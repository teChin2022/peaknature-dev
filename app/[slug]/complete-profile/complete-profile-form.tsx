'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Loader2, CheckCircle2, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { GuestLocationSelector } from '@/components/guest-location-selector'

interface CompleteProfileFormProps {
  slug: string
  tenant: { name: string; primary_color: string }
  nextUrl: string | null
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
  initialData,
  isOAuthUser 
}: CompleteProfileFormProps) {
  const router = useRouter()
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
      setError('Please enter a valid phone number (at least 10 digits)')
      return
    }
    
    if (!province) {
      setError('Please select your province')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please login again')
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          phone: phone.trim(),
          province,
          district: district || null,
          sub_district: subDistrict || null,
        })
        .eq('id', user.id)

      if (updateError) {
        setError('Failed to save. Please try again.')
        return
      }

      // Redirect to next page or home
      router.push(nextUrl || `/${slug}`)
    } catch {
      setError('Something went wrong. Please try again.')
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
            Complete Your Profile
          </h1>
          <p className="text-stone-600 mt-2">
            Please tell us where you&apos;re from to help {tenant.name} serve you better
          </p>
        </div>

        {/* Form */}
        <Card className="border-stone-200 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" style={{ color: tenant.primary_color }} />
              Complete Your Details
            </CardTitle>
            <CardDescription>
              This helps us serve you better and process refunds if needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+66 812 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-stone-500">Required for booking confirmations and refunds via PromptPay</p>
              </div>

              <div className="border-t border-stone-200 my-4 pt-4">
                <p className="text-sm font-medium text-stone-700 mb-4">Your Location</p>
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
              />

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold text-white"
                style={{ backgroundColor: tenant.primary_color }}
                disabled={isSaving || !phone.trim() || phone.trim().length < 10 || !province}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Profile
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info note */}
        <p className="text-center text-xs text-stone-500 mt-6">
          Your location helps the property understand where their guests come from.
          <br />This information is kept private and secure.
        </p>
      </div>
    </div>
  )
}

