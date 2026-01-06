import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/my-bookings', '/booking']


export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request)
  
  const pathname = request.nextUrl.pathname
  
  // If Supabase is not configured, skip all auth-related middleware
  if (!supabase) {
    return supabaseResponse
  }
  
  // Check if this is a host route
  if (pathname.startsWith('/host')) {
    // Allow access to login and register pages without auth
    if (pathname === '/host/login' || pathname === '/host/register') {
      return supabaseResponse
    }
    
    // Other host routes require auth (if any in the future)
    if (!user) {
      const redirectUrl = new URL('/host/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    return supabaseResponse
  }

  // Check if this is an admin route
  if (pathname.startsWith('/admin')) {
    // Allow access to login page without auth
    if (pathname === '/admin/login') {
      return supabaseResponse
    }
    
    if (!user) {
      const redirectUrl = new URL('/admin/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Check if user is super admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    // Profile not found - user was deleted, sign them out
    if (profileError?.code === 'PGRST116' || !profile) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    // Only super admins can access /admin/* routes
    if (profile.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    return supabaseResponse
  }
  
  // Extract tenant slug from the path (e.g., /viewmog/rooms -> viewmog)
  const pathParts = pathname.split('/').filter(Boolean)
  const potentialSlug = pathParts[0]
  
  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    !potentialSlug ||
    potentialSlug === 'admin'
  ) {
    return supabaseResponse
  }
  
  // Check if this is a tenant route (has a slug)
  // Exclude system routes that are not tenant slugs
  if (potentialSlug && !['login', 'register', 'admin', 'host', 'upload', 'privacy', 'terms'].includes(potentialSlug)) {
    // Validate tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, is_active')
      .eq('slug', potentialSlug)
      .single()
    
    // If there's a database error (not just "not found"), let the page handle it
    if (tenantError && tenantError.code !== 'PGRST116') {
      console.error('Middleware tenant lookup error:', tenantError)
      // Continue to page - let the page handle the error
      return supabaseResponse
    }
    
    if (!tenant) {
      // Tenant doesn't exist, redirect to home
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    if (!tenant.is_active) {
      // Tenant is inactive
      return NextResponse.redirect(new URL('/?error=tenant_inactive', request.url))
    }
    
    // Check protected routes within tenant
    const tenantPath = '/' + pathParts.slice(1).join('/')
    const isProtectedRoute = protectedRoutes.some(route => tenantPath.startsWith(route))
    
    if (isProtectedRoute && !user) {
      const redirectUrl = new URL(`/${potentialSlug}/login`, request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Check if user is blocked or deleted (for protected routes)
    if (isProtectedRoute && user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_blocked, tenant_id')
        .eq('id', user.id)
        .single()
      
      // Profile not found - user was deleted, sign them out
      if (profileError?.code === 'PGRST116' || !profile) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL(`/${potentialSlug}/login?error=account_deleted`, request.url))
      }
      
      if (profile.is_blocked) {
        // User is blocked, sign them out and redirect
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL(`/${potentialSlug}/login?error=blocked`, request.url))
      }
      
      // Ensure user belongs to this tenant (except for hosts who own the tenant)
      if (profile.tenant_id && profile.tenant_id !== tenant.id) {
        return NextResponse.redirect(new URL(`/${potentialSlug}?error=wrong_tenant`, request.url))
      }
    }
  }
  
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
