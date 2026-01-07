import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allows relative paths starting with / (but not //)
 */
function isValidRedirectUrl(url: string): boolean {
  // Must start with / but not // (protocol-relative URL)
  if (!url.startsWith('/') || url.startsWith('//')) {
    return false
  }
  
  // Block any URL that looks like it could redirect externally
  const decoded = decodeURIComponent(url)
  if (decoded.startsWith('//') || decoded.includes('://')) {
    return false
  }
  
  return true
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const rawNext = requestUrl.searchParams.get('next') || '/host/login'
  
  // Validate and sanitize the redirect URL to prevent open redirect attacks
  const next = isValidRedirectUrl(rawNext) ? rawNext : '/host/login'
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const error_param = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Handle errors from Supabase
  if (error_param) {
    console.error('Host auth callback error:', error_param, error_description)
    
    // Check for expired/invalid link error
    if (error_description?.includes('expired') || error_description?.includes('invalid')) {
      return NextResponse.redirect(
        new URL(`/host/login?error=${encodeURIComponent('Your verification link has expired or was already used. Please try logging in - if your email is verified, you can access your account. Otherwise, try registering again.')}&showResend=true`, requestUrl.origin)
      )
    }
    
    return NextResponse.redirect(
      new URL(`/host/login?error=${encodeURIComponent(error_description || error_param)}`, requestUrl.origin)
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
      console.error('Host email verification error:', verifyError)
      // For recovery type, redirect to forgot-password with error
      if (type === 'recovery') {
        return NextResponse.redirect(
          new URL(`/host/forgot-password?error=${encodeURIComponent('Password reset link has expired or is invalid. Please request a new one.')}`, requestUrl.origin)
        )
      }
      return NextResponse.redirect(
        new URL(`/host/login?error=${encodeURIComponent('Email verification failed. Please try again or request a new link.')}`, requestUrl.origin)
      )
    }

    // For recovery type, redirect to reset password page
    if (type === 'recovery') {
      return NextResponse.redirect(
        new URL('/host/reset-password', requestUrl.origin)
      )
    }

    // After verification, redirect to next or login
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // Get user profile to find their tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', session.user.id)
        .single()

      if (profile?.role === 'host' && profile?.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('slug, is_active')
          .eq('id', profile.tenant_id)
          .single()

        if (tenant?.is_active) {
          return NextResponse.redirect(new URL(`/${tenant.slug}/dashboard`, requestUrl.origin))
        }
      }
      
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }

    // Verification succeeded but no session - redirect to login
    return NextResponse.redirect(
      new URL('/host/login?message=Email verified! Please login to continue.', requestUrl.origin)
    )
  }

  // Handle code exchange (OAuth or PKCE email flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Host code exchange error:', error)
      return NextResponse.redirect(
        new URL(`/host/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`, requestUrl.origin)
      )
    }

    // Get the session to check profile
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // Get user profile to find their tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', session.user.id)
        .single()

      if (profile?.role === 'host' && profile?.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('slug, is_active')
          .eq('id', profile.tenant_id)
          .single()

        if (tenant?.is_active) {
          return NextResponse.redirect(new URL(`/${tenant.slug}/dashboard`, requestUrl.origin))
        }
      }
    }

    // Redirect to destination
    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // No valid parameters - redirect to login
  return NextResponse.redirect(
    new URL('/host/login?error=Invalid authentication link.', requestUrl.origin)
  )
}

