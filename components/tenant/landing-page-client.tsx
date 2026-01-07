'use client'

import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowRight, Star, Wifi, Car, Coffee, Utensils, Wind, Tv, MapPin, Users, Calendar, 
  Phone, Mail, ExternalLink, Navigation,
  Bath, Bed, Dumbbell, Waves, Mountain, TreePine, Flame, Snowflake, Lock, ShieldCheck,
  PawPrint, Baby, Cigarette, Clock, Banknote, CreditCard, Shirt, Droplets, Sun, Moon, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Room, Tenant, TenantSettings, TenantAmenity, CurrencyCode } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { useTranslations } from 'next-intl'

// Icon mapping for amenities
const amenityIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  car: <Car className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  coffee: <Coffee className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  utensils: <Utensils className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  wind: <Wind className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  tv: <Tv className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  bath: <Bath className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  bed: <Bed className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  dumbbell: <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  waves: <Waves className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  mountain: <Mountain className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  tree: <TreePine className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  restaurant: <Utensils className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  flame: <Flame className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  snowflake: <Snowflake className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  lock: <Lock className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  shield: <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  paw: <PawPrint className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  baby: <Baby className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  'no-smoking': <Cigarette className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  clock: <Clock className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  cash: <Banknote className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  card: <CreditCard className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  laundry: <Shirt className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  'hot-water': <Droplets className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  balcony: <Sun className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  night: <Moon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  star: <Star className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
  sparkles: <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
}

interface RoomCardProps {
  room: Room
  tenantSlug: string
  primaryColor: string
  currency: CurrencyCode
}

