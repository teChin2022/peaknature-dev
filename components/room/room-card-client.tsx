'use client'

import Link from 'next/link'
import { Users, Calendar, Wifi, Car, Coffee, Wind, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Room, CurrencyCode } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { RoomCardImage } from '@/components/room/room-card-image'
import { useTranslations } from 'next-intl'

const amenityIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-4 w-4" />,
  parking: <Car className="h-4 w-4" />,
  breakfast: <Coffee className="h-4 w-4" />,
  'air conditioning': <Wind className="h-4 w-4" />,
}

interface RoomCardClientProps {
  room: Room
  tenantSlug: string
  primaryColor: string
  currency: CurrencyCode
}

export function RoomCardClient({ room, tenantSlug, primaryColor, currency }: RoomCardClientProps) {
  const t = useTranslations('room')
  const displayAmenities = room.amenities?.slice(0, 4) || []
  const images = room.images?.length ? room.images : ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80']
  
  return (
    <Card className="group border border-stone-200 hover:border-stone-300 transition-all duration-300 hover:shadow-lg overflow-hidden !p-0">
      <div className="flex flex-col md:flex-row">
        {/* Image with Gallery */}
        <div className="w-full md:w-64 lg:w-72 flex-shrink-0">
          <RoomCardImage images={images} roomName={room.name} />
        </div>

        {/* Content */}
        <CardContent className="flex-1 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-xl font-semibold text-stone-900 group-hover:text-stone-700 transition-colors">
                {room.name}
              </h3>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold" style={{ color: primaryColor }}>
                  {formatPrice(room.base_price, currency)}
                </div>
                <div className="text-sm text-stone-500">{t('perNight')}</div>
              </div>
            </div>
            
            <p className="text-stone-600 mb-4 line-clamp-2">
              {room.description || t('noDescription')}
            </p>

            {/* Room Details */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-stone-600">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {t('upTo')} {room.max_guests} {room.max_guests > 1 ? t('guests') : t('guest')}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {t('minNights')}: {room.min_nights} {room.min_nights > 1 ? t('nights') : t('night')}
              </span>
            </div>

            {/* Amenities */}
            {displayAmenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {displayAmenities.map((amenity) => (
                  <Badge 
                    key={amenity} 
                    variant="secondary"
                    className="bg-stone-100 text-stone-700 font-normal"
                  >
                    {amenityIcons[amenity.toLowerCase()] || null}
                    <span className="ml-1 capitalize">{amenity}</span>
                  </Badge>
                ))}
                {room.amenities && room.amenities.length > 4 && (
                  <Badge variant="secondary" className="bg-stone-100 text-stone-700 font-normal">
                    +{room.amenities.length - 4} {t('more')}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <div className="text-sm text-stone-500">
              {t('checkInTime')}: {room.check_in_time} · {t('checkOutTime')}: {room.check_out_time}
            </div>
            <Link href={`/${tenantSlug}/rooms/${room.id}`}>
              <Button 
                className="text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {t('bookNow')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

