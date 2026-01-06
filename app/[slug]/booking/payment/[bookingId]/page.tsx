'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { format, parseISO, differenceInDays } from 'date-fns'
import { 
  ArrowLeft, Clock, AlertCircle, CheckCircle2, Loader2, 
  Phone, MessageCircle, Calendar, Users, Timer,
  RefreshCw, XCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { SlipUpload } from '@/components/booking/slip-upload'
import { Tenant, Booking, Room, TenantSettings, defaultTenantSettings } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { useTranslations } from 'next-intl'

interface BookingWithRoom extends Booking {
  room: Room
}

export default function PaymentPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const bookingId = params.bookingId as string
  const supabase = createClient()
  const t = useTranslations('paymentPage')
  const tBooking = useTranslations('booking')

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [booking, setBooking] = useState<BookingWithRoom | null>(null)
  const [settings, setSettings] = useState<TenantSettings>(defaultTenantSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Payment state
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isExpired, setIsExpired] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Load booking data
  useEffect(() => {
    async function loadData() {
      try {
        // Get tenant
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .single()

        if (tenantError || !tenantData) {
          setError('Property not found')
          return
        }

        setTenant(tenantData as Tenant)
        const tenantSettings = (tenantData.settings as TenantSettings) || defaultTenantSettings
        setSettings({
          ...defaultTenantSettings,
          ...tenantSettings,
          payment: { ...defaultTenantSettings.payment, ...(tenantSettings.payment || {}) }
        })

        // Get booking with room
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`*, room:rooms(*)`)
          .eq('id', bookingId)
          .eq('tenant_id', tenantData.id)
          .single()

        if (bookingError || !bookingData) {
          setError('Booking not found')
          return
        }

        const bookingWithRoom = bookingData as unknown as BookingWithRoom
        setBooking(bookingWithRoom)

        // Check if already paid
        if (bookingWithRoom.status === 'confirmed' && bookingWithRoom.payment_verified_at) {
          setPaymentSuccess(true)
        }

        // Get lock expiration - try to get from reservation_locks table first
        try {
          const { data: lockData, error: lockError } = await supabase
            .from('reservation_locks')
            .select('expires_at')
            .eq('room_id', bookingWithRoom.room_id)
            .eq('user_id', bookingWithRoom.user_id)
            .single()

          if (lockData && !lockError) {
            const expiry = new Date(lockData.expires_at)
            setExpiresAt(expiry)
            
            // Check if already expired
            if (expiry < new Date()) {
              setIsExpired(true)
            }
          } else {
            // Fallback: Calculate expiration based on booking creation time + timeout
            const timeoutMinutes = tenantSettings.payment?.payment_timeout_minutes || 15
            const bookingCreatedAt = new Date(bookingWithRoom.created_at)
            const fallbackExpiry = new Date(bookingCreatedAt.getTime() + timeoutMinutes * 60 * 1000)
            
            setExpiresAt(fallbackExpiry)
            
            if (fallbackExpiry < new Date()) {
              // Only mark as expired if booking is still pending
              if (bookingWithRoom.status === 'pending' || bookingWithRoom.status === 'awaiting_payment') {
                setIsExpired(true)
              }
            }
          }
        } catch {
          // Table might not exist - use fallback based on booking time
          const timeoutMinutes = tenantSettings.payment?.payment_timeout_minutes || 15
          const bookingCreatedAt = new Date(bookingWithRoom.created_at)
          const fallbackExpiry = new Date(bookingCreatedAt.getTime() + timeoutMinutes * 60 * 1000)
          
          setExpiresAt(fallbackExpiry)
          
          if (fallbackExpiry < new Date()) {
            if (bookingWithRoom.status === 'pending' || bookingWithRoom.status === 'awaiting_payment') {
              setIsExpired(true)
            }
          }
        }
      } catch (err) {
        console.error('Error loading payment data:', err)
        setError('Failed to load payment details')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [slug, bookingId, supabase])

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || isExpired || paymentSuccess) return

    const interval = setInterval(() => {
      const now = new Date()
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
      
      setTimeRemaining(remaining)
      
      if (remaining <= 0) {
        setIsExpired(true)
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, isExpired, paymentSuccess])

  // Handle slip upload and verification
  const handleSlipUpload = useCallback(async (slipUrl: string) => {
    if (!booking || !tenant) return

    setIsVerifying(true)
    setVerificationError(null)

    try {
      // Call verification API
      const response = await fetch('/api/payment/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          slipUrl,
          expectedAmount: booking.total_price,
          tenantId: tenant.id
        })
      })

      const result = await response.json()

      if (!result.success) {
        setVerificationError(result.error || 'Payment verification failed')
        return
      }

      // Payment verified!
      setPaymentSuccess(true)
      
      // Redirect to confirmation after delay
      setTimeout(() => {
        router.push(`/${slug}/booking/confirmation/${booking.id}`)
      }, 3000)

    } catch (err) {
      console.error('Verification error:', err)
      setVerificationError('Failed to verify payment. Please try again or contact us.')
    } finally {
      setIsVerifying(false)
    }
  }, [booking, tenant, slug, router])

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        {/* Back navigation skeleton */}
        <div className="bg-white border-b border-stone-200">
          <div className="mx-auto max-w-5xl px-6 py-4">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
          {/* Title skeleton */}
          <Skeleton className="h-9 w-72 mb-2" />
          <Skeleton className="h-5 w-48 mb-8" />

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left side - Payment form skeleton */}
            <div className="space-y-6 order-2 lg:order-1">
              {/* Timer card */}
              <Card className="border-stone-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48 mb-2" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* QR Code card */}
              <Card className="border-stone-200">
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-48 w-48 mx-auto" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </CardContent>
              </Card>

              {/* Upload card */}
              <Card className="border-stone-200">
                <CardHeader>
                  <Skeleton className="h-6 w-56" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            </div>

            {/* Right side - Booking summary skeleton */}
            <div className="order-1 lg:order-2">
              <Card className="border-stone-200 sticky top-24 overflow-hidden !p-0">
                <Skeleton className="w-full aspect-[16/9]" />
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-4 pb-4 border-b border-stone-200">
                    <div className="flex-1">
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-stone-200 flex justify-between">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !tenant || !booking) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-stone-900 mb-2">{t('error')}</h2>
            <p className="text-stone-600 mb-4">{error || t('somethingWrong')}</p>
            <Link href={`/${slug}`}>
              <Button>{t('backToHome')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Payment success state
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div 
              className="h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: `${tenant.primary_color}15` }}
            >
              <CheckCircle2 className="h-10 w-10" style={{ color: tenant.primary_color }} />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">{t('paymentVerified')}</h2>
            <p className="text-stone-600 mb-6">
              {t('bookingConfirmed')}
            </p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-stone-400" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Expired state
  if (isExpired) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="h-20 w-20 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-6">
              <Clock className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">{t('paymentExpired')}</h2>
            <p className="text-stone-600 mb-6">
              {t('paymentExpiredMessage')}
            </p>
            <div className="space-y-3">
              <Link href={`/${slug}/rooms/${booking.room_id}`} className="block">
                <Button className="w-full cursor-pointer" style={{ backgroundColor: tenant.primary_color }}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('tryAgain')}
                </Button>
              </Link>
              <Link href={`/${slug}`} className="block">
                <Button variant="outline" className="w-full cursor-pointer">
                  {t('backToHome')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const room = booking.room
  const checkInDate = parseISO(booking.check_in)
  const checkOutDate = parseISO(booking.check_out)
  const numberOfNights = differenceInDays(checkOutDate, checkInDate)
  const currency = settings.currency || 'USD'
  const displayImage = room.images?.[0] || 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80'

  // Get uploaded QR code URL
  const qrCodeUrl = settings.payment?.promptpay_qr_url || null
  
  // Format amount for display
  const formattedAmount = currency === 'THB' 
    ? new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(booking.total_price)
    : formatPrice(booking.total_price, currency)

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href={`/${slug}/rooms/${room.id}`}
              className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('backToRoom')}</span>
            </Link>
            
            {/* Countdown Timer */}
            <div 
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                timeRemaining <= 60 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              <Timer className="h-4 w-4" />
              <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-stone-900 mb-2">
          {t('title')}
        </h1>
        <p className="text-stone-600 mb-8">
          {t('subtitle')}
        </p>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* QR Code Section */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span style={{ color: tenant.primary_color }}>1</span>
                {t('scanToPay')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrCodeUrl ? (
                <>
                  {/* QR Code Image */}
                  <div className="flex justify-center p-4 bg-white border-2 border-stone-200 rounded-xl">
                    <div className="relative w-52 h-52">
                      <Image
                        src={qrCodeUrl}
                        alt="PromptPay QR Code"
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-center">
                    <p className="text-sm text-stone-500 mb-1">{t('amountToPay')}</p>
                    <p className="text-3xl font-bold" style={{ color: tenant.primary_color }}>
                      {formattedAmount}
                    </p>
                  </div>

                  {/* Account Info */}
                  {settings.payment?.promptpay_name && (
                    <div className="bg-stone-50 rounded-lg p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">{t('payTo')}</span>
                        <span className="font-medium text-stone-900">{settings.payment.promptpay_name}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <p className="text-stone-600">{t('qrNotConfigured')}</p>
                  <p className="text-sm text-stone-500 mt-2">{t('contactHost')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Section */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span style={{ color: tenant.primary_color }}>2</span>
                {t('uploadSlip')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SlipUpload
                onUpload={handleSlipUpload}
                isVerifying={isVerifying}
                error={verificationError}
                primaryColor={tenant.primary_color}
              />

              {/* Contact for help */}
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-stone-600 mb-3">{t('havingTrouble')}</p>
                <div className="flex flex-wrap gap-2">
                  {settings.contact.phone && (
                    <a href={`tel:${settings.contact.phone}`}>
                      <Button variant="outline" size="sm" className="gap-2 cursor-pointer">
                        <Phone className="h-4 w-4" />
                        {t('call')}
                      </Button>
                    </a>
                  )}
                  {settings.social.line && (
                    <a href={`https://line.me/R/ti/p/${settings.social.line}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2 cursor-pointer">
                        <MessageCircle className="h-4 w-4" />
                        LINE
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Booking Summary */}
        <Card className="mt-6 bg-white">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="relative w-24 h-20 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={displayImage} alt={room.name} fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-stone-900 truncate">{room.name}</h3>
                <p className="text-sm text-stone-600">{tenant.name}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(checkInDate, 'MMM d')} - {format(checkOutDate, 'MMM d, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {booking.guests} guest{booking.guests > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="mb-2">
                  {numberOfNights} night{numberOfNights > 1 ? 's' : ''}
                </Badge>
                <p className="font-semibold" style={{ color: tenant.primary_color }}>
                  {formatPrice(booking.total_price, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">{t('important')}</p>
              <p className="mt-1">
                {t('importantMessage')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

