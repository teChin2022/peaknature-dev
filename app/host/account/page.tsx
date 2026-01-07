import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HostAccountForm } from './host-account-form'
import { Profile, Tenant } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function HostAccountPage() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/host/login')
  }
  
  // Get profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  const profile = profileData as Profile | null
  
  if (!profile) {
    redirect('/host/login')
  }
  
  // Check if user is a host
  if (profile.role !== 'host') {
    redirect('/host/login')
  }
  
  // Get tenant info for navigation back
  let tenant: Tenant | null = null
  if (profile.tenant_id) {
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', profile.tenant_id)
      .single()
    tenant = tenantData as Tenant | null
  }
  
  // Check if user registered with email (vs OAuth)
  const isEmailUser = !!user.identities?.find(i => i.provider === 'email')
  
  return (
    <HostAccountForm
      profile={profile}
      tenant={tenant}
      isEmailUser={isEmailUser}
    />
  )
}

