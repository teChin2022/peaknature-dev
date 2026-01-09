-- =====================================================
-- FIX: RLS Circular Dependency Causing 500 Errors
-- =====================================================
-- Issue: Migration 050 used raw EXISTS clauses in policies
-- that are NOT SECURITY DEFINER, causing circular RLS evaluation:
--   1. Query profiles with JOIN to tenants
--   2. tenants policy uses EXISTS (SELECT FROM profiles)
--   3. profiles policy queries bookings
--   4. bookings policy uses EXISTS (SELECT FROM profiles)
--   → Infinite loop → 500 Internal Server Error
--
-- Solution: Create SECURITY DEFINER functions that bypass RLS
-- when checking tenant ownership.
-- =====================================================

-- =====================================================
-- STEP 1: Create SECURITY DEFINER helper function
-- =====================================================

-- Function to check if current user owns a specific tenant
-- SECURITY DEFINER bypasses RLS on profiles table
CREATE OR REPLACE FUNCTION public.owns_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'host'
    AND profiles.tenant_id = p_tenant_id
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if a tenant belongs to current user by room's tenant_id
-- Used for rooms and bookings policies
CREATE OR REPLACE FUNCTION public.owns_room_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'host'
    AND profiles.tenant_id = p_tenant_id
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 2: Fix tenants policies
-- =====================================================
DROP POLICY IF EXISTS "tenants_select_host_own" ON tenants;

CREATE POLICY "tenants_select_host_own"
  ON tenants FOR SELECT
  USING (public.owns_tenant(id));

DROP POLICY IF EXISTS "tenants_update_host" ON tenants;

CREATE POLICY "tenants_update_host"
  ON tenants FOR UPDATE
  USING (public.owns_tenant(id))
  WITH CHECK (public.owns_tenant(id));

-- =====================================================
-- STEP 3: Fix rooms policies
-- =====================================================
DROP POLICY IF EXISTS "rooms_select_host" ON rooms;

CREATE POLICY "rooms_select_host"
  ON rooms FOR SELECT
  USING (public.owns_room_tenant(tenant_id));

DROP POLICY IF EXISTS "rooms_all_host" ON rooms;

CREATE POLICY "rooms_all_host"
  ON rooms FOR ALL
  USING (public.owns_room_tenant(tenant_id))
  WITH CHECK (public.owns_room_tenant(tenant_id));

-- =====================================================
-- STEP 4: Fix bookings policies
-- =====================================================
DROP POLICY IF EXISTS "bookings_select_host" ON bookings;

CREATE POLICY "bookings_select_host"
  ON bookings FOR SELECT
  USING (public.owns_room_tenant(tenant_id));

DROP POLICY IF EXISTS "bookings_update_host" ON bookings;

CREATE POLICY "bookings_update_host"
  ON bookings FOR UPDATE
  USING (public.owns_room_tenant(tenant_id))
  WITH CHECK (public.owns_room_tenant(tenant_id));

-- =====================================================
-- STEP 5: Fix profiles_select_host_guests policy
-- This policy also causes issues - simplify it
-- =====================================================
DROP POLICY IF EXISTS "profiles_select_host_guests" ON profiles;

CREATE POLICY "profiles_select_host_guests"
  ON profiles FOR SELECT
  USING (
    public.is_host() 
    AND (
      -- Host can see their own tenant's users
      tenant_id = public.get_my_tenant_id()
      OR
      -- Host can see guests who booked at their property
      -- Use a simple subquery that doesn't trigger complex RLS
      id IN (
        SELECT DISTINCT b.user_id 
        FROM bookings b
        WHERE b.tenant_id = public.get_my_tenant_id()
      )
    )
  );

-- =====================================================
-- DONE: All policies now use SECURITY DEFINER functions
-- that bypass RLS when checking ownership, preventing
-- circular dependency issues.
-- =====================================================
