import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Star, MessageSquare, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import Image from 'next/image'
import { StarRating, StarRatingCompact } from '@/components/review/star-rating'
import { Pagination } from '@/components/ui/pagination'
import { paginateData } from '@/lib/pagination'
import { PageHeader } from '@/components/dashboard/page-header'

export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 10

interface DashboardReviewsPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

async function getReviewsData(slug: string) {
  const supabase = await createClient()

  // OPTIMIZED: Fetch user and tenant in parallel
  const [userResult, tenantResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
  ])

  const user = userResult.data?.user
  if (!user) return null

  const tenant = tenantResult.data
  if (!tenant) return null

  // Check if user is host of this tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'host' || profile.tenant_id !== tenant.id) {
    return null
  }

  // Get all reviews with bookings and user profiles in one query using JOINs
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, rating, comment, created_at, booking_id, user_id,
      booking:bookings!inner(
        id, check_in, check_out, user_id,
        room:rooms!inner(id, name, tenant_id)
      ),
      user:profiles(id, full_name, email, avatar_url)
    `)
    .eq('booking.room.tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  // No need for separate tenantBookings or userProfiles queries - all data is JOINed

  // Reviews already have booking and user data from JOIN
  const reviewsWithData = (reviews || []).map(review => ({
    ...review,
    // Data is already included from JOIN
  }))

  // Calculate stats
  const totalReviews = reviewsWithData.length
  const averageRating = totalReviews > 0
    ? reviewsWithData.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0

  // Rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviewsWithData.filter((r) => r.rating === rating).length,
  }))

  // Recent reviews (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentReviews = reviewsWithData.filter(
    (r) => new Date(r.created_at) >= thirtyDaysAgo
  ).length

  return {
    tenant,
    reviews: reviewsWithData,
    stats: {
      totalReviews,
      averageRating,
      ratingDistribution,
      recentReviews,
    },
  }
}

export default async function DashboardReviewsPage({ params, searchParams }: DashboardReviewsPageProps) {
  const { slug } = await params
  const { page: pageParam } = await searchParams
  const data = await getReviewsData(slug)

  if (!data) {
    notFound()
  }

  const { tenant, reviews, stats } = data

  // Pagination
  const page = pageParam ? parseInt(pageParam) : 1
  const { items: paginatedReviews, currentPage, totalPages, totalItems, itemsPerPage } = paginateData(reviews, page, ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader 
        titleKey="reviews.title" 
        subtitleKey="reviews.subtitle"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${tenant.primary_color}15` }}
            >
              <Star className="h-5 w-5" style={{ color: tenant.primary_color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Average Rating</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-gray-900">
                  {stats.averageRating.toFixed(1)}
                </p>
                <StarRating
                  rating={stats.averageRating}
                  size="sm"
                  primaryColor={tenant.primary_color}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${tenant.primary_color}15` }}
            >
              <MessageSquare className="h-5 w-5" style={{ color: tenant.primary_color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Reviews</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalReviews}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${tenant.primary_color}15` }}
            >
              <TrendingUp className="h-5 w-5" style={{ color: tenant.primary_color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Last 30 Days</p>
              <p className="text-xl font-bold text-gray-900">{stats.recentReviews}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="space-y-1.5">
            {stats.ratingDistribution.map(({ rating, count }) => (
              <div key={rating} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-gray-600">{rating} star</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0}%`,
                      backgroundColor: tenant.primary_color,
                    }}
                  />
                </div>
                <span className="w-4 text-gray-500 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">All Reviews</h2>
        </div>
        <div className="p-5">
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {paginatedReviews.map((review) => {
                const booking = review.booking
                const user = review.user

                if (!booking) return null

                return (
                  <div
                    key={review.id}
                    className="p-4 bg-gray-50/50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {user?.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.full_name || 'Guest'}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                            style={{ backgroundColor: tenant.primary_color }}
                          >
                            {(user?.full_name || user?.email || 'G')[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {user?.full_name || 'Anonymous Guest'}
                            </h4>
                            <p className="text-xs text-gray-500">
                              Stayed at{' '}
                              <span className="font-medium">{booking.room.name}</span>
                              {' · '}
                              {format(new Date(booking.check_in), 'MMM d')} -{' '}
                              {format(new Date(booking.check_out), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StarRatingCompact
                              rating={review.rating}
                              size="sm"
                              primaryColor={tenant.primary_color}
                            />
                            <Badge
                              variant="outline"
                              className={
                                review.rating >= 4
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 text-xs'
                                  : review.rating >= 3
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 text-xs'
                                  : 'border-red-200 bg-red-50 text-red-700 text-xs'
                              }
                            >
                              {review.rating >= 4
                                ? 'Positive'
                                : review.rating >= 3
                                ? 'Neutral'
                                : 'Negative'}
                            </Badge>
                          </div>
                        </div>

                        {review.comment && (
                          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                            &ldquo;{review.comment}&rdquo;
                          </p>
                        )}

                        <p className="mt-2 text-xs text-gray-400">
                          {format(new Date(review.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                className="mt-6 pt-6 border-t border-gray-200"
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No reviews yet</h3>
              <p className="text-xs text-gray-500">
                Reviews will appear here once guests leave feedback after their stay.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
