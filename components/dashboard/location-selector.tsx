'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'

interface Province {
  name_th: string
  name_en: string
}

interface District {
  name_th: string
  name_en: string
}

interface SubDistrict {
  name_th: string
  name_en: string
  zip_code?: number
}

interface LocationData {
  province: string
  province_en: string
  district: string
  district_en: string
  sub_district: string
  sub_district_en: string
  postal_code: string
}

interface LocationSelectorTranslations {
  province: string
  district: string
  subDistrict: string
  selectProvince: string
  selectDistrict: string
  selectSubDistrict: string
  selectProvinceFirst: string
  selectDistrictFirst: string
  searchPlaceholder: string
  noResults: string
  fullAddress?: string
}

const defaultTranslations: LocationSelectorTranslations = {
  province: 'Province',
  district: 'District',
  subDistrict: 'Sub-District',
  selectProvince: 'Select province',
  selectDistrict: 'Select district',
  selectSubDistrict: 'Select sub-district',
  selectProvinceFirst: 'Select province first',
  selectDistrictFirst: 'Select district first',
  searchPlaceholder: 'Search...',
  noResults: 'No location found',
  fullAddress: 'Full Address',
}

interface LocationSelectorProps {
  location: LocationData
  onChange: (location: LocationData) => void
  translations?: Partial<LocationSelectorTranslations>
}

