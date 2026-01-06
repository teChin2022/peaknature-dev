import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Tenant, TenantSettings, defaultTenantSettings } from '@/types/database'
import { paginateData } from '@/lib/pagination'
import { BookingsPageContent } from '@/components/dashboard/bookings-page-content'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 10

interface BookingsPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}

interface BookingWithDetails {
  id: string
  tenant_id: string
  room_id: string
  user_id: string
  check_in: string
  check_out: string
  guests: number
  total_price: number
  status: string
  notes: string | null
  created_at: string
  room_name: string | null
  guest_full_name: string | null
  guest_email: string | null
  guest_phone: string | null
  payment_slip_url: string | null
}

async function getBookings(slug: string, filters: { status?: string; search?: string }) {
  const supabase = await createClient()
  
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single() as { data: Tenant | null }
  
  if (!tenantData) return null

  const tenant = tenantData

  // Use RPC function to get bookings with guest info (bypasses RLS for profile join)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookingsData, error } = await (supabase.rpc as any)('get_tenant_bookings', {
    p_tenant_id: tenant.id,
    p_status: filters.status && filters.status !== 'all' ? filters.status : null
  })

  if (error) {
    console.error('Error fetching bookings:', error)
    return { tenant, bookings: [] }
  }

  // Transform data to match expected format
  const bookings = ((bookingsData || []) as BookingWithDetails[]).map((b) => ({
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    total_price: b.total_price,
    status: b.status,
    created_at: b.created_at,
    payment_slip_url: b.payment_slip_url || undefined,
    room: b.room_name ? { name: b.room_name } : undefined,
    user: b.guest_email ? {
      full_name: b.guest_full_name || undefined,
      email: b.guest_email,
      phone: b.guest_phone || undefined
    } : undefined
  }))

  return { tenant, bookings }
}

export default async function DashboardBookingsPage({ params, searchParams }: BookingsPageProps) {
  const { slug } = await params
  const { status, search, page: pageParam } = await searchParams
  const data = await getBookings(slug, { status, search })
  
  if (!data) {
    notFound()
  }

  const { tenant, bookings } = data
  const settings = (tenant.settings as TenantSettings) || defaultTenantSettings
  const currency = settings.currency || 'THB'

  // Sort by created_at descending (newest first)
  const sortedBookings = [...bookings].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Filter by search term if provided
  let filteredBookings = sortedBookings
  if (search) {
    const searchLower = search.toLowerCase()
    filteredBookings = sortedBookings.filter((booking) => 
      booking.user?.full_name?.toLowerCase().includes(searchLower) ||
      booking.user?.email?.toLowerCase().includes(searchLower) ||
      booking.room?.name?.toLowerCase().includes(searchLower) ||
      booking.id.toLowerCase().includes(searchLower)
    )
  }

  // Pagination
  const page = pageParam ? parseInt(pageParam) : 1
  const { items: paginatedBookings, currentPage, totalPages, totalItems, itemsPerPage } = paginateData(filteredBookings, page, ITEMS_PER_PAGE)

  return (
    <BookingsPageContent
      slug={slug}
      tenant={{
        id: tenant.id,
        name: tenant.name,
        primary_color: tenant.primary_color,
      }}
      bookings={paginatedBookings}
      currency={currency}
      currentStatus={status}
      pagination={{
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage,
      }}
    />
  )
}
