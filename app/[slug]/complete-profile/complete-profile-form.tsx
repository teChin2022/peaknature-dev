'use client'

import { useState } from 'react'
import { MapPin, Loader2, CheckCircle2, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { GuestLocationSelector } from '@/components/guest-location-selector'
import { useTranslations } from 'next-intl'

interface CompleteProfileFormProps {
  slug: string
  tenant: { name: string; primary_color: string }
  nextUrl: string | null
  userId: string  // Pass user ID from server
  initialData: {
    phone: string
    province: string
    district: string
    subDistrict: string
  }
  isOAuthUser: boolean
}

export function CompleteProfileForm({ 
  slug, 
  tenant, 
  nextUrl, 
  userId,
  initialData,
  isOAuthUser 
}: CompleteProfileFormProps) {
  const t = useTranslations('completeProfile')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [phone, setPhone] = useState(initialData.phone)
  const [province, setProvince] = useState(initialData.province)
  const [district, setDistrict] = useState(initialData.district)
  const [subDistrict, setSubDistrict] = useState(initialData.subDistrict)

  const supabase = createClient()

  // Reset district when province changes
  const handleProvinceChange = (value: string) => {
    setProvince(value)
    setDistrict('')
    setSubDistrict('')
  }

  // Reset sub-district when district changes
  const handleDistrictChange = (value: string) => {
    setDistrict(value)
    setSubDistrict('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate phone (required for all users for refunds)
    if (!phone.trim() || phone.trim().length < 10) {
      setError(t('errors.invalidPhone'))
      return
    }
    
    if (!province) {
      setError(t('errors.selectProvince'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Use the userId passed from server instead of getUser()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          phone: phone.trim(),
          province,
          district: district || null,
          sub_district: subDistrict || null,
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        setError(t('errors.saveFailed'))
        return
      }

      // Redirect to next page or home
      window.location.href = nextUrl || `/${slug}`
    } catch (err) {
      console.error('Save error:', err)
      setError(t('errors.somethingWrong'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4"
            style={{ backgroundColor: `${tenant.primary_color}15` }}
          >
            <MapPin className="h-8 w-8" style={{ color: tenant.primary_color }} />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            {t('title')}
          </h1>
          <p className="text-stone-600 mt-2">
            {t('subtitle', { tenantName: tenant.name })}
          </p>
        </div>

        {/* Form */}
        <Card className="border-stone-200 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" style={{ color: tenant.primary_color }} />
              {t('cardTitle')}
            </CardTitle>
            <CardDescription>
              {t('cardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">
                  {t('phone.label')} <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t('phone.placeholder')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-stone-500">{t('phone.hint')}</p>
              </div>

              <div className="border-t border-stone-200 my-4 pt-4">
                <p className="text-sm font-medium text-stone-700 mb-4">{t('location.title')}</p>
              </div>

              {/* Searchable Location Selector */}
              <GuestLocationSelector
                province={province}
                district={district}
                subDistrict={subDistrict}
                onProvinceChange={handleProvinceChange}
                onDistrictChange={handleDistrictChange}
                onSubDistrictChange={setSubDistrict}
                primaryColor={tenant.primary_color}
                labels={{
                  province: t('location.province'),
                  district: t('location.district'),
                  subDistrict: t('location.subDistrict'),
                  selectProvince: t('location.selectProvince'),
                  selectDistrict: t('location.selectDistrict'),
                  selectSubDistrict: t('location.selectSubDistrict'),
                  selectProvinceFirst: t('location.selectProvinceFirst'),
                  selectDistrictFirst: t('location.selectDistrictFirst'),
                  search: t('location.search'),
                  noResults: t('location.noResults'),
                  optional: t('location.optional'),
                }}
              />

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold text-white cursor-pointer"
                style={{ backgroundColor: tenant.primary_color }}
                disabled={isSaving || !phone.trim() || phone.trim().length < 10 || !province}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('submit')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info note */}
        <p className="text-center text-xs text-stone-500 mt-6">
          {t('privacyNote')}
        </p>
      </div>
    </div>
  )
}
