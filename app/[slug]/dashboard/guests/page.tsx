import { createClient } from '@/lib/supabase/server'
import { GuestList } from '@/components/dashboard/guest-list'
import { Pagination } from '@/components/ui/pagination'
import { paginateData } from '@/lib/pagination'
import { PageHeader } from '@/components/dashboard/page-header'

// Disable caching to always show fresh data
export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 12

interface GuestsPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

interface GuestProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  tenant_id: string
  is_blocked: boolean
  avatar_url: string | null
  created_at: string
  province: string | null
  district: string | null
  sub_district: string | null
}

async function getGuestsData(slug: string) {
  const supabase = await createClient()
  
  // Get tenant
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('id, primary_color')
    .eq('slug', slug)
    .single() as { data: { id: string; primary_color: string } | null }
  
  if (!tenantData) return { guests: [], tenantId: '', primaryColor: '#000000' }

  const tenantId = tenantData.id
  const primaryColor = tenantData.primary_color || '#000000'

  // OPTIMIZED: Fetch guests and all bookings in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profilesResult, bookingsResult] = await Promise.all([
    (supabase.rpc as any)('get_tenant_guests', { p_tenant_id: tenantId }),
    supabase
      .from('bookings')
      .select('user_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
  ])

  if (profilesResult.error) {
    console.error('Error fetching guests:', profilesResult.error)
    return { guests: [], tenantId, primaryColor }
  }

  const profiles = profilesResult.data as GuestProfile[] | null
  if (!profiles || profiles.length === 0) return { guests: [], tenantId, primaryColor }

  const bookings = bookingsResult.data || []

  // OPTIMIZED: Calculate booking stats in memory instead of N+1 queries
  // Group bookings by user_id
  const bookingsByUser = bookings.reduce((acc, booking) => {
    const userId = booking.user_id
    if (!acc[userId]) {
      acc[userId] = { count: 0, lastBooking: null as string | null }
    }
    acc[userId].count++
    // First booking in the sorted list is the most recent
    if (!acc[userId].lastBooking) {
      acc[userId].lastBooking = booking.created_at
    }
    return acc
  }, {} as Record<string, { count: number; lastBooking: string | null }>)

  // Map profiles with their booking stats
  const guestData = profiles.map((profile) => ({
    profile,
    bookingCount: bookingsByUser[profile.id]?.count || 0,
    lastBooking: bookingsByUser[profile.id]?.lastBooking || null
  }))

  return { guests: guestData, tenantId, primaryColor }
}

export default async function GuestsPage({ params, searchParams }: GuestsPageProps) {
  const { slug } = await params
  const { page: pageParam } = await searchParams
  const { guests, tenantId, primaryColor } = await getGuestsData(slug)

  // Pagination
  const page = pageParam ? parseInt(pageParam) : 1
  const { items: paginatedGuests, currentPage, totalPages, totalItems, itemsPerPage } = paginateData(guests, page, ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      <PageHeader 
        titleKey="guests.title" 
        subtitleKey="guests.subtitle"
      />

      <GuestList 
        guests={paginatedGuests} 
        tenantId={tenantId}
        primaryColor={primaryColor}
      />
      
      {/* Pagination */}
      {guests.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          className="pt-4 border-t border-gray-200"
        />
      )}
    </div>
  )
}
