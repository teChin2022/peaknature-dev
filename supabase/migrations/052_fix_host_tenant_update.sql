-- =====================================================
-- FIX: Host RLS Policies Causing Operations to Hang
-- =====================================================
-- Issue: When host performs operations (update settings, manage rooms,
-- view/update bookings), the operations hang due to RLS policy issues.
--
-- Root Cause: Migrations 050 and 051 created policies that can cause
-- circular RLS evaluation or timeout issues.
--
-- Solution: Create a robust SECURITY DEFINER function with proper
-- error handling and update ALL affected policies.
--
-- Affected Tables:
-- 1. tenants - Host updating settings (Google Maps, etc.)
-- 2. rooms - Host creating/editing/deleting rooms
-- 3. bookings - Host viewing/updating bookings
-- =====================================================

-- =====================================================
-- STEP 1: Create robust ownership check function
-- =====================================================
-- This function must be SECURITY DEFINER to bypass RLS on profiles
-- Uses plpgsql with proper error handling to avoid timeouts

CREATE OR REPLACE FUNCTION public.current_user_owns_tenant(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
BEGIN
  -- Simple direct check without complex logic
  SELECT TRUE INTO v_result
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
    AND tenant_id = check_tenant_id
  LIMIT 1;
  
  RETURN COALESCE(v_result, FALSE);
EXCEPTION WHEN OTHERS THEN
  -- On any error, deny access (don't hang)
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.current_user_owns_tenant(UUID) TO authenticated;

-- =====================================================
-- STEP 2: Update backward compatible wrapper functions
-- =====================================================
-- Keep these for any code using the old function names

CREATE OR REPLACE FUNCTION public.owns_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_owns_tenant(p_tenant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.owns_room_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_owns_tenant(p_tenant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 3: Fix TENANTS policies
-- =====================================================

-- Clean up any old policy names
DROP POLICY IF EXISTS "tenants_update_host" ON tenants;
DROP POLICY IF EXISTS "tenants_update_own_host" ON tenants;
DROP POLICY IF EXISTS "hosts_update_own_tenant" ON tenants;
DROP POLICY IF EXISTS "host_update_tenant" ON tenants;

CREATE POLICY "tenants_update_host"
  ON tenants FOR UPDATE
  USING (public.current_user_owns_tenant(id))
  WITH CHECK (public.current_user_owns_tenant(id));

DROP POLICY IF EXISTS "tenants_select_host_own" ON tenants;

CREATE POLICY "tenants_select_host_own"
  ON tenants FOR SELECT
  USING (public.current_user_owns_tenant(id));

-- Keep the public select policy for active tenants
DROP POLICY IF EXISTS "tenants_select_active" ON tenants;

CREATE POLICY "tenants_select_active"
  ON tenants FOR SELECT
  USING (is_active = true);

-- Keep super admin full access
DROP POLICY IF EXISTS "tenants_all_super_admin" ON tenants;

CREATE POLICY "tenants_all_super_admin"
  ON tenants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =====================================================
-- STEP 4: Fix ROOMS policies
-- =====================================================

DROP POLICY IF EXISTS "rooms_select_host" ON rooms;

CREATE POLICY "rooms_select_host"
  ON rooms FOR SELECT
  USING (public.current_user_owns_tenant(tenant_id));

DROP POLICY IF EXISTS "rooms_all_host" ON rooms;

CREATE POLICY "rooms_all_host"
  ON rooms FOR ALL
  USING (public.current_user_owns_tenant(tenant_id))
  WITH CHECK (public.current_user_owns_tenant(tenant_id));

-- =====================================================
-- STEP 5: Fix BOOKINGS policies
-- =====================================================

DROP POLICY IF EXISTS "bookings_select_host" ON bookings;

CREATE POLICY "bookings_select_host"
  ON bookings FOR SELECT
  USING (public.current_user_owns_tenant(tenant_id));

DROP POLICY IF EXISTS "bookings_update_host" ON bookings;

CREATE POLICY "bookings_update_host"
  ON bookings FOR UPDATE
  USING (public.current_user_owns_tenant(tenant_id))
  WITH CHECK (public.current_user_owns_tenant(tenant_id));

-- =====================================================
-- STEP 6: Fix ROOM_AVAILABILITY policies
-- =====================================================
-- These policies also use get_my_tenant_id() which can cause issues

DROP POLICY IF EXISTS "room_availability_select_host" ON room_availability;

CREATE POLICY "room_availability_select_host"
  ON room_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_availability.room_id 
      AND public.current_user_owns_tenant(rooms.tenant_id)
    )
  );

DROP POLICY IF EXISTS "room_availability_insert_host" ON room_availability;

CREATE POLICY "room_availability_insert_host"
  ON room_availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_id 
      AND public.current_user_owns_tenant(rooms.tenant_id)
    )
  );

DROP POLICY IF EXISTS "room_availability_update_host" ON room_availability;

CREATE POLICY "room_availability_update_host"
  ON room_availability FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_availability.room_id 
      AND public.current_user_owns_tenant(rooms.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_id 
      AND public.current_user_owns_tenant(rooms.tenant_id)
    )
  );

DROP POLICY IF EXISTS "room_availability_delete_host" ON room_availability;

CREATE POLICY "room_availability_delete_host"
  ON room_availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_availability.room_id 
      AND public.current_user_owns_tenant(rooms.tenant_id)
    )
  );

-- =====================================================
-- STEP 7: Fix PROFILES policy (profiles_select_host_guests)
-- =====================================================
-- Create safe helper function for getting host's tenant ID

CREATE OR REPLACE FUNCTION public.get_host_tenant_id_safe()
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
  LIMIT 1;
  RETURN v_tenant_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "profiles_select_host_guests" ON profiles;

CREATE POLICY "profiles_select_host_guests"
  ON profiles FOR SELECT
  USING (
    public.is_host() 
    AND (
      tenant_id = public.get_host_tenant_id_safe()
      OR
      id IN (
        SELECT DISTINCT b.user_id 
        FROM bookings b
        WHERE b.tenant_id = public.get_host_tenant_id_safe()
      )
    )
  );

-- =====================================================
-- STEP 8: Fix SUBSCRIPTION_PAYMENTS policies
-- =====================================================

DROP POLICY IF EXISTS "subscription_payments_select_host" ON subscription_payments;

CREATE POLICY "subscription_payments_select_host"
  ON subscription_payments FOR SELECT
  USING (
    public.current_user_owns_tenant(tenant_id)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "subscription_payments_insert_host" ON subscription_payments;

CREATE POLICY "subscription_payments_insert_host"
  ON subscription_payments FOR INSERT
  WITH CHECK (
    public.current_user_owns_tenant(tenant_id)
    OR public.is_super_admin()
  );

-- =====================================================
-- DONE: All host-related policies now use the robust
-- current_user_owns_tenant() or get_host_tenant_id_safe()
-- functions which:
-- 1. Have SECURITY DEFINER to bypass RLS
-- 2. Use plpgsql with error handling
-- 3. Return safe values on errors (don't hang)
-- =====================================================
