-- =====================================================
-- FIX: Host RLS Policies Using get_my_tenant_id()
-- =====================================================
-- Issue: Multiple host RLS policies use get_my_tenant_id() which can
-- return NULL due to session timing issues in production.
--
-- Affected policies:
-- 1. tenants_update_host - hosts can't update settings
-- 2. rooms_all_host - hosts can't manage rooms
-- 3. bookings_select_host - hosts can't view bookings
-- 4. bookings_update_host - hosts can't update bookings
--
-- Solution: Replace all with explicit EXISTS checks.
-- =====================================================

-- =====================================================
-- FIX 1: tenants_update_host
-- =====================================================
DROP POLICY IF EXISTS "tenants_update_host" ON tenants;

CREATE POLICY "tenants_update_host"
  ON tenants FOR UPDATE
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = tenants.id
    )
  )
  WITH CHECK (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = tenants.id
    )
  );

-- =====================================================
-- FIX 2: rooms_all_host
-- =====================================================
DROP POLICY IF EXISTS "rooms_all_host" ON rooms;

CREATE POLICY "rooms_all_host"
  ON rooms FOR ALL
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = rooms.tenant_id
    )
  )
  WITH CHECK (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = rooms.tenant_id
    )
  );

-- =====================================================
-- FIX 3: bookings_select_host
-- =====================================================
DROP POLICY IF EXISTS "bookings_select_host" ON bookings;

CREATE POLICY "bookings_select_host"
  ON bookings FOR SELECT
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = bookings.tenant_id
    )
  );

-- =====================================================
-- FIX 4: bookings_update_host
-- =====================================================
DROP POLICY IF EXISTS "bookings_update_host" ON bookings;

CREATE POLICY "bookings_update_host"
  ON bookings FOR UPDATE
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = bookings.tenant_id
    )
  )
  WITH CHECK (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = bookings.tenant_id
    )
  );

-- =====================================================
-- FIX 5: rooms_select_host (also uses get_my_tenant_id)
-- =====================================================
DROP POLICY IF EXISTS "rooms_select_host" ON rooms;

CREATE POLICY "rooms_select_host"
  ON rooms FOR SELECT
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'host'
      AND profiles.tenant_id = rooms.tenant_id
    )
  );
