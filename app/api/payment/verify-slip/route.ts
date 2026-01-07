import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySlip } from '@/lib/easyslip'
import { sendLineMessage, sendEmail, generateBookingNotification, generateGuestConfirmationEmail } from '@/lib/notifications'
import { sendAdminLineNotification } from '@/lib/line-notify'
import { getTranslations } from '@/lib/i18n-server'
import { Locale } from '@/lib/i18n'
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

    // Deep merge settings with defaults (especially for nested payment object)
    const tenantSettings = tenant.settings as TenantSettings || {}
    const settings: TenantSettings = {
      ...defaultTenantSettings,
      ...tenantSettings,
      // Deep merge payment settings
      payment: {
        ...defaultTenantSettings.payment,
        ...(tenantSettings.payment || {})
      }
    }
    
    // Debug: Log what settings we're using
    console.log('[verify-slip] Tenant settings:', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      easyslip_enabled: settings.payment?.easyslip_enabled,
      hasApiKey: !!process.env.EASYSLIP_API_KEY,
      rawPaymentSettings: tenantSettings.payment
    })

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

    // LOG: Will verify in background or skip - with detailed reason
    if (!shouldVerifyWithEasySlip) {
      const reason = !easySlipApiKey 
        ? 'EASYSLIP_API_KEY not set in environment' 
        : !settings.payment?.easyslip_enabled 
          ? 'easyslip_enabled is false in tenant settings'
          : 'unknown'
      console.log('[verify-slip] ⚠️ EasySlip DISABLED - instant confirmation', { 
        bookingId, 
        reason,
        hasApiKey: !!easySlipApiKey,
        tenantEasyslipEnabled: settings.payment?.easyslip_enabled 
      })
      logger.info('EasySlip disabled - instant confirmation', { bookingId, reason })
    } else {
      console.log('[verify-slip] ✅ EasySlip ENABLED - will verify in background', { bookingId })
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

    // Use Next.js after() to run notifications after response is sent
    // This ensures the function stays alive until notifications complete
    after(async () => {
      console.log('[verify-slip] 📧 Running notifications in after()...')
      await sendNotificationsAsync()
      console.log('[verify-slip] 📧 Notifications completed')
    })

    // STEP 2: Background EasySlip verification (runs AFTER response sent)
    if (shouldVerifyWithEasySlip) {
      console.log('[verify-slip] 🚀 Starting background EasySlip verification...', { 
        bookingId, 
        slipUrl: slipUrl.substring(0, 50) + '...',
        expectedAmount 
      })
      
      // This runs in background - user doesn't wait!
      const runBackgroundVerification = async () => {
        try {
          console.log('[verify-slip] 📡 Calling EasySlip API...', { bookingId })
          logger.info('Starting background EasySlip verification', { bookingId })
          
          const verificationResult = await verifySlip({
            image: slipUrl,
            apiKey: easySlipApiKey!,
            expectedAmount: expectedAmount,
            amountTolerance: 1
          })
          
          console.log('[verify-slip] 📡 EasySlip API response:', { 
            bookingId, 
            success: verificationResult.success,
            verified: verificationResult.verified,
            error: verificationResult.error,
            hasData: !!verificationResult.data
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

          // ============ COMPREHENSIVE FRAUD DETECTION ============
          const fraudReasons: string[] = []
          const slipData = verificationResult.data
          
          // Load translations for host notifications (use tenant's language or default to Thai)
          const tenantLocale: Locale = (settings.language as Locale) || 'th'
          const t = await getTranslations(tenantLocale)
          const tEn = await getTranslations('en') // Admin always gets English
          
          // 1. Check if EasySlip API returned an error (fake slip, invalid, duplicate, or API issues)
          if (!verificationResult.success && verificationResult.error?.code) {
            const errorCode = verificationResult.error.code
            const errorMessage = verificationResult.error.message
            
            // Categorize error types
            // Fraud errors = slip is fake/invalid (should cancel booking)
            const fraudErrorCodes = [
              'slip_not_found',      // Transaction not found in BOT (FAKE!)
              'duplicate_slip',      // Already verified in EasySlip
              'invalid_image',       // Not a valid image
              'invalid_payload',     // Corrupted/modified slip
              'qrcode_not_found'     // QR code is invalid
            ]
            
            // System errors = API issues (should NOT cancel, just notify)
            const systemErrorCodes = [
              'TIMEOUT',             // Request timeout
              'NETWORK_ERROR',       // Network issue
              'unauthorized',        // API key invalid
              'quota_exceeded',      // API quota exceeded
              'server_error',        // EasySlip server error
              'api_server_error',    // EasySlip API error
              'access_denied',       // Account access denied
              'account_not_verified',// Account not verified
              'application_expired', // Application expired
              'application_deactivated' // Application deactivated
            ]
            
            const isFraudError = fraudErrorCodes.includes(errorCode)
            const isSystemError = systemErrorCodes.includes(errorCode)
            
            // Log ALL EasySlip errors to audit log for admin review
            await adminClient.from('audit_logs').insert({
              action: isFraudError ? 'easyslip.fraud_error' : 'easyslip.system_error',
              category: 'security',
              severity: isFraudError ? 'high' : 'medium',
              actor_id: user.id,
              actor_email: user.email,
              actor_role: 'guest',
              actor_ip: clientIP,
              target_type: 'booking',
              target_id: bookingId,
              tenant_id: tenantId,
              details: { 
                easyslip_error_code: errorCode,
                easyslip_error_message: errorMessage,
                error_type: isFraudError ? 'fraud' : isSystemError ? 'system' : 'unknown',
                slip_url: slipUrl,
                expected_amount: expectedAmount
              },
              success: false
            }).catch(err => logger.error('Failed to log EasySlip error', err))
            
            if (isFraudError) {
              // Use translated error message if available
              const translatedError = t.slipVerification?.easyslipErrors?.[errorCode as keyof typeof t.slipVerification.easyslipErrors] || errorMessage
              fraudReasons.push(t.slipVerification?.fraudReasons?.invalidSlip?.replace('{message}', translatedError) || `Invalid slip: ${errorMessage}`)
            } else {
              // For system errors, notify admin but DON'T cancel booking (manual review needed)
              console.log('[verify-slip] ⚠️ EasySlip system error - manual review needed', { errorCode, errorMessage })
              
              const guestName = booking.user?.full_name || booking.user?.email || 'Unknown'
              const roomName = booking.room?.name || 'Unknown Room'
              const bookingCode = bookingId.slice(0, 8).toUpperCase()
              const translatedError = t.slipVerification?.easyslipErrors?.[errorCode as keyof typeof t.slipVerification.easyslipErrors] || errorMessage
              
              // Notify host about system error (use tenant's language)
              if (settings.payment?.line_channel_access_token && settings.payment?.line_user_id) {
                const sysErr = t.slipVerification?.systemErrors || {}
                const hostErrorMsg = [
                  sysErr.title || '⚠️ EasySlip Verification Failed - Manual Review Needed',
                  (sysErr.bookingCode || '📋 Code: {code}').replace('{code}', bookingCode),
                  (sysErr.guest || '👤 Guest: {name}').replace('{name}', guestName),
                  (sysErr.room || '🏠 Room: {name}').replace('{name}', roomName),
                  (sysErr.amount || '💰 Amount: {amount} THB').replace('{amount}', String(expectedAmount)),
                  '',
                  (sysErr.error || '❌ Error: {message}').replace('{message}', translatedError),
                  '',
                  sysErr.manualReview || '📌 Please review the slip manually.',
                  sysErr.statusRemains || '   Booking status remains "confirmed".'
                ].join('\n')
                
                await sendLineMessage({
                  channelAccessToken: settings.payment.line_channel_access_token,
                  userId: settings.payment.line_user_id,
                  message: hostErrorMsg
                }).catch(err => logger.error('LINE system error alert to host failed', err))
              }
              
              // Notify admin about system error (always English)
              const adminSysErr = tEn.slipVerification?.systemErrors || {}
              const adminErrorMsg = [
                '⚠️ EASYSLIP SYSTEM ERROR',
                '',
                `🏠 Tenant: ${tenant.name} (${tenant.slug})`,
                (adminSysErr.bookingCode || '📋 Code: {code}').replace('{code}', bookingCode),
                (adminSysErr.guest || '👤 Guest: {name}').replace('{name}', guestName),
                `📧 Email: ${booking.user?.email || 'N/A'}`,
                (adminSysErr.amount || '💰 Amount: {amount} THB').replace('{amount}', String(expectedAmount)),
                '',
                `❌ Error Code: ${errorCode}`,
                `❌ Error: ${errorMessage}`,
                '',
                adminSysErr.manualReview || '📌 Manual review required.',
                adminSysErr.statusRemains || '   Booking status remains "confirmed".'
              ].join('\n')
              
              await sendAdminLineNotification(adminErrorMsg)
                .catch(err => logger.error('LINE system error alert to admin failed', err))
            }
          }
          
          // 2. Check amount matching
          if (verificationResult.success && !verificationResult.verified && verificationResult.validation) {
            const amountMsg = t.slipVerification?.fraudReasons?.amountMismatch
              ?.replace('{expected}', String(verificationResult.validation.expectedAmount))
              ?.replace('{actual}', String(verificationResult.validation.actualAmount))
              || `Amount mismatch: expected ${verificationResult.validation.expectedAmount}, received ${verificationResult.validation.actualAmount}`
            fraudReasons.push(amountMsg)
          }
          
          // 3. Check receiver account matches tenant's PromptPay (if data available)
          if (slipData && settings.payment?.promptpay_id) {
            const tenantPromptPay = settings.payment.promptpay_id.replace(/-/g, '').trim()
            const receiverProxy = slipData.receiver?.account?.proxy?.account?.replace(/-/g, '').trim()
            const receiverBank = slipData.receiver?.account?.bank?.account?.replace(/-/g, '').trim()
            
            // Check if money went to the right account
            const matchesProxy = receiverProxy && receiverProxy.includes(tenantPromptPay.slice(-4))
            const matchesBank = receiverBank && receiverBank.includes(tenantPromptPay.slice(-4))
            
            if (!matchesProxy && !matchesBank) {
              // Only flag if we have receiver info but it doesn't match
              if (receiverProxy || receiverBank) {
                console.log('[verify-slip] ⚠️ Receiver mismatch:', {
                  tenantPromptPay: tenantPromptPay.slice(-4),
                  receiverProxy: receiverProxy?.slice(-4),
                  receiverBank: receiverBank?.slice(-4)
                })
                fraudReasons.push(t.slipVerification?.fraudReasons?.receiverMismatch || 'Recipient account mismatch')
              }
            }
          }
          
          // 4. Check for self-transfer (sender = receiver)
          if (slipData) {
            const senderAccount = slipData.sender?.account?.bank?.account || slipData.sender?.account?.proxy?.account
            const receiverAccount = slipData.receiver?.account?.bank?.account || slipData.receiver?.account?.proxy?.account
            
            if (senderAccount && receiverAccount && senderAccount === receiverAccount) {
              fraudReasons.push(t.slipVerification?.fraudReasons?.selfTransfer || 'Self-transfer detected')
            }
          }
          
          // 5. Check slip date is recent (within 7 days)
          if (slipData?.date) {
            try {
              const slipDate = new Date(slipData.date)
              const now = new Date()
              const daysDiff = Math.floor((now.getTime() - slipDate.getTime()) / (1000 * 60 * 60 * 24))
              
              if (daysDiff > 7) {
                const oldSlipMsg = t.slipVerification?.fraudReasons?.oldSlip?.replace('{days}', String(daysDiff)) || `Slip too old (${daysDiff} days)`
                fraudReasons.push(oldSlipMsg)
              } else if (daysDiff < 0) {
                fraudReasons.push(t.slipVerification?.fraudReasons?.futureDate || 'Slip date is in the future')
              }
            } catch {
              console.log('[verify-slip] Could not parse slip date:', slipData.date)
            }
          }
          
          // ============ HANDLE FRAUD DETECTION ============
          if (fraudReasons.length > 0) {
            const failReason = fraudReasons.join(', ')
            
            console.log('[verify-slip] 🚨 FRAUD DETECTED!', { bookingId, reasons: fraudReasons })
            logger.warn('FRAUD DETECTED - Auto-cancelling', { bookingId, reasons: fraudReasons })

            // Cancel booking (use adminClient to bypass RLS)
            const cancelNote = tenantLocale === 'th' ? '[ยกเลิกอัตโนมัติ]' : '[Auto-cancelled]'
            await adminClient
              .from('bookings')
              .update({ 
                status: 'cancelled', 
                notes: `${cancelNote} ${failReason}` 
              })
              .eq('id', bookingId)

            // Prepare alert message using translations
            const guestName = booking.user?.full_name || booking.user?.email || 'Unknown'
            const roomName = booking.room?.name || 'Unknown Room'
            const bookingCode = bookingId.slice(0, 8).toUpperCase()
            
            // Host message (use tenant's language)
            const hostAlerts = t.slipVerification?.alerts || {}
            const hostAlertMessage = [
              hostAlerts.fraudDetected || '🚨 Suspicious Slip Detected - Auto-Cancelled',
              (hostAlerts.bookingCode || '📋 Code: {code}').replace('{code}', bookingCode),
              (hostAlerts.guest || '👤 Guest: {name}').replace('{name}', guestName),
              (hostAlerts.room || '🏠 Room: {name}').replace('{name}', roomName),
              (hostAlerts.amount || '💰 Amount: {amount} THB').replace('{amount}', String(expectedAmount)),
              '',
              hostAlerts.reasons || '❌ Reasons:',
              ...fraudReasons.map(r => `  • ${r}`),
              '',
              slipData?.transRef ? (hostAlerts.transRef || '🔖 Ref: {ref}').replace('{ref}', slipData.transRef) : '',
              slipData?.date ? (hostAlerts.slipDate || '📅 Slip Date: {date}').replace('{date}', slipData.date) : '',
              '',
              hostAlerts.autoCancelled || '⚠️ Booking has been auto-cancelled'
            ].filter(Boolean).join('\n')

            // Notify host/tenant via LINE
            if (settings.payment?.line_channel_access_token && settings.payment?.line_user_id) {
              await sendLineMessage({
                channelAccessToken: settings.payment.line_channel_access_token,
                userId: settings.payment.line_user_id,
                message: hostAlertMessage
              }).catch(err => logger.error('LINE alert to host failed', err))
            }
            
            // Admin message (always English)
            const adminAlerts = tEn.slipVerification?.adminAlerts || {}
            const adminAlertMessage = [
              adminAlerts.fraudAlert || '🚨 FRAUD ALERT - Payment Slip Issue',
              '',
              (adminAlerts.tenant || '🏠 Tenant: {name} ({slug})').replace('{name}', tenant.name).replace('{slug}', tenant.slug),
              (adminAlerts.booking || '📋 Booking: {code}').replace('{code}', bookingCode),
              (adminAlerts.guest || '👤 Guest: {name}').replace('{name}', guestName),
              (adminAlerts.email || '📧 Email: {email}').replace('{email}', booking.user?.email || 'N/A'),
              (adminAlerts.room || '🏠 Room: {name}').replace('{name}', roomName),
              (adminAlerts.amount || '💰 Amount: {amount} THB').replace('{amount}', String(expectedAmount)),
              '',
              adminAlerts.fraudReasons || '❌ Fraud Reasons:',
              ...fraudReasons.map(r => `  • ${r}`),
              '',
              slipData?.transRef ? (adminAlerts.transRef || '🔖 Trans Ref: {ref}').replace('{ref}', slipData.transRef) : '',
              slipData?.sender?.bank?.short ? (adminAlerts.senderBank || '🏦 Sender Bank: {bank}').replace('{bank}', slipData.sender.bank.short) : '',
              slipData?.receiver?.bank?.short ? (adminAlerts.receiverBank || '🏦 Receiver Bank: {bank}').replace('{bank}', slipData.receiver.bank.short) : '',
              '',
              adminAlerts.autoCancelled || '⚠️ Booking has been auto-cancelled.'
            ].filter(Boolean).join('\n')
            
            await sendAdminLineNotification(adminAlertMessage)
              .catch(err => logger.error('LINE alert to admin failed', err))
            
            // Log to audit
            await adminClient.from('audit_logs').insert({
              action: 'payment.fraud_detected',
              category: 'security',
              severity: 'high',
              actor_id: user.id,
              actor_email: user.email,
              actor_role: 'guest',
              actor_ip: clientIP,
              target_type: 'booking',
              target_id: bookingId,
              tenant_id: tenantId,
              details: { 
                reasons: fraudReasons, 
                slipTransRef: slipData?.transRef,
                slipAmount: slipData?.amount?.amount,
                slipDate: slipData?.date,
                senderBank: slipData?.sender?.bank?.short,
                receiverBank: slipData?.receiver?.bank?.short,
                expectedAmount,
                guestEmail: booking.user?.email,
                tenantName: tenant.name
              },
              success: false
            }).catch(err => logger.error('Failed to log fraud detection', err))
          } else if (verificationResult.success && verificationResult.verified) {
            // EasySlip verification successful AND amount matches
            await adminClient.from('audit_logs').insert({
              action: 'easyslip.verified',
              category: 'user',
              severity: 'info',
              actor_id: user.id,
              actor_email: user.email,
              actor_role: 'guest',
              actor_ip: clientIP,
              target_type: 'booking',
              target_id: bookingId,
              tenant_id: tenantId,
              details: { 
                transRef: slipData?.transRef,
                amount: slipData?.amount?.amount,
                expectedAmount,
                senderBank: slipData?.sender?.bank?.short,
                receiverBank: slipData?.receiver?.bank?.short,
                slipDate: slipData?.date,
                verificationStatus: 'passed'
              },
              success: true
            }).catch(err => logger.error('Failed to log EasySlip success', err))
            
            console.log('[verify-slip] ✅ Slip passed all fraud checks', { 
              bookingId,
              transRef: slipData?.transRef,
              amount: slipData?.amount?.amount
            })
          } else if (!verificationResult.success) {
            // EasySlip verification failed but no specific fraud detected
            // (This handles edge cases like unexpected API responses)
            console.log('[verify-slip] ⚠️ EasySlip verification failed (unhandled case)', {
              bookingId,
              success: verificationResult.success,
              verified: verificationResult.verified,
              error: verificationResult.error
            })
            
            await adminClient.from('audit_logs').insert({
              action: 'easyslip.verification_failed',
              category: 'security',
              severity: 'medium',
              actor_id: user.id,
              actor_email: user.email,
              actor_role: 'guest',
              actor_ip: clientIP,
              target_type: 'booking',
              target_id: bookingId,
              tenant_id: tenantId,
              details: { 
                error: verificationResult.error,
                expected_amount: expectedAmount,
                slip_url: slipUrl,
                verificationStatus: 'failed_unknown'
              },
              success: false
            }).catch(err => logger.error('Failed to log EasySlip failure', err))
          }
        } catch (err) {
          console.error('[verify-slip] ❌ Background verification error:', err)
          logger.error('Background verification error', err)
        }
      }
      
      // Use Next.js after() to ensure EasySlip verification completes
      // This keeps the serverless function alive until verification is done
      after(async () => {
        console.log('[verify-slip] 🔥 Running EasySlip verification in after()...')
        await runBackgroundVerification()
        console.log('[verify-slip] ✅ EasySlip verification completed in after()')
      })
    } else {
      console.log('[verify-slip] ⏭️ Skipping EasySlip verification (not enabled or no API key)')
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

