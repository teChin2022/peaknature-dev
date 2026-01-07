/**
 * Notification Service
 * 
 * Handles sending notifications via Email and LINE Messaging API
 */

import { removeTrailingSlash } from './utils'

// LINE Messaging API endpoint
const LINE_MESSAGING_API = 'https://api.line.me/v2/bot/message/push'

/**
 * Get the app base URL (server-side), ensuring no trailing slash
 */
function getServerBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
  return removeTrailingSlash(url)
}

export interface LineMessageOptions {
  channelAccessToken: string
  userId: string
  message: string
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  fromName?: string
  replyTo?: string
}

export interface NotificationResult {
  success: boolean
  error?: string
}

/**
 * Send LINE message using Messaging API
 * 
 * @param options - LINE Messaging API options
 * @returns Notification result
 */
export async function sendLineMessage(options: LineMessageOptions): Promise<NotificationResult> {
  const { channelAccessToken, userId, message } = options

  if (!channelAccessToken || !userId) {
    console.warn('LINE Messaging not configured (missing channelAccessToken or userId)')
    return { success: false, error: 'LINE not configured' }
  }

  try {
    const response = await fetch(LINE_MESSAGING_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('LINE Messaging API error:', error)
      return {
        success: false,
        error: `LINE message failed: ${error.message || response.status}`
      }
    }

    return { success: true }

  } catch (error) {
    console.error('LINE Messaging API error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send LINE message'
    }
  }
}

/**
 * Send LINE Flex Message (rich message) using Messaging API
 * 
 * @param options - LINE Messaging API options with flex content
 * @returns Notification result
 */
export async function sendLineFlexMessage(options: {
  channelAccessToken: string
  userId: string
  altText: string
  contents: object
}): Promise<NotificationResult> {
  const { channelAccessToken, userId, altText, contents } = options

  if (!channelAccessToken || !userId) {
    console.warn('LINE Messaging not configured')
    return { success: false, error: 'LINE not configured' }
  }

  try {
    const response = await fetch(LINE_MESSAGING_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'flex',
            altText,
            contents
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('LINE Flex Message error:', error)
      return {
        success: false,
        error: `LINE flex message failed: ${error.message || response.status}`
      }
    }

    return { success: true }

  } catch (error) {
    console.error('LINE Flex Message error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send LINE flex message'
    }
  }
}

/**
 * Send email notification using Resend API (or other provider)
 * 
 * Note: You'll need to set up an email service like Resend, SendGrid, etc.
 * For now, this uses a simple fetch to a webhook or the built-in Supabase Edge Function
 */
