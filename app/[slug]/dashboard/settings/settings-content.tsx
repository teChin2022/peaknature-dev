'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  Loader2, Save, Building2, Palette, Globe, MapPin, 
  Star, Share2, Wifi, Car, Coffee, UtensilsCrossed, Wind, Tv,
  Sparkles, Phone, Mail, Plus, Trash2, GripVertical,
  Bath, Bed, Dumbbell, Waves, Mountain, TreePine, Utensils,
  Flame, Snowflake, Lock, ShieldCheck, PawPrint, Baby, Cigarette,
  Clock, Banknote, CreditCard, Shirt, Droplets, Sun, Moon, ImageIcon,
  QrCode, Bell, Timer, CheckCircle2, AlertCircle, Image as ImageLucide
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { HeroImageUpload } from '@/components/dashboard/hero-image-upload'
import Image from 'next/image'
import { Tenant, TenantSettings, defaultTenantSettings, TenantAmenity, CURRENCIES, CurrencyCode } from '@/types/database'
import { LocationSelector } from '@/components/dashboard/location-selector'
import { useTranslations } from 'next-intl'

// Available icons for amenities
const availableIcons = [
  { id: 'wifi', name: 'WiFi', icon: <Wifi className="h-5 w-5" /> },
  { id: 'car', name: 'Parking', icon: <Car className="h-5 w-5" /> },
  { id: 'coffee', name: 'Coffee', icon: <Coffee className="h-5 w-5" /> },
  { id: 'utensils', name: 'Kitchen', icon: <UtensilsCrossed className="h-5 w-5" /> },
  { id: 'wind', name: 'Air Conditioning', icon: <Wind className="h-5 w-5" /> },
  { id: 'tv', name: 'TV', icon: <Tv className="h-5 w-5" /> },
  { id: 'bath', name: 'Bathroom', icon: <Bath className="h-5 w-5" /> },
  { id: 'bed', name: 'Bed', icon: <Bed className="h-5 w-5" /> },
  { id: 'dumbbell', name: 'Gym', icon: <Dumbbell className="h-5 w-5" /> },
  { id: 'waves', name: 'Pool', icon: <Waves className="h-5 w-5" /> },
  { id: 'mountain', name: 'Mountain View', icon: <Mountain className="h-5 w-5" /> },
  { id: 'tree', name: 'Garden', icon: <TreePine className="h-5 w-5" /> },
  { id: 'restaurant', name: 'Restaurant', icon: <Utensils className="h-5 w-5" /> },
  { id: 'flame', name: 'Fireplace', icon: <Flame className="h-5 w-5" /> },
  { id: 'snowflake', name: 'Heating', icon: <Snowflake className="h-5 w-5" /> },
  { id: 'lock', name: 'Safe', icon: <Lock className="h-5 w-5" /> },
  { id: 'shield', name: 'Security', icon: <ShieldCheck className="h-5 w-5" /> },
  { id: 'paw', name: 'Pet Friendly', icon: <PawPrint className="h-5 w-5" /> },
  { id: 'baby', name: 'Baby Friendly', icon: <Baby className="h-5 w-5" /> },
  { id: 'no-smoking', name: 'No Smoking', icon: <Cigarette className="h-5 w-5" /> },
  { id: 'clock', name: '24/7 Service', icon: <Clock className="h-5 w-5" /> },
  { id: 'cash', name: 'Cash Payment', icon: <Banknote className="h-5 w-5" /> },
  { id: 'card', name: 'Card Payment', icon: <CreditCard className="h-5 w-5" /> },
  { id: 'laundry', name: 'Laundry', icon: <Shirt className="h-5 w-5" /> },
  { id: 'hot-water', name: 'Hot Water', icon: <Droplets className="h-5 w-5" /> },
  { id: 'balcony', name: 'Balcony', icon: <Sun className="h-5 w-5" /> },
  { id: 'night', name: 'Night Service', icon: <Moon className="h-5 w-5" /> },
  { id: 'star', name: 'Premium', icon: <Star className="h-5 w-5" /> },
  { id: 'sparkles', name: 'Special', icon: <Sparkles className="h-5 w-5" /> },
]

