'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Upload, X, Loader2, CheckCircle2, AlertCircle, ImageIcon, Send, MessageSquare, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { QRUploadModal } from './qr-upload-modal'
import { useTranslations } from 'next-intl'
import type { User } from '@supabase/supabase-js'

// Generate SHA-256 hash of file content for duplicate detection
async function generateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    console.error('[generateFileHash] Error generating hash:', error)
    // Fallback: use file name + size + last modified as a pseudo-hash
    const fallbackHash = `${file.name}-${file.size}-${file.lastModified}`
    return fallbackHash
  }
}

interface PaymentSlipUploadProps {
  roomId: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: number
  tenantId: string
  tenantSlug: string
  primaryColor: string
  transportNote?: string
}

export function PaymentSlipUpload({
  roomId,
  checkIn,
  checkOut,
  guests,
  totalPrice,
  tenantId,
  tenantSlug,
  primaryColor,
  transportNote = ''
}: PaymentSlipUploadProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('booking')
  const tPage = useTranslations('paymentPage')
  
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [slipContentHash, setSlipContentHash] = useState<string | null>(null) // Hash of actual image content
  const [isUploading, setIsUploading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [showQRModal, setShowQRModal] = useState(false)
  
  // Pre-warm auth session state - this prevents slow first upload
  const [cachedUser, setCachedUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  // Pre-warm auth session on component mount
  // This ensures the first upload is fast by caching the user session ahead of time
  useEffect(() => {
    // Only pre-warm if not already loaded
    if (cachedUser) {
      setIsAuthLoading(false)
      return
    }
    
    console.log('[PaymentSlipUpload] Pre-warming auth session...')
    const warmUpAuth = async () => {
      try {
        const startTime = Date.now()
        const { data: { user } } = await supabase.auth.getUser()
        setCachedUser(user)
        console.log('[PaymentSlipUpload] Auth pre-warmed in', Date.now() - startTime, 'ms:', user?.id?.substring(0, 8) + '...')
      } catch (err) {
        console.error('[PaymentSlipUpload] Auth pre-warm failed:', err)
      } finally {
        setIsAuthLoading(false)
      }
    }
    warmUpAuth()
  }, [supabase, cachedUser])

  // Sync with transport note from parent
  useEffect(() => {
    if (transportNote) {
      setNotes(transportNote)
    }
  }, [transportNote])

  // Step 1: Handle file upload (just upload, don't verify yet)
  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(tPage('errorImageOnly'))
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError(tPage('errorMaxSize'))
      return
    }

    setError(null)
    setSlipUrl(null)
    setSlipContentHash(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    setIsUploading(true)
    try {
      // Use cached user from pre-warm, or fetch if not available
      // This is the key performance fix - we don't wait for getUser() on every upload
      let user = cachedUser
      if (!user) {
        console.log('[PaymentSlipUpload] Cache miss, fetching user...')
        const { data } = await supabase.auth.getUser()
        user = data.user
        if (user) setCachedUser(user)
      }
      
      if (!user) {
        console.error('[PaymentSlipUpload] User not authenticated')
        setError(t('pleaseLoginFirst'))
        setPreview(null)
        setIsUploading(false)
        return
      }
      console.log('[PaymentSlipUpload] User authenticated:', user.id.substring(0, 8) + '...')

      // Generate content hash FIRST for duplicate detection
      console.log('[PaymentSlipUpload] Starting hash generation...')
      const contentHash = await generateFileHash(file)
      console.log('[PaymentSlipUpload] Content hash generated:', contentHash.substring(0, 16) + '...')
      
      const fileName = `payment-slips/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      
      console.log('[PaymentSlipUpload] Uploading to storage...', { fileName, fileSize: file.size, fileType: file.type })
      const { data, error: uploadErr } = await supabase.storage
        .from('bookings')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadErr) {
        console.error('[PaymentSlipUpload] Upload error:', uploadErr)
        setError(`Failed to upload image: ${uploadErr.message}`)
        setPreview(null)
        setIsUploading(false)
        return
      }

      console.log('[PaymentSlipUpload] Upload successful, getting public URL...')
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bookings')
        .getPublicUrl(data.path)

      console.log('[PaymentSlipUpload] Public URL obtained:', publicUrl.substring(0, 50) + '...')
      setSlipUrl(publicUrl)
      setSlipContentHash(contentHash) // Store content hash for verification

    } catch (err) {
      console.error('[PaymentSlipUpload] Upload error:', err)
      setError(t('anErrorOccurred'))
      setPreview(null)
    } finally {
      setIsUploading(false)
    }
  }, [supabase, cachedUser, t, tPage])

  // Step 2: Handle confirm button click (create booking + verify)
  const handleConfirmPayment = useCallback(async () => {
    if (!slipUrl) {
      setError(t('pleaseUploadSlipFirst'))
      return
    }

    setError(null)
    setIsVerifying(true)

    // Declare these outside try block so they're accessible in catch
    let bookingToUse: { id: string } | null = null
    let isNewBooking = false

    try {
      // Use cached user from pre-warm, or fetch if not available
      let user = cachedUser
      if (!user) {
        console.log('[PaymentSlipUpload] Cache miss in confirm, fetching user...')
        const { data } = await supabase.auth.getUser()
        user = data.user
        if (user) setCachedUser(user)
      }
      
      if (!user) {
        setError(t('pleaseLoginOrCreateAccount'))
        setIsVerifying(false)
        return
      }

      // Check if there's already a pending booking for this user
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .eq('check_in', checkIn)
        .eq('check_out', checkOut)
        .in('status', ['pending', 'awaiting_payment'])
        .maybeSingle()

      bookingToUse = existingBooking

      // If no existing booking, create one
      if (!existingBooking) {
        const { data: newBooking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            tenant_id: tenantId,
            room_id: roomId,
            user_id: user.id,
            check_in: checkIn,
            check_out: checkOut,
            guests,
            total_price: totalPrice,
            status: 'pending',
            payment_slip_url: slipUrl,
            notes: notes.trim() || null
          })
          .select()
          .single()

        if (bookingError) {
          if (bookingError.message.includes('overlap') || bookingError.message.includes('Booking dates overlap')) {
            setError(t('datesNoLongerAvailable'))
          } else {
            setError(bookingError.message)
          }
          setIsVerifying(false)
          return
        }
        
        bookingToUse = newBooking
        isNewBooking = true
      } else {
        // Update existing booking with slip URL
        await supabase
          .from('bookings')
          .update({ payment_slip_url: slipUrl })
          .eq('id', existingBooking.id)
      }

      if (!bookingToUse) {
        setError(t('failedToCreateBooking'))
        setIsVerifying(false)
        return
      }

      // Helper function to delete booking on failure
      const deleteBookingOnFailure = async () => {
        if (isNewBooking && bookingToUse) {
          await supabase
            .from('bookings')
            .delete()
            .eq('id', bookingToUse.id)
            .eq('status', 'pending') // Only delete if still pending
        }
      }

      // Verify with EasySlip
      console.log('[PaymentSlipUpload] Sending verification request:', {
        bookingId: bookingToUse.id,
        hasSlipUrl: !!slipUrl,
        hasContentHash: !!slipContentHash,
        contentHashPreview: slipContentHash ? slipContentHash.substring(0, 16) + '...' : 'NULL',
        expectedAmount: totalPrice
      })
      
      const response = await fetch('/api/payment/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingToUse.id,
          slipUrl: slipUrl,
          slipContentHash: slipContentHash, // Send content hash for duplicate detection
          expectedAmount: totalPrice,
          tenantId
        })
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        setError(t('tooManyAttempts', { seconds: retryAfter }))
        setIsVerifying(false)
        return
      }

      const result = await response.json()

      if (!result.success) {
        // Delete the booking since verification failed
        await deleteBookingOnFailure()
        setError(result.error || t('verificationFailed'))
        setIsVerifying(false)
        return
      }

      // Success!
      setIsSuccess(true)
      setIsVerifying(false)

      // Redirect to confirmation after delay
      setTimeout(() => {
        router.push(`/${tenantSlug}/booking/confirmation/${bookingToUse!.id}`)
      }, 2000)

    } catch (err) {
      console.error('Verification error:', err)
      // Delete the booking since an error occurred (now accessible due to outer scope)
      if (isNewBooking && bookingToUse) {
        await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingToUse.id)
          .eq('status', 'pending')
      }
      setError(t('anErrorOccurred'))
      setIsVerifying(false)
    }
  }, [supabase, slipUrl, slipContentHash, roomId, checkIn, checkOut, guests, totalPrice, tenantId, tenantSlug, router, notes, t, cachedUser])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setSlipUrl(null)
    setSlipContentHash(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Handle upload from QR code (phone upload)
  const handleQRUploadComplete = useCallback((uploadedSlipUrl: string, contentHash?: string) => {
    setSlipUrl(uploadedSlipUrl)
    setSlipContentHash(contentHash || null) // Store content hash from mobile upload
    setPreview(uploadedSlipUrl)
    setShowQRModal(false)
  }, [])

  // Success state
  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <div 
          className="h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: primaryColor }} />
        </div>
        <p className="text-lg font-semibold text-stone-900 mb-2">
          {t('paymentVerified')}
        </p>
        <p className="text-sm text-stone-600 mb-4">
          {t('bookingHasBeenConfirmed')}
        </p>
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-stone-400" />
        <p className="text-xs text-stone-500 mt-2">{t('redirecting')}</p>
      </div>
    )
  }

  // Verifying state
  if (isVerifying) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: primaryColor }} />
        <p className="text-lg font-medium text-stone-900">{t('verifying')}</p>
        <p className="text-sm text-stone-500 mt-2">
          {t('verifyingDesc')}
        </p>
      </div>
    )
  }

  // Show preview with slip uploaded
  if (preview) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden border-2 border-green-200 bg-green-50 max-w-xs mx-auto">
          <div className="relative aspect-[3/4]">
            <Image 
              src={preview} 
              alt="Payment slip preview" 
              fill 
              className="object-contain bg-stone-50"
            />
          </div>
          {!isUploading && (
            <button
              onClick={clearPreview}
              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
            >
              <X className="h-4 w-4 text-stone-600" />
            </button>
          )}
        </div>

        {isUploading && (
          <div className="flex items-center justify-center gap-2 text-stone-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('uploadingSlip')}</span>
          </div>
        )}

        {slipUrl && !isUploading && !error && (
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t('slipUploadedSuccess')}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{t('error')}</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <Button 
            onClick={clearPreview} 
            variant="outline" 
            className="w-full"
          >
            {t('tryAgainDifferent')}
          </Button>
        )}

        {/* Confirm Payment Button */}
        <Button 
          onClick={handleConfirmPayment}
          className="w-full h-12 text-base font-semibold text-white gap-2"
          style={{ backgroundColor: primaryColor }}
          disabled={!slipUrl || isUploading}
        >
          <Send className="h-5 w-5" />
          {t('confirmPayment')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Notes input */}
      <div className="space-y-2">
        <Label htmlFor="booking-notes" className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {t('specialRequests')}
        </Label>
        <Textarea
          id="booking-notes"
          placeholder={t('notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[80px] resize-none"
        />
        <p className="text-xs text-stone-500">
          {t('specialRequestsDesc')}
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !isAuthLoading && fileInputRef.current?.click()}
        onDrop={isAuthLoading ? undefined : handleDrop}
        onDragOver={isAuthLoading ? undefined : handleDragOver}
        onDragLeave={isAuthLoading ? undefined : handleDragLeave}
        className={`
          relative rounded-xl border-2 border-dashed transition-all
          ${isAuthLoading 
            ? 'border-stone-200 bg-stone-50 cursor-wait'
            : isDragging 
              ? 'border-blue-400 bg-blue-50 cursor-pointer' 
              : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50 cursor-pointer'
          }
        `}
      >
        <div className="p-6 text-center">
          <div 
            className="h-14 w-14 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: isAuthLoading ? '#e5e7eb' : `${primaryColor}15` }}
          >
            {isAuthLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-stone-400" />
            ) : isDragging ? (
              <Upload className="h-7 w-7" style={{ color: primaryColor }} />
            ) : (
              <ImageIcon className="h-7 w-7" style={{ color: primaryColor }} />
            )}
          </div>
          
          <p className="text-base font-medium text-stone-900 mb-1">
            {isAuthLoading 
              ? t('preparingUpload') || 'Preparing...'
              : isDragging 
                ? t('dropSlipHere')
                : t('uploadPaymentSlip')
            }
          </p>
          <p className="text-sm text-stone-500">
            {isAuthLoading 
              ? t('pleaseWait') || 'Please wait a moment'
              : t('afterPayingUpload')
            }
          </p>
          {!isAuthLoading && (
            <p className="text-xs text-stone-400 mt-2">
              {t('supportedFormatsDetail')}
            </p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isAuthLoading}
        />
      </div>

      {/* Upload from Phone Button - Hidden on mobile since users are already on phone */}
      <div className="hidden md:block">
        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-stone-500">{t('or')}</span>
          </div>
        </div>

        {/* Upload from Phone Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 gap-2"
          onClick={() => setShowQRModal(true)}
          disabled={isAuthLoading}
        >
          <Smartphone className="h-5 w-5" />
          {t('uploadFromPhone')}
        </Button>

        <p className="text-xs text-stone-500 text-center mt-4">
          {t('scanQRToUpload')}
        </p>
      </div>

      {/* QR Upload Modal */}
      <QRUploadModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onUploadComplete={handleQRUploadComplete}
        tenantId={tenantId}
        roomId={roomId}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        totalPrice={totalPrice}
        notes={notes}
        primaryColor={primaryColor}
      />

      {/* Tips */}
      <div className="bg-stone-50 rounded-lg p-4">
        <p className="text-sm font-medium text-stone-700 mb-2">
          {t('tipsForVerification')}
        </p>
        <ul className="text-xs text-stone-500 space-y-1">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
            <span>{t('tip1')}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
            <span>{t('tip2')}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
            <span>{t('tip3')}</span>
          </li>
        </ul>
      </div>

      {error && !preview && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Confirm Payment Button - Always visible, disabled when no slip or auth loading */}
      <Button 
        onClick={handleConfirmPayment}
        className="w-full h-12 text-base font-semibold text-white gap-2"
        style={{ backgroundColor: primaryColor }}
        disabled={!slipUrl || isUploading || isAuthLoading}
      >
        <Send className="h-5 w-5" />
        {t('confirmPayment')}
      </Button>
    </div>
  )
}
