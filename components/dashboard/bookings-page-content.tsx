'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Calendar, ClipboardList, Receipt, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookingActions } from '@/components/dashboard/booking-actions'
import { BookingFilters } from '@/components/dashboard/booking-filters'
import { Pagination } from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslations } from 'next-intl'
import { formatPrice } from '@/lib/currency'
import { format, parseISO, differenceInDays } from 'date-fns'

interface Booking {
  id: string
  check_in: string
  check_out: string
  total_price: number
  status: string
  created_at: string
  payment_slip_url?: string
  room?: { name: string }
  user?: { full_name?: string; email: string; phone?: string }
}

interface BookingsPageContentProps {
  slug: string
  tenant: {
    id: string
    name: string
    primary_color: string
  }
  bookings: Booking[]
  currency: string
  currentStatus?: string
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
  }
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border border-red-200',
  completed: 'bg-blue-50 text-blue-700 border border-blue-200',
}

export function BookingsPageContent({
  slug,
  tenant,
  bookings,
  currency,
  currentStatus,
  pagination,
}: BookingsPageContentProps) {
  const t = useTranslations('dashboard')
  const [selectedSlip, setSelectedSlip] = useState<{ url: string; guestName: string } | null>(null)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t('status.pending')
      case 'confirmed': return t('status.confirmed')
      case 'cancelled': return t('status.cancelled')
      case 'completed': return t('status.completed')
      default: return status
    }
  }

  return (
    <>
    {/* Slip Image Modal */}
    <Dialog open={!!selectedSlip} onOpenChange={(open) => !open && setSelectedSlip(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t('bookings.paymentSlip')} - {selectedSlip?.guestName}
          </DialogTitle>
        </DialogHeader>
        {selectedSlip && (
          <div className="relative w-full aspect-[3/4] max-h-[70vh] bg-gray-100 rounded-lg overflow-hidden">
            <Image
              src={selectedSlip.url}
              alt="Payment Slip"
              fill
              className="object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">{t('bookings.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('bookings.subtitle')}</p>
        </div>
        <BookingFilters currentStatus={currentStatus} />
      </div>

      {bookings.length > 0 ? (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const nights = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in))
            
            return (
              <div key={booking.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-gray-900">
                          {booking.room?.name || t('bookings.unknownRoom')}
                        </h3>
                        <Badge className={statusColors[booking.status] || statusColors.pending}>
                          {getStatusLabel(booking.status)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>
                            {format(parseISO(booking.check_in), 'MMM d')} - {format(parseISO(booking.check_out), 'MMM d, yyyy')}
                          </span>
                          <span className="text-gray-400">
                            ({nights} {nights === 1 ? t('bookings.night') : t('bookings.nights')})
                          </span>
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">{t('bookings.guest')}:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {booking.user?.full_name || booking.user?.email || t('bookings.unknownGuest')}
                        </span>
                        {booking.user?.phone && (
                          <span className="text-gray-400 ml-2">• {booking.user.phone}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Payment Slip Button */}
                      {booking.payment_slip_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 cursor-pointer"
                          onClick={() => setSelectedSlip({
                            url: booking.payment_slip_url!,
                            guestName: booking.user?.full_name || booking.user?.email || 'Guest'
                          })}
                        >
                          <Receipt className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('bookings.viewSlip')}</span>
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="text-lg font-semibold" style={{ color: tenant.primary_color }}>
                          {formatPrice(booking.total_price, currency)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {t('bookings.bookedOn')} {format(parseISO(booking.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <BookingActions 
                        booking={booking} 
                        tenantSlug={slug}
                        primaryColor={tenant.primary_color}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          
          {/* Pagination */}
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            itemsPerPage={pagination.itemsPerPage}
          />
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">{t('bookings.noBookings')}</h3>
          <p className="text-sm text-gray-500">{t('bookings.noBookingsDesc')}</p>
        </div>
      )}
    </div>
    </>
  )
}

