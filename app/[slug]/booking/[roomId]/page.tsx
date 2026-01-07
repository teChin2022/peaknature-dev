import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Calendar, Users, Clock, Shield, AlertTriangle, QrCode } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { BookingConfirmForm } from '@/components/booking/booking-confirm-form'
import { ReservationLockChecker } from '@/components/booking/reservation-lock-checker'
import { PaymentSectionWrapper } from '@/components/booking/payment-section-wrapper'
import { differenceInDays, parseISO } from 'date-fns'
import { Tenant, Room, TenantSettings, defaultTenantSettings } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { getLocaleFromCookies, getTranslations } from '@/lib/i18n-server'
import { formatDate, formatDateRange } from '@/lib/date-utils'

// Disable caching to always get fresh booking data
export const dynamic = 'force-dynamic'

interface BookingPageProps {
  params: Promise<{ slug: string; roomId: string }>
  searchParams: Promise<{ checkIn: string; checkOut: string; guests: string }>
}

async function getRoomWithTenant(slug: string, roomId: string, checkIn: string, checkOut: string) {
  const supabase = await createClient()
  
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  if (!tenantData) return null

  const tenant = tenantData as Tenant
  const tenantId = tenant.id

  const { data: roomData } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single()
  
  if (!roomData) return null

  const room = roomData as Room

  // Check for blocked dates in the requested range
  const { data: blockedDates } = await supabase
    .from('room_availability')
    .select('date')
    .eq('room_id', roomId)
    .eq('is_blocked', true)
    .gte('date', checkIn)
    .lt('date', checkOut)
  
  // Check for existing bookings in the requested range
  // Date ranges overlap if: existing_check_in < new_check_out AND existing_check_out > new_check_in
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('room_id', roomId)
    .in('status', ['pending', 'confirmed'])
    .lt('check_in', checkOut)   // Existing booking starts before our checkout
    .gt('check_out', checkIn)   // Existing booking ends after our checkin
    .limit(1)

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's profile to check phone number
  let profile = null
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('phone, full_name, province, district, sub_district')
      .eq('id', user.id)
      .single()
    profile = profileData
  }

  return { 
    tenant, 
    room, 
    user,
    profile,
    hasBlockedDates: (blockedDates?.length || 0) > 0,
    hasConflictingBookings: (existingBookings?.length || 0) > 0
  }
}

