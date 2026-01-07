'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface RoomPageHeaderProps {
  slug: string
  mode: 'create' | 'edit'
  roomName?: string
}

export function RoomPageHeader({ slug, mode, roomName }: RoomPageHeaderProps) {
  const t = useTranslations('dashboard.rooms')

  return (
    <div className="flex items-center gap-4">
      <Link 
        href={`/${slug}/dashboard/rooms`}
        className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-stone-600" />
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          {mode === 'create' ? t('addNewRoom') : t('editRoomTitle')}
        </h1>
        <p className="text-stone-600">
          {mode === 'create' ? t('addNewRoomDesc') : roomName}
        </p>
      </div>
    </div>
  )
}