export async function sendEmail(options: EmailOptions): Promise<NotificationResult> {
  const { to, subject, html, text, fromName, replyTo } = options

  // Check if email API key is configured
  const resendApiKey = process.env.RESEND_API_KEY
  
  if (!resendApiKey) {
    console.warn('Email service not configured (RESEND_API_KEY missing)')
    // Log the email for development
    console.log('Email would be sent:', { to, subject, fromName, replyTo })
    return { success: true } // Return success in dev mode
  }

  // Build the FROM address
  // Use platform email if configured, otherwise use Resend's free test email
  // Note: For production, set EMAIL_FROM to a verified domain email (e.g., noreply@yourdomain.com)
  // Resend's test email (onboarding@resend.dev) works for development without domain verification
  const platformEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const fromAddress = fromName 
    ? `${fromName} <${platformEmail}>`
    : `Peaksnature <${platformEmail}>`

  try {
    const emailPayload: Record<string, unknown> = {
      from: fromAddress,
      to: [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for plain text
    }

    // Add reply-to so guest replies go to tenant
    if (replyTo) {
      emailPayload.reply_to = replyTo
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Email send error:', error)
      return {
        success: false,
        error: `Email failed: ${JSON.stringify(error)}`
      }
    }

    return { success: true }

  } catch (error) {
    console.error('Email send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
}

/**
 * Generate booking confirmation notification message
 */
export function generateBookingNotification(params: {
  guestName: string
  roomName: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: string
  bookingRef: string
  notes?: string | null
}) {
  const { guestName, roomName, checkIn, checkOut, guests, totalPrice, bookingRef, notes } = params

  // Include notes if they contain transport info or special requests
  let notesSection = ''
  if (notes) {
    notesSection = `\n📝 Notes:\n${notes}\n`
  }

  const lineMessage = `
🏠 New Booking Confirmed!

👤 Guest: ${guestName}
🛏️ Room: ${roomName}
📅 Check-in: ${checkIn}
📅 Check-out: ${checkOut}
👥 Guests: ${guests}
💰 Total: ${totalPrice}
📋 Ref: ${bookingRef}${notesSection}

Payment has been verified! ✅`

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #666; }
    .value { font-weight: 600; }
    .total { font-size: 1.2em; color: #667eea; }
    .badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🏠 New Booking Confirmed!</h1>
      <span class="badge">Payment Verified ✓</span>
    </div>
    <div class="content">
      <p>A new booking has been confirmed with verified payment.</p>
      
      <div class="booking-details">
        <div class="detail-row">
          <span class="label">Guest</span>
          <span class="value">${guestName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Room</span>
          <span class="value">${roomName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Check-in</span>
          <span class="value">${checkIn}</span>
        </div>
        <div class="detail-row">
          <span class="label">Check-out</span>
          <span class="value">${checkOut}</span>
        </div>
        <div class="detail-row">
          <span class="label">Guests</span>
          <span class="value">${guests}</span>
        </div>
        <div class="detail-row">
          <span class="label">Total</span>
          <span class="value total">${totalPrice}</span>
        </div>
        <div class="detail-row">
          <span class="label">Booking Reference</span>
          <span class="value">${bookingRef}</span>
        </div>
      </div>
      ${notes ? `
      <div class="booking-details" style="background: #f0f9ff;">
        <h3 style="margin-top: 0; color: #1e40af;">📝 Guest Notes</h3>
        <p style="white-space: pre-line; margin: 0;">${notes}</p>
      </div>
      ` : ''}
      
      <p style="color: #666; font-size: 0.9em;">
        Log in to your dashboard to view complete booking details.
      </p>
    </div>
  </div>
</body>
</html>`

  const emailSubject = `✅ New Booking: ${guestName} - ${roomName} (${checkIn})`

  return {
    lineMessage,
    emailHtml,
    emailSubject
  }
}

/**
 * Generate payment pending notification
 */
export function generatePaymentPendingNotification(params: {
  guestName: string
  roomName: string
  checkIn: string
  checkOut: string
  totalPrice: string
  expiresAt: string
}) {
  const { guestName, roomName, checkIn, checkOut, totalPrice, expiresAt } = params

  const lineMessage = `
⏳ Pending Payment

👤 Guest: ${guestName}
🛏️ Room: ${roomName}
📅 ${checkIn} - ${checkOut}
💰 Amount: ${totalPrice}
⏰ Expires: ${expiresAt}

Waiting for payment confirmation...`

  return { lineMessage }
}

/**
 * Generate guest booking confirmation email
 */
export function generateGuestConfirmationEmail(params: {
  guestName: string
  roomName: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: string
  bookingRef: string
  checkInTime: string
  checkOutTime: string
  tenantName: string
  tenantSlug: string
  primaryColor?: string
  notes?: string | null
}) {
  const { 
    guestName, roomName, checkIn, checkOut, guests, totalPrice, bookingRef,
    checkInTime, checkOutTime, tenantName, tenantSlug, primaryColor = '#10b981', notes
  } = params

  const confirmationUrl = `${getServerBaseUrl()}/${tenantSlug}/my-bookings`

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${primaryColor}; color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0 0 10px 0; font-size: 28px; }
    .header p { margin: 0; opacity: 0.9; font-size: 16px; }
    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
    .success-badge { display: inline-block; background: #10b981; color: white; padding: 8px 20px; border-radius: 25px; font-weight: 600; margin-bottom: 20px; }
    .booking-card { background: #f9fafb; padding: 24px; border-radius: 12px; margin: 24px 0; }
    .booking-ref { background: ${primaryColor}15; padding: 12px 16px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
    .booking-ref span { font-family: monospace; font-size: 20px; font-weight: bold; color: ${primaryColor}; letter-spacing: 2px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .detail-item { padding: 12px 0; }
    .detail-item.full { grid-column: span 2; }
    .detail-label { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .detail-value { font-weight: 600; font-size: 16px; color: #1f2937; }
    .total-row { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 18px; font-weight: 600; }
    .total-value { font-size: 24px; font-weight: bold; color: ${primaryColor}; }
    .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0; }
    .notes-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0; }
    .btn { display: inline-block; background: ${primaryColor}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { text-align: center; padding: 24px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Booking Confirmed!</h1>
      <p>Thank you for booking with ${tenantName}</p>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <span class="success-badge">✓ Payment Verified</span>
      </div>
      
      <p>Dear ${guestName},</p>
      <p>Great news! Your payment has been verified and your booking is now confirmed. We're looking forward to hosting you!</p>
      
      <div class="booking-card">
        <div class="booking-ref">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">BOOKING REFERENCE</div>
          <span>${bookingRef}</span>
        </div>
        
        <div class="detail-grid">
          <div class="detail-item full">
            <div class="detail-label">Room</div>
            <div class="detail-value">${roomName}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Check-in</div>
            <div class="detail-value">${checkIn}</div>
            <div style="color: #666; font-size: 14px;">From ${checkInTime}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Check-out</div>
            <div class="detail-value">${checkOut}</div>
            <div style="color: #666; font-size: 14px;">Until ${checkOutTime}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Guests</div>
            <div class="detail-value">${guests} ${guests === 1 ? 'Guest' : 'Guests'}</div>
          </div>
        </div>
        
        <div class="total-row">
          <span class="total-label">Total Paid</span>
          <span class="total-value">${totalPrice}</span>
        </div>
      </div>
      
      <div class="info-box">
        <strong>📍 What's Next?</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Save this email for your records</li>
          <li>Arrive on ${checkIn} after ${checkInTime}</li>
          <li>Contact us if you have any questions</li>
        </ul>
      </div>
      
      ${notes ? `
      <div class="notes-box">
        <strong>📝 Your Notes</strong>
        <p style="margin: 10px 0 0 0; white-space: pre-line;">${notes}</p>
      </div>
      ` : ''}
      
      <div style="text-align: center;">
        <a href="${confirmationUrl}" class="btn">View My Bookings</a>
      </div>
    </div>
    
    <div class="footer">
      <p>Thank you for choosing ${tenantName}!</p>
      <p style="font-size: 12px; color: #999;">
        If you have any questions, please don't hesitate to contact us.
      </p>
    </div>
  </div>
</body>
</html>`

  const emailSubject = `✅ Booking Confirmed - ${roomName} (${checkIn} - ${checkOut})`

  return { emailHtml, emailSubject }
}

/**
 * Generate waitlist notification
 */
export function generateWaitlistNotification(params: {
  roomName: string
  checkIn: string
  checkOut: string
  tenantSlug: string
}) {
  const { roomName, checkIn, checkOut, tenantSlug } = params

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; text-align: center; }
    .btn { display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🎉 Dates Available!</h1>
    </div>
    <div class="content">
      <p>Good news! The dates you were waiting for are now available.</p>
      
      <p><strong>Room:</strong> ${roomName}</p>
      <p><strong>Dates:</strong> ${checkIn} - ${checkOut}</p>
      
      <a href="${getServerBaseUrl()}/${tenantSlug}/rooms" class="btn">
        Book Now →
      </a>
      
      <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
        Hurry! These dates are available on a first-come, first-served basis.
      </p>
    </div>
  </div>
</body>
</html>`

  const emailSubject = `🎉 Dates Available: ${roomName} (${checkIn} - ${checkOut})`

  return { emailHtml, emailSubject }
}

