import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TenantSettings } from '@/types/database'

// PUT /api/host/settings - Update tenant settings
export async function PUT(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { tenant_id, name, logo_url, primary_color, settings } = body as {
      tenant_id: string
      name: string
      logo_url: string | null
      primary_color: string
      settings: TenantSettings
    }

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS and verify host ownership
    const adminClient = createAdminClient()

    // Verify the user is a host for this tenant
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('[API/host/settings] Profile not found:', profileError)
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    if (profile.role !== 'host') {
      return NextResponse.json(
        { error: 'Only hosts can update tenant settings' },
        { status: 403 }
      )
    }

    if (profile.tenant_id !== tenant_id) {
      return NextResponse.json(
        { error: 'You can only update your own tenant settings' },
        { status: 403 }
      )
    }

    // Update tenant settings using admin client (bypasses RLS)
    const { data, error: updateError } = await adminClient
      .from('tenants')
      .update({
        name,
        logo_url,
        primary_color,
        settings,
      })
      .eq('id', tenant_id)
      .select('id')
      .single()

    if (updateError) {
      console.error('[API/host/settings] Update error:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    console.log('[API/host/settings] Settings updated successfully for tenant:', tenant_id)
    
    return NextResponse.json({ 
      success: true,
      data 
    })

  } catch (error) {
    console.error('[API/host/settings] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
