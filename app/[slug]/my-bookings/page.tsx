import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { parseISO, isPast } from 'date-fns'
import { TenantSettings, defaultTenantSettings, CurrencyCode } from '@/types/database'
import { paginateData } from '@/lib/pagination'
import { MyBookingsContent } from './my-bookings-content'

export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 5

interface MyBookingsPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; page?: string }>
}

async function getUserBookings(slug: string) {
  const supabase = await createClient()
  
  // OPTIMIZED: Fetch tenant and user in parallel
  const [tenantResult, userResult] = await Promise.all([
    supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single(),
    supabase.auth.getUser()
  ])
  
  const tenant = tenantResult.data
  if (!tenant) return null

  const user = userResult.data?.user
  if (!user) return { tenant, bookings: [], user: null, profile: null }

  // OPTIMIZED: Fetch profile and bookings in parallel
  const [profileResult, bookingsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .single(),
    supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(*),
        reviews:reviews(id, booking_id, rating, comment, created_at)
      `)
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id)
      .order('check_in', { ascending: false })
  ])

  const profile = profileResult.data
  const bookings = bookingsResult.data || []

  // Reviews are now included via JOIN - no separate query needed
  const bookingsWithReviews = bookings.map(booking => ({
    ...booking,
    reviews: booking.reviews || []
  }))

  return { tenant, bookings: bookingsWithReviews, user, profile }
}

export default async function MyBookingsPage({ params, searchParams }: MyBookingsPageProps) {
  const { slug } = await params
  const { tab, page: pageParam } = await searchParams
  const data = await getUserBookings(slug)
  
  if (!data) {
    notFound()
  }

  const { tenant, bookings, user, profile } = data
  const settings = (tenant.settings as TenantSettings) || defaultTenantSettings
  const currency = (settings.currency || 'USD') as CurrencyCode

  if (!user) {
    redirect(`/${tenant.slug}/login?redirect=/${tenant.slug}/my-bookings`)
  }

  const upcomingBookings = bookings.filter(b => 
    !isPast(parseISO(b.check_in)) && !['cancelled', 'completed'].includes(b.status)
  )
  const pastBookings = bookings.filter(b => 
    isPast(parseISO(b.check_out)) || b.status === 'completed'
  )
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled')

  // Pagination - apply to active tab
  const activeTab = tab || 'upcoming'
  const page = pageParam ? parseInt(pageParam) : 1
  
  const paginatedUpcoming = paginateData(upcomingBookings, activeTab === 'upcoming' ? page : 1, ITEMS_PER_PAGE)
  const paginatedPast = paginateData(pastBookings, activeTab === 'past' ? page : 1, ITEMS_PER_PAGE)
  const paginatedCancelled = paginateData(cancelledBookings, activeTab === 'cancelled' ? page : 1, ITEMS_PER_PAGE)

  return (
    <MyBookingsContent
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
      primaryColor={tenant.primary_color}
      currency={currency}
      guestPhone={profile?.phone}
      bookings={bookings}
      upcomingBookings={upcomingBookings}
      pastBookings={pastBookings}
      cancelledBookings={cancelledBookings}
      activeTab={activeTab}
      paginatedUpcoming={paginatedUpcoming}
      paginatedPast={paginatedPast}
      paginatedCancelled={paginatedCancelled}
    />
  )
}
