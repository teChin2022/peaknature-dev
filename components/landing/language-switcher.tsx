'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe } from 'lucide-react'
import { Locale, localeNames, localeFlags } from '@/lib/i18n'

interface LanguageSwitcherProps {
  currentLocale: Locale
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter()

  const handleLanguageChange = (locale: Locale) => {
    // Set cookie for language preference with proper attributes for production
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
    const secureFlag = isSecure ? ';Secure' : ''
    document.cookie = `locale=${locale};path=/;max-age=31536000;SameSite=Lax${secureFlag}`
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-600 hover:text-slate-900 gap-2"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{localeFlags[currentLocale]} {localeNames[currentLocale]}</span>
          <span className="sm:hidden">{localeFlags[currentLocale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem 
          onClick={() => handleLanguageChange('th')}
          className={currentLocale === 'th' ? 'bg-blue-50 text-blue-600' : ''}
        >
          {localeFlags.th} {localeNames.th}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleLanguageChange('en')}
          className={currentLocale === 'en' ? 'bg-blue-50 text-blue-600' : ''}
        >
          {localeFlags.en} {localeNames.en}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

