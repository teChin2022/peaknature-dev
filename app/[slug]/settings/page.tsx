import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { GuestSettingsForm } from './guest-settings-form'
import { Tenant, Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

interface GuestSettingsPageProps {
  params: Promise<{ slug: string }>
}

export default async function GuestSettingsPage({ params }: GuestSettingsPageProps) {
  const { slug } = await params
  
  const supabase = await createClient()
  
  // Run queries in parallel
  const [tenantResult, userResult] = await Promise.all([
    supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single(),
    supabase.auth.getUser()
  ])
  
  const tenant = tenantResult.data as Tenant | null
  const user = userResult.data?.user
  
  // If no tenant, 404
  if (!tenant) {
    notFound()
  }
  
  // If no user, redirect to login
  if (!user) {
    redirect(`/${slug}/login?redirect=/${slug}/settings`)
  }
  
  // Get profile (needs user id)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  const profile = profileData as Profile | null
  
  if (!profile) {
    redirect(`/${slug}/login`)
  }
  
  // Check if user registered with email (vs OAuth)
  const isEmailUser = !!user.identities?.find(i => i.provider === 'email')
  
  return (
    <GuestSettingsForm
      slug={slug}
      tenant={tenant}
      profile={profile}
      isEmailUser={isEmailUser}
    />
  )
}
