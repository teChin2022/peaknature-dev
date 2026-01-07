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
    const { data: existingByHash } = await supabase
      .from('verified_slips')
      .select('id, booking_id, verified_at')
      .eq('slip_url_hash', slipUrlHash)
      .maybeSingle()

    if (existingByHash) {
      return NextResponse.json({
        success: false,
        error: 'This payment slip has already been used for another booking. Please make a new payment and upload the new slip.'
      })
    }

    // Check if EasySlip verification is enabled
    const easySlipApiKey = process.env.EASYSLIP_API_KEY
    const shouldVerifyWithEasySlip = settings.payment?.easyslip_enabled && easySlipApiKey

    // LOG: Will verify in background or skip
    if (!shouldVerifyWithEasySlip) {
      logger.info('EasySlip disabled - instant confirmation', { bookingId })
    } else {
      logger.info('EasySlip enabled - will verify in BACKGROUND after response', { bookingId })
    }

    // STEP 1: Confirm booking IMMEDIATELY (no waiting for EasySlip!)
    const updateData: Record<string, unknown> = {
      status: 'confirmed',
      payment_slip_url: slipUrl
    }

    const adminClient = createAdminClient()

    // Execute DB operations in parallel
    const [updateResult] = await Promise.all([
      supabase.from('bookings').update(updateData).eq('id', bookingId),
      // Use adminClient to bypass RLS for verified_slips insert
      adminClient.from('verified_slips').insert({
        trans_ref: null,
        slip_url_hash: slipUrlHash,
        booking_id: bookingId,
        tenant_id: tenantId,
        amount: expectedAmount,
        slip_url: slipUrl,
        easyslip_data: null
      }).catch(err => logger.error('Failed to store verified slip', err)),
      adminClient.from('audit_logs').insert({
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
        details: { amount: expectedAmount, checkIn: booking.check_in, checkOut: booking.check_out },
        success: true
      }).catch(err => logger.error('Failed to log payment verification', err))
    ])

    // Only check the booking update result (critical operation)
    if (updateResult.error) {
      console.error('Failed to update booking:', updateResult.error)
      
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

    // STEP 2: Background EasySlip verification (runs AFTER response sent)
    if (shouldVerifyWithEasySlip) {
      // This runs in background - user doesn't wait!
      const runBackgroundVerification = async () => {
        try {
          logger.info('Starting background EasySlip verification', { bookingId })
          
          const verificationResult = await verifySlip({
            image: slipUrl,
            apiKey: easySlipApiKey!,
            expectedAmount: expectedAmount,
            amountTolerance: 1
          })

          logger.info('EasySlip verification complete', { 
            bookingId, 
            success: verificationResult.success,
            verified: verificationResult.verified 
          })

          // Update verified_slips with result (use adminClient to bypass RLS)
          await adminClient
            .from('verified_slips')
            .update({
              easyslip_data: verificationResult?.data || null,
              trans_ref: verificationResult?.data?.transRef || null
            })
            .eq('booking_id', bookingId)

          // Check for FRAUD
          const isFraud = !verificationResult.success && verificationResult.error?.code &&
            ['NOT_A_SLIP', 'INVALID_IMAGE', 'DUPLICATE_SLIP'].includes(verificationResult.error.code)
          const isAmountMismatch = verificationResult.success && !verificationResult.verified

          if (isFraud || isAmountMismatch) {
            const failReason = isAmountMismatch
              ? `ยอดไม่ตรง: คาดหวัง ${expectedAmount}, ได้รับ ${verificationResult.data?.amount?.amount}`
              : (verificationResult.error?.message || 'สลิปไม่ถูกต้อง')

            logger.warn('FRAUD DETECTED - Auto-cancelling', { bookingId, reason: failReason })

            // Cancel booking (use adminClient to bypass RLS)
            await adminClient
              .from('bookings')
              .update({ status: 'cancelled', notes: `[Auto-cancelled] ${failReason}` })
              .eq('id', bookingId)

            // Notify host via LINE
            if (settings.payment?.line_channel_access_token && settings.payment?.line_user_id) {
              await sendLineMessage({
                channelAccessToken: settings.payment.line_channel_access_token,
                userId: settings.payment.line_user_id,
                message: `🚨 สลิปปลอม - ยกเลิกอัตโนมัติ\n📋 ${bookingId.slice(0,8).toUpperCase()}\n❌ ${failReason}`
              }).catch(err => logger.error('LINE alert failed', err))
            }
          }
        } catch (err) {
          logger.error('Background verification error', err)
        }
      }
      
      // Fire and forget
      runBackgroundVerification()
    }

    // Return success immediately - user doesn't wait for EasySlip!
    return NextResponse.json({
      success: true,
      verified: true,
      bookingId,
      paymentRef: null
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

