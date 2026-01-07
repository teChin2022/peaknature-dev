'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  CreditCard, Clock, CheckCircle2, AlertTriangle, Upload, Loader2,
  Crown, Zap, BarChart3, MessageCircle, Headphones, Code
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/currency'
import { 
  SubscriptionStatus,
  formatSubscriptionStatus, 
  getStatusColor,
  DEFAULT_FEATURES,
  FeatureKey 
} from '@/lib/subscription'
import { format, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'

interface Payment {
  id: string
  amount: number
  period_start: string
  period_end: string
  status: string
  created_at: string
  payment_proof_url: string | null
}

// Serializable subscription data (no functions)
interface SubscriptionData {
  plan: 'free' | 'pro'
  status: SubscriptionStatus
  trialStartedAt: string | null
  trialEndsAt: string | null
  subscriptionStartedAt: string | null
  subscriptionEndsAt: string | null
  daysRemaining: number
  isTrialActive: boolean
  isSubscriptionActive: boolean
}

interface SubscriptionContentProps {
  slug: string
  tenant: {
    id: string
    name: string
    primary_color: string
    settings?: unknown
  }
  subscriptionData: SubscriptionData | null
  payments: Payment[]
  currency: string
  proPlanPrice: number
}

const featureIcons: Record<FeatureKey, typeof CreditCard> = {
  rooms: CreditCard,
  bookings_per_month: CreditCard,
  analytics: BarChart3,
  custom_branding: Crown,
  online_payments: CreditCard,
  email_notifications: Zap,
  line_notifications: MessageCircle,
  priority_support: Headphones,
  api_access: Code,
}

export function SubscriptionContent({
  slug,
  tenant,
  subscriptionData,
  payments,
  currency,
  proPlanPrice,
}: SubscriptionContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('dashboard.subscription')
  const [upgradeDialog, setUpgradeDialog] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedProof, setUploadedProof] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const featureLabels: Record<FeatureKey, string> = {
    rooms: t('rooms'),
    bookings_per_month: t('bookingsPerMonth'),
    analytics: t('analytics'),
    custom_branding: t('customBranding'),
    online_payments: t('onlinePayments'),
    email_notifications: t('emailNotifications'),
    line_notifications: t('lineNotifications'),
    priority_support: t('prioritySupport'),
    api_access: t('apiAccess'),
  }

  const handleUpgrade = async () => {
    if (!uploadedProof) {
      setError(t('upgradeDialog.uploadProof'))
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Use API route to handle the upgrade
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          amount: proPlanPrice,
          currency: currency,
          paymentProofUrl: uploadedProof,
        }),
      })

      const result = await response.json()

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        setError(`Too many requests. Please try again in ${retryAfter} seconds.`)
        return
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit payment')
      }

      setSuccess(true)
      setTimeout(() => {
        setUpgradeDialog(false)
        setUploadedProof(null)
        router.refresh()
      }, 2000)
    } catch (err) {
      console.error('Error submitting payment:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit payment')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${tenant.id}/payment-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('subscription-proofs')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('subscription-proofs')
        .getPublicUrl(fileName)

      setUploadedProof(publicUrl)
    } catch (err) {
      console.error('Error uploading file:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const statusColor = subscriptionData 
    ? getStatusColor(subscriptionData.status)
    : 'bg-gray-100 text-gray-700'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Trial/Expiry Warning */}
      {subscriptionData && (subscriptionData.status === 'trial' || subscriptionData.status === 'expired') && (
        <div className={`p-4 rounded-xl flex items-center justify-between ${
          subscriptionData.status === 'expired' 
            ? 'bg-red-50 border border-red-200' 
            : subscriptionData.daysRemaining <= 7 
              ? 'bg-amber-50 border border-amber-200' 
              : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {subscriptionData.status === 'expired' ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : (
              <Clock className="h-5 w-5 text-blue-600" />
            )}
            <div>
              <p className={`font-medium ${
                subscriptionData.status === 'expired' ? 'text-red-800' : 'text-gray-900'
              }`}>
                {subscriptionData.status === 'expired' 
                  ? t('trialExpired')
                  : t('trialDaysLeft', { days: subscriptionData.daysRemaining })
                }
              </p>
              <p className={`text-sm ${
                subscriptionData.status === 'expired' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {subscriptionData.status === 'expired'
                  ? t('upgradeToProExpired')
                  : t('upgradeToProTrial')
                }
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setUpgradeDialog(true)}
            style={{ backgroundColor: tenant.primary_color }}
            className="text-white"
          >
            {t('upgradeNow')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Plan */}
        <Card className="lg:col-span-2 bg-white">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5" style={{ color: tenant.primary_color }} />
              {t('currentPlan')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold text-gray-900 capitalize">
                    {t('plan', { plan: subscriptionData?.plan || 'Free' })}
                  </h3>
                  <Badge className={statusColor}>
                    {subscriptionData ? formatSubscriptionStatus(subscriptionData.status) : 'Unknown'}
                  </Badge>
                </div>
                {subscriptionData?.status === 'trial' && subscriptionData.trialEndsAt && (
                  <p className="text-sm text-gray-500 mt-1">
                    {t('trialEndsOn', { date: format(parseISO(subscriptionData.trialEndsAt), 'MMMM d, yyyy') })}
                  </p>
                )}
                {subscriptionData?.status === 'active' && subscriptionData.subscriptionEndsAt && (
                  <p className="text-sm text-gray-500 mt-1">
                    {t('renewsOn', { date: format(parseISO(subscriptionData.subscriptionEndsAt), 'MMMM d, yyyy') })}
                  </p>
                )}
              </div>
              {subscriptionData?.status !== 'active' && (
                <Button 
                  onClick={() => setUpgradeDialog(true)}
                  style={{ backgroundColor: tenant.primary_color }}
                  className="text-white"
                >
                  {t('upgradeToPro')}
                </Button>
              )}
            </div>

            {/* Feature Comparison */}
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 bg-gray-50 border-b">
                <div className="p-3 text-xs font-medium text-gray-500 uppercase">{t('feature')}</div>
                <div className="p-3 text-xs font-medium text-gray-500 uppercase text-center">{t('freePlan')}</div>
                <div className="p-3 text-xs font-medium text-gray-500 uppercase text-center">{t('proPlan')}</div>
              </div>
              {(Object.keys(featureLabels) as FeatureKey[]).map((key) => {
                const Icon = featureIcons[key]
                const freeFeature = DEFAULT_FEATURES.free[key]
                const proFeature = DEFAULT_FEATURES.pro[key]
                
                return (
                  <div key={key} className="grid grid-cols-3 border-b last:border-b-0">
                    <div className="p-3 flex items-center gap-2 text-sm text-gray-700">
                      <Icon className="h-4 w-4 text-gray-400" />
                      {featureLabels[key]}
                    </div>
                    <div className="p-3 flex items-center justify-center">
                      {freeFeature.enabled ? (
                        freeFeature.limit !== null ? (
                          <span className="text-sm text-gray-600">{freeFeature.limit}</span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                    <div className="p-3 flex items-center justify-center bg-indigo-50/50">
                      {proFeature.enabled ? (
                        proFeature.limit !== null ? (
                          <span className="text-sm font-medium text-indigo-600">{proFeature.limit}</span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Pro Plan Card */}
        <Card className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5" />
              <span className="font-semibold">{t('proCard.title')}</span>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">{formatPrice(proPlanPrice, currency)}</span>
              <span className="text-white/70">{t('proCard.perMonth')}</span>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {t('proCard.unlimitedRooms')}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {t('proCard.unlimitedBookings')}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {t('proCard.advancedAnalytics')}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {t('proCard.lineNotifications')}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {t('proCard.prioritySupport')}
              </li>
            </ul>
            {subscriptionData?.status !== 'active' && (
              <Button 
                onClick={() => setUpgradeDialog(true)}
                className="w-full bg-white text-indigo-600 hover:bg-white/90"
              >
                {t('upgradeNow')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card className="bg-white">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-base">{t('paymentHistory')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {payments.map((payment) => (
                <div key={payment.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatPrice(payment.amount, currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(parseISO(payment.period_start), 'MMM d')} - {format(parseISO(payment.period_end), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={
                      payment.status === 'verified' 
                        ? 'bg-emerald-100 text-emerald-700'
                        : payment.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }>
                      {payment.status}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {format(parseISO(payment.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialog} onOpenChange={setUpgradeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-indigo-600" />
              {t('upgradeDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('upgradeDialog.description', { price: formatPrice(proPlanPrice, currency) })}
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('paymentSubmitted.title')}</h3>
              <p className="text-sm text-gray-500">
                {t('paymentSubmitted.description')}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 my-4">
                {/* Payment Instructions */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {t('upgradeDialog.step1', { price: formatPrice(proPlanPrice, currency) })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('upgradeDialog.step1Hint')}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {t('upgradeDialog.step2')}
                  </p>
                  <div className="mt-3">
                    {uploadedProof ? (
                      <div className="relative">
                        <Image
                          src={uploadedProof}
                          alt="Payment proof"
                          width={200}
                          height={200}
                          className="rounded-lg border max-h-40 object-contain mx-auto"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUploadedProof(null)}
                          className="absolute top-2 right-2"
                        >
                          {t('upgradeDialog.change')}
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-6 cursor-pointer hover:border-gray-300 transition-colors">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">{t('upgradeDialog.clickToUpload')}</span>
                        <span className="text-xs text-gray-400 mt-1">{t('upgradeDialog.supportedFormats')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setUpgradeDialog(false)}
                >
                  {t('upgradeDialog.cancel')}
                </Button>
                <Button
                  onClick={handleUpgrade}
                  disabled={isUploading || !uploadedProof}
                  style={{ backgroundColor: tenant.primary_color }}
                  className="text-white"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('upgradeDialog.uploading')}
                    </>
                  ) : (
                    t('upgradeDialog.submitPayment')
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
