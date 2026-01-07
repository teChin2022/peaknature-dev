import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RoomForm } from '@/components/dashboard/room-form'
import { RoomPageHeader } from '@/components/dashboard/room-page-header'

interface EditRoomPageProps {
  params: Promise<{ slug: string; roomId: string }>
}

async function getTenantAndRoom(slug: string, roomId: string) {
  const supabase = await createClient()
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  if (!tenant) return null

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!room) return null

  return { tenant, room }
}

export default async function EditRoomPage({ params }: EditRoomPageProps) {
  const { slug, roomId } = await params
  const data = await getTenantAndRoom(slug, roomId)
  
  if (!data) {
    notFound()
  }

  const { tenant, room } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <RoomPageHeader slug={slug} mode="edit" roomName={room.name} />

      {/* Form */}
      <RoomForm tenant={tenant} room={room} mode="edit" />
    </div>
  )
}

