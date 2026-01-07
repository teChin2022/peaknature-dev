import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySlip } from '@/lib/easyslip'
import { sendLineMessage, sendEmail, generateBookingNotification, generateGuestConfirmationEmail } from '@/lib/notifications'
import { TenantSettings, defaultTenantSettings } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { format, parseISO } from 'date-fns'
import crypto from 'crypto'
import { reportCriticalErrorServer } from '@/lib/error-handler'
import { apiLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'

// Generate a hash of the slip URL for duplicate detection (fallback if no content hash provided)
function generateSlipHash(slipUrl: string): string {
  return crypto.createHash('sha256').update(slipUrl).digest('hex')
}

// Download image and calculate content hash (for cases when content hash is not provided)
async function calculateImageContentHash(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null
    
    const buffer = await response.arrayBuffer()
    return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex')
  } catch (error) {
    console.error('[verify-slip] Failed to calculate image content hash:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  console.log('[verify-slip] ========== REQUEST RECEIVED ==========')
  let debugStep = 'init'
  try {
    // Rate limiting - 10 requests per minute per IP
    debugStep = 'rate-limit'
    const clientIP = getClientIP(request.headers)
    const { success: rateLimitOk, reset } = await apiLimiter.check(10, `verify-slip:${clientIP}`)
    if (!rateLimitOk) {
      logger.warn('Rate limit exceeded for payment verification', { ip: clientIP })
      return rateLimitResponse(reset)
    }

    debugStep = 'parse-body'
    const body = await request.json()
    const { bookingId, slipUrl, slipContentHash: providedContentHash, expectedAmount, tenantId } = body
    console.log('[verify-slip] Request:', { bookingId, tenantId, hasSlipUrl: !!slipUrl, hasContentHash: !!providedContentHash, expectedAmount })

    if (!bookingId || !slipUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    debugStep = 'create-supabase'
    const supabase = await createClient()
    console.log('[verify-slip] Supabase client created')

    debugStep = 'create-admin-client'
    const adminClient = createAdminClient()
    console.log('[verify-slip] Admin client created')

    // Run auth check, booking fetch, and tenant fetch in parallel for speed
    debugStep = 'fetch-data'
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
    console.log('[verify-slip] Data fetched', { hasUser: !!authResult.data?.user, hasBooking: !!bookingResult.data, hasTenant: !!tenantResult.data })

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

    // Use content hash for duplicate detection (more reliable than URL hash)
    // If client provided content hash, use it; otherwise calculate from image
    debugStep = 'calculate-content-hash'
    let contentHash = providedContentHash
    let hashSource = 'client-provided'
    
    if (!contentHash) {
      console.log('[verify-slip] ⚠️ No content hash provided by client, calculating from image...')
      hashSource = 'server-calculated'
      contentHash = await calculateImageContentHash(slipUrl)
      if (!contentHash) {
        // Fallback to URL hash if content hash calculation fails
        console.log('[verify-slip] ⚠️ Content hash calculation failed, falling back to URL hash (LESS RELIABLE)')
        hashSource = 'url-hash-fallback'
        contentHash = generateSlipHash(slipUrl)
      }
    }
    console.log('[verify-slip] Using content hash:', { 
      hash: contentHash.substring(0, 16) + '...', 
      source: hashSource,
      bookingId 
    })

    // ALWAYS check for duplicate slip by content hash first
    debugStep = 'check-duplicate'
    const { data: existingByHash, error: duplicateCheckError } = await supabase
      .from('verified_slips')
      .select('id, booking_id, verified_at')
      .eq('slip_url_hash', contentHash)
      .maybeSingle()

    if (duplicateCheckError) {
      console.error('[verify-slip] Error checking for duplicates:', duplicateCheckError)
    }

    if (existingByHash) {
      console.log('[verify-slip] 🚫 DUPLICATE DETECTED!', { 
        contentHash: contentHash.substring(0, 16), 
        existingBookingId: existingByHash.booking_id,
        currentBookingId: bookingId,
        verifiedAt: existingByHash.verified_at
      })
      return NextResponse.json({
        success: false,
        error: 'This payment slip has already been used for another booking. Please make a new payment and upload the new slip.'
      })
    }
    console.log('[verify-slip] ✅ No duplicate found, proceeding...', { 
      contentHash: contentHash.substring(0, 16),
      bookingId,
      hashSource
    })

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
    debugStep = 'update-booking'
    const updateData: Record<string, unknown> = {
      status: 'confirmed',
      payment_slip_url: slipUrl
    }

    // Execute DB operations in parallel
    const [updateResult, slipResult, auditResult] = await Promise.all([
      supabase.from('bookings').update(updateData).eq('id', bookingId),
      // Use adminClient to bypass RLS for verified_slips insert
      // Store content hash (not URL hash) for proper duplicate detection
      adminClient.from('verified_slips').insert({
        trans_ref: null,
        slip_url_hash: contentHash, // Now using content hash, not URL hash
        booking_id: bookingId,
        tenant_id: tenantId,
        amount: expectedAmount,
        slip_url: slipUrl,
        easyslip_data: null
      }),
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
      })
    ])
    
    // CHECK: If slip insert failed, this is CRITICAL - rollback booking!
    if (slipResult.error) {
      console.error('[verify-slip] CRITICAL: Failed to store verified slip!', slipResult.error)
      
      // Check if this is a unique constraint violation (duplicate slip)
      const isDuplicateError = slipResult.error.code === '23505' || 
        slipResult.error.message?.includes('unique') ||
        slipResult.error.message?.includes('duplicate') ||
        slipResult.error.message?.includes('unique_slip_url_hash')
      
      // Rollback: Cancel the booking since we can't prevent duplicate slips
      await adminClient.from('bookings').update({ 
        status: 'cancelled', 
        notes: isDuplicateError 
          ? '[System] Duplicate slip detected - booking cancelled' 
          : '[System] Failed to verify slip - please try again' 
      }).eq('id', bookingId)
      
      return NextResponse.json({
        success: false,
        error: isDuplicateError 
          ? 'This payment slip has already been used for another booking. Please make a new payment and upload the new slip.'
          : 'Failed to verify payment. Please try again.'
      }, { status: 500 })
    }
    
    console.log('[verify-slip] Slip stored successfully for duplicate detection', { contentHash: contentHash.substring(0, 16) })
    if (auditResult.error) logger.error('Failed to log payment verification', auditResult.error)

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
    }).then(result => {
      if (result.error) logger.error('Failed to release reservation lock', result.error)
    })

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
    console.log('[verify-slip] ========== RETURNING SUCCESS ==========', { bookingId })
    return NextResponse.json({
      success: true,
      verified: true,
      bookingId,
      paymentRef: null
    })

  } catch (error) {
    console.error('[verify-slip] ERROR at step:', debugStep, error)
    
    // Report critical error to admin via LINE
    await reportCriticalErrorServer(
      'Payment Verification Failed',
      `Step: ${debugStep}, Error: ${String(error)}`,
      `BookingId: ${request.url}`
    ).catch(() => {}) // Don't let error reporting cause another error
    
    return NextResponse.json(
      { success: false, error: `Internal server error at ${debugStep}` },
      { status: 500 }
    )
  }
}

