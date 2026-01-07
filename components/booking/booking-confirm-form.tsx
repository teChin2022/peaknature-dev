'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, Lock, Eye, EyeOff, User as UserIcon, Phone, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Tenant, Room, TenantSettings, defaultTenantSettings } from '@/types/database'
import type { User } from '@supabase/supabase-js'
import { useTranslations } from 'next-intl'

const guestBookingSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number is required for refunds via PromptPay'),
  notes: z.string().optional(),
})

const userBookingSchema = z.object({
  notes: z.string().optional(),
})

type GuestBookingFormData = z.infer<typeof guestBookingSchema>
type UserBookingFormData = z.infer<typeof userBookingSchema>

interface TransportData {
  pickupPrice: number
  dropoffPrice: number
  formattedNote: string
}

interface BookingConfirmFormProps {
  tenant: Tenant
  room: Room
  user: User | null
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: number
  transportSelections?: TransportData
}

export function BookingConfirmForm({ 
  tenant, 
  room, 
  user, 
  checkIn, 
  checkOut, 
  guests, 
  totalPrice,
  transportSelections
}: BookingConfirmFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('booking')
  const tErrors = useTranslations('errors')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('register')

  const guestForm = useForm<GuestBookingFormData>({
    resolver: zodResolver(guestBookingSchema),
  })

  const userForm = useForm<UserBookingFormData>({
    resolver: zodResolver(userBookingSchema),
  })

  // Check if PromptPay QR is configured - determines payment flow
  const settings: TenantSettings = {
    ...defaultTenantSettings,
    ...(tenant.settings as TenantSettings || {})
  }
  const hasPromptPay = !!settings.payment?.promptpay_qr_url

  const createReservationLock = async (userId: string) => {
    // Create reservation lock via API
    // This is optional - if it fails, we'll use a fallback timer on the payment page
    try {
      const response = await fetch('/api/payment/create-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          checkIn,
          checkOut,
          tenantId: tenant.id
        })
      })

      const result = await response.json()
      
      // If another guest is completing payment, we should show an error
      if (!result.success && result.error?.includes('locked by another')) {
        throw new Error(result.error)
      }

      return result
    } catch (err) {
      // If the error is about another guest having a lock, re-throw it
      if (err instanceof Error && err.message.includes('locked')) {
        throw err
      }
      // Otherwise, log and continue - the payment page will use a fallback timer
      console.warn('Could not create reservation lock:', err)
      return { success: false }
    }
  }

  const createBooking = async (userId: string, notes?: string) => {
    // First, validate that dates are not blocked
    const { data: blockedDates } = await supabase
      .from('room_availability')
      .select('date')
      .eq('room_id', room.id)
      .eq('is_blocked', true)
      .gte('date', checkIn)
      .lt('date', checkOut)
    
    if (blockedDates && blockedDates.length > 0) {
      throw new Error(t('dateErrors.notAvailableAnymore'))
    }

    // Check for existing bookings (double-booking prevention)
    // Date ranges overlap if: existing_check_in < new_check_out AND existing_check_out > new_check_in
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', room.id)
      .in('status', ['pending', 'confirmed', 'awaiting_payment'])
      .lt('check_in', checkOut)   // Existing booking starts before our checkout
      .gt('check_out', checkIn)   // Existing booking ends after our checkin
      .limit(1)
    
    if (existingBookings && existingBookings.length > 0) {
      throw new Error(t('dateErrors.roomNotAvailable'))
    }

    // Determine booking status based on payment configuration
    const bookingStatus = hasPromptPay ? 'awaiting_payment' : 'pending'

    // Calculate total with transport
    const transportTotal = (transportSelections?.pickupPrice || 0) + (transportSelections?.dropoffPrice || 0)
    const finalTotalPrice = totalPrice + transportTotal

    // Combine notes with transport info
    const transportNote = transportSelections?.formattedNote || ''
    const combinedNotes = transportNote 
      ? `${transportNote}\n${notes || ''}`.trim()
      : (notes || null)

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        tenant_id: tenant.id,
        room_id: room.id,
        user_id: userId,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        total_price: finalTotalPrice,
        status: bookingStatus,
        notes: combinedNotes,
      })
      .select()
      .single()

    if (bookingError) {
      throw new Error(bookingError.message)
    }

    return booking
  }

  const onGuestSubmit = async (data: GuestBookingFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      if (mode === 'register') {
        // Sign up new user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
              phone: data.phone || null,
              tenant_id: tenant.id,
            },
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        if (signUpData.user) {
          // Update profile with phone and tenant
          await supabase
            .from('profiles')
            .update({
              phone: data.phone || null,
              tenant_id: tenant.id,
            })
            .eq('id', signUpData.user.id)

          // If PromptPay is configured, just refresh page (slip upload will handle booking)
          if (hasPromptPay) {
            router.refresh()
            return
          }

          // No PromptPay - create booking directly
          const booking = await createBooking(signUpData.user.id, data.notes)
          router.push(`/${tenant.slug}/booking/confirmation/${booking.id}`)
        }
      } else {
        // Sign in existing user
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })

        if (signInError) {
          setError(signInError.message)
          return
        }

        if (signInData.user) {
          // If PromptPay is configured, just refresh page (slip upload will handle booking)
          if (hasPromptPay) {
            router.refresh()
            return
          }

          // No PromptPay - create booking directly
          const booking = await createBooking(signInData.user.id, data.notes)
          router.push(`/${tenant.slug}/booking/confirmation/${booking.id}`)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors('unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  const onUserSubmit = async (data: UserBookingFormData) => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      // Create reservation lock if PromptPay is configured
      if (hasPromptPay) {
        await createReservationLock(user.id)
      }

      const booking = await createBooking(user.id, data.notes)
      
      // Redirect to payment page or confirmation based on PromptPay configuration
      if (hasPromptPay) {
        router.push(`/${tenant.slug}/booking/payment/${booking.id}`)
      } else {
        router.push(`/${tenant.slug}/booking/confirmation/${booking.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors('unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  // Logged in user - when PromptPay is configured, just show info (slip upload handles booking)
  if (user) {
    // If PromptPay QR is configured, don't show submit button - slip upload handles booking
    if (hasPromptPay) {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <UserIcon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-green-900">{user.email}</div>
                <div className="text-sm text-green-700">
                  {t('readyToComplete')}
                </div>
              </div>
            </div>
          </div>

          {/* Notes input for transport and special requests */}
          <div className="space-y-2">
            <Label htmlFor="notes-promptpay">{t('specialRequestsOptional')}</Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
              <Textarea
                id="notes-promptpay"
                placeholder={t('specialRequestsPlaceholder')}
                className="pl-10 min-h-[100px]"
                {...userForm.register('notes')}
              />
            </div>
            <p className="text-xs text-stone-500">
              {t('transportRequestsIncluded')}
            </p>
          </div>

          <p className="text-sm text-stone-600">
            {t('scanQRThenUpload')}
          </p>
        </div>
      )
    }

    // No PromptPay - show regular form with submit button
    return (
      <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="p-4 bg-stone-50 rounded-lg">
          <div className="font-medium text-stone-900">{user.email}</div>
          <div className="text-sm text-stone-500 mt-1">
            {t('loggedInAsGuest')}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t('specialRequestsOptional')}</Label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
            <Textarea
              id="notes"
              placeholder={t('specialRequestsPlaceholder')}
              className="pl-10 min-h-[100px]"
              {...userForm.register('notes')}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold text-white"
          style={{ backgroundColor: tenant.primary_color }}
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
      </form>
    )
  }

  // Guest form (login/register)
  return (
    <form onSubmit={guestForm.handleSubmit(onGuestSubmit)} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-stone-100 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'register'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {t('newGuest')}
        </button>
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'login'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {t('returningGuest')}
        </button>
      </div>

      {mode === 'register' && (
        <div className="space-y-2">
          <Label htmlFor="fullName">{t('fullName')}</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              className="pl-10"
              {...guestForm.register('fullName')}
            />
          </div>
          {guestForm.formState.errors.fullName && (
            <p className="text-sm text-red-600">{guestForm.formState.errors.fullName.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="pl-10"
            {...guestForm.register('email')}
          />
        </div>
        {guestForm.formState.errors.email && (
          <p className="text-sm text-red-600">{guestForm.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pl-10 pr-10"
            {...guestForm.register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {guestForm.formState.errors.password && (
          <p className="text-sm text-red-600">{guestForm.formState.errors.password.message}</p>
        )}
      </div>

      {mode === 'register' && (
        <div className="space-y-2">
          <Label htmlFor="phone">
            {t('phoneNumber')} <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              id="phone"
              type="tel"
              placeholder="+66 812 345 678"
              className="pl-10"
              {...guestForm.register('phone')}
            />
          </div>
          {guestForm.formState.errors.phone && (
            <p className="text-sm text-red-500">{guestForm.formState.errors.phone.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">{t('specialRequestsOptional')}</Label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
          <Textarea
            id="notes"
            placeholder={t('specialRequestsPlaceholder')}
            className="pl-10 min-h-[80px]"
            {...guestForm.register('notes')}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold text-white"
        style={{ backgroundColor: tenant.primary_color }}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {mode === 'register' ? t('creatingAccount') : t('signingIn')}
          </>
        ) : (
          hasPromptPay 
            ? (mode === 'register' ? t('createAccountToContinue') : t('signInToContinue'))
            : (mode === 'register' ? t('signUpAndBook') : t('signInAndBook'))
        )}
      </Button>
    </form>
  )
}