// Create icon mapping for rendering
const amenityIcons: Record<string, React.ReactNode> = {}
availableIcons.forEach(item => {
  amenityIcons[item.id] = item.icon
})

interface SettingsPageContentProps {
  slug: string
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'logo_url' | 'primary_color' | 'plan' | 'settings'>
  initialSettings: TenantSettings
}

export function SettingsPageContent({ slug, tenant, initialSettings }: SettingsPageContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('dashboard.settings')
  const tCommon = useTranslations('common')
  
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [deleteAmenityId, setDeleteAmenityId] = useState<string | null>(null)
  
  // Basic info - initialized from props (no loading state needed!)
  const [formData, setFormData] = useState({
    name: tenant.name,
    logo_url: tenant.logo_url || '',
    primary_color: tenant.primary_color || '#3B82F6',
  })
  
  // Settings (JSON) - initialized from props
  const [settings, setSettings] = useState<TenantSettings>(initialSettings)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('[Settings] handleSubmit called - tenant.id:', tenant.id)

    setIsSaving(true)
    setSuccess(false)

    try {
      // Prepare the settings object for saving - ensure all required fields exist
      const settingsToSave = {
        ...defaultTenantSettings,
        ...settings,
        hero: {
          ...defaultTenantSettings.hero,
          ...settings.hero,
        },
        amenities: settings.amenities || defaultTenantSettings.amenities,
        location: {
          ...defaultTenantSettings.location,
          ...settings.location,
        },
        contact: {
          ...defaultTenantSettings.contact,
          ...settings.contact,
        },
        stats: {
          ...defaultTenantSettings.stats,
          ...settings.stats,
        },
        social: {
          ...defaultTenantSettings.social,
          ...settings.social,
        },
        payment: {
          ...defaultTenantSettings.payment,
          ...settings.payment,
        },
        transport: {
          ...defaultTenantSettings.transport,
          ...settings.transport,
        },
      }

      console.log('[Settings] Saving settings via API...')

      // Use API route instead of direct Supabase to bypass RLS issues
      const response = await fetch('/api/host/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          name: formData.name,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
          settings: settingsToSave,
        }),
      })

      const result = await response.json()

      console.log('[Settings] API response:', response.status, result)

      if (!response.ok) {
        console.error('[Settings] Error saving settings:', result.error)
        alert(`Error saving settings: ${result.error}`)
      } else {
        console.log('[Settings] Settings saved successfully')
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        router.refresh()
      }
    } catch (err) {
      console.error('[Settings] Unexpected error saving settings:', err)
      alert(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      console.log('[Settings] handleSubmit finished')
      setIsSaving(false)
    }
  }

  const updateAmenity = (id: string, updates: Partial<TenantAmenity>) => {
    setSettings(prev => ({
      ...prev,
      amenities: prev.amenities.map(a => 
        a.id === id ? { ...a, ...updates } : a
      )
    }))
  }

  const addAmenity = () => {
    const newId = `custom_${Date.now()}`
    const newAmenity: TenantAmenity = {
      id: newId,
      name: 'New Amenity',
      icon: 'star',
      enabled: true
    }
    setSettings(prev => ({
      ...prev,
      amenities: [...prev.amenities, newAmenity]
    }))
  }

  const confirmDeleteAmenity = () => {
    if (deleteAmenityId) {
      setSettings(prev => ({
        ...prev,
        amenities: prev.amenities.filter(a => a.id !== deleteAmenityId)
      }))
      setDeleteAmenityId(null)
    }
  }

  const moveAmenity = (index: number, direction: 'up' | 'down') => {
    const newAmenities = [...settings.amenities]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newAmenities.length) return
    
    const temp = newAmenities[index]
    newAmenities[index] = newAmenities[newIndex]
    newAmenities[newIndex] = temp
    
    setSettings(prev => ({
      ...prev,
      amenities: newAmenities
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-gray-100 flex-wrap h-auto gap-1">
            <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
            <TabsTrigger value="landing">{t('tabs.landing')}</TabsTrigger>
            <TabsTrigger value="contact">{t('tabs.contact')}</TabsTrigger>
            <TabsTrigger value="social">{t('tabs.social')}</TabsTrigger>
            <TabsTrigger value="payment">{t('tabs.payment')}</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Property Information */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {t('propertyInfo')}
                </CardTitle>
                <CardDescription>
                  {t('propertyInfoDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('propertyName')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Homestay"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">{t('propertyUrl')}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">yoursite.com/</span>
                    <Input
                      id="slug"
                      value={slug}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('propertyUrlHint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Branding */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  {t('branding')}
                </CardTitle>
                <CardDescription>
                  {t('brandingDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logo_url">{t('logoUrl')}</Label>
                  <Input
                    id="logo_url"
                    type="text"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-gray-500">
                    {t('logoUrlHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary_color">{t('brandColor')}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="primary_color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="font-mono w-32"
                      maxLength={7}
                    />
                    <div 
                      className="h-10 px-4 rounded flex items-center text-white text-sm font-medium"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      Preview
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">{t('currency')}</Label>
                  <Select
                    value={settings.currency || 'USD'}
                    onValueChange={(value: CurrencyCode) => setSettings({ ...settings, currency: value })}
                  >
                    <SelectTrigger className="w-full md:w-64 bg-white">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CURRENCIES).map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium w-6">{currency.symbol}</span>
                            <span>{currency.name}</span>
                            <span className="text-gray-400">({currency.code})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {t('currencyHint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Plan Info */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('subscription')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">
                      {t('plan', { plan: tenant.plan || 'free' })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {tenant.plan === 'free' && t('planFree')}
                      {tenant.plan === 'pro' && t('planPro')}
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    {t('upgrade')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Landing Page Tab */}
          <TabsContent value="landing" className="space-y-6">
            {/* Hero Section */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {t('heroSection')}
                </CardTitle>
                <CardDescription>
                  {t('heroSectionDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tagline">{t('tagline')}</Label>
                  <Input
                    id="tagline"
                    value={settings.hero.tagline}
                    onChange={(e) => setSettings({
                      ...settings,
                      hero: { ...settings.hero, tagline: e.target.value }
                    })}
                    placeholder="Highly Rated Homestay"
                  />
                  <p className="text-xs text-gray-500">
                    {t('taglineHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('descriptionLabel')}</Label>
                  <Textarea
                    id="description"
                    value={settings.hero.description}
                    onChange={(e) => setSettings({
                      ...settings,
                      hero: { ...settings.hero, description: e.target.value }
                    })}
                    placeholder="Discover comfort and tranquility..."
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    {t('descriptionHint')}
                  </p>
                </div>

                {/* Hero Images */}
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <Label className="flex items-center gap-2">
                      <ImageLucide className="h-4 w-4" />
                      {t('heroImages')}
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('heroImagesHint')}
                    </p>
                  </div>

                  <HeroImageUpload
                    tenantId={tenant.id}
                    images={settings.hero.images || []}
                    onImagesChange={(newImages) => setSettings({
                      ...settings,
                      hero: { ...settings.hero, images: newImages }
                    })}
                    primaryColor={tenant.primary_color}
                  />
                  
                  {/* Reminder to save */}
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                    <Save className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      {t('saveReminder')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Section */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  {t('statisticsDisplay')}
                </CardTitle>
                <CardDescription>
                  {t('statisticsDisplayDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('showStatistics')}</Label>
                    <p className="text-xs text-gray-500">{t('showStatisticsHint')}</p>
                  </div>
                  <Switch
                    checked={settings.stats.show_stats}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      stats: { ...settings.stats, show_stats: checked }
                    })}
                  />
                </div>

                {settings.stats.show_stats && (
                  <p className="text-sm text-gray-500 pt-4 border-t">
                    {t('statsAutoCalculated')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Amenities */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  {t('whatWeOffer')}
                </CardTitle>
                <CardDescription>
                  {t('whatWeOfferDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Amenities List */}
                <div className="space-y-3">
                  {settings.amenities.map((amenity, index) => (
                    <div 
                      key={amenity.id}
                      className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                    >
                      {/* Drag Handle / Order Controls */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveAmenity(index, 'up')}
                          disabled={index === 0}
                          className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <GripVertical className="h-3 w-3 text-gray-400 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAmenity(index, 'down')}
                          disabled={index === settings.amenities.length - 1}
                          className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <GripVertical className="h-3 w-3 text-gray-400 -rotate-90" />
                        </button>
                      </div>

                      {/* Icon Preview */}
                      <div 
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ 
                          backgroundColor: amenity.enabled ? `${formData.primary_color}15` : '#f5f5f4',
                          color: amenity.enabled ? formData.primary_color : '#a8a29e'
                        }}
                      >
                        {amenityIcons[amenity.icon] || <Sparkles className="h-5 w-5" />}
                      </div>

                      {/* Icon Selector */}
                      <Select
                        value={amenity.icon}
                        onValueChange={(value) => updateAmenity(amenity.id, { icon: value })}
                      >
                        <SelectTrigger className="w-32 bg-white">
                          <SelectValue placeholder="Icon" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {availableIcons.map((iconOption) => (
                            <SelectItem key={iconOption.id} value={iconOption.id}>
                              <div className="flex items-center gap-2">
                                {iconOption.icon}
                                <span className="text-xs">{iconOption.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Name Input */}
                      <Input
                        value={amenity.name}
                        onChange={(e) => updateAmenity(amenity.id, { name: e.target.value })}
                        className="flex-1 bg-white"
                        placeholder="Amenity name"
                      />

                      {/* Enable/Disable Toggle */}
                      <Switch
                        checked={amenity.enabled}
                        onCheckedChange={(checked) => updateAmenity(amenity.id, { enabled: checked })}
                      />

                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteAmenityId(amenity.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Add Amenity Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAmenity}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t('addNewAmenity')}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  {t('amenityTip')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-6">
            {/* Location Card */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t('location')}
                </CardTitle>
                <CardDescription>
                  {t('locationDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Searchable Location Selector */}
                <LocationSelector
                  location={{
                    province: settings.location?.province || '',
                    province_en: settings.location?.province_en || '',
                    district: settings.location?.district || '',
                    district_en: settings.location?.district_en || '',
                    sub_district: settings.location?.sub_district || '',
                    sub_district_en: settings.location?.sub_district_en || '',
                    postal_code: settings.location?.postal_code || '',
                  }}
                  onChange={(newLocation) => setSettings({
                    ...settings,
                    location: {
                      ...defaultTenantSettings.location,
                      ...newLocation,
                    }
                  })}
                  translations={{
                    province: t('province'),
                    district: t('district'),
                    subDistrict: t('subDistrict'),
                    selectProvince: t('selectProvince'),
                    selectDistrict: t('selectDistrict'),
                    selectSubDistrict: t('selectSubDistrict'),
                    selectProvinceFirst: t('selectProvinceFirst'),
                    selectDistrictFirst: t('selectDistrictFirst'),
                    searchPlaceholder: t('searchLocation'),
                    noResults: t('noLocationResults'),
                    fullAddress: t('fullAddress'),
                  }}
                />

                {/* Postal Code (auto-filled but editable) */}
                <div className="space-y-2">
                  <Label>{t('postalCode')}</Label>
                  <Input
                    value={settings.location?.postal_code || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      location: {
                        ...defaultTenantSettings.location,
                        ...settings.location,
                        postal_code: e.target.value,
                      }
                    })}
                    placeholder="10110"
                    className="w-32"
                    maxLength={5}
                  />
                </div>

                {/* Location Preview */}
                {settings.location?.province && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{t('fullAddress')}:</span>{' '}
                      {[
                        settings.location.sub_district,
                        settings.location.district,
                        settings.location.province,
                        settings.location.postal_code,
                      ].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {[
                        settings.location.sub_district_en,
                        settings.location.district_en,
                        settings.location.province_en,
                        settings.location.postal_code,
                      ].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Details Card */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  {t('locationContact')}
                </CardTitle>
                <CardDescription>
                  {t('locationContactDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">{t('streetAddress')}</Label>
                    <Input
                      id="address"
                      value={settings.contact.address}
                      onChange={(e) => setSettings({
                        ...settings,
                        contact: { ...settings.contact, address: e.target.value }
                      })}
                      placeholder="123 Homestay Lane"
                    />
                    <p className="text-xs text-gray-500">{t('streetAddressHint')}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="directions">{t('directions')}</Label>
                    <Textarea
                      id="directions"
                      value={settings.contact.directions}
                      onChange={(e) => setSettings({
                        ...settings,
                        contact: { ...settings.contact, directions: e.target.value }
                      })}
                      placeholder="10 min from airport, free parking available..."
                      rows={2}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> {t('phone')}
                    </Label>
                    <Input
                      id="phone"
                      value={settings.contact.phone}
                      onChange={(e) => setSettings({
                        ...settings,
                        contact: { ...settings.contact, phone: e.target.value }
                      })}
                      placeholder="+66 123 456 789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> {t('email')}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.contact.email}
                      onChange={(e) => setSettings({
                        ...settings,
                        contact: { ...settings.contact, email: e.target.value }
                      })}
                      placeholder="contact@myhomestay.com"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="map_embed" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> {t('mapEmbed')}
                    </Label>
                    <Input
                      id="map_embed"
                      type="text"
                      value={settings.contact.map_embed}
                      onChange={(e) => setSettings({
                        ...settings,
                        contact: { ...settings.contact, map_embed: e.target.value }
                      })}
                      placeholder="https://www.google.com/maps/embed?pb=..."
                    />
                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="font-medium">{t('mapEmbedInstructions')}</p>
                      <ol className="list-decimal list-inside space-y-0.5 ml-2">
                        <li>{t('mapEmbedStep1')}</li>
                        <li>{t('mapEmbedStep2')}</li>
                        <li>{t('mapEmbedStep3')}</li>
                        <li>{t('mapEmbedStep4')}</li>
                      </ol>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="map_url">{t('mapLink')}</Label>
                    <Input
                      id="map_url"
                      type="text"
                      value={settings.contact.map_url}
                      onChange={(e) => setSettings({
                        ...settings,
                        contact: { ...settings.contact, map_url: e.target.value }
                      })}
                      placeholder="https://maps.google.com/..."
                    />
                    <p className="text-xs text-gray-500">
                      {t('mapLinkHint')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Tab */}
          <TabsContent value="social" className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  {t('socialMedia')}
                </CardTitle>
                <CardDescription>
                  {t('socialMediaDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="facebook">{t('facebook')}</Label>
                  <Input
                    id="facebook"
                    value={settings.social?.facebook ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setSettings(prev => ({
                        ...prev,
                        social: {
                          facebook: val,
                          instagram: prev.social?.instagram ?? '',
                          twitter: prev.social?.twitter ?? '',
                          line: prev.social?.line ?? '',
                          whatsapp: prev.social?.whatsapp ?? '',
                        }
                      }))
                    }}
                    placeholder="https://facebook.com/yourhomestay"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social_line">{t('line')}</Label>
                  <Input
                    id="social_line"
                    value={settings.social?.line ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setSettings(prev => ({
                        ...prev,
                        social: {
                          facebook: prev.social?.facebook ?? '',
                          instagram: prev.social?.instagram ?? '',
                          twitter: prev.social?.twitter ?? '',
                          line: val,
                          whatsapp: prev.social?.whatsapp ?? '',
                        }
                      }))
                    }}
                    placeholder="@yourhomestay or LINE ID"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="space-y-6">
            {/* PromptPay QR Code Upload */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  {t('promptPayQR')}
                </CardTitle>
                <CardDescription>
                  {t('promptPayQRDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* QR Code Upload */}
                <div className="space-y-4">
                  <Label>{t('qrCodeImage')}</Label>
                  
                  {settings.payment?.promptpay_qr_url ? (
                    <div className="space-y-4">
                      {/* Preview */}
                      <div className="flex justify-center">
                        <div className="relative p-4 bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                          <Image
                            src={settings.payment.promptpay_qr_url}
                            alt="PromptPay QR Code"
                            width={200}
                            height={200}
                            className="object-contain"
                          />
                        </div>
                      </div>
                      
                      {/* Replace button */}
                      <div className="flex justify-center">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              
                              const fileName = `promptpay-qr/${tenant.id}-${Date.now()}.${file.name.split('.').pop()}`
                              const { data, error } = await supabase.storage
                                .from('tenants')
                                .upload(fileName, file, { upsert: true })
                              
                              if (!error && data) {
                                const { data: { publicUrl } } = supabase.storage
                                  .from('tenants')
                                  .getPublicUrl(data.path)
                                
                                setSettings({
                                  ...settings,
                                  payment: {
                                    ...settings.payment,
                                    promptpay_qr_url: publicUrl,
                                    promptpay_id: settings.payment?.promptpay_id || '',
                                    promptpay_name: settings.payment?.promptpay_name || '',
                                    bank_name: settings.payment?.bank_name || '',
                                    bank_account_number: settings.payment?.bank_account_number || '',
                                    payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                                    easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                                    line_channel_access_token: settings.payment?.line_channel_access_token || '',
                                    line_user_id: settings.payment?.line_user_id || ''
                                  }
                                })
                              }
                            }}
                          />
                          <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                            <ImageIcon className="h-4 w-4" />
                            {t('replaceQRCode')}
                          </span>
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-2 justify-center text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">{t('qrCodeUploaded')}</span>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('qr-upload')?.click()}
                    >
                      <input
                        id="qr-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          
                          const fileName = `promptpay-qr/${tenant.id}-${Date.now()}.${file.name.split('.').pop()}`
                          const { data, error } = await supabase.storage
                            .from('tenants')
                            .upload(fileName, file, { upsert: true })
                          
                          if (!error && data) {
                            const { data: { publicUrl } } = supabase.storage
                              .from('tenants')
                              .getPublicUrl(data.path)
                            
                            setSettings({
                              ...settings,
                              payment: {
                                ...settings.payment,
                                promptpay_qr_url: publicUrl,
                                promptpay_id: settings.payment?.promptpay_id || '',
                                promptpay_name: settings.payment?.promptpay_name || '',
                                bank_name: settings.payment?.bank_name || '',
                                bank_account_number: settings.payment?.bank_account_number || '',
                                payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                                easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                                line_channel_access_token: settings.payment?.line_channel_access_token || '',
                                line_user_id: settings.payment?.line_user_id || ''
                              }
                            })
                          }
                        }}
                      />
                      <div className="h-16 w-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <QrCode className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-base font-medium text-gray-700 mb-1">
                        {t('uploadQRCode')}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        {t('uploadQRCodeHint')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t('qrSupportedFormats')}
                      </p>
                    </div>
                  )}
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">{t('howToGetQR')}</p>
                        <ol className="mt-1 list-decimal list-inside text-xs space-y-1">
                          <li>{t('qrStep1')}</li>
                          <li>{t('qrStep2')}</li>
                          <li>{t('qrStep3')}</li>
                          <li>{t('qrStep4')}</li>
                          <li>{t('qrStep5')}</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Name */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="promptpay_name">{t('accountName')}</Label>
                  <Input
                    id="promptpay_name"
                    value={settings.payment?.promptpay_name || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      payment: { 
                        ...settings.payment,
                        promptpay_id: settings.payment?.promptpay_id || '',
                        promptpay_name: e.target.value,
                        promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                        bank_name: settings.payment?.bank_name || '',
                        bank_account_number: settings.payment?.bank_account_number || '',
                        payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                        easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                        line_channel_access_token: settings.payment?.line_channel_access_token || '',
                        line_user_id: settings.payment?.line_user_id || ''
                      }
                    })}
                    placeholder="John Doe / บริษัท โฮมสเตย์ จำกัด"
                  />
                  <p className="text-xs text-gray-500">
                    {t('accountNameHint')}
                  </p>
                </div>

                {/* Bank Details Section */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-gray-500" />
                    <Label className="text-sm font-medium">{t('bankDetails')}</Label>
                  </div>
                  <p className="text-xs text-gray-500 -mt-2">
                    {t('bankDetailsHint')}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bank Name */}
                    <div className="space-y-2">
                      <Label htmlFor="bank_name">{t('bankName')}</Label>
                      <Input
                        id="bank_name"
                        value={settings.payment?.bank_name || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          payment: { 
                            ...settings.payment,
                            promptpay_id: settings.payment?.promptpay_id || '',
                            promptpay_name: settings.payment?.promptpay_name || '',
                            promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                            bank_name: e.target.value,
                            bank_account_number: settings.payment?.bank_account_number || '',
                            payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                            easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                            line_channel_access_token: settings.payment?.line_channel_access_token || '',
                            line_user_id: settings.payment?.line_user_id || ''
                          }
                        })}
                        placeholder={t('bankNamePlaceholder')}
                      />
                    </div>

                    {/* Bank Account Number */}
                    <div className="space-y-2">
                      <Label htmlFor="bank_account_number">{t('bankAccountNumber')}</Label>
                      <Input
                        id="bank_account_number"
                        value={settings.payment?.bank_account_number || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          payment: { 
                            ...settings.payment,
                            promptpay_id: settings.payment?.promptpay_id || '',
                            promptpay_name: settings.payment?.promptpay_name || '',
                            promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                            bank_name: settings.payment?.bank_name || '',
                            bank_account_number: e.target.value,
                            payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                            easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                            line_channel_access_token: settings.payment?.line_channel_access_token || '',
                            line_user_id: settings.payment?.line_user_id || ''
                          }
                        })}
                        placeholder={t('bankAccountNumberPlaceholder')}
                      />
                    </div>
                  </div>
                </div>

                {/* PromptPay Number */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="promptpay_id">{t('promptPayNumber')}</Label>
                  <Input
                    id="promptpay_id"
                    value={settings.payment?.promptpay_id || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      payment: { 
                        ...settings.payment,
                        promptpay_id: e.target.value,
                        promptpay_name: settings.payment?.promptpay_name || '',
                        promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                        bank_name: settings.payment?.bank_name || '',
                        bank_account_number: settings.payment?.bank_account_number || '',
                        payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                        easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                        line_channel_access_token: settings.payment?.line_channel_access_token || '',
                        line_user_id: settings.payment?.line_user_id || ''
                      }
                    })}
                    placeholder={t('promptPayNumberPlaceholder')}
                  />
                  <p className="text-xs text-gray-500">
                    {t('promptPayNumberHint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payment Timeout */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  {t('paymentTimeout')}
                </CardTitle>
                <CardDescription>
                  {t('paymentTimeoutDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_timeout">{t('timeoutDuration')}</Label>
                  <Select
                    value={(settings.payment?.payment_timeout_minutes || 15).toString()}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      payment: { 
                        ...settings.payment,
                        promptpay_id: settings.payment?.promptpay_id || '',
                        promptpay_name: settings.payment?.promptpay_name || '',
                        promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                        bank_name: settings.payment?.bank_name || '',
                        bank_account_number: settings.payment?.bank_account_number || '',
                        payment_timeout_minutes: parseInt(value),
                        easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                        line_channel_access_token: settings.payment?.line_channel_access_token || '',
                        line_user_id: settings.payment?.line_user_id || ''
                      }
                    })}
                  >
                    <SelectTrigger className="w-full md:w-64 bg-white">
                      <SelectValue placeholder={t('selectTimeout')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">{t('timeout3min')}</SelectItem>
                      <SelectItem value="5">{t('timeout5min')}</SelectItem>
                      <SelectItem value="10">{t('timeout10min')}</SelectItem>
                      <SelectItem value="15">{t('timeout15min')}</SelectItem>
                      <SelectItem value="20">{t('timeout20min')}</SelectItem>
                      <SelectItem value="30">{t('timeout30min')}</SelectItem>
                      <SelectItem value="45">{t('timeout45min')}</SelectItem>
                      <SelectItem value="60">{t('timeout60min')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {t('timeoutExplanation')}
                  </p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">{t('howTimeoutWorks')}</p>
                      <ul className="mt-1 list-disc list-inside text-xs space-y-1">
                        <li>{t('timeoutStep1')}</li>
                        <li>{t('timeoutStep2')}</li>
                        <li>{t('timeoutStep3')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* EasySlip Verification */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  {t('paymentVerification')}
                </CardTitle>
                <CardDescription>
                  {t('paymentVerificationDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('enableEasySlip')}</Label>
                    <p className="text-xs text-gray-500">{t('enableEasySlipHint')}</p>
                  </div>
                  <Switch
                    checked={settings.payment?.easyslip_enabled ?? true}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      payment: { 
                        ...settings.payment,
                        promptpay_id: settings.payment?.promptpay_id || '',
                        promptpay_name: settings.payment?.promptpay_name || '',
                        promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                        bank_name: settings.payment?.bank_name || '',
                        bank_account_number: settings.payment?.bank_account_number || '',
                        payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                        easyslip_enabled: checked,
                        line_channel_access_token: settings.payment?.line_channel_access_token || '',
                        line_user_id: settings.payment?.line_user_id || ''
                      }
                    })}
                  />
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">{t('easySlipRequired')}</p>
                      <p className="text-xs mt-1">
                        {t('easySlipRequiredHint')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LINE Messaging */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t('lineNotifications')}
                </CardTitle>
                <CardDescription>
                  {t('lineNotificationsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="line_channel_access_token">{t('channelAccessToken')}</Label>
                  <Input
                    id="line_channel_access_token"
                    type="password"
                    value={settings.payment?.line_channel_access_token || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      payment: { 
                        ...settings.payment,
                        promptpay_id: settings.payment?.promptpay_id || '',
                        promptpay_name: settings.payment?.promptpay_name || '',
                        promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                        bank_name: settings.payment?.bank_name || '',
                        bank_account_number: settings.payment?.bank_account_number || '',
                        payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                        easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                        line_channel_access_token: e.target.value,
                        line_user_id: settings.payment?.line_user_id || ''
                      }
                    })}
                    placeholder={t('channelAccessTokenPlaceholder')}
                  />
                  <p className="text-xs text-gray-500">
                    {t('channelAccessTokenHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="line_user_id">{t('lineUserId')}</Label>
                  <Input
                    id="line_user_id"
                    value={settings.payment?.line_user_id || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      payment: { 
                        ...settings.payment,
                        promptpay_id: settings.payment?.promptpay_id || '',
                        promptpay_name: settings.payment?.promptpay_name || '',
                        promptpay_qr_url: settings.payment?.promptpay_qr_url || '',
                        bank_name: settings.payment?.bank_name || '',
                        bank_account_number: settings.payment?.bank_account_number || '',
                        payment_timeout_minutes: settings.payment?.payment_timeout_minutes || 15,
                        easyslip_enabled: settings.payment?.easyslip_enabled ?? true,
                        line_channel_access_token: settings.payment?.line_channel_access_token || '',
                        line_user_id: e.target.value
                      }
                    })}
                    placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-gray-500">
                    {t('lineUserIdHint')}
                  </p>
                </div>

                {settings.payment?.line_channel_access_token && settings.payment?.line_user_id && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">{t('lineConfigured')}</span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      {t('lineConfiguredHint')}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">{t('howToSetupLine')}</p>
                      <ol className="mt-1 text-xs space-y-1 list-decimal list-inside">
                        <li>{t('lineStep1')}</li>
                        <li>{t('lineStep2')}</li>
                        <li>{t('lineStep3')}</li>
                        <li>{t('lineStep4')}</li>
                        <li>{t('lineStep5')}</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-2">{t('notificationsFor')}</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {t('notif1')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {t('notif2')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {t('notif3')}
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Save Button - Always visible */}
        <div className="flex items-center gap-4 pt-6 border-t border-gray-200 mt-6">
          <Button type="submit" disabled={isSaving} className="gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-sm">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t('saveAllChanges')}
              </>
            )}
          </Button>
          {success && (
            <span className="text-sm text-emerald-600">{t('saved')}</span>
          )}
        </div>
      </form>

      {/* Delete Amenity Confirmation Dialog */}
      <AlertDialog open={!!deleteAmenityId} onOpenChange={(open) => !open && setDeleteAmenityId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAmenity')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteAmenityConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAmenity}
              className="bg-red-600 hover:bg-red-700"
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

