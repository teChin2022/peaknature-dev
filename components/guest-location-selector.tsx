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

interface GuestLocationSelectorProps {
  province: string
  district: string
  subDistrict: string
  onProvinceChange: (value: string) => void
  onDistrictChange: (value: string) => void
  onSubDistrictChange: (value: string) => void
  primaryColor?: string
  labels?: {
    province?: string
    district?: string
    subDistrict?: string
    selectProvince?: string
    selectDistrict?: string
    selectSubDistrict?: string
    selectProvinceFirst?: string
    selectDistrictFirst?: string
    search?: string
    noResults?: string
    optional?: string
  }
}

const defaultLabels = {
  province: 'Province / จังหวัด',
  district: 'District / อำเภอ',
  subDistrict: 'Sub-district / ตำบล',
  selectProvince: 'Select province',
  selectDistrict: 'Select district',
  selectSubDistrict: 'Select sub-district',
  selectProvinceFirst: 'Select province first',
  selectDistrictFirst: 'Select district first',
  search: 'Search...',
  noResults: 'No location found',
  optional: '(optional)',
}

export function GuestLocationSelector({
  province,
  district,
  subDistrict,
  onProvinceChange,
  onDistrictChange,
  onSubDistrictChange,
  primaryColor = '#3B82F6',
  labels: customLabels,
}: GuestLocationSelectorProps) {
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

  const labels = { ...defaultLabels, ...customLabels }

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
    if (!province) {
      setDistricts([])
      return
    }
    
    async function loadDistricts() {
      setLoadingDistricts(true)
      try {
        const res = await fetch(`/api/locations/districts?province=${encodeURIComponent(province)}`)
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
  }, [province])

  // Load sub-districts when district changes
  React.useEffect(() => {
    if (!province || !district) {
      setSubDistricts([])
      return
    }
    
    async function loadSubDistricts() {
      setLoadingSubDistricts(true)
      try {
        const res = await fetch(
          `/api/locations/sub-districts?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`
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
  }, [province, district])

  const selectedProvince = provinces.find(p => p.name_th === province)
  const selectedDistrict = districts.find(d => d.name_th === district)
  const selectedSubDistrict = subDistricts.find(s => s.name_th === subDistrict)

  return (
    <div className="space-y-4">
      {/* Province */}
      <div className="space-y-2">
        <Label>
          {labels.province} <span className="text-red-500">*</span>
        </Label>
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
                <span className="text-gray-500">{labels.selectProvince}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
            <Command>
              <CommandInput placeholder={labels.search} />
              <CommandList>
                <CommandEmpty>{labels.noResults}</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {provinces.map((p) => (
                    <CommandItem
                      key={p.name_th}
                      value={`${p.name_th} ${p.name_en}`}
                      onSelect={() => {
                        onProvinceChange(p.name_th)
                        setProvinceOpen(false)
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          province === p.name_th ? "opacity-100" : "opacity-0"
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
        <Label>
          {labels.district} <span className="text-stone-400 text-xs font-normal">{labels.optional}</span>
        </Label>
        <Popover open={districtOpen} onOpenChange={setDistrictOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={districtOpen}
              className="w-full justify-between bg-white font-normal h-10 cursor-pointer"
              disabled={!province || loadingDistricts}
              onClick={() => province && setDistrictOpen(!districtOpen)}
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
                  {province ? labels.selectDistrict : labels.selectProvinceFirst}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
            <Command>
              <CommandInput placeholder={labels.search} />
              <CommandList>
                <CommandEmpty>{labels.noResults}</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {districts.map((d) => (
                    <CommandItem
                      key={d.name_th}
                      value={`${d.name_th} ${d.name_en}`}
                      onSelect={() => {
                        onDistrictChange(d.name_th)
                        setDistrictOpen(false)
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          district === d.name_th ? "opacity-100" : "opacity-0"
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
        <Label>
          {labels.subDistrict} <span className="text-stone-400 text-xs font-normal">{labels.optional}</span>
        </Label>
        <Popover open={subDistrictOpen} onOpenChange={setSubDistrictOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={subDistrictOpen}
              className="w-full justify-between bg-white font-normal h-10 cursor-pointer"
              disabled={!district || loadingSubDistricts}
              onClick={() => district && setSubDistrictOpen(!subDistrictOpen)}
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
                  {district ? labels.selectSubDistrict : labels.selectDistrictFirst}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
            <Command>
              <CommandInput placeholder={labels.search} />
              <CommandList>
                <CommandEmpty>{labels.noResults}</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {subDistricts.map((s) => (
                    <CommandItem
                      key={s.name_th}
                      value={`${s.name_th} ${s.name_en} ${s.zip_code}`}
                      onSelect={() => {
                        onSubDistrictChange(s.name_th)
                        setSubDistrictOpen(false)
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          subDistrict === s.name_th ? "opacity-100" : "opacity-0"
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