export function LocationSelector({ location, onChange, translations }: LocationSelectorProps) {
  const t = { ...defaultTranslations, ...translations }
  
  const [provinceOpen, setProvinceOpen] = React.useState(false)
  const [districtOpen, setDistrictOpen] = React.useState(false)
  const [subDistrictOpen, setSubDistrictOpen] = React.useState(false)
  
  // Data states - loaded from API
  const [provinces, setProvinces] = React.useState<Province[]>([])
  const [districts, setDistricts] = React.useState<District[]>([])
  const [subDistricts, setSubDistricts] = React.useState<SubDistrict[]>([])
  
  // Loading states
  const [loadingProvinces, setLoadingProvinces] = React.useState(true)
  const [loadingDistricts, setLoadingDistricts] = React.useState(false)
  const [loadingSubDistricts, setLoadingSubDistricts] = React.useState(false)

  // Load provinces on mount
  React.useEffect(() => {
    async function loadProvinces() {
      try {
        const res = await fetch('/api/locations/provinces')
        if (res.ok) {
          const data = await res.json()
          setProvinces(data)
        }
      } catch (error) {
        console.error('Failed to load provinces:', error)
      } finally {
        setLoadingProvinces(false)
      }
    }
    loadProvinces()
  }, [])

  // Load districts when province changes
  React.useEffect(() => {
    if (!location.province) {
      setDistricts([])
      return
    }
    
    async function loadDistricts() {
      setLoadingDistricts(true)
      try {
        const res = await fetch(`/api/locations/districts?province=${encodeURIComponent(location.province)}`)
        if (res.ok) {
          const data = await res.json()
          setDistricts(data)
        }
      } catch (error) {
        console.error('Failed to load districts:', error)
      } finally {
        setLoadingDistricts(false)
      }
    }
    loadDistricts()
  }, [location.province])

  // Load sub-districts when district changes
  React.useEffect(() => {
    if (!location.province || !location.district) {
      setSubDistricts([])
      return
    }
    
    async function loadSubDistricts() {
      setLoadingSubDistricts(true)
      try {
        const res = await fetch(
          `/api/locations/sub-districts?province=${encodeURIComponent(location.province)}&district=${encodeURIComponent(location.district)}`
        )
        if (res.ok) {
          const data = await res.json()
          setSubDistricts(data)
        }
      } catch (error) {
        console.error('Failed to load sub-districts:', error)
      } finally {
        setLoadingSubDistricts(false)
      }
    }
    loadSubDistricts()
  }, [location.province, location.district])

  const selectedProvince = provinces.find(p => p.name_th === location.province)
  const selectedDistrict = districts.find(d => d.name_th === location.district)
  const selectedSubDistrict = subDistricts.find(s => s.name_th === location.sub_district)

  const handleProvinceChange = (province: Province) => {
    onChange({
      province: province.name_th,
      province_en: province.name_en,
      district: '',
      district_en: '',
      sub_district: '',
      sub_district_en: '',
      postal_code: '',
    })
    setProvinceOpen(false)
  }

  const handleDistrictChange = (district: District) => {
    onChange({
      ...location,
      district: district.name_th,
      district_en: district.name_en,
      sub_district: '',
      sub_district_en: '',
      postal_code: '',
    })
    setDistrictOpen(false)
  }

  const handleSubDistrictChange = (subDistrict: SubDistrict) => {
    onChange({
      ...location,
      sub_district: subDistrict.name_th,
      sub_district_en: subDistrict.name_en,
      postal_code: subDistrict.zip_code?.toString() || '',
    })
    setSubDistrictOpen(false)
  }

  return (
    <div className="space-y-4">
      {/* Province */}
      <div className="space-y-2">
        <Label>{t.province}</Label>
        <Popover open={provinceOpen} onOpenChange={setProvinceOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={provinceOpen}
              className="w-full justify-between bg-white font-normal h-10 cursor-pointer"
              disabled={loadingProvinces}
              onClick={() => setProvinceOpen(!provinceOpen)}
            >
              {loadingProvinces ? (
                <span className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : selectedProvince ? (
                <span className="truncate">
                  {selectedProvince.name_th} ({selectedProvince.name_en})
                </span>
              ) : (
                <span className="text-gray-500">{t.selectProvince}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
            <Command>
              <CommandInput placeholder={t.searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{t.noResults}</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {provinces.map((p) => (
                    <CommandItem
                      key={p.name_th}
                      value={`${p.name_th} ${p.name_en}`}
                      onSelect={() => handleProvinceChange(p)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          location.province === p.name_th ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{p.name_th}</span>
                      <span className="ml-2 text-gray-500 text-sm">({p.name_en})</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* District */}
      <div className="space-y-2">
        <Label>{t.district}</Label>
        <Popover open={districtOpen} onOpenChange={setDistrictOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={districtOpen}
              className="w-full justify-between bg-white font-normal h-10 cursor-pointer"
              disabled={!location.province || loadingDistricts}
              onClick={() => location.province && setDistrictOpen(!districtOpen)}
            >
              {loadingDistricts ? (
                <span className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : selectedDistrict ? (
                <span className="truncate">
                  {selectedDistrict.name_th} ({selectedDistrict.name_en})
                </span>
              ) : (
                <span className="text-gray-500">
                  {location.province ? t.selectDistrict : t.selectProvinceFirst}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
            <Command>
              <CommandInput placeholder={t.searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{t.noResults}</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {districts.map((d) => (
                    <CommandItem
                      key={d.name_th}
                      value={`${d.name_th} ${d.name_en}`}
                      onSelect={() => handleDistrictChange(d)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          location.district === d.name_th ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{d.name_th}</span>
                      <span className="ml-2 text-gray-500 text-sm">({d.name_en})</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Sub-District */}
      <div className="space-y-2">
        <Label>{t.subDistrict}</Label>
        <Popover open={subDistrictOpen} onOpenChange={setSubDistrictOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={subDistrictOpen}
              className="w-full justify-between bg-white font-normal h-10 cursor-pointer"
              disabled={!location.district || loadingSubDistricts}
              onClick={() => location.district && setSubDistrictOpen(!subDistrictOpen)}
            >
              {loadingSubDistricts ? (
                <span className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : selectedSubDistrict ? (
                <span className="truncate">
                  {selectedSubDistrict.name_th} ({selectedSubDistrict.name_en})
                </span>
              ) : (
                <span className="text-gray-500">
                  {location.district ? t.selectSubDistrict : t.selectDistrictFirst}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
            <Command>
              <CommandInput placeholder={t.searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{t.noResults}</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {subDistricts.map((s) => (
                    <CommandItem
                      key={s.name_th}
                      value={`${s.name_th} ${s.name_en} ${s.zip_code}`}
                      onSelect={() => handleSubDistrictChange(s)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          location.sub_district === s.name_th ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{s.name_th}</span>
                      <span className="ml-2 text-gray-500 text-sm">({s.name_en})</span>
                      <span className="ml-auto text-gray-400 text-xs">{s.zip_code}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
