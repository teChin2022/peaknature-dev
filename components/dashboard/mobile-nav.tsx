'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Menu, X, ExternalLink, LogOut, UserCircle,
  LayoutDashboard, BedDouble, Calendar, ClipboardList, 
  Users, Star, BarChart3, Settings, CreditCard
} from 'lucide-react'
import { Tenant } from '@/types/database'
import { DashboardLanguageSwitcher } from './dashboard-language-switcher'
import { useTranslations } from 'next-intl'

// Define nav items with translation keys
const navItems = [
  { key: 'dashboard', href: '', icon: LayoutDashboard },
  { key: 'rooms', href: '/rooms', icon: BedDouble },
  { key: 'calendar', href: '/calendar', icon: Calendar },
  { key: 'bookings', href: '/bookings', icon: ClipboardList },
  { key: 'guests', href: '/guests', icon: Users },
  { key: 'reviews', href: '/reviews', icon: Star },
  { key: 'analytics', href: '/analytics', icon: BarChart3 },
  { key: 'subscription', href: '/subscription', icon: CreditCard },
  { key: 'settings', href: '/settings', icon: Settings },
]

interface MobileNavProps {
  tenant: Tenant
  slug: string
}

export function MobileNav({ tenant, slug }: MobileNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const t = useTranslations('dashboard')

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link href={`/${slug}/dashboard`} className="flex items-center gap-2.5 cursor-pointer">
            <div 
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ backgroundColor: tenant.primary_color }}
            >
              {tenant.name.charAt(0)}
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px] block">{tenant.name}</span>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{t('hostDashboard')}</span>
            </div>
          </Link>
          
          {/* Hamburger Menu Button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Toggle menu</span>
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-100 px-3 py-2 flex-shrink-0 shadow-lg">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={`/${slug}/dashboard${item.href}`}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {t(`nav.${item.key}`)}
              </Link>
            ))}
            
            <hr className="border-gray-100 my-2" />

            {/* Language Switcher */}
            <DashboardLanguageSwitcher variant="mobile" />
            
            <hr className="border-gray-100 my-2" />
            
            <Link
              href="/host/account"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
              onClick={() => setMobileMenuOpen(false)}
            >
              <UserCircle className="h-4 w-4" />
              {t('actions.myAccount')}
            </Link>
            
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ExternalLink className="h-4 w-4" />
              {t('actions.viewPublicSite')}
            </a>
            
            <form action={`/${slug}/dashboard/signout`} method="POST">
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-sm font-medium cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                {t('actions.signOut')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
