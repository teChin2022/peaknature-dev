import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Calendar, Users, Clock, MapPin, Mail, Phone, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { parseISO, differenceInDays } from 'date-fns'
import { Tenant, Booking, Room, Profile, TenantSettings, defaultTenantSettings } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { getLocaleFromCookies, getTranslations } from '@/lib/i18n-server'
import { formatDate } from '@/lib/date-utils'

interface ConfirmationPageProps {
  params: Promise<{ slug: string; bookingId: string }>
}

interface BookingWithRelations extends Booking {
  room: Room
  user: Profile
}

async function getBookingDetails(slug: string, bookingId: string) {
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

  const { data: bookingData } = await supabase
    .from('bookings')
    .select(`
      *,
      room:rooms(*),
      user:profiles(*)
    `)
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single()
  
  if (!bookingData) return null

  const booking = bookingData as unknown as BookingWithRelations

  return { tenant, booking }
}

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
}

export default async function BookingConfirmationPage({ params }: ConfirmationPageProps) {
  const { slug, bookingId } = await params
  const data = await getBookingDetails(slug, bookingId)
  
  if (!data) {
    notFound()
  }

  // Get translations
  const locale = await getLocaleFromCookies()
  const messages = await getTranslations(locale)
  const t = messages.confirmationPage

  const { tenant, booking } = data
  const room = booking.room
  const settings = (tenant.settings as TenantSettings) || defaultTenantSettings
  const currency = settings.currency || 'USD'

  const checkInDate = parseISO(booking.check_in)
  const checkOutDate = parseISO(booking.check_out)
  const numberOfNights = differenceInDays(checkOutDate, checkInDate)

  const displayImage = room.images?.[0] || 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80'

  // Status labels
  const statusLabels = {
    pending: t.pending,
    confirmed: t.confirmedStatus,
    cancelled: t.cancelled,
    completed: t.completed,
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-10">
          <div 
            className="inline-flex h-20 w-20 items-center justify-center rounded-full mb-6"
            style={{ backgroundColor: `${tenant.primary_color}15` }}
          >
            <CheckCircle2 className="h-10 w-10" style={{ color: tenant.primary_color }} />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            {booking.status === 'pending' ? t.submitted : t.confirmed}
          </h1>
          <p className="text-lg text-stone-600">
            {booking.status === 'pending' 
              ? t.submittedDesc
              : t.confirmedDesc
            }
          </p>
        </div>

        {/* Booking Details Card */}
        <Card className="border-stone-200 shadow-lg mb-8 overflow-hidden !p-0">
          <CardContent className="p-0">
            {/* Room Preview Header */}
            <div className="relative h-48">
              <Image
                src={displayImage}
                alt={room.name}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <Badge className={statusColors[booking.status as keyof typeof statusColors]}>
                  {statusLabels[booking.status as keyof typeof statusLabels]}
                </Badge>
                <h2 className="text-2xl font-bold text-white mt-2">{room.name}</h2>
                <p className="text-white/80">{tenant.name}</p>
              </div>
            </div>

            {/* Booking Reference */}
            <div className="px-6 py-4 bg-stone-50 border-b border-stone-200">
              <div className="text-sm text-stone-500">{t.bookingReference}</div>
              <div className="font-mono text-lg font-semibold text-stone-900">
                {booking.id.slice(0, 8).toUpperCase()}
              </div>
            </div>

            {/* Stay Details */}
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Check-in */}
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${tenant.primary_color}15` }}
                  >
                    <Calendar className="h-5 w-5" style={{ color: tenant.primary_color }} />
                  </div>
                  <div>
                    <div className="text-sm text-stone-500 mb-1">{t.checkIn}</div>
                    <div className="font-semibold text-stone-900">
                      {formatDate(checkInDate, 'EEEE, MMMM d, yyyy', locale)}
                    </div>
                    <div className="text-sm text-stone-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {room.check_in_time}
                    </div>
                  </div>
                </div>

                {/* Check-out */}
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${tenant.primary_color}15` }}
                  >
                    <Calendar className="h-5 w-5" style={{ color: tenant.primary_color }} />
                  </div>
                  <div>
                    <div className="text-sm text-stone-500 mb-1">{t.checkOut}</div>
                    <div className="font-semibold text-stone-900">
                      {formatDate(checkOutDate, 'EEEE, MMMM d, yyyy', locale)}
                    </div>
                    <div className="text-sm text-stone-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {room.check_out_time}
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Guest Info */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-stone-400" />
                  <span className="text-stone-700">
                    {booking.guests} {booking.guests > 1 ? t.guests : t.guest} · {numberOfNights} {numberOfNights > 1 ? t.nights : t.night}
                  </span>
                </div>
              </div>

              {/* Special Requests */}
              {booking.notes && (
                <div className="p-4 bg-stone-50 rounded-lg mb-6">
                  <div className="text-sm font-medium text-stone-700 mb-1">{t.specialRequests}</div>
                  <div className="text-stone-600 whitespace-pre-line">{booking.notes}</div>
                </div>
              )}

              <Separator className="my-6" />

              {/* Price Summary */}
              <div className="space-y-3">
                <div className="flex justify-between text-stone-600">
                  <span>{formatPrice(room.base_price, currency)} × {numberOfNights} {numberOfNights > 1 ? t.nights : t.night}</span>
                  <span>{formatPrice(room.base_price * numberOfNights, currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold text-stone-900">
                  <span>{t.total}</span>
                  <span style={{ color: tenant.primary_color }}>{formatPrice(booking.total_price, currency)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border-stone-200 mb-8">
          <CardContent className="p-6">
            <h3 className="font-semibold text-stone-900 mb-4">{t.contactInformation}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-stone-600">
                <MapPin className="h-5 w-5" style={{ color: tenant.primary_color }} />
                <span>123 Homestay Lane, City Center</span>
              </div>
              <div className="flex items-center gap-3 text-stone-600">
                <Phone className="h-5 w-5" style={{ color: tenant.primary_color }} />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-3 text-stone-600 md:col-span-2">
                <Mail className="h-5 w-5" style={{ color: tenant.primary_color }} />
                <span>hello@{tenant.slug}.com</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${tenant.slug}/my-bookings`}>
            <Button 
              className="w-full sm:w-auto text-white"
              style={{ backgroundColor: tenant.primary_color }}
            >
              {t.viewMyBookings}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/${tenant.slug}`}>
            <Button variant="outline" className="w-full sm:w-auto">
              {t.backToHome}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

