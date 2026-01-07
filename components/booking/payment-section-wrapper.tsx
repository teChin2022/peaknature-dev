'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TransportServiceSelector, TransportSelections } from './transport-service-selector'
import { PaymentSlipUpload } from './payment-slip-upload'
import { PromptPayQRCode } from './promptpay-qr'
import { Tenant, TenantSettings, defaultTenantSettings, CurrencyCode } from '@/types/database'
import { formatPrice } from '@/lib/currency'
import { QrCode, Upload, Car } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface PaymentSectionWrapperProps {
  tenant: Tenant
  roomId: string
  checkIn: string
  checkOut: string
  guests: number
  basePrice: number
}

export function PaymentSectionWrapper({
  tenant,
  roomId,
  checkIn,
  checkOut,
  guests,
  basePrice,
}: PaymentSectionWrapperProps) {
  const t = useTranslations('booking')
  const settings: TenantSettings = {
    ...defaultTenantSettings,
    ...(tenant.settings as TenantSettings || {})
  }

  const [transportSelections, setTransportSelections] = useState<TransportSelections>({
    pickupRequested: false,
    pickupLocation: '',
    pickupTime: '',
    pickupPrice: 0,
    dropoffRequested: false,
    dropoffLocation: '',
    dropoffTime: '',
    dropoffPrice: 0,
    formattedNote: '',
  })

  const handleTransportChange = useCallback((selections: TransportSelections) => {
    setTransportSelections(selections)
  }, [])

  const transportTotal = transportSelections.pickupPrice + transportSelections.dropoffPrice
  const grandTotal = basePrice + transportTotal

  // Check if transport services are enabled
  const hasTransportServices = settings.transport?.pickup_enabled || settings.transport?.dropoff_enabled

  if (!settings.payment?.promptpay_qr_url) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Transport Services */}
      {hasTransportServices && (
        <TransportServiceSelector
          settings={settings}
          currency={settings.currency as CurrencyCode}
          primaryColor={tenant.primary_color}
          onChange={handleTransportChange}
        />
      )}

      {/* Updated Total if transport selected */}
      {transportTotal > 0 && (
        <Card className="border-stone-200 bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>{t('roomTotal')}</span>
                <span>{formatPrice(basePrice, settings.currency as CurrencyCode)}</span>
              </div>
              {transportSelections.pickupRequested && (
                <div className="flex justify-between text-amber-700">
                  <span className="flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {t('pickupService')}
                  </span>
                  <span>+{formatPrice(transportSelections.pickupPrice, settings.currency as CurrencyCode)}</span>
                </div>
              )}
              {transportSelections.dropoffRequested && (
                <div className="flex justify-between text-amber-700">
                  <span className="flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {t('dropoffService')}
                  </span>
                  <span>+{formatPrice(transportSelections.dropoffPrice, settings.currency as CurrencyCode)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-stone-900 pt-2 border-t border-amber-200">
                <span>{t('newTotalToPay')}</span>
                <span style={{ color: tenant.primary_color }}>
                  {formatPrice(grandTotal, settings.currency as CurrencyCode)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: QR Code */}
      <Card className="border-stone-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: tenant.primary_color }}
            >
              1
            </div>
            <QrCode className="h-5 w-5" style={{ color: tenant.primary_color }} />
            {t('scanQR')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PromptPayQRCode
            qrCodeUrl={settings.payment.promptpay_qr_url}
            promptpayName={settings.payment.promptpay_name}
            amount={grandTotal}
            currency={settings.currency}
            primaryColor={tenant.primary_color}
          />
        </CardContent>
      </Card>

      {/* Step 2: Upload Slip */}
      <Card className="border-stone-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: tenant.primary_color }}
            >
              2
            </div>
            <Upload className="h-5 w-5" style={{ color: tenant.primary_color }} />
            {t('uploadPaymentSlip')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentSlipUpload
            roomId={roomId}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            totalPrice={grandTotal}
            tenantId={tenant.id}
            tenantSlug={tenant.slug}
            primaryColor={tenant.primary_color}
            transportNote={transportSelections.formattedNote}
          />
        </CardContent>
      </Card>
    </div>
  )
}

