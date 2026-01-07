'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2, CheckCircle2, AlertCircle, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

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

interface SlipUploadProps {
  onUpload: (slipUrl: string, contentHash?: string) => void
  isVerifying: boolean
  error: string | null
  primaryColor: string
}

export function SlipUpload({ onUpload, isVerifying, error, primaryColor }: SlipUploadProps) {
  const t = useTranslations('paymentPage')
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError(t('errorImageOnly'))
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(t('errorMaxSize'))
      return
    }

    setUploadError(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    setIsUploading(true)
    try {
      // Generate content hash FIRST for duplicate detection
      const contentHash = await generateFileHash(file)
      console.log('[SlipUpload] Content hash generated:', contentHash.substring(0, 16) + '...')
      
      const fileName = `payment-slips/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      
      const { data, error: uploadErr } = await supabase.storage
        .from('bookings')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadErr) {
        console.error('Upload error:', uploadErr)
        setUploadError(t('errorUploadFailed'))
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bookings')
        .getPublicUrl(data.path)

      // Trigger verification with content hash
      onUpload(publicUrl, contentHash)
    } catch (err) {
      console.error('Upload error:', err)
      setUploadError(t('errorUploadFailed'))
    } finally {
      setIsUploading(false)
    }
  }, [supabase, onUpload, t])

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
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Show verifying state
  if (isVerifying) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: primaryColor }} />
        <p className="text-lg font-medium text-stone-900">{t('verifying')}</p>
        <p className="text-sm text-stone-500 mt-2">{t('verifyingDesc')}</p>
      </div>
    )
  }

  // Show preview with option to retry or clear
  if (preview) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden border-2 border-stone-200">
          <div className="relative aspect-[3/4] max-h-80">
            <Image 
              src={preview} 
              alt="Payment slip preview" 
              fill 
              className="object-contain bg-stone-50"
            />
          </div>
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
          >
            <X className="h-4 w-4 text-stone-600" />
          </button>
        </div>

        {isUploading && (
          <div className="flex items-center justify-center gap-2 text-stone-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('uploading')}</span>
          </div>
        )}

        {(error || uploadError) && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{t('verificationFailed')}</p>
                <p className="text-sm text-red-600 mt-1">{error || uploadError}</p>
              </div>
            </div>
          </div>
        )}

        {(error || uploadError) && (
          <Button 
            onClick={clearPreview} 
            variant="outline" 
            className="w-full"
          >
            {t('tryAgainDifferent')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
        <div className="p-8 text-center">
          <div 
            className="h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            {isDragging ? (
              <Upload className="h-8 w-8" style={{ color: primaryColor }} />
            ) : (
              <ImageIcon className="h-8 w-8" style={{ color: primaryColor }} />
            )}
          </div>
          
          <p className="text-base font-medium text-stone-900 mb-1">
            {isDragging ? t('dropHere') : t('uploadSlipAction')}
          </p>
          <p className="text-sm text-stone-500">
            {t('dragDrop')}
          </p>
          <p className="text-xs text-stone-400 mt-2">
            {t('supportedFormats')}
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

      {/* Tips */}
      <div className="bg-stone-50 rounded-lg p-4">
        <p className="text-sm font-medium text-stone-700 mb-2">{t('tips')}</p>
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
    </div>
  )
}

