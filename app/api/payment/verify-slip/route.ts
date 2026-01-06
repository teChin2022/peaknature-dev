import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySlip, getEasySlipErrorMessage } from '@/lib/easyslip'
import { sendLineMessage, sendEmail, generateBookingNotification, generateGuestConfirmationEmail } from '@/lib/notifications'
import { TenantSettings, defaultTenantSettings } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { format, parseISO, differenceInHours } from 'date-fns'
import crypto from 'crypto'
import { reportCriticalErrorServer } from '@/lib/error-handler'
import { apiLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'

// Generate a hash of the slip URL for duplicate detection
function generateSlipHash(slipUrl: string): string {
  return crypto.createHash('sha256').update(slipUrl).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 10 requests per minute per IP
    const clientIP = getClientIP(request.headers)
    const { success: rateLimitOk, reset } = await apiLimiter.check(10, `verify-slip:${clientIP}`)
    if (!rateLimitOk) {
      logger.warn('Rate limit exceeded for payment verification', { ip: clientIP })
      return rateLimitResponse(reset)
    }

    const body = await request.json()
    const { bookingId, slipUrl, expectedAmount, tenantId } = body

    if (!bookingId || !slipUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Run auth check, booking fetch, and tenant fetch in parallel for speed
    const [authResult, bookingResult, tenantResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('bookings')
        .select(`*, room:rooms(*), user:profiles(*)`)
        .eq('id', bookingId)
        .single(),
      supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single()
    ])

    const user = authResult.data?.user
    const booking = bookingResult.data
    const tenant = tenantResult.data

    // Verify user is authenticated
    if (!user) {
      logger.audit('payment_verification_unauthorized', { 
        ip: clientIP, 
        resource: bookingId, 
        success: false 
      })
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check booking exists
    if (bookingResult.error || !booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify user owns this booking
    if (booking.user_id !== user.id) {
      logger.audit('payment_verification_forbidden', { 
        userId: user.id, 
        ip: clientIP, 
        resource: bookingId, 
        success: false,
        details: 'User does not own this booking'
      })
      return NextResponse.json(
        { success: false, error: 'You are not authorized to verify this booking' },
        { status: 403 }
      )
    }

    // Check tenant exists
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }

    const settings: TenantSettings = {
      ...defaultTenantSettings,
      ...(tenant.settings as TenantSettings || {})
    }

    // Generate slip URL hash for duplicate detection
    const slipUrlHash = generateSlipHash(slipUrl)

    // ALWAYS check for duplicate slip by URL hash first
    const { data: existingByHash, error: hashCheckError } = await supabase
      .from('verified_slips')
      .select('id, booking_id, verified_at')
      .eq('slip_url_hash', slipUrlHash)
      .single()

    if (!hashCheckError && existingByHash) {
      return NextResponse.json({
        success: false,
        error: 'This payment slip has already been used for another booking. Please make a new payment and upload the new slip.'
      })
    }

    // Verify with EasySlip if enabled
    let verificationResult = null
    const easySlipApiKey = process.env.EASYSLIP_API_KEY

    if (settings.payment?.easyslip_enabled && easySlipApiKey) {
      verificationResult = await verifySlip({
        image: slipUrl,
        apiKey: easySlipApiKey,
        expectedAmount: expectedAmount,
        amountTolerance: 1 // Allow 1 THB tolerance
      })

      if (!verificationResult.success) {
        return NextResponse.json({
          success: false,
          error: verificationResult.error 
            ? getEasySlipErrorMessage(verificationResult.error.code)
            : 'Failed to verify payment slip'
        })
      }

      if (!verificationResult.verified) {
        const actualAmount = verificationResult.data?.amount.amount
        return NextResponse.json({
          success: false,
          error: `Amount mismatch. Expected: ${expectedAmount}, Received: ${actualAmount}`
        })
      }

      // Check for duplicate slip (prevent reuse)
      if (verificationResult.data?.transRef) {
        const transRef = verificationResult.data.transRef
        
        // Check if this transaction reference has been used before
        const { data: existingSlip } = await supabase
          .from('verified_slips')
          .select('id, booking_id, verified_at')
          .eq('trans_ref', transRef)
          .single()

        if (existingSlip) {
          return NextResponse.json({
            success: false,
            error: 'This payment slip has already been used. Please make a new payment and upload the new slip.'
          })
        }

        // Check payment date - must be within last 24 hours
        if (verificationResult.data.date) {
          const paymentDate = parseISO(verificationResult.data.date)
          const hoursAgo = differenceInHours(new Date(), paymentDate)
          
          if (hoursAgo > 24) {
            return NextResponse.json({
              success: false,
              error: 'This payment slip is too old. Please make a new payment (within 24 hours) and upload the new slip.'
            })
          }
        }
      }
    }

    // Update booking status - only use columns that definitely exist
    const updateData: Record<string, unknown> = {
      status: 'confirmed',
      payment_slip_url: slipUrl
    }

    // Try to update with additional fields if they exist
    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)

    if (updateError) {
      console.error('Failed to update booking:', updateError)
      
      // If update fails, try with just status
      const { error: fallbackError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId)
      
      if (fallbackError) {
        console.error('Fallback update also failed:', fallbackError)
        return NextResponse.json({
          success: false,
          error: 'Failed to confirm booking: ' + fallbackError.message
        })
      }
    }

    // Store verified slip to prevent reuse (ALWAYS store, not just when EasySlip is used)
    try {
      await supabase.from('verified_slips').insert({
        trans_ref: verificationResult?.data?.transRef || null,
        slip_url_hash: slipUrlHash,
        booking_id: bookingId,
        tenant_id: tenantId,
        amount: verificationResult?.data?.amount?.amount || expectedAmount,
        slip_url: slipUrl,
        easyslip_data: verificationResult?.data || null
      })
    } catch (storeError) {
      // Log but don't fail - the booking is already confirmed
      logger.error('Failed to store verified slip', storeError)
    }

    // Log payment verification to audit log
    try {
      const adminClient = createAdminClient()
      await adminClient.from('audit_logs').insert({
        action: 'payment.verify',
        category: 'user',
        severity: 'info',
        actor_id: user.id,
        actor_email: user.email,
        actor_role: 'guest',
        actor_ip: clientIP,
        target_type: 'booking',
        target_id: bookingId,
        target_name: booking.room?.name || 'Room',
        tenant_id: tenantId,
        details: { 
          amount: expectedAmount,
          checkIn: booking.check_in, 
          checkOut: booking.check_out
        },
        success: true
      })
    } catch (auditError) {
      logger.error('Failed to log payment verification', auditError)
    }

    // Release the reservation lock (fire and forget - don't block response)
    supabase.rpc('release_reservation_lock', {
      p_room_id: booking.room_id,
      p_user_id: user.id,
      p_check_in: booking.check_in,
      p_check_out: booking.check_out
    }).catch(err => logger.error('Failed to release reservation lock', err))

    // Send notifications in background (don't block the response)
    // This significantly speeds up the response time for the user
    const sendNotificationsAsync = async () => {
      try {
        const currency = settings.currency || 'USD'
        const guestName = booking.user?.full_name || booking.user?.email || 'Guest'
        const roomName = booking.room?.name || 'Room'
        const checkIn = format(parseISO(booking.check_in), 'MMM d, yyyy')
        const checkOut = format(parseISO(booking.check_out), 'MMM d, yyyy')
        const totalPrice = formatPrice(booking.total_price, currency)
        const bookingRef = bookingId.slice(0, 8).toUpperCase()

        const notifications = generateBookingNotification({
          guestName,
          roomName,
          checkIn,
          checkOut,
          guests: booking.guests,
          totalPrice,
          bookingRef,
          notes: booking.notes,
        })

        // Send all notifications in parallel
        const notificationPromises: Promise<void>[] = []

        // LINE message
        if (settings.payment?.line_channel_access_token && settings.payment?.line_user_id) {
          notificationPromises.push(
            sendLineMessage({
              channelAccessToken: settings.payment.line_channel_access_token,
              userId: settings.payment.line_user_id,
              message: notifications.lineMessage
            }).then(() => {
              supabase.from('notification_queue').insert({
                tenant_id: tenantId,
                booking_id: bookingId,
                type: 'line',
                recipient: settings.payment!.line_user_id,
                message: notifications.lineMessage,
                status: 'sent',
                sent_at: new Date().toISOString()
              })
            }).catch(err => console.error('LINE notification error:', err))
          )
        }

        // Email to host
        if (settings.contact?.email) {
          notificationPromises.push(
            sendEmail({
              to: settings.contact.email,
              subject: notifications.emailSubject,
              html: notifications.emailHtml,
              fromName: tenant.name,
            }).then(() => {
              supabase.from('notification_queue').insert({
                tenant_id: tenantId,
                booking_id: bookingId,
                type: 'email',
                recipient: settings.contact!.email!,
                subject: notifications.emailSubject,
                message: notifications.emailHtml,
                status: 'sent',
                sent_at: new Date().toISOString()
              })
            }).catch(err => console.error('Email notification error:', err))
          )
        }

        // Email to guest
        const guestEmail = booking.user?.email
        if (guestEmail) {
          const guestNotification = generateGuestConfirmationEmail({
            guestName,
            roomName,
            checkIn,
            checkOut,
            guests: booking.guests,
            totalPrice,
            bookingRef,
            checkInTime: booking.room?.check_in_time || '14:00',
            checkOutTime: booking.room?.check_out_time || '12:00',
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            primaryColor: tenant.primary_color,
            notes: booking.notes,
          })

          notificationPromises.push(
            sendEmail({
              to: guestEmail,
              subject: guestNotification.emailSubject,
              html: guestNotification.emailHtml,
              fromName: tenant.name,
              replyTo: settings.contact?.email,
            }).then(() => {
              supabase.from('notification_queue').insert({
                tenant_id: tenantId,
                booking_id: bookingId,
                type: 'email',
                recipient: guestEmail,
                subject: guestNotification.emailSubject,
                message: guestNotification.emailHtml,
                status: 'sent',
                sent_at: new Date().toISOString()
              })
            }).catch(err => console.error('Guest email notification error:', err))
          )
        }

        // Execute all notifications in parallel
        await Promise.allSettled(notificationPromises)
      } catch (error) {
        console.error('Notification error:', error)
      }
    }

    // Fire and forget - don't await
    sendNotificationsAsync()

    // Return success immediately - user doesn't need to wait for notifications
    return NextResponse.json({
      success: true,
      verified: true,
      bookingId,
      paymentRef: verificationResult?.data?.transRef || null
    })

  } catch (error) {
    console.error('Payment verification error:', error)
    
    // Report critical error to admin via LINE
    await reportCriticalErrorServer(
      'Payment Verification Failed',
      String(error),
      `BookingId: ${request.url}`
    )
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

