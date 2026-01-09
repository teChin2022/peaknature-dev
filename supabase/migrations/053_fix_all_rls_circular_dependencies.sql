-- =====================================================
-- CONSOLIDATED FIX: All RLS Circular Dependencies
-- =====================================================
-- This migration fixes ALL circular RLS dependencies by:
-- 1. Creating SECURITY DEFINER helper functions for ALL cross-table checks
-- 2. Removing complex subqueries from RLS policies
-- 3. Using simple, non-recursive policy checks
--
-- ROOT CAUSE: RLS policies query other tables that also have RLS,
-- causing infinite loops or timeouts.
--
-- SOLUTION: All cross-table checks use SECURITY DEFINER functions
-- that bypass RLS evaluation.
-- =====================================================

-- =====================================================
-- STEP 1: Create/Update ALL Helper Functions
-- These MUST be SECURITY DEFINER to bypass RLS
-- =====================================================

-- 1.1: Check if current user owns a specific tenant
CREATE OR REPLACE FUNCTION public.current_user_owns_tenant(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
BEGIN
  IF check_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT TRUE INTO v_result
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
    AND tenant_id = check_tenant_id
  LIMIT 1;
  
  RETURN COALESCE(v_result, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.2: Get current user's tenant ID (safe version)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_tenant_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.3: Get host's tenant ID (only for hosts)
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

-- 1.4: Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
BEGIN
  SELECT TRUE INTO v_result
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'super_admin'
  LIMIT 1;
  
  RETURN COALESCE(v_result, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.5: Check if user is host
CREATE OR REPLACE FUNCTION public.is_host()
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
BEGIN
  SELECT TRUE INTO v_result
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
  LIMIT 1;
  
  RETURN COALESCE(v_result, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.6: Check if room belongs to host's tenant (bypasses rooms RLS)
CREATE OR REPLACE FUNCTION public.host_owns_room(check_room_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
  v_host_tenant_id UUID;
BEGIN
  IF check_room_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get host's tenant ID
  SELECT tenant_id INTO v_host_tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
  LIMIT 1;
  
  IF v_host_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if room belongs to host's tenant
  SELECT TRUE INTO v_result
  FROM public.rooms
  WHERE id = check_room_id
    AND tenant_id = v_host_tenant_id
  LIMIT 1;
  
  RETURN COALESCE(v_result, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.7: Check if notification belongs to host's tenant (bypasses other RLS)
CREATE OR REPLACE FUNCTION public.host_owns_notification(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
BEGIN
  IF check_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT TRUE INTO v_result
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
    AND tenant_id = check_tenant_id
  LIMIT 1;
  
  RETURN COALESCE(v_result, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.8: Check if a profile is a guest who booked at host's property
-- This is used for profiles_select_host_guests to allow hosts to see guest info
CREATE OR REPLACE FUNCTION public.is_guest_of_host_property(check_profile_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
  v_host_tenant_id UUID;
BEGIN
  IF check_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get host's tenant ID
  SELECT tenant_id INTO v_host_tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
  LIMIT 1;
  
  IF v_host_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the profile has a booking at host's property
  SELECT TRUE INTO v_result
  FROM public.bookings
  WHERE user_id = check_profile_id
    AND tenant_id = v_host_tenant_id
  LIMIT 1;
  
  RETURN COALESCE(v_result, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.current_user_owns_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_host_tenant_id_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_host() TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_owns_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_owns_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guest_of_host_property(UUID) TO authenticated;

-- =====================================================
-- STEP 2: Fix TENANTS Policies
-- =====================================================

DROP POLICY IF EXISTS "tenants_select_active" ON tenants;
CREATE POLICY "tenants_select_active"
  ON tenants FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "tenants_select_own" ON tenants;
CREATE POLICY "tenants_select_own"
  ON tenants FOR SELECT
  USING (id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "tenants_select_host_own" ON tenants;
CREATE POLICY "tenants_select_host_own"
  ON tenants FOR SELECT
  USING (public.current_user_owns_tenant(id));

DROP POLICY IF EXISTS "tenants_update_host" ON tenants;
DROP POLICY IF EXISTS "tenants_update_own_host" ON tenants;
DROP POLICY IF EXISTS "hosts_update_own_tenant" ON tenants;
DROP POLICY IF EXISTS "host_update_tenant" ON tenants;

CREATE POLICY "tenants_update_host"
  ON tenants FOR UPDATE
  USING (public.current_user_owns_tenant(id))
  WITH CHECK (public.current_user_owns_tenant(id));

DROP POLICY IF EXISTS "tenants_all_super_admin" ON tenants;
CREATE POLICY "tenants_all_super_admin"
  ON tenants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =====================================================
-- STEP 3: Fix PROFILES Policies (CRITICAL FIX)
-- Remove the circular dependency by NOT querying bookings
-- =====================================================

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_super_admin" ON profiles;
CREATE POLICY "profiles_select_super_admin"
  ON profiles FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "profiles_all_super_admin" ON profiles;
CREATE POLICY "profiles_all_super_admin"
  ON profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- FIXED: Host can see profiles in their tenant OR guests who booked at their property
-- Uses SECURITY DEFINER functions to avoid circular dependency
DROP POLICY IF EXISTS "profiles_select_host_guests" ON profiles;
CREATE POLICY "profiles_select_host_guests"
  ON profiles FOR SELECT
  USING (
    -- Host can see profiles in their own tenant
    tenant_id = public.get_host_tenant_id_safe()
    OR
    -- Host can see guests who booked at their property
    public.is_guest_of_host_property(id)
  );

-- =====================================================
-- STEP 4: Fix ROOMS Policies
-- =====================================================

DROP POLICY IF EXISTS "rooms_select_active" ON rooms;
CREATE POLICY "rooms_select_active"
  ON rooms FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "rooms_select_host" ON rooms;
CREATE POLICY "rooms_select_host"
  ON rooms FOR SELECT
  USING (public.current_user_owns_tenant(tenant_id));

DROP POLICY IF EXISTS "rooms_all_host" ON rooms;
CREATE POLICY "rooms_all_host"
  ON rooms FOR ALL
  USING (public.current_user_owns_tenant(tenant_id))
  WITH CHECK (public.current_user_owns_tenant(tenant_id));

DROP POLICY IF EXISTS "rooms_all_super_admin" ON rooms;
CREATE POLICY "rooms_all_super_admin"
  ON rooms FOR ALL
  USING (public.is_super_admin());

-- =====================================================
-- STEP 5: Fix BOOKINGS Policies
-- =====================================================

DROP POLICY IF EXISTS "bookings_select_own" ON bookings;
CREATE POLICY "bookings_select_own"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookings_insert_own" ON bookings;
CREATE POLICY "bookings_insert_own"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookings_update_own" ON bookings;
CREATE POLICY "bookings_update_own"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending', 'awaiting_payment'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookings_delete_own_pending" ON bookings;
CREATE POLICY "bookings_delete_own_pending"
  ON bookings FOR DELETE
  USING (auth.uid() = user_id AND status IN ('pending', 'awaiting_payment'));

DROP POLICY IF EXISTS "bookings_select_host" ON bookings;
CREATE POLICY "bookings_select_host"
  ON bookings FOR SELECT
  USING (public.current_user_owns_tenant(tenant_id));

DROP POLICY IF EXISTS "bookings_update_host" ON bookings;
CREATE POLICY "bookings_update_host"
  ON bookings FOR UPDATE
  USING (public.current_user_owns_tenant(tenant_id))
  WITH CHECK (public.current_user_owns_tenant(tenant_id));

DROP POLICY IF EXISTS "bookings_all_super_admin" ON bookings;
CREATE POLICY "bookings_all_super_admin"
  ON bookings FOR ALL
  USING (public.is_super_admin());

-- =====================================================
-- STEP 6: Fix ROOM_AVAILABILITY Policies
-- Use SECURITY DEFINER function instead of EXISTS on rooms
-- =====================================================

DROP POLICY IF EXISTS "room_availability_select_all" ON room_availability;
CREATE POLICY "room_availability_select_all"
  ON room_availability FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "room_availability_select_host" ON room_availability;
CREATE POLICY "room_availability_select_host"
  ON room_availability FOR SELECT
  USING (public.host_owns_room(room_id));

DROP POLICY IF EXISTS "room_availability_insert_host" ON room_availability;
CREATE POLICY "room_availability_insert_host"
  ON room_availability FOR INSERT
  WITH CHECK (public.host_owns_room(room_id));

DROP POLICY IF EXISTS "room_availability_update_host" ON room_availability;
CREATE POLICY "room_availability_update_host"
  ON room_availability FOR UPDATE
  USING (public.host_owns_room(room_id))
  WITH CHECK (public.host_owns_room(room_id));

DROP POLICY IF EXISTS "room_availability_delete_host" ON room_availability;
CREATE POLICY "room_availability_delete_host"
  ON room_availability FOR DELETE
  USING (public.host_owns_room(room_id));

DROP POLICY IF EXISTS "room_availability_all_super_admin" ON room_availability;
CREATE POLICY "room_availability_all_super_admin"
  ON room_availability FOR ALL
  USING (public.is_super_admin());

-- =====================================================
-- STEP 7: Fix NOTIFICATION_QUEUE Policies
-- Use SECURITY DEFINER function instead of EXISTS on profiles
-- =====================================================

DROP POLICY IF EXISTS "Hosts can view tenant notifications" ON notification_queue;
CREATE POLICY "notification_queue_select_host"
  ON notification_queue FOR SELECT
  USING (public.host_owns_notification(tenant_id));

DROP POLICY IF EXISTS "notification_queue_all_super_admin" ON notification_queue;
CREATE POLICY "notification_queue_all_super_admin"
  ON notification_queue FOR ALL
  USING (public.is_super_admin());

-- =====================================================
-- STEP 8: Fix SUBSCRIPTION_PAYMENTS Policies
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

DROP POLICY IF EXISTS "subscription_payments_all_super_admin" ON subscription_payments;
CREATE POLICY "subscription_payments_all_super_admin"
  ON subscription_payments FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =====================================================
-- DONE: All RLS policies now use SECURITY DEFINER functions
-- that prevent circular dependencies.
--
-- Key changes:
-- 1. All helper functions are SECURITY DEFINER with error handling
-- 2. profiles_select_host_guests NO LONGER queries bookings table
-- 3. room_availability uses host_owns_room() function
-- 4. notification_queue uses host_owns_notification() function
-- 5. All cross-table checks bypass RLS via SECURITY DEFINER
-- =====================================================
