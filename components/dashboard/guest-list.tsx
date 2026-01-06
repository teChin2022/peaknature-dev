'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Users, Mail, Phone, Calendar, MoreVertical, Trash2, Loader2, AlertTriangle, MapPin } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'

interface GuestProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  tenant_id: string
  is_blocked: boolean
  avatar_url: string | null
  created_at: string
  province?: string | null
  district?: string | null
  sub_district?: string | null
}

interface GuestData {
  profile: GuestProfile
  bookingCount: number
  lastBooking: string | null
}

interface GuestListProps {
  guests: GuestData[]
  tenantId: string
  primaryColor: string
}

// Helper function to format date safely (only on client)
function formatDateSafe(dateString: string, isMounted: boolean): string {
  if (!isMounted) return '...'
  try {
    return format(parseISO(dateString), 'MMM d, yyyy')
  } catch {
    return '...'
  }
}

export function GuestList({ guests: initialGuests, tenantId, primaryColor }: GuestListProps) {
  const t = useTranslations('dashboard')
  const [guests, setGuests] = useState<GuestData[]>(initialGuests)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDeleteClick = (profile: GuestProfile) => {
    setSelectedGuest(profile)
    setDeleteDialogOpen(true)
    setError(null)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedGuest) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: selectedGuest.id,
          tenantId,
          isHostAction: true 
        })
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        setError(`Too many requests. Please try again in ${retryAfter} seconds.`)
        return
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete guest')
      }

      // Remove from local state
      setGuests(prev => prev.filter(g => g.profile.id !== selectedGuest.id))
      setDeleteDialogOpen(false)
      setSelectedGuest(null)
    } catch (err) {
      console.error('Delete guest error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete guest')
    } finally {
      setIsDeleting(false)
    }
  }

  if (guests.length === 0) {
    return (
      <Card className="bg-white">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('guests.noGuests')}</h3>
          <p className="text-gray-500 text-center">
            {t('guests.noGuestsDesc')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guests.map(({ profile, bookingCount, lastBooking }) => (
          <Card key={profile.id} className="bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {profile.full_name 
                      ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      : 'G'
                    }
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {profile.full_name || 'Guest'}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onClick={() => handleDeleteClick(profile)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Guest
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{profile.phone}</span>
                </div>
              )}
              {profile.province && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    {profile.sub_district && (
                      <span>{profile.sub_district}, </span>
                    )}
                    {profile.district && (
                      <span>{profile.district}, </span>
                    )}
                    <span className="font-medium">{profile.province}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-500">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>
                  {lastBooking 
                    ? `Last booked: ${formatDateSafe(lastBooking, mounted)}`
                    : `Joined: ${formatDateSafe(profile.created_at, mounted)}`
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Guest Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedGuest?.full_name || selectedGuest?.email}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="text-sm text-gray-600">
              <p className="mb-2">This action will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Guest profile information</li>
                <li>All booking history for this guest</li>
                <li>Any reviews from this guest</li>
              </ul>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteConfirm()
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Guest'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

