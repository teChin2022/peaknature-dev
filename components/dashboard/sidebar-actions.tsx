'use client'

import Link from 'next/link'
import { ExternalLink, LogOut, UserCircle } from 'lucide-react'
import { DashboardLanguageSwitcher } from './dashboard-language-switcher'
import { useTranslations } from 'next-intl'

interface SidebarActionsProps {
  slug: string
}

export function SidebarActions({ slug }: SidebarActionsProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="p-3 border-t border-gray-100 bg-gray-50/50 space-y-0.5">
      {/* Language Switcher */}
      <DashboardLanguageSwitcher variant="desktop" />
      
      <Link
        href="/host/account"
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all duration-150 text-sm font-medium cursor-pointer"
      >
        <UserCircle className="h-[18px] w-[18px]" />
        {t('actions.myAccount')}
      </Link>
      <a
        href={`/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all duration-150 text-sm font-medium cursor-pointer"
      >
        <ExternalLink className="h-[18px] w-[18px]" />
        {t('actions.viewPublicSite')}
      </a>
      <form action={`/${slug}/dashboard/signout`} method="POST">
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150 text-sm font-medium cursor-pointer"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {t('actions.signOut')}
        </button>
      </form>
    </div>
  )
}
