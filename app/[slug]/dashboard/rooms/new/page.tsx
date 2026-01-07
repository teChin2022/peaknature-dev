import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RoomForm } from '@/components/dashboard/room-form'
import { RoomPageHeader } from '@/components/dashboard/room-page-header'

interface NewRoomPageProps {
  params: Promise<{ slug: string }>
}

async function getTenant(slug: string) {
  const supabase = await createClient()
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  return tenant
}

export default async function NewRoomPage({ params }: NewRoomPageProps) {
  const { slug } = await params
  const tenant = await getTenant(slug)
  
  if (!tenant) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <RoomPageHeader slug={slug} mode="create" />

      {/* Form */}
      <RoomForm tenant={tenant} mode="create" />
    </div>
  )
}

