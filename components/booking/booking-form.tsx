'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, differenceInDays, addDays, parseISO, eachDayOfInterval } from 'date-fns'
import { Minus, Plus, CalendarX2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { Room, Tenant, CurrencyCode } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import type { DateRange } from 'react-day-picker'
import { useTranslations } from 'next-intl'
import { useLanguage } from '@/components/providers/language-provider'

interface BookingFormProps {
  room: Room
  tenant: Tenant
  blockedDates: string[]
  bookedRanges: { check_in: string; check_out: string }[]
  currency?: CurrencyCode
  initialCheckIn?: string
  initialCheckOut?: string
  initialGuests?: number
}

export function BookingForm({ 
  room, 
  tenant, 
  blockedDates, 
  bookedRanges, 
  currency = 'USD',
  initialCheckIn,
  initialCheckOut,
  initialGuests
}: BookingFormProps) {
  const router = useRouter()
  const t = useTranslations('booking')
  const tRoom = useTranslations('room')
  const { locale } = useLanguage()
  
  // Initialize with values from query params (for editing)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (initialCheckIn && initialCheckOut) {
      return {
        from: parseISO(initialCheckIn),
        to: parseISO(initialCheckOut)
      }
    }
    return undefined
  })
  const [guests, setGuests] = useState(initialGuests || 1)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [rangeError, setRangeError] = useState<string | null>(null)

  // Parse booked ranges into Date objects
  const parsedBookings = useMemo(() => {
    return bookedRanges.map(({ check_in, check_out }) => ({
      checkIn: parseISO(check_in),
      checkOut: parseISO(check_out)
    }))
  }, [bookedRanges])

  // Parse blocked dates
  const parsedBlockedDates = useMemo(() => {
    return blockedDates.map(d => parseISO(d))
  }, [blockedDates])

  // Check if a specific date is blocked (host-blocked)
  const isBlocked = (date: Date) => {
    return parsedBlockedDates.some(d => 
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    )
  }

  // Check if a date range overlaps with any booking
  // Two ranges overlap if: range1.start < range2.end AND range1.end > range2.start
  const hasOverlap = (checkIn: Date, checkOut: Date) => {
    return parsedBookings.some(({ checkIn: bookedIn, checkOut: bookedOut }) => {
      // Our check-in must be before their check-out
      // AND our check-out must be after their check-in
      // This means there's an overlap in the NIGHTS stayed
      return checkIn < bookedOut && checkOut > bookedIn
    })
  }

  // Disabled dates for the calendar
  // Only disable host-blocked dates and past dates
  // Booked dates are validated in onSelect to allow checkout on booking start dates
  const disabledDates = useMemo(() => {
    // Only host-blocked dates - booked dates are handled by validation
    return [...parsedBlockedDates]
  }, [parsedBlockedDates])

  // Booked nights for visual styling (shown as strikethrough/faded)
  const bookedNights = useMemo(() => {
    const nights: Date[] = []
    parsedBookings.forEach(({ checkIn, checkOut }) => {
      const bookingNights = eachDayOfInterval({
        start: checkIn,
        end: addDays(checkOut, -1) // Exclude checkout date
      })
      nights.push(...bookingNights)
    })
    return nights
  }, [parsedBookings])

  // Check if a date is a booked NIGHT (can't start a stay on this date)
  const isBookedNight = (date: Date) => {
    return parsedBookings.some(({ checkIn, checkOut }) => {
      // A night is booked if date >= checkIn AND date < checkOut
      return date >= checkIn && date < checkOut
    })
  }

  // Handle date range selection with validation
  const handleSelect = (range: DateRange | undefined) => {
    setRangeError(null)
    
    if (!range) {
      setDateRange(undefined)
      return
    }

    // If user just selected check-in
    if (range.from && !range.to) {
      // Validate check-in is not a booked night
      if (isBookedNight(range.from)) {
        setRangeError(t('dateErrors.alreadyBooked'))
        return
      }
      setDateRange(range)
      return
    }

    // User selected both check-in and check-out
    if (range.from && range.to) {
      const checkIn = range.from
      const checkOut = range.to

      // Check for blocked dates in the range
      const daysInRange = eachDayOfInterval({ start: checkIn, end: addDays(checkOut, -1) })
      const hasBlockedDate = daysInRange.some(day => isBlocked(day))
      
      if (hasBlockedDate) {
        setRangeError(t('dateErrors.blockedByHost'))
        setDateRange({ from: checkIn, to: undefined })
        return
      }

      // Check for overlapping bookings
      // Two stays overlap if: our check-in < their check-out AND our check-out > their check-in
      if (hasOverlap(checkIn, checkOut)) {
        setRangeError(t('dateErrors.datesUnavailable'))
        setDateRange({ from: checkIn, to: undefined })
        return
      }

      // Valid selection!
      setDateRange(range)
      setIsCalendarOpen(false)
    }
  }

  // Calculate total
  const numberOfNights = dateRange?.from && dateRange?.to 
    ? differenceInDays(dateRange.to, dateRange.from)
    : 0
  
  const subtotal = numberOfNights * room.base_price
  const total = subtotal

  const handleBooking = () => {
    if (!dateRange?.from || !dateRange?.to) return
    
    const searchParams = new URLSearchParams({
      checkIn: format(dateRange.from, 'yyyy-MM-dd'),
      checkOut: format(dateRange.to, 'yyyy-MM-dd'),
      guests: guests.toString(),
    })
    
    router.push(`/${tenant.slug}/booking/${room.id}?${searchParams.toString()}`)
  }

  const canBook = dateRange?.from && dateRange?.to && numberOfNights >= room.min_nights

  return (
    <div className="space-y-4">
      {/* Date Selection */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-auto py-3",
              !dateRange && "text-muted-foreground"
            )}
          >
            <div className="grid grid-cols-2 w-full gap-2">
              <div className="border-r border-stone-200 pr-2">
                <div className="text-xs font-medium text-stone-500 uppercase">{t('checkIn')}</div>
                <div className="text-sm text-stone-900">
                  {dateRange?.from ? format(dateRange.from, 'MMM d, yyyy') : (locale === 'th' ? 'เลือกวัน' : 'Select date')}
                </div>
              </div>
              <div className="pl-2">
                <div className="text-xs font-medium text-stone-500 uppercase">{t('checkOut')}</div>
                <div className="text-sm text-stone-900">
                  {dateRange?.to ? format(dateRange.to, 'MMM d, yyyy') : (locale === 'th' ? 'เลือกวัน' : 'Select date')}
                </div>
              </div>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={[
              { before: new Date() },
              ...disabledDates
            ]}
            modifiers={{
              booked: bookedNights
            }}
            modifiersStyles={{
              booked: {
                color: '#9ca3af',
                textDecoration: 'line-through',
                backgroundColor: '#f3f4f6'
              }
            }}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>

      {/* Guests Selection */}
      <div className="flex items-center justify-between p-3 border border-stone-200 rounded-lg">
        <div>
          <div className="text-xs font-medium text-stone-500 uppercase">{t('guests')}</div>
          <div className="text-sm text-stone-900">{guests} {locale === 'th' ? 'คน' : (guests > 1 ? 'guests' : 'guest')}</div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setGuests(Math.max(1, guests - 1))}
            disabled={guests <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-medium">{guests}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setGuests(Math.min(room.max_guests, guests + 1))}
            disabled={guests >= room.max_guests}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Book Button */}
      <Button
        className="w-full h-12 text-base font-semibold text-white"
        style={{ backgroundColor: tenant.primary_color }}
        onClick={handleBooking}
        disabled={!canBook}
      >
        {canBook ? (locale === 'th' ? 'จองห้องพัก' : 'Reserve') : tRoom('selectDates')}
      </Button>

      {numberOfNights > 0 && numberOfNights < room.min_nights && (
        <p className="text-sm text-amber-600 text-center">
          {locale === 'th' 
            ? `เข้าพักขั้นต่ำ ${room.min_nights} คืน`
            : `Minimum stay is ${room.min_nights} night${room.min_nights > 1 ? 's' : ''}`
          }
        </p>
      )}

      {/* Price Breakdown */}
      {numberOfNights >= room.min_nights && (
        <>
          <p className="text-sm text-stone-500 text-center">
            {locale === 'th' ? 'ยังไม่ถูกเรียกเก็บเงิน' : "You won't be charged yet"}
          </p>

          <div className="space-y-3 pt-4">
            <div className="flex justify-between text-stone-600">
              <span className="underline decoration-dotted underline-offset-4">
                {formatPrice(room.base_price, currency)} × {numberOfNights} {locale === 'th' ? 'คืน' : (numberOfNights > 1 ? 'nights' : 'night')}
              </span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-stone-900">
              <span>{t('total')}</span>
              <span>{formatPrice(total, currency)}</span>
            </div>
          </div>
        </>
      )}

      {/* Date Unavailable Modal */}
      <AlertDialog open={!!rangeError} onOpenChange={(open) => !open && setRangeError(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <CalendarX2 className="h-8 w-8 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              {t('dateErrors.datesNotAvailable')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {rangeError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              className="px-8 cursor-pointer"
              style={{ backgroundColor: tenant.primary_color }}
              onClick={() => setRangeError(null)}
            >
              {t('dateErrors.chooseDifferent')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
