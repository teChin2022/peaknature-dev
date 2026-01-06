'use client'

import Link from 'next/link'
import { 
  ArrowLeft, Users, Calendar, Clock, Wifi, Car, Coffee, 
  Utensils, Wind, Tv, CheckCircle2, AlertCircle, Star 
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { BookingForm } from '@/components/booking/booking-form'
import { ImageGallery } from '@/components/room/image-gallery'
import { StarRatingCompact } from '@/components/review/star-rating'
import { Room, Tenant, CurrencyCode } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { useTranslations } from 'next-intl'
import { useLanguage } from '@/components/providers/language-provider'

const amenityIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-5 w-5" />,
  parking: <Car className="h-5 w-5" />,
  breakfast: <Coffee className="h-5 w-5" />,
  kitchen: <Utensils className="h-5 w-5" />,
  'air conditioning': <Wind className="h-5 w-5" />,
  tv: <Tv className="h-5 w-5" />,
}

interface RoomDetailClientProps {
  room: Room
  tenant: Tenant
  images: string[]
  blockedDates: string[]
  bookedRanges: { check_in: string; check_out: string }[]
  currency: CurrencyCode
  averageRating: number
  totalReviews: number
  error?: string
  initialCheckIn?: string
  initialCheckOut?: string
  initialGuests?: number
}

export function RoomDetailClient({
  room,
  tenant,
  images,
  blockedDates,
  bookedRanges,
  currency,
  averageRating,
  totalReviews,
  error,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
}: RoomDetailClientProps) {
  const t = useTranslations('room')
  const tBooking = useTranslations('booking')
  const { locale } = useLanguage()

  const defaultDescription = locale === 'th'
    ? `ยินดีต้อนรับสู่ ${room.name} ห้องพักที่ออกแบบมาอย่างพิถีพิถันเพื่อความสะดวกสบายและสไตล์ที่ลงตัว ห้องนี้มีทุกสิ่งที่คุณต้องการสำหรับการพักผ่อนอย่างเต็มที่ ไม่ว่าคุณจะมาเพื่อธุรกิจหรือพักผ่อน`
    : `Welcome to ${room.name}, a thoughtfully designed space that combines comfort with style. This room offers everything you need for a relaxing stay, from premium bedding to modern amenities. Whether you're here for business or leisure, you'll find the perfect environment to unwind and recharge.`

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Back Navigation */}
      <div className="bg-white border-b border-stone-200">
        <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
          <Link 
            href={`/${tenant.slug}/rooms`}
            className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === 'th' ? 'กลับไปห้องพักทั้งหมด' : 'Back to all rooms'}
          </Link>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <ImageGallery images={images} roomName={room.name} />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Room Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                {averageRating >= 4.5 && totalReviews >= 3 && (
                  <Badge 
                    className="text-white"
                    style={{ backgroundColor: tenant.primary_color }}
                  >
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    {locale === 'th' ? 'ยอดนิยม' : 'Top Rated'}
                  </Badge>
                )}
                {totalReviews > 0 && (
                  <StarRatingCompact
                    rating={averageRating}
                    reviewCount={totalReviews}
                    size="md"
                    primaryColor={tenant.primary_color}
                  />
                )}
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-stone-900 mb-4">
                {room.name}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-stone-600">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('upTo')} {room.max_guests} {locale === 'th' ? 'คน' : 'guests'}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('minNights')}: {room.min_nights} {locale === 'th' ? 'คืน' : (room.min_nights > 1 ? 'nights' : 'night')}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {tBooking('checkIn')}: {room.check_in_time}
                </span>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h2 className="text-xl font-semibold text-stone-900 mb-4">
                {locale === 'th' ? 'เกี่ยวกับห้องนี้' : 'About This Room'}
              </h2>
              <p className="text-stone-600 leading-relaxed">
                {room.description || defaultDescription}
              </p>
            </div>

            <Separator />

            {/* Amenities */}
            {room.amenities && room.amenities.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-stone-900 mb-4">
                  {t('amenities')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {room.amenities.map((amenity) => (
                    <div 
                      key={amenity}
                      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-stone-200"
                    >
                      <div 
                        className="p-2 rounded-lg"
                        style={{ 
                          backgroundColor: `${tenant.primary_color}15`,
                          color: tenant.primary_color 
                        }}
                      >
                        {amenityIcons[amenity.toLowerCase()] || <CheckCircle2 className="h-5 w-5" />}
                      </div>
                      <span className="font-medium text-stone-700 capitalize">
                        {amenity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* House Rules */}
            {room.rules && room.rules.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-xl font-semibold text-stone-900 mb-4">
                    {t('houseRules')}
                  </h2>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <ul className="space-y-3">
                      {room.rules.map((rule, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span className="text-stone-700">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Check-in/out Times */}
            <div>
              <h2 className="text-xl font-semibold text-stone-900 mb-4">
                {locale === 'th' ? 'เวลาเช็คอิน & เช็คเอาท์' : 'Check-in & Check-out'}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <div className="text-sm text-stone-500 mb-1">{t('checkInTime')}</div>
                  <div className="text-2xl font-bold text-stone-900">{room.check_in_time}</div>
                </div>
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <div className="text-sm text-stone-500 mb-1">{t('checkOutTime')}</div>
                  <div className="text-2xl font-bold text-stone-900">{room.check_out_time}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Error Message */}
              {error === 'unavailable' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">
                        {tBooking('dateErrors.datesNotAvailable')}
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {tBooking('dateErrors.datesUnavailable')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <Card className="border-stone-200 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-bold" style={{ color: tenant.primary_color }}>
                        {formatPrice(room.base_price, currency)}
                      </span>
                      <span className="text-stone-600"> / {locale === 'th' ? 'คืน' : 'night'}</span>
                    </div>
                    {totalReviews > 0 && (
                      <StarRatingCompact
                        rating={averageRating}
                        reviewCount={totalReviews}
                        size="sm"
                        primaryColor={tenant.primary_color}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <BookingForm 
                    room={room}
                    tenant={tenant}
                    blockedDates={blockedDates}
                    bookedRanges={bookedRanges}
                    currency={currency}
                    initialCheckIn={initialCheckIn}
                    initialCheckOut={initialCheckOut}
                    initialGuests={initialGuests}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

