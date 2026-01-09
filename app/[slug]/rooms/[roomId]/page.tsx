import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { TenantSettings, defaultTenantSettings, CurrencyCode, CURRENCIES } from '@/types/database'
import { RoomDetailClient } from '@/components/room/room-detail-client'
import { RoomJsonLd, BreadcrumbJsonLd } from '@/components/seo/json-ld'

// Disable caching to always get fresh booking data
export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://peaksnature.com'

interface RoomDetailPageProps {
  params: Promise<{ slug: string; roomId: string }>
  searchParams: Promise<{ 
    error?: string
    checkIn?: string
    checkOut?: string
    guests?: string 
  }>
}

export async function generateMetadata({ params }: RoomDetailPageProps): Promise<Metadata> {
  const { slug, roomId } = await params
  const supabase = await createClient()
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug, settings')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!tenant) {
    return { title: 'Room Not Found' }
  }

  const { data: room } = await supabase
    .from('rooms')
    .select('name, description, images, base_price, max_guests')
    .eq('id', roomId)
    .eq('is_active', true)
    .single()

  if (!room) {
    return { title: 'Room Not Found' }
  }

  const settings = tenant.settings as TenantSettings | null
  const currency = settings?.currency || 'THB'
  const currencySymbol = CURRENCIES[currency]?.symbol || '฿'
  const description = room.description || `Book ${room.name} at ${tenant.name}. Up to ${room.max_guests} guests. Starting from ${currencySymbol}${room.base_price}/night.`
  const images = room.images?.filter((img: string) => img && img.trim() !== '') || []

  return {
    title: `${room.name} - ${tenant.name}`,
    description,
    openGraph: {
      title: `${room.name} - ${tenant.name}`,
      description,
      url: `${siteUrl}/${tenant.slug}/rooms/${roomId}`,
      siteName: 'PeaksNature',
      images: images.length > 0 ? images.map((img: string) => ({
        url: img,
        width: 1200,
        height: 630,
        alt: room.name,
      })) : undefined,
      locale: 'th_TH',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${room.name} - ${tenant.name}`,
      description,
      images: images.length > 0 ? [images[0]] : undefined,
    },
  }
}

async function getRoomWithTenant(slug: string, roomId: string) {
  const supabase = await createClient()
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  if (!tenant) return null

  // OPTIMIZED: Fetch room, blocked dates, bookings, and reviews in parallel
  const [roomResult, blockedDatesResult, bookingsResult, reviewsResult] = await Promise.all([
    supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .single(),
    supabase
      .from('room_availability')
      .select('date')
      .eq('room_id', roomId)
      .eq('is_blocked', true)
      .gte('date', new Date().toISOString().split('T')[0]),
    supabase.rpc('get_room_booked_dates', { p_room_id: roomId }),
    supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        booking:bookings!inner(room_id),
        user:profiles(full_name, avatar_url)
      `)
      .eq('booking.room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(20)
  ])

  const room = roomResult.data
  if (!room) return null

  // Calculate average rating
  const roomReviews = reviewsResult.data || []
  const totalReviews = roomReviews.length
  const averageRating = totalReviews > 0 
    ? roomReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
    : 0

  return { 
    tenant, 
    room, 
    blockedDates: blockedDatesResult.data?.map(d => d.date) || [],
    bookedRanges: bookingsResult.data || [],
    reviews: roomReviews,
    averageRating,
    totalReviews
  }
}

export default async function RoomDetailPage({ params, searchParams }: RoomDetailPageProps) {
  const { slug, roomId } = await params
  const { error, checkIn, checkOut, guests } = await searchParams
  const data = await getRoomWithTenant(slug, roomId)
  
  if (!data) {
    notFound()
  }

  const { tenant, room, blockedDates, bookedRanges, averageRating, totalReviews } = data
  const settings = (tenant.settings as TenantSettings) || defaultTenantSettings
  const currency = (settings.currency || 'USD') as CurrencyCode
  const images = room.images?.length ? room.images : [
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80'
  ]
  
  // Initial values for editing (from query params)
  const initialCheckIn = checkIn || undefined
  const initialCheckOut = checkOut || undefined
  const initialGuests = guests ? parseInt(guests) : undefined

  return (
    <>
      <RoomJsonLd
        name={room.name}
        description={room.description || undefined}
        url={`${siteUrl}/${tenant.slug}/rooms/${room.id}`}
        image={images}
        price={room.base_price}
        priceCurrency={currency}
        maxOccupancy={room.max_guests}
        amenities={room.amenities}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: siteUrl },
          { name: tenant.name, url: `${siteUrl}/${tenant.slug}` },
          { name: 'Rooms', url: `${siteUrl}/${tenant.slug}/rooms` },
          { name: room.name, url: `${siteUrl}/${tenant.slug}/rooms/${room.id}` },
        ]}
      />
      <RoomDetailClient
        room={room}
        tenant={tenant}
        images={images}
        blockedDates={blockedDates}
        bookedRanges={bookedRanges}
        currency={currency}
        averageRating={averageRating}
        totalReviews={totalReviews}
        error={error}
        initialCheckIn={initialCheckIn}
        initialCheckOut={initialCheckOut}
        initialGuests={initialGuests}
      />
    </>
  )
}
