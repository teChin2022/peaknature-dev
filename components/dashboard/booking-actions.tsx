'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Eye, MoreVertical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { CurrencyCode } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { useTranslations } from 'next-intl'

interface BookingData {
  id: string
  status: string
  total_price: number
  room?: { name?: string }
  user?: { full_name?: string; email?: string }
}

interface BookingActionsProps {
  booking: BookingData
  tenantSlug: string
  primaryColor: string
  currency?: CurrencyCode
}

export function BookingActions({ booking, tenantSlug, primaryColor, currency = 'USD' }: BookingActionsProps) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('dashboard.bookings')
  const tCommon = useTranslations('common')
  const [isLoading, setIsLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<'confirm' | 'cancel' | null>(null)

  const updateBookingStatus = async (status: 'confirmed' | 'cancelled') => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', booking.id)

      if (error) throw error
      
      router.refresh()
    } catch (error) {
      console.error('Error updating booking:', error)
    } finally {
      setIsLoading(false)
      setConfirmDialog(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {booking.status === 'pending' && (
          <>
            <Button
              size="sm"
              className="gap-1 text-white"
              style={{ backgroundColor: primaryColor }}
              onClick={() => setConfirmDialog('confirm')}
            >
              <Check className="h-4 w-4" />
              {t('confirmBooking')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setConfirmDialog('cancel')}
            >
              <X className="h-4 w-4" />
              {t('decline')}
            </Button>
          </>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => window.open(`/${tenantSlug}/booking/confirmation/${booking.id}`, '_blank')}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {t('viewDetails')}
            </DropdownMenuItem>
            {booking.status === 'confirmed' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setConfirmDialog('cancel')}
                  className="flex items-center gap-2 text-red-600"
                >
                  <X className="h-4 w-4" />
                  {t('cancelBooking')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog === 'confirm'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmBookingTitle')}</DialogTitle>
            <DialogDescription>
              {t('confirmBookingDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-stone-50 rounded-lg p-4 my-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">{t('guest')}</span>
                <span className="font-medium">{booking.user?.full_name || booking.user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">{t('room')}</span>
                <span className="font-medium">{booking.room?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">{t('total')}</span>
                <span className="font-medium">{formatPrice(booking.total_price, currency)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              className="text-white"
              style={{ backgroundColor: primaryColor }}
              onClick={() => updateBookingStatus('confirmed')}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('confirming')}
                </>
              ) : (
                t('confirmBooking')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={confirmDialog === 'cancel'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelBookingTitle')}</DialogTitle>
            <DialogDescription>
              {t('cancelBookingDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 rounded-lg p-4 my-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">{t('guest')}</span>
                <span className="font-medium">{booking.user?.full_name || booking.user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">{t('room')}</span>
                <span className="font-medium">{booking.room?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">{t('total')}</span>
                <span className="font-medium">{formatPrice(booking.total_price, currency)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              {t('keepBooking')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => updateBookingStatus('cancelled')}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('cancelling')}
                </>
              ) : (
                t('cancelBooking')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

