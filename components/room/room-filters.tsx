'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslations } from 'next-intl'

interface RoomFiltersProps {
  initialGuests?: string
  initialMinPrice?: string
  initialMaxPrice?: string
  primaryColor: string
  tenantSlug: string
}

export function RoomFilters({
  initialGuests,
  initialMinPrice,
  initialMaxPrice,
  primaryColor,
  tenantSlug,
}: RoomFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const t = useTranslations('room')
  
  // Use 'any' as default to avoid hydration issues with empty string
  const [guests, setGuests] = useState(initialGuests || 'any')
  const [minPrice, setMinPrice] = useState(initialMinPrice || '')
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice || '')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    const params = new URLSearchParams()
    if (guests && guests !== 'any') params.set('guests', guests)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    
    const queryString = params.toString()
    router.push(`/${tenantSlug}/rooms${queryString ? `?${queryString}` : ''}`)
  }

  const handleClear = () => {
    setGuests('any')
    setMinPrice('')
    setMaxPrice('')
    router.push(`/${tenantSlug}/rooms`)
  }

  const hasFilters = (guests && guests !== 'any') || minPrice || maxPrice

  // Prevent hydration mismatch by not rendering Select until mounted
  if (!isMounted) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 sticky top-24">
        <div className="flex items-center gap-2 mb-6">
          <SlidersHorizontal className="h-5 w-5 text-stone-600" />
          <h2 className="font-semibold text-stone-900">{t('filters')}</h2>
        </div>
        <div className="space-y-6 animate-pulse">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-stone-200 rounded" />
            <div className="h-9 w-full bg-stone-200 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-stone-200 rounded" />
            <div className="flex gap-3">
              <div className="h-9 flex-1 bg-stone-200 rounded" />
              <div className="h-9 flex-1 bg-stone-200 rounded" />
            </div>
          </div>
          <div className="h-9 w-full bg-stone-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 sticky top-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-stone-600" />
          <h2 className="font-semibold text-stone-900">{t('filters')}</h2>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-stone-500 hover:text-stone-700 underline"
          >
            {t('clearFilters')}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Guests */}
        <div className="space-y-2">
          <Label htmlFor="guests" className="text-sm font-medium text-stone-700">
            {t('guestsFilter')}
          </Label>
          <Select value={guests} onValueChange={setGuests}>
            <SelectTrigger id="guests" className="w-full">
              <SelectValue placeholder={t('anyGuests')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('anyGuests')}</SelectItem>
              <SelectItem value="1">{t('oneGuest')}</SelectItem>
              <SelectItem value="2">{t('twoGuests')}</SelectItem>
              <SelectItem value="3">{t('threeGuests')}</SelectItem>
              <SelectItem value="4">{t('fourPlusGuests')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price Range */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-stone-700">
            {t('priceRange')}
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              name="minPrice"
              placeholder={t('min')}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="flex-1"
            />
            <span className="text-stone-400">–</span>
            <Input
              type="number"
              name="maxPrice"
              placeholder={t('max')}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <Button 
          type="submit"
          className="w-full text-white"
          style={{ backgroundColor: primaryColor }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('applying')}
            </>
          ) : (
            t('applyFilters')
          )}
        </Button>
      </form>
    </div>
  )
}
