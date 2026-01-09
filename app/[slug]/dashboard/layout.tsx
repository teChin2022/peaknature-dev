import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Tenant, Profile } from '@/types/database'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { SidebarActions } from '@/components/dashboard/sidebar-actions'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { SidebarHeader } from '@/components/dashboard/sidebar-header'
import { createSubscriptionInfo } from '@/lib/subscription'
import { SubscriptionBanner } from '@/components/dashboard/subscription-banner'

// Force dynamic rendering for dashboard
export const dynamic = 'force-dynamic'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

async function getTenantAndUser(slug: string) {
  const supabase = await createClient()
  
  // Fetch tenant and user in parallel for better performance
  const [tenantResult, userResult] = await Promise.all([
    supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single() as Promise<{ data: Tenant | null; error: unknown }>,
    supabase.auth.getUser()
  ])
  
  const tenantData = tenantResult.data
  if (!tenantData) return null

  const user = userResult.data?.user
  if (!user) return { tenant: tenantData, profile: null, subscriptionInfo: null }

  // OPTIMIZED: Profile fetch is now included in parallel with tenant+user
  // Since we already have user.id from userResult, we can add profile fetch to initial Promise.all
  // But since we need to check user exists first, we fetch profile here
  // Note: This is already optimized - the profile fetch is the only remaining sequential call
  // and it's necessary because we need user.id
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null }

  // Create subscription info from tenant data (no extra DB call needed)
  const subscriptionInfo = createSubscriptionInfo({
    plan: tenantData.plan || 'free',
    subscription_status: tenantData.subscription_status || 'trial',
    trial_started_at: tenantData.trial_started_at,
    trial_ends_at: tenantData.trial_ends_at,
    subscription_started_at: tenantData.subscription_started_at,
    subscription_ends_at: tenantData.subscription_ends_at,
  })

  return { tenant: tenantData, profile: profileData, subscriptionInfo }
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { slug } = await params
  const data = await getTenantAndUser(slug)
  
  if (!data) {
    notFound()
  }

  const { tenant, profile, subscriptionInfo } = data

  // Check if user is authorized (must be host or super_admin)
  if (!profile || (profile.role !== 'host' && profile.role !== 'super_admin')) {
    redirect(`/${slug}/login?redirect=/${slug}/dashboard`)
  }

  // Prepare subscription data for client component
  const subscriptionData = subscriptionInfo ? {
    status: subscriptionInfo.status,
    daysRemaining: subscriptionInfo.daysRemaining,
    trialEndsAt: subscriptionInfo.trialEndsAt?.toISOString() || null,
    subscriptionEndsAt: subscriptionInfo.subscriptionEndsAt?.toISOString() || null,
  } : null

  return (
    // Fixed full-screen container to cover parent tenant layout
    <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-100 flex-shrink-0 shadow-sm">
        {/* Logo - Client Component for translations */}
        <SidebarHeader 
          slug={slug} 
          tenantName={tenant.name} 
          primaryColor={tenant.primary_color} 
        />

        {/* Navigation - Client Component for translations */}
        <SidebarNav slug={slug} />

        {/* Bottom Actions with Language Switcher */}
        <SidebarActions slug={slug} />
      </aside>

      {/* Mobile + Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile Header & Navigation (hamburger menu style) */}
        <MobileNav tenant={tenant} slug={slug} />

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          {/* Subscription Banner */}
          <SubscriptionBanner 
            subscriptionData={subscriptionData}
            slug={slug}
            primaryColor={tenant.primary_color}
          />
          
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
