'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X, User, Calendar, LogOut, Settings, Globe } from 'lucide-react'
import { Tenant } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLanguage } from '@/components/providers/language-provider'
import { locales, localeNames, localeFlags, Locale } from '@/lib/i18n'
import { useTranslations } from 'next-intl'

interface TenantHeaderProps {
  tenant: Tenant
  user?: { email: string; full_name?: string } | null
}

export function TenantHeader({ tenant, user }: TenantHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { locale, setLocale } = useLanguage()
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const tSettings = useTranslations('settings')

  // Toggle between languages
  const toggleLanguage = () => {
    const nextLocale = locale === 'th' ? 'en' : 'th'
    setLocale(nextLocale)
  }

  // Prevent hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = () => {
    // Use server-side signout route for proper cookie cleanup
    window.location.href = `/${tenant.slug}/signout`
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/80 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        {/* Logo */}
        <Link href={`/${tenant.slug}`} className="flex items-center gap-2 sm:gap-3">
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={40}
              height={40}
              className="rounded-lg h-8 w-8 sm:h-10 sm:w-10"
            />
          ) : (
            <div 
              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-white font-bold text-base sm:text-lg"
              style={{ backgroundColor: tenant.primary_color }}
            >
              {tenant.name.charAt(0)}
            </div>
          )}
          <span className="text-lg sm:text-xl font-semibold tracking-tight text-stone-900 truncate max-w-[120px] sm:max-w-none">
            {tenant.name}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-8">
          <Link 
            href={`/${tenant.slug}/rooms`}
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            {t('rooms')}
          </Link>
          <Link 
            href={`/${tenant.slug}#amenities`}
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            {t('amenities')}
          </Link>
          <Link 
            href={`/${tenant.slug}#location`}
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            {t('location')}
          </Link>
          <Link 
            href={`/${tenant.slug}#contact`}
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            {t('contact')}
          </Link>
        </div>

        {/* Auth Buttons */}
        <div className="hidden md:flex md:items-center md:gap-2">
          {/* Language Switcher Dropdown - Same style as landing page */}
          {mounted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-stone-600 hover:text-stone-900 gap-2"
                >
                  <Globe className="h-4 w-4" />
                  <span>{localeFlags[locale]} {localeNames[locale]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]">
                <DropdownMenuItem 
                  onClick={() => setLocale('th')}
                  className={locale === 'th' ? 'bg-stone-100' : ''}
                >
                  {localeFlags.th} {localeNames.th}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setLocale('en')}
                  className={locale === 'en' ? 'bg-stone-100' : ''}
                >
                  {localeFlags.en} {localeNames.en}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user ? (
            mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">
                      {user.full_name || user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/${tenant.slug}/my-bookings`} className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {t('myBookings')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${tenant.slug}/settings`} className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {t('settings')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-red-600">
                    <LogOut className="h-4 w-4" />
                    {t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" className="gap-2">
                <User className="h-4 w-4" />
                <span className="max-w-[120px] truncate">
                  {user.full_name || user.email}
                </span>
              </Button>
            )
          ) : (
            <>
              <Link href={`/${tenant.slug}/login`}>
                <Button variant="ghost" className="text-stone-600">
                  {t('login')}
                </Button>
              </Link>
              <Link href={`/${tenant.slug}/register`}>
                <Button 
                  className="text-white"
                  style={{ backgroundColor: tenant.primary_color }}
                >
                  {t('register')}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden -m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-stone-700"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className="sr-only">Toggle menu</span>
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <Link 
              href={`/${tenant.slug}/rooms`}
              className="text-base font-medium text-stone-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('rooms')}
            </Link>
            <Link 
              href={`/${tenant.slug}#amenities`}
              className="text-base font-medium text-stone-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('amenities')}
            </Link>
            <Link 
              href={`/${tenant.slug}#location`}
              className="text-base font-medium text-stone-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('location')}
            </Link>
            <Link 
              href={`/${tenant.slug}#contact`}
              className="text-base font-medium text-stone-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('contact')}
            </Link>
            <hr className="border-stone-200" />
            {/* Language Switcher - Mobile */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-stone-500 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {tSettings('language')}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setLocale('th')
                    setMobileMenuOpen(false)
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    locale === 'th' 
                      ? 'bg-stone-900 text-white' 
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {localeFlags.th} {localeNames.th}
                </button>
                <button
                  onClick={() => {
                    setLocale('en')
                    setMobileMenuOpen(false)
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    locale === 'en' 
                      ? 'bg-stone-900 text-white' 
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {localeFlags.en} {localeNames.en}
                </button>
              </div>
            </div>
            <hr className="border-stone-200" />
            {user ? (
              <>
                <Link 
                  href={`/${tenant.slug}/my-bookings`}
                  className="text-base font-medium text-stone-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('myBookings')}
                </Link>
                <Link 
                  href={`/${tenant.slug}/settings`}
                  className="text-base font-medium text-stone-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('settings')}
                </Link>
                <button
                  onClick={() => {
                    handleSignOut()
                    setMobileMenuOpen(false)
                  }}
                  className="text-left text-base font-medium text-red-600"
                >
                  {t('logout')}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <Link href={`/${tenant.slug}/login`} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">{t('login')}</Button>
                </Link>
                <Link href={`/${tenant.slug}/register`} onClick={() => setMobileMenuOpen(false)}>
                  <Button 
                    className="w-full text-white"
                    style={{ backgroundColor: tenant.primary_color }}
                  >
                    {t('register')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