function RoomCard({ room, tenantSlug, primaryColor, currency }: RoomCardProps) {
  const t = useTranslations('landing')
  const tRoom = useTranslations('room')
  const displayImage = room.images?.[0] || 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80'
  
  return (
    <Card className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={displayImage}
          alt={room.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <Badge 
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white border-0 text-xs sm:text-sm"
          style={{ backgroundColor: primaryColor }}
        >
          {t('from')} {formatPrice(room.base_price, currency)}/{tRoom('night')}
        </Badge>
      </div>
      <CardContent className="p-4 sm:p-5 md:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-stone-900 mb-1.5 sm:mb-2">{room.name}</h3>
        <p className="text-stone-600 text-xs sm:text-sm line-clamp-2 mb-3 sm:mb-4">
          {room.description || tRoom('noDescription')}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3 sm:gap-4 text-stone-500 text-xs sm:text-sm">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {room.max_guests} {tRoom('guests')}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {room.min_nights > 1 ? t('minNightsStay', { nights: room.min_nights }) : t('minNightStay', { nights: room.min_nights })}
            </span>
          </div>
          <Link href={`/${tenantSlug}/rooms/${room.id}`} className="self-end sm:self-auto">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 font-medium h-8 sm:h-9 text-xs sm:text-sm"
              style={{ color: primaryColor }}
            >
              {t('view')}
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

interface LandingPageClientProps {
  tenant: Tenant
  rooms: Room[]
  settings: TenantSettings
  realStats: {
    averageRating: number | null
    totalReviews: number
    guestCount: number
    roomCount: number
  }
  heroImages: string[]
  fullAddress: string
  currency: CurrencyCode
  enabledAmenities: TenantAmenity[]
}

export function LandingPageClient({
  tenant,
  rooms,
  settings,
  realStats,
  heroImages,
  fullAddress,
  currency,
  enabledAmenities,
}: LandingPageClientProps) {
  const t = useTranslations('landing')
  const tHero = useTranslations('hero')
  const tRoom = useTranslations('room')

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] sm:min-h-[85vh] lg:min-h-[90vh] flex items-center">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-50 via-white to-amber-50/30">
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 lg:gap-12 items-center">
            {/* Text Content */}
            <div className="text-center lg:text-left">
              <div 
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6"
                style={{ 
                  backgroundColor: `${tenant.primary_color}15`,
                  color: tenant.primary_color 
                }}
              >
                <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
                {settings.hero.tagline}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-stone-900 mb-4 sm:mb-6">
                {t('welcomeTo')}{' '}
                <span style={{ color: tenant.primary_color }}>
                  {tenant.name}
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-stone-600 mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed px-2 sm:px-0">
                {settings.hero.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start px-4 sm:px-0">
                <Link href={`/${tenant.slug}/rooms`} className="w-full sm:w-auto">
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto text-white px-6 sm:px-8 h-12 sm:h-14 text-base sm:text-lg"
                    style={{ backgroundColor: tenant.primary_color }}
                  >
                    {tHero('exploreRooms')}
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
                <Link href={`/${tenant.slug}#location`} className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8">
                    <MapPin className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    {t('getDirections')}
                  </Button>
                </Link>
              </div>

              {/* Stats - Only show if there's real data */}
              {settings.stats.show_stats && (realStats.averageRating || realStats.guestCount > 0 || realStats.roomCount > 0) && (
                <div className="grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-8 border-t border-stone-200">
                  {/* Rating - only show if there are reviews */}
                  {realStats.averageRating && realStats.totalReviews > 0 ? (
                    <div>
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900">
                        {realStats.averageRating}
                      </div>
                      <div className="text-xs sm:text-sm text-stone-500">
                        {t('ratingReviews', { count: realStats.totalReviews })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900">
                        {realStats.roomCount > 0 ? realStats.roomCount : rooms.length}
                      </div>
                      <div className="text-xs sm:text-sm text-stone-500">
                        {t('availableRooms')}
                      </div>
                    </div>
                  )}
                  
                  {/* Guest count - only show if there are guests */}
                  {realStats.guestCount > 0 ? (
                    <div>
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900">
                        {realStats.guestCount}+
                      </div>
                      <div className="text-xs sm:text-sm text-stone-500">
                        {t('happyGuests')}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900">
                        {settings.stats.custom_stat_value || t('cozy')}
                      </div>
                      <div className="text-xs sm:text-sm text-stone-500">
                        {settings.stats.custom_stat_label || t('atmosphere')}
                      </div>
                    </div>
                  )}
                  
                  {/* Room count */}
                  <div>
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900">
                      {realStats.roomCount > 0 ? realStats.roomCount : rooms.length}
                    </div>
                    <div className="text-xs sm:text-sm text-stone-500">
                      {t('rooms')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Hero Image Grid - Always show 4 boxes */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  {/* Image 1 */}
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                    {heroImages[0] ? (
                      <Image
                        src={heroImages[0]}
                        alt={`${tenant.name} - Image 1`}
                        width={400}
                        height={500}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: `${tenant.primary_color}15` }}
                      >
                        <MapPin className="h-12 w-12 opacity-30" style={{ color: tenant.primary_color }} />
                      </div>
                    )}
                  </div>
                  {/* Image 2 */}
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                    {heroImages[1] ? (
                      <Image
                        src={heroImages[1]}
                        alt={`${tenant.name} - Image 2`}
                        width={400}
                        height={300}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: `${tenant.primary_color}10` }}
                      >
                        <MapPin className="h-10 w-10 opacity-20" style={{ color: tenant.primary_color }} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  {/* Image 3 */}
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                    {heroImages[2] ? (
                      <Image
                        src={heroImages[2]}
                        alt={`${tenant.name} - Image 3`}
                        width={400}
                        height={300}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: `${tenant.primary_color}10` }}
                      >
                        <MapPin className="h-10 w-10 opacity-20" style={{ color: tenant.primary_color }} />
                      </div>
                    )}
                  </div>
                  {/* Image 4 */}
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                    {heroImages[3] ? (
                      <Image
                        src={heroImages[3]}
                        alt={`${tenant.name} - Image 4`}
                        width={400}
                        height={500}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: `${tenant.primary_color}15` }}
                      >
                        <MapPin className="h-12 w-12 opacity-30" style={{ color: tenant.primary_color }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Decorative Elements */}
              <div 
                className="absolute -z-10 -bottom-8 -right-8 w-72 h-72 rounded-full blur-3xl opacity-30"
                style={{ backgroundColor: tenant.primary_color }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Rooms Section */}
      {rooms.length > 0 && (
        <section className="py-16 sm:py-20 md:py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-3 sm:mb-4">
                {t('featuredRooms')}
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-stone-600 max-w-2xl mx-auto px-4 sm:px-0">
                {t('featuredRoomsDesc')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {rooms.map((room) => (
                <RoomCard 
                  key={room.id} 
                  room={room} 
                  tenantSlug={tenant.slug}
                  primaryColor={tenant.primary_color}
                  currency={currency}
                />
              ))}
            </div>
            <div className="text-center mt-8 sm:mt-10 md:mt-12">
              <Link href={`/${tenant.slug}/rooms`}>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="gap-2 h-11 sm:h-12 text-sm sm:text-base"
                >
                  {t('viewAllRooms')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Amenities Section */}
      {enabledAmenities.length > 0 && (
        <section id="amenities" className="py-16 sm:py-20 md:py-24 bg-stone-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-3 sm:mb-4">
                {t('whatWeOffer')}
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-stone-600 max-w-2xl mx-auto px-4 sm:px-0">
                {t('whatWeOfferDesc')}
              </p>
            </div>
            <div className={`grid gap-3 sm:gap-4 md:gap-6 ${
              enabledAmenities.length <= 4 
                ? 'grid-cols-2 sm:grid-cols-4' 
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
            }`}>
              {enabledAmenities.map((amenity: TenantAmenity) => (
                <div 
                  key={amenity.id}
                  className="flex flex-col items-center p-4 sm:p-5 md:p-6 bg-white rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div 
                    className="mb-3 sm:mb-4 p-3 sm:p-4 rounded-full"
                    style={{ 
                      backgroundColor: `${tenant.primary_color}15`,
                      color: tenant.primary_color 
                    }}
                  >
                    {amenityIcons[amenity.icon] || <Star className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />}
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-stone-700 text-center">
                    {amenity.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Location Section */}
      <section id="location" className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 lg:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-3 sm:mb-4">
                {t('findUs')}
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-stone-600 mb-6 sm:mb-8 leading-relaxed">
                {settings.contact.directions || t('locationDefault')}
              </p>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div 
                    className="p-2.5 sm:p-3 rounded-lg flex-shrink-0"
                    style={{ 
                      backgroundColor: `${tenant.primary_color}15`,
                      color: tenant.primary_color 
                    }}
                  >
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-semibold text-stone-900">
                      {t('address')}
                    </h4>
                    <p className="text-sm sm:text-base text-stone-600">{fullAddress}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4">
                  <div 
                    className="p-2.5 sm:p-3 rounded-lg flex-shrink-0"
                    style={{ 
                      backgroundColor: `${tenant.primary_color}15`,
                      color: tenant.primary_color 
                    }}
                  >
                    <Car className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-semibold text-stone-900">
                      {t('gettingHere')}
                    </h4>
                    <p className="text-sm sm:text-base text-stone-600">
                      {settings.contact.directions || t('gettingHereDefault')}
                    </p>
                  </div>
                </div>
              </div>
              
              {settings.contact.map_url ? (
                <a href={settings.contact.map_url} target="_blank" rel="noopener noreferrer">
                  <Button 
                    size="lg" 
                    className="mt-6 sm:mt-8 text-white h-11 sm:h-12 text-sm sm:text-base gap-2"
                    style={{ backgroundColor: tenant.primary_color }}
                  >
                    <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
                    {t('openInMaps')}
                  </Button>
                </a>
              ) : (
                <Button 
                  size="lg" 
                  className="mt-6 sm:mt-8 text-white h-11 sm:h-12 text-sm sm:text-base"
                  style={{ backgroundColor: tenant.primary_color }}
                  disabled
                >
                  <MapPin className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  {t('openInMaps')}
                </Button>
              )}
            </div>
            <div className="order-1 lg:order-2 relative">
              <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-lg sm:shadow-xl bg-stone-200">
                {settings.contact.map_embed ? (
                  <iframe
                    src={settings.contact.map_embed}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={t('locationMap')}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                    <div className="text-center">
                      <MapPin className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 mx-auto mb-3 sm:mb-4 text-stone-400" />
                      <p className="text-sm sm:text-base text-stone-500">
                        {t('map')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {/* Open in Google Maps button */}
              {settings.contact.map_url && (
                <a
                  href={settings.contact.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg text-sm font-medium text-stone-700 hover:bg-white transition-colors cursor-pointer"
                >
                  <Navigation className="h-4 w-4" />
                  {t('openInGoogleMaps')}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 md:py-24 relative overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{ backgroundColor: tenant.primary_color }}
        />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
            {t('readyForStay')}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-white/90 mb-8 sm:mb-10 max-w-2xl mx-auto px-2">
            {t('readyForStayDesc')}
          </p>
          <Link href={`/${tenant.slug}/rooms`}>
            <Button 
              size="lg" 
              className="bg-white hover:bg-stone-100 text-base sm:text-lg h-12 sm:h-14 px-6 sm:px-10"
              style={{ color: tenant.primary_color }}
            >
              {t('bookNow')}
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}

