import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { TenantSettings, defaultTenantSettings, TenantAmenity, CurrencyCode } from '@/types/database'
import { LandingPageClient } from '@/components/tenant/landing-page-client'
import { LodgingBusinessJsonLd } from '@/components/seo/json-ld'

interface TenantPageProps {
  params: Promise<{ slug: string }>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://peaksnature.com'

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug, settings')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!tenant) {
    return {
      title: 'Property Not Found',
    }
  }

  const settings = tenant.settings as TenantSettings | null
  const description = settings?.hero?.description || `Book your stay at ${tenant.name}. Authentic homestay experience with modern amenities.`
  const images = settings?.hero?.images?.filter((img: string) => img && img.trim() !== '') || []

  return {
    title: tenant.name,
    description,
    openGraph: {
      title: tenant.name,
      description,
      url: `${siteUrl}/${tenant.slug}`,
      siteName: 'PeaksNature',
      images: images.length > 0 ? images.map((img: string) => ({
        url: img,
        width: 1200,
        height: 630,
        alt: tenant.name,
      })) : undefined,
      locale: 'th_TH',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: tenant.name,
      description,
      images: images.length > 0 ? [images[0]] : undefined,
    },
  }
}

async function getTenantWithRooms(slug: string) {
  const supabase = await createClient()
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  if (!tenant) return null

  // OPTIMIZED: Fetch rooms and stats in parallel
  const [roomsResult, statsResult] = await Promise.all([
    supabase
      .from('rooms')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .limit(3),
    supabase.rpc('get_tenant_stats', { p_tenant_id: tenant.id })
  ])

  const rooms = roomsResult.data

  // Get tenant stats using RPC function (bypasses RLS for public access)
  // If RPC fails or doesn't exist, fall back to direct queries
  let tenantStats = {
    averageRating: null as number | null,
    totalReviews: 0,
    guestCount: 0,
    roomCount: 0,
  }

  if (statsResult.error) {
    // RPC function might not exist yet, use fallback
    // OPTIMIZED: Fetch room count and bookings in parallel
    const [roomCountResult, bookingsResult] = await Promise.all([
      supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_active', true),
      supabase
        .from('bookings')
        .select('id')
        .eq('tenant_id', tenant.id)
    ])
    
    tenantStats.roomCount = roomCountResult.count || 0
    
    // Try to get reviews via bookings
    const tenantBookings = bookingsResult.data
    if (tenantBookings && tenantBookings.length > 0) {
      const bookingIds = tenantBookings.map(b => b.id)
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .in('booking_id', bookingIds)
      
      if (reviews && reviews.length > 0) {
        tenantStats.totalReviews = reviews.length
        tenantStats.averageRating = Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
      }
    }
  } else {
    // RPC succeeded - statsData is an array with one row when using RETURNS TABLE
    const statsRow = Array.isArray(statsResult.data) && statsResult.data.length > 0 
      ? statsResult.data[0] 
      : statsResult.data

    tenantStats = {
      averageRating: statsRow?.average_rating ?? null,
      totalReviews: statsRow?.total_reviews ?? 0,
      guestCount: statsRow?.guest_count ?? 0,
      roomCount: statsRow?.room_count ?? 0,
    }
  }
  
  // Merge settings with defaults
  const rawSettings = tenant.settings as TenantSettings | null
  const settings: TenantSettings = rawSettings 
    ? {
        ...defaultTenantSettings,
        ...rawSettings,
        hero: { 
          ...defaultTenantSettings.hero, 
          ...(rawSettings.hero || {}),
          images: rawSettings.hero?.images || defaultTenantSettings.hero.images
        },
        contact: { ...defaultTenantSettings.contact, ...(rawSettings.contact || {}) },
        stats: { ...defaultTenantSettings.stats, ...(rawSettings.stats || {}) },
        social: { ...defaultTenantSettings.social, ...(rawSettings.social || {}) },
        amenities: rawSettings.amenities || defaultTenantSettings.amenities,
      }
    : defaultTenantSettings
  
  return { 
    tenant, 
    rooms: rooms || [], 
    settings,
    realStats: {
      averageRating: tenantStats.averageRating,
      totalReviews: tenantStats.totalReviews || 0,
      guestCount: tenantStats.guestCount || 0,
      roomCount: tenantStats.roomCount || 0,
    }
  }
}

export default async function TenantLandingPage({ params }: TenantPageProps) {
  const { slug } = await params
  const data = await getTenantWithRooms(slug)
  
  if (!data) {
    notFound()
  }

  const { tenant, rooms, settings, realStats } = data
  const enabledAmenities = settings.amenities.filter((a: TenantAmenity) => a.enabled)
  const currency = (settings.currency || 'USD') as CurrencyCode
  
  // Get hero images (filter out empty strings)
  const heroImages = (settings.hero.images || []).filter((img: string) => img && img.trim() !== '')
  
  // Build full address
  // Build full address - prefer location data if available, fallback to contact address
  let fullAddress = ''
  if (settings.location?.province) {
    // Use new location data (Thai format: sub-district, district, province, postal code)
    const locationParts = [
      settings.location.sub_district,
      settings.location.district,
      settings.location.province,
      settings.location.postal_code,
    ].filter(Boolean)
    fullAddress = locationParts.join(', ')
  } else {
    // Fallback to old contact address format
    const addressParts = [
      settings.contact.address,
      settings.contact.city,
      settings.contact.postal_code,
      settings.contact.country
    ].filter(Boolean)
    fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '123 Homestay Lane, City Center, 12345'
  }

  return (
    <>
      <LodgingBusinessJsonLd
        name={tenant.name}
        description={settings.hero.description}
        url={`${siteUrl}/${tenant.slug}`}
        image={heroImages.length > 0 ? heroImages : undefined}
        address={{
          addressLocality: settings.location?.district || settings.contact.city,
          addressRegion: settings.location?.province || '',
          postalCode: settings.location?.postal_code || settings.contact.postal_code,
          addressCountry: 'TH',
        }}
        priceRange={currency === 'THB' ? '฿฿' : '$$'}
        telephone={settings.contact.phone}
        email={settings.contact.email}
        aggregateRating={realStats.totalReviews > 0 && realStats.averageRating ? {
          ratingValue: realStats.averageRating,
          reviewCount: realStats.totalReviews,
        } : undefined}
      />
      <LandingPageClient
        tenant={tenant}
        rooms={rooms}
        settings={settings}
        realStats={realStats}
        heroImages={heroImages}
        fullAddress={fullAddress}
        currency={currency}
        enabledAmenities={enabledAmenities}
      />
    </>
  )
}