export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const { slug, roomId } = await params
  const { checkIn, checkOut, guests } = await searchParams
  
  // Validate required params
  if (!checkIn || !checkOut || !guests) {
    redirect(`/${slug}/rooms/${roomId}`)
  }

  const data = await getRoomWithTenant(slug, roomId, checkIn, checkOut)
  
  if (!data) {
    notFound()
  }

  // Get translations
  const locale = await getLocaleFromCookies()
  const messages = await getTranslations(locale)
  const t = messages.booking

  const { tenant, room, user, profile, hasBlockedDates, hasConflictingBookings } = data
  const settings = (tenant.settings as TenantSettings) || defaultTenantSettings
  const currency = settings.currency || 'USD'
  
  // If dates are blocked or already booked, redirect back with error
  if (hasBlockedDates || hasConflictingBookings) {
    redirect(`/${slug}/rooms/${roomId}?error=unavailable`)
  }

  // Check if profile needs completion (will be handled in the form, not as immediate redirect)
  const needsProfileCompletion = user && profile && (
    !profile.phone || !profile.province
  )
  
  const checkInDate = parseISO(checkIn)
  const checkOutDate = parseISO(checkOut)
  const numberOfNights = differenceInDays(checkOutDate, checkInDate)
  const guestCount = parseInt(guests)

  // Calculate pricing
  const subtotal = numberOfNights * room.base_price
  const total = subtotal

  const displayImage = room.images?.[0] || 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80'

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Back Navigation */}
      <div className="bg-white border-b border-stone-200">
        <div className="mx-auto max-w-5xl px-6 py-4 lg:px-8">
          <Link 
            href={`/${tenant.slug}/rooms/${roomId}`}
            className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.backToRoom}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
        <h1 className="text-3xl font-bold text-stone-900 mb-8">
          {t.confirmAndPay}
        </h1>

        {/* Profile Completion Banner */}
        {needsProfileCompletion && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-900">{t.completeProfile}</h3>
                <p className="text-sm text-amber-700 mt-1">
                  {t.completeProfileDesc}
                </p>
                <Link
                  href={`/${tenant.slug}/complete-profile?next=${encodeURIComponent(`/${slug}/booking/${roomId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`)}`}
                  className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-900 hover:text-amber-700 underline"
                >
                  {t.completeProfileNow}
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Booking Form */}
          <div className="space-y-6 order-2 lg:order-1">
            {/* Reservation Lock Checker - handles countdown and waiting queue */}
            <ReservationLockChecker
              roomId={roomId}
              checkIn={checkIn}
              checkOut={checkOut}
              tenantId={tenant.id}
              tenantSlug={tenant.slug}
              primaryColor={tenant.primary_color}
              timeoutMinutes={settings.payment?.payment_timeout_minutes || 15}
              user={user}
            >
              {/* Trip Details */}
              <Card className="border-stone-200">
                <CardHeader>
                  <CardTitle className="text-lg">{t.yourTrip}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-stone-900">{t.dates}</div>
                      <div className="text-stone-600">
                        {formatDateRange(checkInDate, checkOutDate, locale)}
                      </div>
                    </div>
                    <Link 
                      href={`/${tenant.slug}/rooms/${roomId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`}
                      className="text-sm font-medium underline"
                      style={{ color: tenant.primary_color }}
                    >
                      {t.edit}
                    </Link>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-stone-900">{t.guests}</div>
                      <div className="text-stone-600">{guestCount} {guestCount > 1 ? t.guests : t.guest}</div>
                    </div>
                    <Link 
                      href={`/${tenant.slug}/rooms/${roomId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`}
                      className="text-sm font-medium underline"
                      style={{ color: tenant.primary_color }}
                    >
                      {t.edit}
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info / Login */}
              {/* Contact Info / Login - only show if no PromptPay or profile incomplete */}
              {(!settings.payment?.promptpay_qr_url || needsProfileCompletion) && (
                <Card className="border-stone-200">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {user ? t.contactInformation : t.loginOrSignupToBook}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BookingConfirmForm
                      tenant={tenant}
                      room={room}
                      user={user}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      guests={guestCount}
                      totalPrice={total}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Payment Section with Transport, QR Code and Slip Upload */}
              {!needsProfileCompletion && (
                <PaymentSectionWrapper
                  tenant={tenant}
                  roomId={roomId}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  guests={guestCount}
                  basePrice={total}
                />
              )}

              {/* No PromptPay configured message */}
              {!settings.payment?.promptpay_qr_url && (
                <Card className="border-stone-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      {t.payment}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800">
                        {t.paymentWillBeCollected}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Policies */}
              <div className="flex items-start gap-3 p-4 bg-stone-100 rounded-lg">
                <Shield className="h-5 w-5 text-stone-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-stone-600">
                  <p className="font-medium text-stone-900 mb-1">{t.cancellationPolicy}</p>
                  <p>{t.cancellationPolicyDesc}</p>
                </div>
              </div>
            </ReservationLockChecker>
          </div>

          {/* Booking Summary */}
          <div className="order-1 lg:order-2">
            <Card className="border-stone-200 sticky top-24 overflow-hidden !p-0">
              {/* Room Image - Full Width */}
              <div className="relative w-full aspect-[16/9]">
                <Image
                  src={displayImage}
                  alt={room.name}
                  fill
                  className="object-cover"
                />
              </div>
              
              <CardContent className="p-6">
                {/* Room Info */}
                <div className="pb-6 border-b border-stone-200">
                  <h3 className="font-semibold text-stone-900 text-lg mb-1">
                    {room.name}
                  </h3>
                  <p className="text-sm text-stone-600 mb-3">
                    {tenant.name}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-stone-500">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      {guestCount} {guestCount > 1 ? t.guests : t.guest}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {numberOfNights} {numberOfNights > 1 ? t.nights : t.night}
                    </span>
                  </div>
                </div>

                {/* Check-in/out times */}
                <div className="py-4 border-b border-stone-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-stone-500 mb-1">{t.checkIn}</div>
                      <div className="font-medium text-stone-900 flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {room.check_in_time}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500 mb-1">{t.checkOut}</div>
                      <div className="font-medium text-stone-900 flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {room.check_out_time}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="py-6 border-b border-stone-200">
                  <h4 className="font-semibold text-stone-900 mb-4">{t.priceDetails}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-stone-600">
                      <span>{formatPrice(room.base_price, currency)} × {numberOfNights} {numberOfNights > 1 ? t.nights : t.night}</span>
                      <span>{formatPrice(subtotal, currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-stone-900">{t.total} ({currency})</span>
                    <span className="text-2xl font-bold" style={{ color: tenant.primary_color }}>
                      {formatPrice(total, currency)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

