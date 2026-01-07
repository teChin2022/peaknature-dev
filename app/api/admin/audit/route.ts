import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getClientIP, apiLimiter, rateLimitResponse } from '@/lib/rate-limit'

export interface AuditLogEntry {
  action: string
  category: 'admin' | 'security' | 'user' | 'system'
  severity?: 'info' | 'warning' | 'error' | 'critical'
  targetType?: string
  targetId?: string
  targetName?: string
  tenantId?: string
  details?: Record<string, unknown>
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  success?: boolean
  errorMessage?: string
}

/**
 * POST /api/admin/audit
 * Log an audit event to the database
 * 
 * Security:
 * - Requires authentication to prevent log injection attacks
 * - Rate limited to prevent abuse
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 50 audit logs per minute per IP
    const clientIP = getClientIP(request.headers)
    const { success: rateLimitOk, reset } = await apiLimiter.check(50, `audit:${clientIP}`)
    if (!rateLimitOk) {
      return rateLimitResponse(reset)
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user - REQUIRE authentication to prevent log injection
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Get user profile for role
    let actorEmail = user.email || null
    let actorRole = 'guest'
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', user.id)
      .single()
    
    if (profile) {
      actorEmail = profile.email
      actorRole = profile.role
    }
    
    // Get request metadata
    const userAgent = request.headers.get('user-agent') || null
    
    // Parse request body
    const body: AuditLogEntry = await request.json()
    
    // Insert audit log using admin client (bypasses RLS)
    const { data, error } = await adminClient
      .from('audit_logs')
      .insert({
        action: body.action,
        category: body.category,
        severity: body.severity || 'info',
        actor_id: user?.id || null,
        actor_email: actorEmail,
        actor_role: actorRole,
        actor_ip: clientIP,
        actor_user_agent: userAgent,
        target_type: body.targetType || null,
        target_id: body.targetId || null,
        target_name: body.targetName || null,
        tenant_id: body.tenantId || null,
        details: body.details || {},
        old_value: body.oldValue || null,
        new_value: body.newValue || null,
        success: body.success ?? true,
        error_message: body.errorMessage || null,
      })
      .select('id')
      .single()
    
    if (error) {
      console.error('Failed to write audit log:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, id: data.id })
  } catch (error) {
    console.error('Audit log error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to write audit log' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/audit
 * Retrieve audit logs (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is super_admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const category = searchParams.get('category')
    const severity = searchParams.get('severity')
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const offset = (page - 1) * limit
    
    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (category) query = query.eq('category', category)
    if (severity) query = query.eq('severity', severity)
    if (action) query = query.ilike('action', `%${action}%`)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    
    const { data: logs, count, error } = await query
    
    if (error) {
      console.error('Failed to fetch audit logs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('Audit log fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

