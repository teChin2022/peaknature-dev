'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MoreVertical, Edit2, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { Room } from '@/types/database'
import { useTranslations } from 'next-intl'

interface RoomActionsProps {
  room: Room
  tenantSlug: string
}

export function RoomActions({ room, tenantSlug }: RoomActionsProps) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('dashboard.rooms')
  const tCommon = useTranslations('common')
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const toggleActive = async () => {
    setIsLoading(true)
    try {
      await supabase
        .from('rooms')
        .update({ is_active: !room.is_active })
        .eq('id', room.id)
      
      router.refresh()
    } catch (error) {
      console.error('Error toggling room status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteRoom = async () => {
    setIsLoading(true)
    try {
      await supabase
        .from('rooms')
        .delete()
        .eq('id', room.id)
      
      setShowDeleteDialog(false)
      router.refresh()
    } catch (error) {
      console.error('Error deleting room:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/${tenantSlug}/dashboard/rooms/${room.id}`} className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              {t('editRoom')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${tenantSlug}/rooms/${room.id}`} target="_blank" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('viewPublic')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleActive} className="flex items-center gap-2">
            {room.is_active ? (
              <>
                <EyeOff className="h-4 w-4" />
                {t('deactivate')}
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                {t('activate')}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="flex items-center gap-2 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            {tCommon('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteRoom')}</DialogTitle>
            <DialogDescription>
              {t('deleteRoomDesc', { name: room.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={deleteRoom}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                t('deleteRoom')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

