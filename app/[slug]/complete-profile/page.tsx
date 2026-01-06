import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CompleteProfileForm } from './complete-profile-form'

export const dynamic = 'force-dynamic'

interface CompleteProfilePageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ next?: string }>
}

export default async function CompleteProfilePage({ params, searchParams }: CompleteProfilePageProps) {
  const { slug } = await params
  const { next: nextUrl } = await searchParams
  
  const supabase = await createClient()
  
  // Run all queries in parallel
  const [tenantResult, userResult] = await Promise.all([
    supabase
      .from('tenants')
      .select('name, primary_color')
      .eq('slug', slug)
      .single(),
    supabase.auth.getUser()
  ])
  
  const tenant = tenantResult.data
  const user = userResult.data?.user
  
  // If no tenant, 404
  if (!tenant) {
    notFound()
  }
  
  // If no user, redirect to login
  if (!user) {
    redirect(`/${slug}/login?next=${encodeURIComponent(`/${slug}/complete-profile`)}`)
  }
  
  // Get profile (needs user id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, province, district, sub_district')
    .eq('id', user.id)
    .single()
  
  // Phone and province are required - if complete, redirect
  const phoneComplete = !!profile?.phone
  const provinceComplete = !!profile?.province
  
  if (phoneComplete && provinceComplete) {
    redirect(nextUrl || `/${slug}`)
  }
  
  // Check if user is OAuth
  const isOAuthUser = user.app_metadata?.provider !== 'email' && 
                     user.app_metadata?.providers?.some((p: string) => ['google', 'facebook'].includes(p))
  
  return (
    <CompleteProfileForm
      slug={slug}
      tenant={tenant}
      nextUrl={nextUrl || null}
      userId={user.id}
      initialData={{
        phone: profile?.phone || '',
        province: profile?.province || '',
        district: profile?.district || '',
        subDistrict: profile?.sub_district || '',
      }}
      isOAuthUser={isOAuthUser}
    />
  )
}
