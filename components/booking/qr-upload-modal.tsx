'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, X, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getAppBaseUrl } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface QRUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (slipUrl: string, contentHash?: string) => void
  tenantId: string
  roomId: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: number
  notes?: string
  primaryColor: string
}

export function QRUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  tenantId,
  roomId,
  checkIn,
  checkOut,
  guests,
  totalPrice,
  notes,
  primaryColor,
}: QRUploadModalProps) {
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploaded, setIsUploaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('qrUploadModal')
  const tErrors = useTranslations('errors')

  // Generate upload URL - falls back to current domain if env var not set
  const baseUrl = getAppBaseUrl()
  const uploadUrl = token ? `${baseUrl}/upload/${token}` : ''

  // Create token when modal opens
  const createToken = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/upload/create-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          roomId,
          checkIn,
          checkOut,
          guests,
          totalPrice,
          notes,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || tErrors('failedToCreateUploadLink'))
        return
      }

      setToken(result.token)
      setExpiresAt(new Date(result.expiresAt))

    } catch (err) {
      console.error('Create token error:', err)
      setError(tErrors('somethingWrong'))
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, roomId, checkIn, checkOut, guests, totalPrice, notes])

  // Poll for upload status
  useEffect(() => {
    if (!token || isUploaded) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/upload/check-status?token=${token}`)
        const result = await response.json()

        if (result.expired) {
          setError(tErrors('qrExpired'))
          setToken(null)
          clearInterval(pollInterval)
          return
        }

        if (result.isUploaded && result.slipUrl) {
          setIsUploaded(true)
          clearInterval(pollInterval)
          // Wait a moment then call completion handler with content hash
          setTimeout(() => {
            onUploadComplete(result.slipUrl, result.slipContentHash)
          }, 1500)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [token, isUploaded, onUploadComplete])

  // Update countdown timer
  useEffect(() => {
    if (!expiresAt) return

    const updateTimer = () => {
      const now = new Date()
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
      setTimeLeft(diff)

      if (diff === 0) {
        setError(tErrors('qrExpired'))
        setToken(null)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // Create token when modal opens
  useEffect(() => {
    if (isOpen && !token && !isLoading) {
      createToken()
    }
  }, [isOpen, token, isLoading, createToken])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setToken(null)
      setExpiresAt(null)
      setIsUploaded(false)
      setError(null)
    }
  }, [isOpen])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-stone-400 mb-4" />
              <p className="text-stone-600">{t('generatingQR')}</p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="text-center py-8">
              <div className="h-16 w-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                <X className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-stone-800 font-medium mb-4">{error}</p>
              <Button onClick={createToken} variant="outline">
                {t('generateNewQR')}
              </Button>
            </div>
          )}

          {/* Upload complete state */}
          {isUploaded && (
            <div className="text-center py-8">
              <div 
                className="h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <CheckCircle2 className="h-8 w-8" style={{ color: primaryColor }} />
              </div>
              <p className="text-stone-800 font-medium mb-2">{t('uploadComplete')}</p>
              <p className="text-stone-500 text-sm">{t('closingWindow')}</p>
            </div>
          )}

          {/* QR Code */}
          {token && !error && !isUploaded && !isLoading && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white border-2 border-stone-200 rounded-xl">
                <QRCodeSVG
                  value={uploadUrl}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>

              {/* Timer */}
              <div className="flex items-center justify-center gap-2 text-stone-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {t('expiresIn')} <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
                </span>
              </div>

              {/* Instructions */}
              <div className="bg-stone-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-stone-800 text-sm">{t('instructions')}</p>
                <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
                  <li>{t('step1')}</li>
                  <li>{t('step2')}</li>
                  <li>{t('step3')}</li>
                  <li>{t('step4')}</li>
                </ol>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t('waitingForUpload')}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

