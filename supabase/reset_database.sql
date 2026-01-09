-- =====================================================
-- SUPABASE COMPLETE RESET SCRIPT
-- =====================================================
-- WARNING: This script will DELETE ALL DATA!
-- Run this in Supabase SQL Editor with caution.
-- After running this, run production_init.sql to recreate.
-- =====================================================

-- =====================================================
-- STEP 1: DROP ALL TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS prevent_booking_overlap ON bookings;
DROP TRIGGER IF EXISTS trigger_notify_waitlist ON reservation_locks;
DROP TRIGGER IF EXISTS platform_settings_updated_at ON platform_settings;
DROP TRIGGER IF EXISTS set_trial_dates_trigger ON tenants;

-- =====================================================
-- STEP 2: DROP ALL VIEWS
-- =====================================================

DROP VIEW IF EXISTS cookie_consent_stats CASCADE;

-- =====================================================
-- STEP 3: DROP ALL FUNCTIONS
-- =====================================================

-- Helper functions (SECURITY DEFINER)
DROP FUNCTION IF EXISTS public.current_user_owns_tenant(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_host_tenant_id_safe() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_host() CASCADE;
DROP FUNCTION IF EXISTS public.host_owns_room(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.host_owns_notification(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_guest_of_host_property(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.owns_room_tenant(UUID) CASCADE;

-- Business logic functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_booking_conflict(UUID, DATE, DATE, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_dates_blocked(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.check_booking_overlap() CASCADE;
DROP FUNCTION IF EXISTS public.get_room_booked_dates(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_reservation_lock(UUID, DATE, DATE, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.create_reservation_lock(UUID, UUID, DATE, DATE, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.release_reservation_lock(UUID, UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.notify_waitlist_on_lock_release() CASCADE;
DROP FUNCTION IF EXISTS public.check_slip_duplicate_by_hash(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_guest_demographics_by_province(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_tenant_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_upload_tokens() CASCADE;
DROP FUNCTION IF EXISTS public.update_platform_settings_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_tenant_trial_dates() CASCADE;
DROP FUNCTION IF EXISTS public.check_subscription_status(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.log_audit_event(VARCHAR, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, UUID, VARCHAR, UUID, JSONB, JSONB, JSONB, BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_tenant(UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_tenant(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_tenant_guests(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_tenant_bookings(UUID, TEXT) CASCADE;

-- =====================================================
-- STEP 4: DROP ALL TABLES (in correct order due to FK)
-- =====================================================

-- Drop tables with foreign keys first
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS cookie_consent_logs CASCADE;
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS plan_features CASCADE;
DROP TABLE IF EXISTS upload_tokens CASCADE;
DROP TABLE IF EXISTS verified_slips CASCADE;
DROP TABLE IF EXISTS date_waitlist CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;
DROP TABLE IF EXISTS reservation_locks CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS room_availability CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- =====================================================
-- STEP 5: DROP ALL STORAGE POLICIES
-- =====================================================

-- Tenants bucket policies
DROP POLICY IF EXISTS "Public can view tenant files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to tenants" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update tenant files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete tenant files" ON storage.objects;

-- Bookings bucket policies
DROP POLICY IF EXISTS "Public can view booking files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload payment slips" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update booking files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete booking files" ON storage.objects;

-- Subscription proofs bucket policies
DROP POLICY IF EXISTS "subscription_proofs_insert_host" ON storage.objects;
DROP POLICY IF EXISTS "subscription_proofs_update_host" ON storage.objects;
DROP POLICY IF EXISTS "subscription_proofs_select_public" ON storage.objects;
DROP POLICY IF EXISTS "subscription_proofs_delete_super_admin" ON storage.objects;

-- =====================================================
-- STEP 6: DELETE ALL FILES FROM STORAGE BUCKETS
-- =====================================================

-- Delete all objects from tenants bucket
DELETE FROM storage.objects WHERE bucket_id = 'tenants';

-- Delete all objects from bookings bucket
DELETE FROM storage.objects WHERE bucket_id = 'bookings';

-- Delete all objects from subscription-proofs bucket
DELETE FROM storage.objects WHERE bucket_id = 'subscription-proofs';

-- =====================================================
-- STEP 7: DELETE STORAGE BUCKETS
-- =====================================================

DELETE FROM storage.buckets WHERE id = 'tenants';
DELETE FROM storage.buckets WHERE id = 'bookings';
DELETE FROM storage.buckets WHERE id = 'subscription-proofs';

-- =====================================================
-- STEP 8: DELETE ALL USERS FROM AUTH
-- =====================================================
-- WARNING: This deletes ALL users permanently!

-- First, delete all sessions
DELETE FROM auth.sessions;

-- Delete all refresh tokens
DELETE FROM auth.refresh_tokens;

-- Delete all MFA factors
DELETE FROM auth.mfa_factors;

-- Delete all identities (OAuth connections)
DELETE FROM auth.identities;

-- Finally, delete all users
DELETE FROM auth.users;

-- =====================================================
-- VERIFICATION: Check that everything is deleted
-- =====================================================

-- This should return empty results for all queries:
-- SELECT * FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM auth.users;
-- SELECT * FROM storage.buckets;
-- SELECT * FROM storage.objects;

-- =====================================================
-- DONE! Now run production_init.sql to recreate.
-- =====================================================

-- After running this script:
-- 1. Run production_init.sql to recreate all tables, functions, and policies
-- 2. Create your first super_admin user manually or through the app
-- 3. Create your first tenant

SELECT 'Database reset complete! Now run production_init.sql' AS status;
