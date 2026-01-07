import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { differenceInHours, parseISO, format } from 'date-fns'
import { sendLineMessage, sendEmail, generateBookingCancellationNotification, generateGuestCancellationEmail } from '@/lib/notifications'
import { formatPrice } from '@/lib/currency'
import { TenantSettings, defaultTenantSettings } from '@/types/database'
import { apiLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 5 cancellations per minute per IP
    const clientIP = getClientIP(request.headers)
    const { success: rateLimitOk, reset } = await apiLimiter.check(5, `cancel:${clientIP}`)
    if (!rateLimitOk) {
      logger.warn('Rate limit exceeded for booking cancellation', { ip: clientIP })
      return rateLimitResponse(reset)
    }

    const { bookingId, reason } = await request.json()
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Missing booking ID' }, { status: 400 })
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ success: false, error: 'Cancellation reason is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }
    
    logger.audit('booking_cancel_attempt', { 
      userId: user.id, 
      ip: clientIP, 
      resource: bookingId, 
      success: true 
    })

    // Get booking with room and guest details
    const { data: booking } = await supabase
      .from('bookings')
      .select(`*, room:rooms(*), guest:profiles(*)`)
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Already cancelled' })
    }
    if (booking.status === 'completed') {
      return NextResponse.json({ success: false, error: 'Cannot cancel completed booking' })
    }

    // 24-hour rule: Can only cancel within 24 hours AFTER booking was created
    const bookingCreatedAt = parseISO(booking.created_at)
    const hoursSinceBooking = differenceInHours(new Date(), bookingCreatedAt)
    
    if (hoursSinceBooking > 24) {
      return NextResponse.json({
        success: false,
        error: 'Cancellation period has expired. Please contact the property.'
      })
    }

    // Cancel booking - include user_id check for defense in depth
    const { error, count } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', user.id)  // SECURITY: Ensure user owns this booking

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to cancel' })
    }
    
    // Verify a row was actually updated
    if (count === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found or not authorized' }, { status: 403 })
    }

    // Log booking cancellation to audit log
    try {
      const adminClient = createAdminClient()
      await adminClient.from('audit_logs').insert({
        action: 'booking.cancel',
        category: 'user',
        severity: 'info',
        actor_id: user.id,
        actor_email: user.email,
        actor_role: 'guest',
        actor_ip: clientIP,
        target_type: 'booking',
        target_id: bookingId,
        target_name: booking.room?.name || 'Room',
        tenant_id: booking.tenant_id,
        details: { 
          reason, 
          checkIn: booking.check_in, 
          checkOut: booking.check_out,
          totalPrice: booking.total_price
        },
        success: true
      })
    } catch (auditError) {
      logger.error('Failed to log booking cancellation', auditError)
    }

    // Release any reservation lock for these dates
    try {
      await supabase
        .from('reservation_locks')
        .delete()
        .eq('room_id', booking.room_id)
        .eq('user_id', user.id)
        .eq('check_in', booking.check_in)
        .eq('check_out', booking.check_out)
    } catch {
      // Ignore lock release errors - lock may not exist
    }

    // Get tenant settings for notifications
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', booking.tenant_id)
      .single()

    if (tenant) {
      const settings: TenantSettings = { ...defaultTenantSettings, ...(tenant.settings || {}) }
      const currency = settings.currency || 'USD'
      
      // Prepare notification content
      // Get guest name with multiple fallbacks for better display
      const guestName = 
        booking.guest?.full_name || 
        user.user_metadata?.full_name || 
        user.user_metadata?.name || 
        booking.guest?.email?.split('@')[0] || // Use email prefix as last resort
        'Guest'
      const guestEmail = booking.guest?.email || 'N/A'
      const guestPhone = booking.guest?.phone || 'N/A'
      const roomName = booking.room?.name || 'Room'
      const checkIn = format(parseISO(booking.check_in), 'MMM d, yyyy')
      const checkOut = format(parseISO(booking.check_out), 'MMM d, yyyy')
      const refundAmount = formatPrice(booking.total_price, currency)
      const bookingRef = bookingId.slice(0, 8).toUpperCase()

      // Generate host cancellation notification with i18n and tenant branding
      const hostNotification = await generateBookingCancellationNotification({
        guestName,
        guestEmail,
        guestPhone,
        roomName,
        checkIn,
        checkOut,
        refundAmount,
        bookingRef,
        reason,
        primaryColor: tenant.primary_color,
        language: 'th', // Default to Thai for host notifications
        tenantName: tenant.name,
      })

      // Send LINE notification
      if (settings.payment?.line_channel_access_token && settings.payment?.line_user_id) {
        try {
          await sendLineMessage({
            channelAccessToken: settings.payment.line_channel_access_token,
            userId: settings.payment.line_user_id,
            message: hostNotification.lineMessage
          })
        } catch (e) { console.error('LINE notification error:', e) }
      }

      // Send email notification to host
      if (settings.contact?.email) {
        try {
          await sendEmail({
            to: settings.contact.email,
            subject: hostNotification.emailSubject,
            html: hostNotification.emailHtml,
            fromName: tenant.name,
          })
        } catch (e) { console.error('Host email notification error:', e) }
      }

      // Send cancellation confirmation email to guest
      if (guestEmail && guestEmail !== 'N/A') {
        try {
          const guestNotification = await generateGuestCancellationEmail({
            guestName,
            roomName,
            checkIn,
            checkOut,
            refundAmount,
            bookingRef,
            reason,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            primaryColor: tenant.primary_color,
            language: 'th', // Default to Thai for guest notifications
          })

          await sendEmail({
            to: guestEmail,
            subject: guestNotification.emailSubject,
            html: guestNotification.emailHtml,
            fromName: tenant.name,
            replyTo: settings.contact?.email,
          })
        } catch (e) { console.error('Guest email notification error:', e) }
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

