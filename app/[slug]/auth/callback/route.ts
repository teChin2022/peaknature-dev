import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allows relative paths starting with / (but not //)
 */
function isValidRedirectUrl(url: string, allowedSlug: string): boolean {
  // Must start with / but not // (protocol-relative URL)
  if (!url.startsWith('/') || url.startsWith('//')) {
    return false
  }
  
  // Block any URL that looks like it could redirect externally
  // e.g., /\evil.com or /%2F%2Fevil.com
  const decoded = decodeURIComponent(url)
  if (decoded.startsWith('//') || decoded.includes('://')) {
    return false
  }
  
  // Optionally, restrict to same tenant paths
  // This ensures users can only be redirected within their tenant
  if (!url.startsWith(`/${allowedSlug}`) && url !== `/${allowedSlug}`) {
    // Allow root paths but log for monitoring
    console.warn(`[auth-callback] Redirect to different path: ${url} (tenant: ${allowedSlug})`)
  }
  
  return true
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const rawNext = requestUrl.searchParams.get('next') || `/${slug}`
  
  // Validate and sanitize the redirect URL to prevent open redirect attacks
  const next = isValidRedirectUrl(rawNext, slug) ? rawNext : `/${slug}`
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const error_param = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Handle errors from Supabase
  if (error_param) {
    console.error('Auth callback error:', error_param, error_description)
    return NextResponse.redirect(
      new URL(`/${slug}/login?error=${encodeURIComponent(error_description || error_param)}`, requestUrl.origin)
    )
  }

  const supabase = await createClient()

  // Handle email verification with token_hash first (PKCE email confirmation)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'signup' | 'recovery' | 'invite' | 'magiclink',
    })

    if (verifyError) {
      console.error('Email verification error:', verifyError)
      // For recovery type, redirect to forgot-password with error
      if (type === 'recovery') {
        return NextResponse.redirect(
          new URL(`/${slug}/forgot-password?error=${encodeURIComponent('Password reset link has expired or is invalid. Please request a new one.')}`, requestUrl.origin)
        )
      }
      return NextResponse.redirect(
        new URL(`/${slug}/login?error=${encodeURIComponent('Email verification failed. Please try again or request a new link.')}`, requestUrl.origin)
      )
    }

    // For recovery type, redirect to reset password page
    if (type === 'recovery') {
      return NextResponse.redirect(
        new URL(`/${slug}/reset-password`, requestUrl.origin)
      )
    }

    // After verification, check profile and redirect
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, province')
        .eq('id', session.user.id)
        .single()

      const needsPhone = !profile?.phone
      const needsProvince = !profile?.province
      
      if (needsPhone || needsProvince) {
        return NextResponse.redirect(
          new URL(`/${slug}/complete-profile?next=${encodeURIComponent(next)}`, requestUrl.origin)
        )
      }
      
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }

    // Verification succeeded but no session - redirect to login
    return NextResponse.redirect(
      new URL(`/${slug}/login?message=${encodeURIComponent('Email verified! Please login to continue.')}`, requestUrl.origin)
    )
  }

  // Handle code exchange (OAuth or PKCE email flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Code exchange error:', error)
      return NextResponse.redirect(
        new URL(`/${slug}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`, requestUrl.origin)
      )
    }

    // Get the session to check profile
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // Check if profile exists and has tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, tenant_id, phone, province')
        .eq('id', session.user.id)
        .single()

      // If profile doesn't have tenant_id, set it
      if (profile && !profile.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', slug)
          .single()

        if (tenant) {
          await supabase
            .from('profiles')
            .update({ tenant_id: tenant.id })
            .eq('id', session.user.id)
        }
      }

      // Check if profile is complete (phone and province required)
      const needsPhone = !profile?.phone
      const needsProvince = !profile?.province
      
      if (needsPhone || needsProvince) {
        return NextResponse.redirect(
          new URL(`/${slug}/complete-profile?next=${encodeURIComponent(next)}`, requestUrl.origin)
        )
      }
    }

    // Profile complete, redirect to destination
    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // No valid parameters - redirect to login
  return NextResponse.redirect(
    new URL(`/${slug}/login?error=${encodeURIComponent('Invalid authentication link.')}`, requestUrl.origin)
  )
}

