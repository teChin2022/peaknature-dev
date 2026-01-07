import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TenantSettings, defaultTenantSettings } from '@/types/database'
import { apiLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 30 lock requests per minute per IP
    const clientIP = getClientIP(request.headers)
    const { success: rateLimitOk, reset } = await apiLimiter.check(30, `create-lock:${clientIP}`)
    if (!rateLimitOk) {
      return rateLimitResponse(reset)
    }

    const body = await request.json()
    const { roomId, checkIn, checkOut, tenantId } = body

    if (!roomId || !checkIn || !checkOut || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get tenant settings for timeout
    const { data: tenant } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single()

    const settings: TenantSettings = {
      ...defaultTenantSettings,
      ...(tenant?.settings as TenantSettings || {})
    }

    const timeoutMinutes = settings.payment?.payment_timeout_minutes || 15

    // Try RPC function first
    const { data: lockData, error: rpcError } = await supabase.rpc('create_reservation_lock', {
      p_room_id: roomId,
      p_user_id: user.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_timeout_minutes: timeoutMinutes
    })

    // If RPC fails, try direct approach
    if (rpcError) {
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString()
      
      // First, clean up any expired locks for this room
      await supabase
        .from('reservation_locks')
        .delete()
        .eq('room_id', roomId)
        .lt('expires_at', new Date().toISOString())
      
      // Check if there's an existing ACTIVE lock by ANOTHER user
      const { data: existingLocks } = await supabase
        .from('reservation_locks')
        .select('id, user_id, check_in, check_out, expires_at')
        .eq('room_id', roomId)
        .gt('expires_at', new Date().toISOString())

      // Check for overlapping locks by other users
      const requestedCheckIn = new Date(checkIn)
      const requestedCheckOut = new Date(checkOut)
      
      const conflictingLock = existingLocks?.find(lock => {
        const lockCheckIn = new Date(lock.check_in)
        const lockCheckOut = new Date(lock.check_out)
        const datesOverlap = lockCheckIn < requestedCheckOut && lockCheckOut > requestedCheckIn
        return datesOverlap && lock.user_id !== user.id
      })

      if (conflictingLock) {
        return NextResponse.json({
          success: false,
          error: 'Dates are currently locked by another guest'
        })
      }

      // Check if current user already has a lock for these exact dates
      const existingUserLock = existingLocks?.find(lock => 
        lock.user_id === user.id && 
        lock.check_in === checkIn && 
        lock.check_out === checkOut
      )

      if (existingUserLock) {
        // User already has a lock, just update the expiration
        const { data: updatedLock, error: updateError } = await supabase
          .from('reservation_locks')
          .update({ expires_at: expiresAt })
          .eq('id', existingUserLock.id)
          .select()
          .single()

        if (updateError) {
          // Still return success since lock exists
          return NextResponse.json({
            success: true,
            lockId: existingUserLock.id,
            expiresAt: existingUserLock.expires_at,
            timeoutMinutes
          })
        }

        return NextResponse.json({
          success: true,
          lockId: updatedLock.id,
          expiresAt: updatedLock.expires_at,
          timeoutMinutes
        })
      }

      // Delete any existing lock for this room/dates (expired or by same user)
      await supabase
        .from('reservation_locks')
        .delete()
        .eq('room_id', roomId)
        .eq('check_in', checkIn)
        .eq('check_out', checkOut)

      // Create new lock
      const { data: newLock, error: insertError } = await supabase
        .from('reservation_locks')
        .insert({
          room_id: roomId,
          user_id: user.id,
          check_in: checkIn,
          check_out: checkOut,
          expires_at: expiresAt
        })
        .select()
        .single()

      if (insertError) {
        // If insert fails due to unique constraint, try to get existing lock
        if (insertError.code === '23505') {
          const { data: existingLock } = await supabase
            .from('reservation_locks')
            .select('*')
            .eq('room_id', roomId)
            .eq('check_in', checkIn)
            .eq('check_out', checkOut)
            .single()
          
          if (existingLock && existingLock.user_id === user.id) {
            return NextResponse.json({
              success: true,
              lockId: existingLock.id,
              expiresAt: existingLock.expires_at,
              timeoutMinutes
            })
          }
        }
        
        return NextResponse.json({
          success: false,
          error: 'Failed to create reservation lock: ' + insertError.message
        })
      }

      return NextResponse.json({
        success: true,
        lockId: newLock.id,
        expiresAt: newLock.expires_at,
        timeoutMinutes
      })
    }

    const result = lockData?.[0]
    
    if (!result?.success) {
      return NextResponse.json({
        success: false,
        error: result?.error_message || 'Dates are currently locked by another guest',
        expiresAt: result?.expires_at || null
      })
    }

    return NextResponse.json({
      success: true,
      lockId: result.lock_id,
      expiresAt: result.expires_at,
      timeoutMinutes
    })

  } catch (error) {
    console.error('[create-lock] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
