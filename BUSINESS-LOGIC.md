# Homestay Booking Platform - Business Logic Documentation

This document describes the business logic and workflows of the Homestay Booking Platform.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Multi-Tenant Architecture](#3-multi-tenant-architecture)
4. [Subscription & Billing](#4-subscription--billing)
5. [Room Management](#5-room-management)
6. [Booking Workflow](#6-booking-workflow)
7. [Payment Processing](#7-payment-processing)
8. [Notification System](#8-notification-system)
9. [Authentication & Security](#9-authentication--security)
10. [Internationalization (i18n)](#10-internationalization-i18n)

---

## 1. System Overview

### 1.1 Platform Purpose

A multi-tenant SaaS platform that enables property owners (hosts) to manage their homestay accommodations and accept online bookings with PromptPay payment verification.

### 1.2 Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Styling | Tailwind CSS 4 |
| UI | shadcn/ui (Radix primitives) |
| Email | Resend API |
| Notifications | LINE Messaging API |
| Payment Verify | EasySlip API |

### 1.3 Key Files Reference

```
lib/
├── subscription.ts          # Subscription logic (client)
├── subscription-server.ts   # Subscription logic (server)
├── easyslip.ts             # Payment slip verification
├── notifications.ts         # Email/LINE notifications
├── rate-limit.ts           # API rate limiting
├── currency.ts             # Currency formatting
└── supabase/
    ├── client.ts           # Browser Supabase client
    ├── server.ts           # Server Supabase client
    └── middleware.ts       # Supabase session handler

proxy.ts                    # Route protection & tenant validation (Next.js 16)
types/database.ts           # TypeScript type definitions
```

---

## 2. User Roles & Permissions

### 2.1 Role Hierarchy

```
┌─────────────────┐
│   super_admin   │  Platform administrator
├─────────────────┤
│      host       │  Tenant/property owner
├─────────────────┤
│      guest      │  End user who books rooms
└─────────────────┘
```

### 2.2 Role Capabilities

| Capability | super_admin | host | guest |
|------------|:-----------:|:----:|:-----:|
| Manage all tenants | ✅ | ❌ | ❌ |
| View platform analytics | ✅ | ❌ | ❌ |
| Manage platform settings | ✅ | ❌ | ❌ |
| View/manage own tenant | ✅ | ✅ | ❌ |
| Manage rooms | ✅ | ✅ | ❌ |
| View tenant bookings | ✅ | ✅ | ❌ |
| Manage blocked dates | ✅ | ✅ | ❌ |
| Block/unblock users | ✅ | ✅ | ❌ |
| Create bookings | ❌ | ❌ | ✅ |
| View own bookings | ❌ | ❌ | ✅ |
| Cancel own bookings | ❌ | ❌ | ✅ |
| Write reviews | ❌ | ❌ | ✅ |

### 2.3 Role Determination Logic

```sql
-- supabase/production_init.sql - Helper Functions (SECURITY DEFINER)
-- These functions bypass RLS to avoid circular dependencies

-- Role checking
function public.get_my_role() → TEXT
function public.is_super_admin() → BOOLEAN
function public.is_host() → BOOLEAN

-- Tenant ownership
function public.get_my_tenant_id() → UUID
function public.get_host_tenant_id_safe() → UUID
function public.current_user_owns_tenant(tenant_id) → BOOLEAN

-- Resource ownership (used in RLS policies)
function public.host_owns_room(room_id) → BOOLEAN
function public.host_owns_notification(tenant_id) → BOOLEAN
function public.is_guest_of_host_property(profile_id) → BOOLEAN
```

**Reference:** `supabase/production_init.sql` (Section 4: Helper Functions)

---

## 3. Multi-Tenant Architecture

### 3.1 Tenant Structure

Each tenant represents a property/homestay with:
- Unique slug (URL identifier): `/{slug}/...`
- Custom branding (logo, primary color)
- Configurable settings (JSONB)
- Subscription plan (free/pro)

```typescript
// types/database.ts
interface Tenant {
  id: UUID
  name: string
  slug: string              // URL-safe identifier
  logo_url: string | null
  primary_color: string     // Hex color
  plan: 'free' | 'pro'
  is_active: boolean
  settings: TenantSettings  // JSONB configuration
  // Subscription fields
  trial_started_at: Date
  trial_ends_at: Date
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled'
}
```

### 3.2 Tenant Settings (JSONB)

```typescript
// types/database.ts
interface TenantSettings {
  currency: 'USD' | 'THB'
  hero: { tagline, description, images[] }
  amenities: TenantAmenity[]
  contact: { 
    address, city, postal_code, country, 
    phone, email, directions, 
    map_url, map_embed 
  }
  stats: { 
    show_stats, rating, guest_count, 
    custom_stat_label, custom_stat_value 
  }
  social: { facebook, instagram, twitter, line, whatsapp }
  payment: {
    promptpay_id: string
    promptpay_name: string
    qr_code_url: string
    bank_name: string
    bank_account: string
    payment_timeout_minutes: number
    easyslip_enabled: boolean
    line_channel_access_token: string
    line_user_id: string
  }
  transport: { pickup_enabled, pickup_price, dropoff_enabled, dropoff_price }
}
```

**Reference:** `types/database.ts`, `supabase/production_init.sql` (Section 2: Tables)

### 3.3 URL Routing

```
/                           # Public landing page
/admin/*                    # Super admin panel
/host/login                 # Host login
/host/register              # Host registration
/{slug}                     # Tenant landing page
/{slug}/rooms               # Room listing
/{slug}/rooms/{id}          # Room detail
/{slug}/booking/{roomId}    # Booking flow
/{slug}/my-bookings         # Guest bookings
/{slug}/dashboard/*         # Host dashboard
```

### 3.4 Tenant Validation (Middleware)

```typescript
// proxy.ts - Tenant validation flow
1. Extract slug from URL path
2. Skip if system route (admin, host, privacy, terms, upload)
3. Query tenants table by slug
4. If not found → Redirect to home
5. If is_active = false → Redirect with ?error=tenant_inactive
6. If protected route → Check user authentication
7. If user blocked → Sign out and redirect with ?error=blocked
```

**Reference:** `proxy.ts` (lines 64-141)

---

## 4. Subscription & Billing

### 4.1 Plans

| Plan | Price | Trial | Features |
|------|-------|-------|----------|
| Free | ฿0 | 2 months | All features (trial period) |
| Pro | ฿699/month | - | All features (unlimited) |

### 4.2 Subscription States

```
┌─────────┐   Trial Ends    ┌─────────┐
│  trial  │ ───────────────→│ expired │
└────┬────┘                 └────┬────┘
     │                           │
     │ Payment Verified          │ Payment Verified
     ↓                           ↓
┌─────────┐                 ┌─────────┐
│  active │←────────────────│  active │
└────┬────┘                 └─────────┘
     │
     │ Subscription Ends (no renewal)
     ↓
┌─────────┐
│ expired │
└─────────┘
```

### 4.3 Subscription Logic

```typescript
// lib/subscription.ts
export function createSubscriptionInfo(tenant) {
  // Calculate days remaining
  if (status === 'trial' && trialEndsAt) {
    daysRemaining = Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000))
  } else if (status === 'active' && subscriptionEndsAt) {
    daysRemaining = Math.ceil((subscriptionEndsAt - now) / (24 * 60 * 60 * 1000))
  }
  
  // Trial active = trial status AND trial_ends_at > now
  isTrialActive = status === 'trial' && trialEndsAt > now
  
  // Subscription active = active status OR trial active
  isSubscriptionActive = status === 'active' || isTrialActive
  
  return {
    plan, status, daysRemaining,
    isTrialActive, isSubscriptionActive,
    canAccessFeature: (feature) => ...
    getFeatureLimit: (feature) => ...
  }
}
```

**Reference:** `lib/subscription.ts` (lines 106-151)

### 4.4 Trial Initialization

When a new tenant is created, a database trigger automatically sets trial dates:

```sql
-- supabase/production_init.sql
CREATE TRIGGER set_trial_dates_trigger
  BEFORE INSERT ON tenants
  FOR EACH ROW
  WHEN (NEW.trial_started_at IS NULL)
  EXECUTE FUNCTION set_tenant_trial_dates();

-- Sets:
-- trial_started_at = NOW()
-- trial_ends_at = NOW() + 2 months
-- subscription_status = 'trial'
```

### 4.5 Subscription Payment Flow

```
Host Dashboard → Subscription Page
         │
         ▼
    Upload Payment Proof (PromptPay slip)
         │
         ▼
    API: /api/subscription/upgrade
         │
         ├── Insert into subscription_payments (status: 'pending')
         │
         └── Notify Admin via LINE
         
         │
    [Admin Reviews]
         │
         ▼
    Admin Approves/Rejects
         │
         ├── If Approved:
         │   ├── Update subscription_payments.status = 'verified'
         │   ├── Update tenant.subscription_status = 'active'
         │   ├── Set subscription dates
         │   └── Notify Host
         │
         └── If Rejected:
             ├── Update subscription_payments.status = 'rejected'
             └── Notify Host
```

**Reference:** `app/api/subscription/upgrade/route.ts`, `components/dashboard/subscription-content.tsx`

---

## 5. Room Management

### 5.1 Room Structure

```typescript
interface Room {
  id: UUID
  tenant_id: UUID
  name: string
  description: string
  images: string[]          // Array of image URLs
  base_price: number
  max_guests: number
  amenities: string[]
  rules: string[]
  is_active: boolean
  check_in_time: string     // e.g., "14:00"
  check_out_time: string    // e.g., "11:00"
  min_nights: number
}
```

### 5.2 Room Availability

Dates can be blocked or have price overrides:

```typescript
interface RoomAvailability {
  room_id: UUID
  date: Date
  is_blocked: boolean       // If true, date is unavailable
  price_override: number    // Override base_price for this date
}
```

### 5.3 Availability Check Logic

```sql
-- Check if dates are booked
CREATE FUNCTION check_booking_conflict(room_id, check_in, check_out)
RETURNS BOOLEAN
  SELECT EXISTS (
    FROM bookings
    WHERE room_id = p_room_id
      AND status NOT IN ('cancelled')
      AND (check_in, check_out) OVERLAPS (p_check_in, p_check_out)
  )

-- Check if dates are blocked
CREATE FUNCTION check_dates_blocked(room_id, check_in, check_out)
RETURNS BOOLEAN
  SELECT EXISTS (
    FROM room_availability
    WHERE room_id = p_room_id
      AND is_blocked = TRUE
      AND date >= p_check_in
      AND date < p_check_out
  )

-- Get booked dates for calendar display (bypasses RLS)
CREATE FUNCTION get_room_booked_dates(room_id)
RETURNS TABLE (check_in DATE, check_out DATE)
```

**Reference:** `supabase/production_init.sql` (Section 5: Business Logic Functions)

---

## 6. Booking Workflow

### 6.1 Booking States

```
┌─────────┐    Payment Verified    ┌───────────┐
│ pending │ ─────────────────────→ │ confirmed │
└────┬────┘                        └─────┬─────┘
     │                                   │
     │ Guest Cancels                     │ Check-out Date Passed
     │ (within 24hrs)                    ↓
     ↓                             ┌───────────┐
┌───────────┐                      │ completed │
│ cancelled │                      └───────────┘
└───────────┘
```

### 6.2 Reservation Lock System

To prevent double bookings during payment:

```
Guest Selects Dates
        │
        ▼
   Create Lock (15 min)
        │
   ┌────┴────┐
   │ Locked  │ ← Other users see "Dates locked by another guest"
   └────┬────┘
        │
        ▼
   Guest Uploads Payment Slip
        │
        ▼
   Verify Payment
        │
   ┌────┴────┐
   │ Success │ → Release Lock, Create Booking (confirmed)
   └────┬────┘
        │
   ┌────┴────┐
   │ Failure │ → Lock expires automatically (15 min)
   └─────────┘
```

**Lock Functions:**
```sql
-- Create or extend a lock
CREATE FUNCTION create_reservation_lock(room_id, user_id, check_in, check_out, timeout_minutes)
RETURNS TABLE (success, lock_id, expires_at, error_message)

-- Check if dates are locked
CREATE FUNCTION check_reservation_lock(room_id, check_in, check_out, user_id)
RETURNS TABLE (is_locked, locked_by, expires_at, seconds_remaining)

-- Release a lock
CREATE FUNCTION release_reservation_lock(room_id, user_id, check_in, check_out)
RETURNS BOOLEAN
```

**Reference:** `supabase/production_init.sql` (check_reservation_lock, create_reservation_lock, release_reservation_lock)

### 6.5 Dashboard Data Functions

Host dashboard uses SECURITY DEFINER functions to bypass RLS:

```sql
-- Get bookings with guest info (for dashboard/bookings page)
CREATE FUNCTION get_tenant_bookings(tenant_id, status?)
RETURNS TABLE (
  id, tenant_id, room_id, user_id,
  check_in, check_out, guests, total_price, status, notes, created_at,
  room_name, guest_full_name, guest_email, guest_phone, payment_slip_url
)

-- Get guests for tenant (for dashboard/guests page)
CREATE FUNCTION get_tenant_guests(tenant_id)
RETURNS TABLE (
  id, email, full_name, phone, tenant_id,
  is_blocked, avatar_url, created_at
)

-- Get tenant stats (for landing page)
CREATE FUNCTION get_tenant_stats(tenant_id)
RETURNS TABLE (
  average_rating, total_reviews, guest_count, room_count
)

-- Get guest demographics by province (for analytics)
CREATE FUNCTION get_guest_demographics_by_province(tenant_id)
RETURNS TABLE (
  province, guest_count, booking_count, total_revenue
)
```

**Reference:** `supabase/production_init.sql` (Section 5: Business Logic Functions)

### 6.3 Booking Creation Flow

```typescript
// app/[slug]/booking/[roomId]/page.tsx workflow

1. Guest selects dates and guest count
2. System checks:
   - Room exists and is active
   - Dates not blocked (room_availability)
   - No existing bookings overlap
   - No lock by another user
3. Guest submits booking form
4. Create reservation lock (15 min timeout)
5. Show payment page with PromptPay QR code
6. Guest uploads payment slip
7. Verify slip (see Section 7)
8. If valid:
   - Update booking status to 'confirmed'
   - Release lock
   - Send notifications
9. If invalid:
   - Show error message
   - Lock expires automatically
```

### 6.4 Cancellation Rules

```typescript
// app/api/booking/cancel/route.ts

// 24-hour rule: Can only cancel within 24 hours AFTER booking was created
const bookingCreatedAt = parseISO(booking.created_at)
const hoursSinceBooking = differenceInHours(new Date(), bookingCreatedAt)

if (hoursSinceBooking > 24) {
  return error('Cancellation period has expired. Please contact the property.')
}

// Additional rules:
// - Cannot cancel completed bookings
// - Cannot cancel already cancelled bookings
// - Only booking owner can cancel
```

**Reference:** `app/api/booking/cancel/route.ts` (lines 60-69)

---

## 7. Payment Processing

### 7.1 Payment Method: PromptPay

Thai instant payment system using QR codes:

1. Host configures PromptPay in tenant settings
2. Guest scans QR code with banking app
3. Guest uploads payment slip photo
4. System verifies slip using EasySlip API

### 7.2 Payment Verification Flow

```typescript
// app/api/payment/verify-slip/route.ts

1. Validate request (bookingId, slipUrl, expectedAmount)
2. Verify user is authenticated
3. Verify user owns the booking (SECURITY)
4. Generate slip URL hash for duplicate detection
5. Check if slip already used (by URL hash)
6. If EasySlip enabled:
   a. Call EasySlip API to verify slip
   b. Validate amount matches (±1 THB tolerance)
   c. Check transaction reference not reused
   d. Check payment date within 24 hours
7. Update booking status to 'confirmed'
8. Store verified slip record (prevent reuse)
9. Release reservation lock
10. Send notifications to host (LINE + Email)
11. Send confirmation email to guest
```

**Reference:** `app/api/payment/verify-slip/route.ts`

### 7.3 EasySlip Integration

```typescript
// lib/easyslip.ts

interface VerifySlipResult {
  success: boolean
  verified: boolean
  data?: {
    transRef: string      // Transaction reference
    date: string          // Payment date
    amount: { amount: number }
    sender: { bank, name }
    receiver: { bank, name, displayName }
  }
  validation?: {
    amountMatch: boolean
    expectedAmount: number
    actualAmount: number
  }
}

// Verification checks:
// 1. API response success (status 200)
// 2. Amount match (within tolerance)
// 3. Transaction reference not reused
// 4. Payment date within 24 hours
```

**Reference:** `lib/easyslip.ts`

### 7.4 Duplicate Slip Prevention

Two-layer protection:

```typescript
// Layer 1: URL Hash Check
const slipUrlHash = crypto.createHash('sha256').update(slipUrl).digest('hex')
const { data: existingByHash } = await supabase
  .from('verified_slips')
  .select('id')
  .eq('slip_url_hash', slipUrlHash)
  .single()

// Layer 2: Transaction Reference Check (EasySlip)
if (verificationResult.data?.transRef) {
  const { data: existingSlip } = await supabase
    .from('verified_slips')
    .select('id')
    .eq('trans_ref', transRef)
    .single()
}
```

---

## 8. Notification System

### 8.1 Notification Channels

| Channel | Use Case | Configuration |
|---------|----------|---------------|
| Email | Booking confirmations, cancellations | Resend API (RESEND_API_KEY) |
| LINE | Real-time alerts to host | LINE Messaging API (per-tenant config) |

### 8.2 Notification Triggers

| Event | Host Notification | Guest Notification |
|-------|:-----------------:|:------------------:|
| New Booking | ✅ LINE + Email | ✅ Email |
| Booking Cancelled | ✅ LINE + Email | ❌ |
| Payment Pending | ✅ LINE | ❌ |
| Dates Available (waitlist) | ❌ | ✅ Email |

### 8.3 LINE Messaging Implementation

```typescript
// lib/notifications.ts

export async function sendLineMessage(options: {
  channelAccessToken: string  // From tenant settings
  userId: string              // From tenant settings
  message: string
}): Promise<NotificationResult> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${channelAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }]
    })
  })
  return { success: response.ok }
}
```

**Reference:** `lib/notifications.ts` (lines 36-80)

### 8.4 Email Templates

Pre-built templates for:
- `generateBookingNotification()` - Host notification with booking details
- `generateGuestConfirmationEmail()` - Guest confirmation with styled HTML
- `generateWaitlistNotification()` - Notify guest when dates become available

**Reference:** `lib/notifications.ts` (lines 209-537)

---

## 9. Authentication & Security

### 9.1 Authentication Flow

```
Guest Registration          Host Registration
       │                           │
       ▼                           ▼
   Sign up with                Sign up with
   email + password            email + password
       │                           │
       ▼                           ▼
   Email verification          Create tenant
       │                           │
       ▼                           ▼
   Create profile              Set user as host
   (role: guest)               (role: host)
       │                           │
       ▼                           ▼
   Set tenant_id               Link to tenant_id
```

### 9.2 Password Requirements

```typescript
// components/auth/register-form.tsx
const registerSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})
```

### 9.3 Route Protection (Middleware)

```typescript
// proxy.ts

// Admin routes: Only super_admin
if (pathname.startsWith('/admin')) {
  if (profile.role !== 'super_admin') {
    redirect('/')
  }
}

// Tenant dashboard: Only host of that tenant
if (pathname.includes('/dashboard')) {
  if (profile.role !== 'host' || profile.tenant_id !== tenant.id) {
    redirect('/')
  }
}

// Protected guest routes: Authenticated guests
if (protectedRoutes.includes(tenantPath)) {
  if (!user) {
    redirect('/{slug}/login')
  }
  if (profile.is_blocked) {
    signOut()
    redirect('/{slug}/login?error=blocked')
  }
}
```

### 9.4 Row Level Security (RLS)

All 16 tables have RLS enabled with SECURITY DEFINER helper functions to avoid circular dependencies:

```sql
-- Example: Bookings policies (using helper functions)
CREATE POLICY "bookings_select_own"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bookings_select_host"
  ON bookings FOR SELECT
  USING (public.current_user_owns_tenant(tenant_id));

CREATE POLICY "bookings_update_host"
  ON bookings FOR UPDATE
  USING (public.current_user_owns_tenant(tenant_id))
  WITH CHECK (public.current_user_owns_tenant(tenant_id));

CREATE POLICY "bookings_all_super_admin"
  ON bookings FOR ALL
  USING (public.is_super_admin());

-- Example: Profiles policies (host can view guests who booked)
CREATE POLICY "profiles_select_host_guests"
  ON profiles FOR SELECT
  USING (
    tenant_id = public.get_host_tenant_id_safe()
    OR public.is_guest_of_host_property(id)
  );
```

**Reference:** `supabase/production_init.sql` (Section 8: RLS Policies)

### 9.5 Audit Logging

All admin actions are logged to an immutable audit_logs table:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  action VARCHAR(100),        -- e.g., 'tenant.deactivate', 'user.block'
  category VARCHAR(50),       -- 'admin', 'security', 'user', 'system'
  severity VARCHAR(20),       -- 'info', 'warning', 'error', 'critical'
  actor_id UUID,              -- Who performed the action
  actor_email, actor_role, actor_ip, actor_user_agent,
  target_type VARCHAR(50),    -- 'tenant', 'user', 'booking', 'room'
  target_id UUID,
  details JSONB,              -- Additional structured data
  old_value JSONB,            -- Previous state (for updates)
  new_value JSONB,            -- New state (for updates)
  success BOOLEAN
);

-- Log via SECURITY DEFINER function
CREATE FUNCTION log_audit_event(
  action, category, severity,
  actor_id, actor_email, actor_role, actor_ip, actor_user_agent,
  target_type, target_id, target_name,
  tenant_id, details, old_value, new_value, success, error_message
) RETURNS UUID
```

**Reference:** `supabase/production_init.sql` (Section 2: Tables, audit_logs)

### 9.6 Rate Limiting

```typescript
// lib/rate-limit.ts

// Applied to sensitive endpoints:
// - /api/payment/verify-slip: 10 req/min
// - /api/booking/cancel: 5 req/min
// - /api/user/delete: 3 req/min
// - /api/consent/log: 5 req/min
// - /api/subscription/upgrade: 5 req/min
// - /api/admin/settings: 30 GET, 10 POST req/min

const { success, reset } = await apiLimiter.check(limit, `endpoint:${clientIP}`)
if (!success) {
  return rateLimitResponse(reset)
}
```

**Reference:** `lib/rate-limit.ts`

### 9.7 Security Headers

```typescript
// next.config.ts
headers: [
  { 'X-Frame-Options': 'DENY' },
  { 'X-Content-Type-Options': 'nosniff' },
  { 'Referrer-Policy': 'strict-origin-when-cross-origin' },
  { 'X-XSS-Protection': '1; mode=block' },
  { 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' },
]
```

---

## 10. Internationalization (i18n)

### 10.1 Supported Languages

| Language | Code | File |
|----------|------|------|
| Thai | `th` | `messages/th.json` |
| English | `en` | `messages/en.json` |

### 10.2 Implementation

```typescript
// lib/i18n.ts - Client-side configuration
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async () => {
  const locale = // Get from cookie or default to 'th'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  }
})

// Usage in components:
import { useTranslations } from 'next-intl'

function Component() {
  const t = useTranslations('common')
  return <h1>{t('welcome')}</h1>
}
```

### 10.3 Locale Persistence

User's language preference is stored in a cookie:

```typescript
// components/language-switcher.tsx
const setLocale = (newLocale: 'th' | 'en') => {
  document.cookie = `locale=${newLocale}; path=/; max-age=31536000`
  router.refresh()
}
```

### 10.4 Coverage

| Area | Translated |
|------|:----------:|
| Public landing page | ✅ |
| Tenant landing page | ✅ |
| Guest booking flow | ✅ |
| Guest my-bookings | ✅ |
| Host dashboard | ✅ |
| Admin panel | ❌ (English only) |

---

## Appendix A: Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=

# Payment Verification (EasySlip)
EASYSLIP_API_KEY=
```

---

## Appendix B: Database Schema Quick Reference

| Table | Purpose |
|-------|---------|
| `tenants` | Property/homestay configurations |
| `profiles` | User accounts (extends auth.users) |
| `rooms` | Accommodations within a tenant |
| `bookings` | Reservations |
| `room_availability` | Blocked dates and price overrides |
| `reviews` | Guest reviews |
| `reservation_locks` | Temporary locks during payment |
| `verified_slips` | Verified payment slips (prevent reuse) |
| `upload_tokens` | Mobile slip upload tokens |
| `notification_queue` | Notification history |
| `date_waitlist` | Guest waitlist for locked dates |
| `subscription_payments` | Host subscription payment records |
| `plan_features` | Plan feature definitions |
| `platform_settings` | Global admin settings |
| `cookie_consent_logs` | GDPR consent records |
| `audit_logs` | Immutable admin action logs |

---

## Appendix C: API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payment/verify-slip` | POST | Verify payment slip |
| `/api/payment/create-lock` | POST | Create reservation lock |
| `/api/payment/check-lock` | POST | Check lock status |
| `/api/booking/cancel` | POST | Cancel booking |
| `/api/host/settings` | PUT | Update tenant settings (bypasses RLS) |
| `/api/host/rooms` | POST | Create/update room |
| `/api/host/availability` | POST | Update room availability |
| `/api/subscription/upgrade` | POST | Submit subscription payment |
| `/api/admin/settings` | GET/POST | Platform settings |
| `/api/admin/subscription-payment` | POST | Approve/reject payments |
| `/api/admin/audit` | GET | Get audit logs |
| `/api/user/delete` | POST | Delete user account |
| `/api/consent/log` | POST | Log cookie consent |
| `/api/upload/create-token` | POST | Create mobile upload token |
| `/api/upload/mobile` | POST | Mobile slip upload |

---

*Last Updated: January 9, 2026*

