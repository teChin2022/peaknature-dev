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
import { useLanguage } from '@/components/providers/language-provider'

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
  const { locale } = useLanguage()
  
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [showQRModal, setShowQRModal] = useState(false)

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
      setError('Please upload an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    setError(null)
    setSlipUrl(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    setIsUploading(true)
    try {
      const fileName = `payment-slips/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      
      const { data, error: uploadErr } = await supabase.storage
        .from('bookings')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadErr) {
        setError('Failed to upload image. Please try again.')
        setPreview(null)
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bookings')
        .getPublicUrl(data.path)

      setSlipUrl(publicUrl)

    } catch (err) {
      console.error('Upload error:', err)
      setError('An error occurred. Please try again.')
      setPreview(null)
    } finally {
      setIsUploading(false)
    }
  }, [supabase])

  // Step 2: Handle confirm button click (create booking + verify)
  const handleConfirmPayment = useCallback(async () => {
    if (!slipUrl) {
      setError('Please upload your payment slip first')
      return
    }

    setError(null)
    setIsVerifying(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Please log in or create an account first using the form above')
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
        .single()

      let bookingToUse = existingBooking
      let isNewBooking = false

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
            setError('These dates are no longer available. Another guest has just booked them. Please choose different dates.')
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
        setError('Failed to create booking. Please try again.')
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
      const response = await fetch('/api/payment/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingToUse.id,
          slipUrl: slipUrl,
          expectedAmount: totalPrice,
          tenantId
        })
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        setError(`Too many verification attempts. Please wait ${retryAfter} seconds and try again.`)
        setIsVerifying(false)
        return
      }

      const result = await response.json()

      if (!result.success) {
        // Delete the booking since verification failed
        await deleteBookingOnFailure()
        setError(result.error || 'Payment verification failed. Please try again or contact the host.')
        setIsVerifying(false)
        return
      }

      // Success!
      setIsSuccess(true)
      setIsVerifying(false)

      // Redirect to confirmation after delay
      setTimeout(() => {
        router.push(`/${tenantSlug}/booking/confirmation/${bookingToUse.id}`)
      }, 2000)

    } catch (err) {
      console.error('Verification error:', err)
      // Delete the booking since an error occurred
      if (bookingToUse && isNewBooking) {
        await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingToUse.id)
          .eq('status', 'pending')
      }
      setError('An error occurred. Please try again.')
      setIsVerifying(false)
    }
  }, [supabase, slipUrl, roomId, checkIn, checkOut, guests, totalPrice, tenantId, tenantSlug, router, notes])

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
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Handle upload from QR code (phone upload)
  const handleQRUploadComplete = useCallback((uploadedSlipUrl: string) => {
    setSlipUrl(uploadedSlipUrl)
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
          {locale === 'th' ? 'ยืนยันการชำระเงินแล้ว!' : 'Payment Verified!'}
        </p>
        <p className="text-sm text-stone-600 mb-4">
          {locale === 'th' ? 'การจองของคุณได้รับการยืนยันแล้ว' : 'Your booking has been confirmed.'}
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
          {locale === 'th' ? 'กรุณารอสักครู่' : 'This may take a moment'}
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
            <span className="text-sm">Uploading...</span>
          </div>
        )}

        {slipUrl && !isUploading && !error && (
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Slip uploaded successfully. Click &quot;Confirm Payment&quot; to complete your booking.</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
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
            Try Again with Different Image
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
          {locale === 'th' ? 'ยืนยันการชำระเงิน' : 'Confirm Payment'}
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
          {locale === 'th' ? 'คำขอพิเศษ (ถ้ามี)' : 'Special Requests (Optional)'}
        </Label>
        <Textarea
          id="booking-notes"
          placeholder={t('notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[80px] resize-none"
        />
        <p className="text-xs text-stone-500">
          {locale === 'th' ? 'รวมถึงคำขอรับ-ส่ง, เวลาเดินทางถึง หรือความต้องการพิเศษอื่นๆ' : 'Include pickup/drop-off requests, arrival time, or other special needs.'}
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed transition-all
          ${isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
          }
        `}
      >
        <div className="p-6 text-center">
          <div 
            className="h-14 w-14 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            {isDragging ? (
              <Upload className="h-7 w-7" style={{ color: primaryColor }} />
            ) : (
              <ImageIcon className="h-7 w-7" style={{ color: primaryColor }} />
            )}
          </div>
          
          <p className="text-base font-medium text-stone-900 mb-1">
            {isDragging 
              ? (locale === 'th' ? 'วางสลิปที่นี่' : 'Drop your slip here') 
              : (locale === 'th' ? 'อัปโหลดสลิปการชำระเงิน' : 'Upload payment slip')
            }
          </p>
          <p className="text-sm text-stone-500">
            {locale === 'th' ? 'หลังจากชำระเงิน ให้ถ่ายภาพหน้าจอและอัปโหลดที่นี่' : 'After paying, take a screenshot and upload here'}
          </p>
          <p className="text-xs text-stone-400 mt-2">
            {locale === 'th' ? 'รองรับ: JPG, PNG, WEBP (สูงสุด 10MB)' : 'Supports: JPG, PNG, WEBP (max 10MB)'}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-stone-500">or</span>
        </div>
      </div>

      {/* Upload from Phone Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 gap-2"
        onClick={() => setShowQRModal(true)}
      >
        <Smartphone className="h-5 w-5" />
        {t('uploadFromPhone')}
      </Button>

      <p className="text-xs text-stone-500 text-center">
        {t('scanQRToUpload')}
      </p>

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
          {locale === 'th' ? 'เคล็ดลับการตรวจสอบสำเร็จ:' : 'Tips for successful verification:'}
        </p>
        <ul className="text-xs text-stone-500 space-y-1">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
            <span>{locale === 'th' ? 'อัปโหลดภาพหน้าจอที่ชัดเจนของการยืนยันการชำระเงิน' : 'Upload a clear screenshot of your payment confirmation'}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
            <span>{locale === 'th' ? 'ตรวจสอบให้แน่ใจว่าจำนวนเงินและรายละเอียดผู้รับปรากฏชัดเจน' : 'Make sure the amount and recipient details are visible'}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
            <span>{locale === 'th' ? 'ใช้สลิปจากแอปธนาคาร ไม่ใช่รูปถ่ายหน้าจอ' : 'Use the slip from your banking app, not a photo of the screen'}</span>
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

      {/* Confirm Payment Button - Always visible, disabled when no slip */}
      <Button 
        onClick={handleConfirmPayment}
        className="w-full h-12 text-base font-semibold text-white gap-2"
        style={{ backgroundColor: primaryColor }}
        disabled={!slipUrl || isUploading}
      >
        <Send className="h-5 w-5" />
        {locale === 'th' ? 'ยืนยันการชำระเงิน' : 'Confirm Payment'}
      </Button>
    </div>
  )
}
