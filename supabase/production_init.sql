-- =====================================================
-- PRODUCTION INIT SQL
-- =====================================================
-- This file is a consolidated version of all migrations.
-- Generated from migration files 001-053.
-- Last updated: 2026-01-09
-- =====================================================

-- =====================================================
-- SECTION 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SECTION 2: TABLES
-- =====================================================

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  stripe_account_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Subscription fields (from 033_subscription_system.sql)
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  subscription_status TEXT DEFAULT 'trial' 
    CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled')),
  -- Settings JSON (from 007_tenant_settings.sql)
  settings JSONB DEFAULT '{
    "currency": "THB",
    "hero": {
      "tagline": "Highly Rated Homestay",
      "description": "Discover comfort and tranquility in our carefully curated spaces. Your perfect retreat awaits with authentic hospitality and modern amenities.",
      "images": []
    },
    "amenities": [
      {"id": "wifi", "name": "Free WiFi", "icon": "wifi", "enabled": true},
      {"id": "parking", "name": "Free Parking", "icon": "car", "enabled": true},
      {"id": "breakfast", "name": "Breakfast", "icon": "coffee", "enabled": true},
      {"id": "kitchen", "name": "Kitchen", "icon": "utensils", "enabled": true},
      {"id": "ac", "name": "Air Conditioning", "icon": "wind", "enabled": true},
      {"id": "tv", "name": "Smart TV", "icon": "tv", "enabled": true}
    ],
    "contact": {
      "address": "",
      "city": "",
      "postal_code": "",
      "country": "",
      "phone": "",
      "email": "",
      "directions": "",
      "map_url": "",
      "map_embed": ""
    },
    "stats": {
      "show_stats": true,
      "rating": "4.9",
      "guest_count": "500+",
      "custom_stat_label": "Cozy Rooms",
      "custom_stat_value": ""
    },
    "social": {
      "facebook": "",
      "instagram": "",
      "twitter": "",
      "line": "",
      "whatsapp": ""
    },
    "payment": {
      "promptpay_id": "",
      "promptpay_name": "",
      "qr_code_url": "",
      "bank_name": "",
      "bank_account": ""
    }
  }'::jsonb
);

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'guest' CHECK (role IN ('super_admin', 'host', 'guest')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  is_blocked BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Location fields (from 017_add_location_fields.sql)
  province TEXT,
  district TEXT,
  sub_district TEXT,
  -- Locale (from 026_add_locale_to_profiles.sql)
  locale VARCHAR(5) DEFAULT 'th'
);

-- Create unique constraint for email per tenant
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_tenant_unique ON profiles(email, tenant_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_super_admin_unique ON profiles(email) WHERE role = 'super_admin';

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  base_price DECIMAL(10,2) NOT NULL,
  max_guests INT NOT NULL DEFAULT 2,
  amenities TEXT[] DEFAULT '{}',
  rules TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  check_in_time TEXT DEFAULT '14:00',
  check_out_time TEXT DEFAULT '11:00',
  min_nights INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table (updated with payment fields from 012_payment_system.sql and 015_add_awaiting_payment_status.sql)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed')),
  stripe_payment_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Payment fields (from 012_payment_system.sql)
  payment_slip_url TEXT,
  payment_verified_at TIMESTAMPTZ,
  payment_ref TEXT,
  easyslip_data JSONB,
  payment_amount DECIMAL(10,2),
  CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- Room availability (blocked dates and price overrides)
CREATE TABLE IF NOT EXISTS room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_blocked BOOLEAN DEFAULT TRUE,
  price_override DECIMAL(10,2),
  UNIQUE(room_id, date)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id) -- One review per booking
);

-- Reservation locks table (from 012_payment_system.sql)
CREATE TABLE IF NOT EXISTS reservation_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_room_date_lock UNIQUE (room_id, check_in, check_out)
);

-- Notification queue (from 012_payment_system.sql)
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'line')),
  recipient TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Date waitlist (from 012_payment_system.sql)
CREATE TABLE IF NOT EXISTS date_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_waitlist_entry UNIQUE (room_id, user_id, check_in, check_out)
);

-- Verified slips (from 016_prevent_slip_reuse.sql, 043_add_unique_slip_url_hash.sql)
CREATE TABLE IF NOT EXISTS verified_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_ref TEXT,
  slip_url_hash TEXT NOT NULL,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2),
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  slip_url TEXT,
  easyslip_data JSONB,
  CONSTRAINT unique_trans_ref_if_not_null UNIQUE (trans_ref),
  CONSTRAINT unique_slip_url_hash UNIQUE (slip_url_hash)
);

-- Upload tokens (from 024_upload_tokens.sql, 045_add_content_hash_to_upload_tokens.sql)
CREATE TABLE IF NOT EXISTS upload_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  slip_url TEXT,
  is_uploaded BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  slip_content_hash TEXT
);

-- Platform settings (from 027_platform_settings.sql, 029_add_line_to_platform_settings.sql)
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name VARCHAR(255) DEFAULT 'Homestay Booking',
  support_email VARCHAR(255) DEFAULT 'support@homestay.com',
  default_currency VARCHAR(10) DEFAULT 'thb',
  default_timezone VARCHAR(50) DEFAULT 'gmt7',
  smtp_host VARCHAR(255) DEFAULT '',
  smtp_port INTEGER DEFAULT 587,
  from_email VARCHAR(255) DEFAULT '',
  from_name VARCHAR(255) DEFAULT 'Homestay Booking',
  promptpay_name VARCHAR(255) DEFAULT '',
  promptpay_qr_url TEXT DEFAULT '',
  platform_fee_percent DECIMAL(5,2) DEFAULT 10.00,
  line_channel_access_token TEXT DEFAULT '',
  line_user_id VARCHAR(50) DEFAULT '',
  require_email_verification BOOLEAN DEFAULT true,
  require_2fa_admin BOOLEAN DEFAULT false,
  notify_new_tenant BOOLEAN DEFAULT true,
  notify_daily_summary BOOLEAN DEFAULT true,
  notify_errors BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription payments (from 033_subscription_system.sql)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'THB',
  payment_method TEXT DEFAULT 'promptpay',
  payment_proof_url TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan features (from 033_subscription_system.sql)
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  limit_value INT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan, feature_key)
);

-- Cookie consent logs (from 035_cookie_consent_logs.sql)
CREATE TABLE IF NOT EXISTS cookie_consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  consent_status TEXT NOT NULL CHECK (consent_status IN ('accepted', 'declined')),
  consent_categories JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  page_url TEXT,
  country_code TEXT,
  region TEXT,
  privacy_policy_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (from 039_audit_logs.sql)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  action VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  actor_role VARCHAR(50),
  actor_ip VARCHAR(45),
  actor_user_agent TEXT,
  target_type VARCHAR(50),
  target_id UUID,
  target_name VARCHAR(255),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  old_value JSONB,
  new_value JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- =====================================================
-- SECTION 3: INDEXES
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_province ON profiles(province);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON profiles(district);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_province ON profiles(tenant_id, province);

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active) WHERE is_active = TRUE;

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);

-- Room availability indexes
CREATE INDEX IF NOT EXISTS idx_room_availability_room ON room_availability(room_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_date ON room_availability(date);

-- Tenants indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_settings ON tenants USING GIN (settings);

-- Reservation locks indexes
CREATE INDEX IF NOT EXISTS idx_reservation_locks_room_dates ON reservation_locks(room_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservation_locks_expires ON reservation_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_reservation_locks_user ON reservation_locks(user_id);

-- Notification queue indexes
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status, created_at);

-- Date waitlist indexes
CREATE INDEX IF NOT EXISTS idx_date_waitlist_room_dates ON date_waitlist(room_id, check_in, check_out);

-- Verified slips indexes
CREATE INDEX IF NOT EXISTS idx_verified_slips_trans_ref ON verified_slips(trans_ref);
CREATE INDEX IF NOT EXISTS idx_verified_slips_slip_url_hash ON verified_slips(slip_url_hash);
CREATE INDEX IF NOT EXISTS idx_verified_slips_tenant ON verified_slips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_verified_slips_booking_id ON verified_slips(booking_id);

-- Upload tokens indexes
CREATE INDEX IF NOT EXISTS idx_upload_tokens_token ON upload_tokens(token);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_expires ON upload_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_content_hash ON upload_tokens(slip_content_hash);

-- Cookie consent logs indexes
CREATE INDEX IF NOT EXISTS idx_cookie_consent_created_at ON cookie_consent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user_id ON cookie_consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_ip ON cookie_consent_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_status ON cookie_consent_logs(consent_status);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- =====================================================
-- SECTION 4: HELPER FUNCTIONS (SECURITY DEFINER)
-- These are used in RLS policies to avoid circular dependencies
-- From 053_fix_all_rls_circular_dependencies.sql
-- =====================================================

-- 4.1: Check if current user owns a specific tenant
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

-- 4.2: Get current user's tenant ID (safe version)
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

-- 4.3: Get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_role;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4.4: Get host's tenant ID (only for hosts)
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

-- 4.5: Check if user is super admin
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

-- 4.6: Check if user is host
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

-- 4.7: Check if room belongs to host's tenant (bypasses rooms RLS)
CREATE OR REPLACE FUNCTION public.host_owns_room(check_room_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
  v_host_tenant_id UUID;
BEGIN
  IF check_room_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT tenant_id INTO v_host_tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
  LIMIT 1;
  
  IF v_host_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
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

-- 4.8: Check if notification belongs to host's tenant
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

-- 4.9: Check if a profile is a guest who booked at host's property
CREATE OR REPLACE FUNCTION public.is_guest_of_host_property(check_profile_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN := FALSE;
  v_host_tenant_id UUID;
BEGIN
  IF check_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT tenant_id INTO v_host_tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'host'
  LIMIT 1;
  
  IF v_host_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
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

-- =====================================================
-- SECTION 5: BUSINESS LOGIC FUNCTIONS
-- =====================================================

-- Handle new user registration (from 025_fix_handle_new_user.sql)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_tenant_id UUID;
  v_phone TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );
  
  v_phone := NEW.raw_user_meta_data->>'phone';
  
  BEGIN
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, tenant_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_phone,
    v_avatar_url,
    v_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'guest')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id);
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check booking conflict (from 001_initial_schema.sql)
CREATE OR REPLACE FUNCTION check_booking_conflict(
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  conflict_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE room_id = p_room_id
      AND status NOT IN ('cancelled')
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND (check_in, check_out) OVERLAPS (p_check_in, p_check_out)
  ) INTO conflict_exists;
  
  RETURN conflict_exists;
END;
$$ LANGUAGE plpgsql;

-- Check if dates are blocked (from 001_initial_schema.sql)
CREATE OR REPLACE FUNCTION check_dates_blocked(
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  blocked_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM room_availability
    WHERE room_id = p_room_id
      AND is_blocked = TRUE
      AND date >= p_check_in
      AND date < p_check_out
  ) INTO blocked_exists;
  
  RETURN blocked_exists;
END;
$$ LANGUAGE plpgsql;

-- Check booking overlap trigger function (from 010_prevent_double_booking.sql)
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  overlap_count INTEGER;
BEGIN
  IF NEW.status IN ('pending', 'confirmed') THEN
    SELECT COUNT(*) INTO overlap_count
    FROM bookings
    WHERE room_id = NEW.room_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status IN ('pending', 'confirmed')
      AND check_in < NEW.check_out
      AND check_out > NEW.check_in;
    
    IF overlap_count > 0 THEN
      RAISE EXCEPTION 'Booking dates overlap with an existing booking for this room';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get room booked dates (from 011_get_room_booked_dates.sql)
CREATE OR REPLACE FUNCTION public.get_room_booked_dates(p_room_id UUID)
RETURNS TABLE (
  check_in DATE,
  check_out DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.check_in,
    b.check_out
  FROM public.bookings b
  WHERE b.room_id = p_room_id
    AND b.status IN ('pending', 'confirmed')
    AND b.check_out >= CURRENT_DATE
  ORDER BY b.check_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check reservation lock (from 012_payment_system.sql)
CREATE OR REPLACE FUNCTION check_reservation_lock(
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_by UUID,
  expires_at TIMESTAMPTZ,
  seconds_remaining INTEGER
) AS $$
BEGIN
  DELETE FROM reservation_locks WHERE expires_at < NOW();
  
  RETURN QUERY
  SELECT 
    TRUE AS is_locked,
    rl.user_id AS locked_by,
    rl.expires_at,
    EXTRACT(EPOCH FROM (rl.expires_at - NOW()))::INTEGER AS seconds_remaining
  FROM reservation_locks rl
  WHERE rl.room_id = p_room_id
    AND rl.check_in < p_check_out
    AND rl.check_out > p_check_in
    AND (p_user_id IS NULL OR rl.user_id != p_user_id)
    AND rl.expires_at > NOW()
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ, NULL::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create reservation lock (from 012_payment_system.sql)
CREATE OR REPLACE FUNCTION create_reservation_lock(
  p_room_id UUID,
  p_user_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_timeout_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
  success BOOLEAN,
  lock_id UUID,
  expires_at TIMESTAMPTZ,
  error_message TEXT
) AS $$
DECLARE
  v_lock_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_existing_lock RECORD;
BEGIN
  DELETE FROM reservation_locks WHERE expires_at < NOW();
  
  SELECT * INTO v_existing_lock
  FROM reservation_locks rl
  WHERE rl.room_id = p_room_id
    AND rl.check_in < p_check_out
    AND rl.check_out > p_check_in
    AND rl.user_id != p_user_id
    AND rl.expires_at > NOW()
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, v_existing_lock.expires_at, 
      'Dates are locked by another guest'::TEXT;
    RETURN;
  END IF;
  
  SELECT id, rl.expires_at INTO v_lock_id, v_expires_at
  FROM reservation_locks rl
  WHERE room_id = p_room_id
    AND user_id = p_user_id
    AND check_in = p_check_in
    AND check_out = p_check_out;
  
  IF FOUND THEN
    v_expires_at := NOW() + (p_timeout_minutes || ' minutes')::INTERVAL;
    UPDATE reservation_locks 
    SET expires_at = v_expires_at
    WHERE id = v_lock_id;
    
    RETURN QUERY SELECT TRUE, v_lock_id, v_expires_at, NULL::TEXT;
    RETURN;
  END IF;
  
  v_expires_at := NOW() + (p_timeout_minutes || ' minutes')::INTERVAL;
  
  INSERT INTO reservation_locks (room_id, user_id, check_in, check_out, expires_at)
  VALUES (p_room_id, p_user_id, p_check_in, p_check_out, v_expires_at)
  RETURNING id INTO v_lock_id;
  
  RETURN QUERY SELECT TRUE, v_lock_id, v_expires_at, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release reservation lock (from 012_payment_system.sql)
CREATE OR REPLACE FUNCTION release_reservation_lock(
  p_room_id UUID,
  p_user_id UUID,
  p_check_in DATE,
  p_check_out DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM reservation_locks
  WHERE room_id = p_room_id
    AND user_id = p_user_id
    AND check_in = p_check_in
    AND check_out = p_check_out;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify waitlist on lock release (from 012_payment_system.sql)
CREATE OR REPLACE FUNCTION notify_waitlist_on_lock_release()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE date_waitlist
  SET notified = FALSE
  WHERE room_id = OLD.room_id
    AND check_in < OLD.check_out
    AND check_out > OLD.check_in
    AND notified = FALSE;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Check slip duplicate by hash (from 016_prevent_slip_reuse.sql)
CREATE OR REPLACE FUNCTION check_slip_duplicate_by_hash(p_slip_url_hash TEXT)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  original_booking_id UUID,
  verified_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_duplicate,
    vs.booking_id as original_booking_id,
    vs.verified_at
  FROM verified_slips vs
  WHERE vs.slip_url_hash = p_slip_url_hash
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get guest demographics by province (from 017_add_location_fields.sql)
CREATE OR REPLACE FUNCTION get_guest_demographics_by_province(p_tenant_id UUID)
RETURNS TABLE (
  province TEXT,
  guest_count BIGINT,
  booking_count BIGINT,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.province,
    COUNT(DISTINCT p.id) as guest_count,
    COUNT(b.id) as booking_count,
    COALESCE(SUM(b.total_price), 0) as total_revenue
  FROM profiles p
  LEFT JOIN bookings b ON b.user_id = p.id AND b.tenant_id = p_tenant_id AND b.status IN ('confirmed', 'completed')
  WHERE p.tenant_id = p_tenant_id
    AND p.province IS NOT NULL
  GROUP BY p.province
  ORDER BY guest_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get tenant stats (from 020_tenant_stats_function.sql)
CREATE OR REPLACE FUNCTION public.get_tenant_stats(p_tenant_id UUID)
RETURNS TABLE (
  average_rating NUMERIC,
  total_reviews INT,
  guest_count INT,
  room_count INT
) AS $$
BEGIN
  RETURN QUERY
  WITH review_stats AS (
    SELECT 
      CASE 
        WHEN COUNT(r.id) > 0 THEN ROUND(AVG(r.rating)::NUMERIC, 1)
        ELSE NULL
      END as avg_rating,
      COUNT(r.id)::INT as review_count
    FROM public.reviews r
    INNER JOIN public.bookings b ON r.booking_id = b.id
    WHERE b.tenant_id = p_tenant_id
  ),
  guest_stats AS (
    SELECT COUNT(DISTINCT user_id)::INT as unique_guests
    FROM public.bookings
    WHERE bookings.tenant_id = p_tenant_id
    AND status IN ('confirmed', 'completed')
  ),
  room_stats AS (
    SELECT COUNT(*)::INT as active_rooms
    FROM public.rooms
    WHERE tenant_id = p_tenant_id AND is_active = true
  )
  SELECT 
    rs.avg_rating,
    rs.review_count,
    gs.unique_guests,
    rms.active_rooms
  FROM review_stats rs, guest_stats gs, room_stats rms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Cleanup expired upload tokens (from 024_upload_tokens.sql)
CREATE OR REPLACE FUNCTION cleanup_expired_upload_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM upload_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update platform settings updated_at (from 027_platform_settings.sql)
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set tenant trial dates (from 033_subscription_system.sql)
CREATE OR REPLACE FUNCTION set_tenant_trial_dates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trial_started_at := NOW();
  NEW.trial_ends_at := NOW() + INTERVAL '2 months';
  NEW.subscription_status := 'trial';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check subscription status (from 033_subscription_system.sql)
CREATE OR REPLACE FUNCTION check_subscription_status(tenant_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  tenant_record RECORD;
  current_status TEXT;
BEGIN
  SELECT * INTO tenant_record FROM tenants WHERE id = tenant_uuid;
  
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  
  IF tenant_record.subscription_status = 'trial' AND tenant_record.trial_ends_at < NOW() THEN
    IF EXISTS (
      SELECT 1 FROM subscription_payments 
      WHERE tenant_id = tenant_uuid 
      AND status = 'verified'
      AND period_end >= CURRENT_DATE
    ) THEN
      current_status := 'active';
    ELSE
      current_status := 'expired';
    END IF;
    
    UPDATE tenants SET subscription_status = current_status WHERE id = tenant_uuid;
    RETURN current_status;
  END IF;
  
  IF tenant_record.subscription_status = 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM subscription_payments 
      WHERE tenant_id = tenant_uuid 
      AND status = 'verified'
      AND period_end >= CURRENT_DATE
    ) THEN
      current_status := 'expired';
      UPDATE tenants SET subscription_status = current_status WHERE id = tenant_uuid;
      RETURN current_status;
    END IF;
  END IF;
  
  RETURN tenant_record.subscription_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log audit event (from 039_audit_logs.sql)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action VARCHAR(100),
  p_category VARCHAR(50),
  p_severity VARCHAR(20) DEFAULT 'info',
  p_actor_id UUID DEFAULT NULL,
  p_actor_email VARCHAR(255) DEFAULT NULL,
  p_actor_role VARCHAR(50) DEFAULT NULL,
  p_actor_ip VARCHAR(45) DEFAULT NULL,
  p_actor_user_agent TEXT DEFAULT NULL,
  p_target_type VARCHAR(50) DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_target_name VARCHAR(255) DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action, category, severity,
    actor_id, actor_email, actor_role, actor_ip, actor_user_agent,
    target_type, target_id, target_name,
    tenant_id, details, old_value, new_value,
    success, error_message
  ) VALUES (
    p_action, p_category, p_severity,
    p_actor_id, p_actor_email, p_actor_role, p_actor_ip, p_actor_user_agent,
    p_target_type, p_target_id, p_target_name,
    p_tenant_id, p_details, p_old_value, p_new_value,
    p_success, p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Admin update tenant (from 046_admin_tenant_functions.sql)
CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  p_tenant_id UUID,
  p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin required';
  END IF;

  UPDATE public.tenants
  SET
    is_active = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active),
    name = COALESCE(p_updates->>'name', name),
    slug = COALESCE(p_updates->>'slug', slug),
    primary_color = COALESCE(p_updates->>'primary_color', primary_color),
    plan = COALESCE(p_updates->>'plan', plan)
  WHERE id = p_tenant_id
  RETURNING * INTO v_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  SELECT jsonb_build_object(
    'id', v_tenant.id,
    'name', v_tenant.name,
    'slug', v_tenant.slug,
    'is_active', v_tenant.is_active,
    'plan', v_tenant.plan,
    'primary_color', v_tenant.primary_color
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin delete tenant (from 046_admin_tenant_functions.sql)
CREATE OR REPLACE FUNCTION public.admin_delete_tenant(
  p_tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin required';
  END IF;

  DELETE FROM public.tenants WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get tenant guests (from 005_get_tenant_guests_function.sql)
CREATE OR REPLACE FUNCTION public.get_tenant_guests(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  tenant_id UUID,
  is_blocked BOOLEAN,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'host' 
      AND profiles.tenant_id = p_tenant_id
    )
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not have permission to view guests for this tenant';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.tenant_id,
    p.is_blocked,
    p.avatar_url,
    p.created_at
  FROM public.profiles p
  WHERE p.tenant_id = p_tenant_id
    AND p.role = 'guest'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get tenant bookings (from 041_add_slip_to_bookings_function.sql)
CREATE OR REPLACE FUNCTION public.get_tenant_bookings(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  room_id UUID,
  user_id UUID,
  check_in DATE,
  check_out DATE,
  guests INT,
  total_price DECIMAL,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  room_name TEXT,
  guest_full_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  payment_slip_url TEXT
) AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'host' 
      AND profiles.tenant_id = p_tenant_id
    )
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.tenant_id,
    b.room_id,
    b.user_id,
    b.check_in,
    b.check_out,
    b.guests,
    b.total_price,
    b.status,
    b.notes,
    b.created_at,
    r.name as room_name,
    p.full_name as guest_full_name,
    p.email as guest_email,
    p.phone as guest_phone,
    b.payment_slip_url
  FROM public.bookings b
  LEFT JOIN public.rooms r ON r.id = b.room_id
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.tenant_id = p_tenant_id
  AND (p_status IS NULL OR b.status = p_status)
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 6: TRIGGERS
-- =====================================================

-- Trigger for new user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to prevent booking overlap
DROP TRIGGER IF EXISTS prevent_booking_overlap ON bookings;
CREATE TRIGGER prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_overlap();

-- Trigger to notify waitlist when lock expires/released
DROP TRIGGER IF EXISTS trigger_notify_waitlist ON reservation_locks;
CREATE TRIGGER trigger_notify_waitlist
  AFTER DELETE ON reservation_locks
  FOR EACH ROW
  EXECUTE FUNCTION notify_waitlist_on_lock_release();

-- Trigger for platform settings updated_at
DROP TRIGGER IF EXISTS platform_settings_updated_at ON platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

-- Trigger for new tenant trial dates
DROP TRIGGER IF EXISTS set_trial_dates_trigger ON tenants;
CREATE TRIGGER set_trial_dates_trigger
  BEFORE INSERT ON tenants
  FOR EACH ROW
  WHEN (NEW.trial_started_at IS NULL)
  EXECUTE FUNCTION set_tenant_trial_dates();

-- =====================================================
-- SECTION 7: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 8: RLS POLICIES
-- From 053_fix_all_rls_circular_dependencies.sql (final consolidated version)
-- =====================================================

-- -----------------------------------------------------
-- TENANTS POLICIES
-- -----------------------------------------------------

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
CREATE POLICY "tenants_update_host"
  ON tenants FOR UPDATE
  USING (public.current_user_owns_tenant(id))
  WITH CHECK (public.current_user_owns_tenant(id));

DROP POLICY IF EXISTS "tenants_all_super_admin" ON tenants;
CREATE POLICY "tenants_all_super_admin"
  ON tenants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- -----------------------------------------------------
-- PROFILES POLICIES
-- -----------------------------------------------------

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

-- Host can see profiles in their tenant OR guests who booked at their property
DROP POLICY IF EXISTS "profiles_select_host_guests" ON profiles;
CREATE POLICY "profiles_select_host_guests"
  ON profiles FOR SELECT
  USING (
    tenant_id = public.get_host_tenant_id_safe()
    OR
    public.is_guest_of_host_property(id)
  );

-- -----------------------------------------------------
-- ROOMS POLICIES
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- BOOKINGS POLICIES
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- ROOM_AVAILABILITY POLICIES
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- REVIEWS POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all"
  ON reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = reviews.booking_id
      AND bookings.user_id = auth.uid()
      AND bookings.status != 'cancelled'
      AND (
        bookings.status = 'completed' 
        OR bookings.check_out < CURRENT_DATE
      )
    )
  );

DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON reviews;
CREATE POLICY "reviews_delete_own"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_all_super_admin" ON reviews;
CREATE POLICY "reviews_all_super_admin"
  ON reviews FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- RESERVATION_LOCKS POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own locks" ON reservation_locks;
CREATE POLICY "reservation_locks_select_own"
  ON reservation_locks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create locks" ON reservation_locks;
CREATE POLICY "reservation_locks_insert_own"
  ON reservation_locks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own locks" ON reservation_locks;
CREATE POLICY "reservation_locks_delete_own"
  ON reservation_locks FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------
-- NOTIFICATION_QUEUE POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "Hosts can view tenant notifications" ON notification_queue;
DROP POLICY IF EXISTS "notification_queue_select_host" ON notification_queue;
CREATE POLICY "notification_queue_select_host"
  ON notification_queue FOR SELECT
  USING (public.host_owns_notification(tenant_id));

DROP POLICY IF EXISTS "notification_queue_all_super_admin" ON notification_queue;
CREATE POLICY "notification_queue_all_super_admin"
  ON notification_queue FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- DATE_WAITLIST POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "Users can view their waitlist entries" ON date_waitlist;
CREATE POLICY "date_waitlist_select_own"
  ON date_waitlist FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to waitlist" ON date_waitlist;
CREATE POLICY "date_waitlist_insert_own"
  ON date_waitlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from waitlist" ON date_waitlist;
CREATE POLICY "date_waitlist_delete_own"
  ON date_waitlist FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------
-- VERIFIED_SLIPS POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "Anyone can check duplicates" ON verified_slips;
CREATE POLICY "verified_slips_select_all"
  ON verified_slips FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert" ON verified_slips;
CREATE POLICY "verified_slips_insert_authenticated"
  ON verified_slips FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- -----------------------------------------------------
-- UPLOAD_TOKENS POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "upload_tokens_select_own" ON upload_tokens;
CREATE POLICY "upload_tokens_select_own"
  ON upload_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "upload_tokens_insert_own" ON upload_tokens;
CREATE POLICY "upload_tokens_insert_own"
  ON upload_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "upload_tokens_update_own" ON upload_tokens;
CREATE POLICY "upload_tokens_update_own"
  ON upload_tokens FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "upload_tokens_delete_own" ON upload_tokens;
CREATE POLICY "upload_tokens_delete_own"
  ON upload_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Allow anonymous access for mobile upload
DROP POLICY IF EXISTS "upload_tokens_select_by_token" ON upload_tokens;
CREATE POLICY "upload_tokens_select_by_token"
  ON upload_tokens FOR SELECT
  TO anon
  USING (
    token IS NOT NULL 
    AND expires_at > NOW()
  );

DROP POLICY IF EXISTS "upload_tokens_update_by_token" ON upload_tokens;
CREATE POLICY "upload_tokens_update_by_token"
  ON upload_tokens FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL 
    AND expires_at > NOW()
    AND is_uploaded = FALSE
  );

-- -----------------------------------------------------
-- PLATFORM_SETTINGS POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "platform_settings_select_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_select_super_admin"
  ON platform_settings FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "platform_settings_public_read" ON platform_settings;
CREATE POLICY "platform_settings_public_read"
  ON platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "platform_settings_insert_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_insert_super_admin"
  ON platform_settings FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "platform_settings_update_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_update_super_admin"
  ON platform_settings FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- -----------------------------------------------------
-- SUBSCRIPTION_PAYMENTS POLICIES
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- PLAN_FEATURES POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "plan_features_select_all" ON plan_features;
CREATE POLICY "plan_features_select_all"
  ON plan_features FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "plan_features_all_super_admin" ON plan_features;
CREATE POLICY "plan_features_all_super_admin"
  ON plan_features FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- COOKIE_CONSENT_LOGS POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "cookie_consent_logs_select_super_admin" ON cookie_consent_logs;
CREATE POLICY "cookie_consent_logs_select_super_admin" 
  ON cookie_consent_logs FOR SELECT 
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "cookie_consent_logs_insert_public" ON cookie_consent_logs;
CREATE POLICY "cookie_consent_logs_insert_public" 
  ON cookie_consent_logs FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "cookie_consent_logs_delete_super_admin" ON cookie_consent_logs;
CREATE POLICY "cookie_consent_logs_delete_super_admin" 
  ON cookie_consent_logs FOR DELETE 
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- AUDIT_LOGS POLICIES
-- -----------------------------------------------------

DROP POLICY IF EXISTS "audit_logs_select_super_admin" ON audit_logs;
CREATE POLICY "audit_logs_select_super_admin"
  ON audit_logs FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "audit_logs_insert_service_role" ON audit_logs;
CREATE POLICY "audit_logs_insert_service_role"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- SECTION 9: STORAGE BUCKETS
-- =====================================================

-- Tenants bucket (QR codes, logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenants', 'tenants', true)
ON CONFLICT (id) DO NOTHING;

-- Bookings bucket (payment slips)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bookings', 'bookings', true)
ON CONFLICT (id) DO NOTHING;

-- Subscription proofs bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('subscription-proofs', 'subscription-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tenants bucket
DROP POLICY IF EXISTS "Public can view tenant files" ON storage.objects;
CREATE POLICY "Public can view tenant files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenants');

DROP POLICY IF EXISTS "Authenticated users can upload to tenants" ON storage.objects;
CREATE POLICY "Authenticated users can upload to tenants"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tenants' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can update tenant files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tenants' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete tenant files" ON storage.objects;
CREATE POLICY "Authenticated users can delete tenant files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tenants' AND auth.role() = 'authenticated');

-- Storage policies for bookings bucket
DROP POLICY IF EXISTS "Public can view booking files" ON storage.objects;
CREATE POLICY "Public can view booking files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bookings');

DROP POLICY IF EXISTS "Authenticated users can upload payment slips" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment slips"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bookings' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update booking files" ON storage.objects;
CREATE POLICY "Authenticated users can update booking files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bookings' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete booking files" ON storage.objects;
CREATE POLICY "Authenticated users can delete booking files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bookings' AND auth.role() = 'authenticated');

-- Storage policies for subscription-proofs bucket
DROP POLICY IF EXISTS "subscription_proofs_insert_host" ON storage.objects;
CREATE POLICY "subscription_proofs_insert_host"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'subscription-proofs'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "subscription_proofs_update_host" ON storage.objects;
CREATE POLICY "subscription_proofs_update_host"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'subscription-proofs'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "subscription_proofs_select_public" ON storage.objects;
CREATE POLICY "subscription_proofs_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'subscription-proofs');

DROP POLICY IF EXISTS "subscription_proofs_delete_super_admin" ON storage.objects;
CREATE POLICY "subscription_proofs_delete_super_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'subscription-proofs'
    AND public.is_super_admin()
  );

-- =====================================================
-- SECTION 10: DEFAULT DATA
-- =====================================================

-- Insert default platform settings (single row)
INSERT INTO platform_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert default plan features
INSERT INTO plan_features (plan, feature_key, feature_name, description, limit_value, is_enabled) VALUES
  ('free', 'rooms', 'Number of Rooms', 'Maximum rooms you can create', 3, true),
  ('free', 'bookings_per_month', 'Bookings per Month', 'Maximum bookings per month', 50, true),
  ('free', 'analytics', 'Analytics', 'Access to analytics dashboard', NULL, false),
  ('free', 'custom_branding', 'Custom Branding', 'Upload logo and set colors', NULL, true),
  ('free', 'online_payments', 'Online Payments', 'Accept online payments', NULL, true),
  ('free', 'email_notifications', 'Email Notifications', 'Booking email notifications', NULL, true),
  ('free', 'line_notifications', 'LINE Notifications', 'LINE booking notifications', NULL, false),
  ('free', 'priority_support', 'Priority Support', 'Priority customer support', NULL, false),
  ('free', 'api_access', 'API Access', 'Access to API for integrations', NULL, false),
  ('pro', 'rooms', 'Number of Rooms', 'Maximum rooms you can create', NULL, true),
  ('pro', 'bookings_per_month', 'Bookings per Month', 'Maximum bookings per month', NULL, true),
  ('pro', 'analytics', 'Analytics', 'Access to analytics dashboard', NULL, true),
  ('pro', 'custom_branding', 'Custom Branding', 'Upload logo and set colors', NULL, true),
  ('pro', 'online_payments', 'Online Payments', 'Accept online payments', NULL, true),
  ('pro', 'email_notifications', 'Email Notifications', 'Booking email notifications', NULL, true),
  ('pro', 'line_notifications', 'LINE Notifications', 'LINE booking notifications', NULL, true),
  ('pro', 'priority_support', 'Priority Support', 'Priority customer support', NULL, true),
  ('pro', 'api_access', 'API Access', 'Access to API for integrations', NULL, true)
ON CONFLICT (plan, feature_key) DO NOTHING;

-- =====================================================
-- SECTION 11: VIEWS
-- =====================================================

-- Cookie consent stats view
CREATE OR REPLACE VIEW cookie_consent_stats AS
SELECT 
  consent_status,
  COUNT(*) as count,
  DATE_TRUNC('day', created_at) as date
FROM cookie_consent_logs
GROUP BY consent_status, DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- =====================================================
-- SECTION 12: GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.current_user_owns_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_host_tenant_id_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_host() TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_owns_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_owns_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guest_of_host_property(UUID) TO authenticated;

-- Grant execute permissions on business logic functions
GRANT EXECUTE ON FUNCTION public.get_room_booked_dates(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_reservation_lock TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation_lock TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_reservation_lock TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_slip_duplicate_by_hash(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_guest_demographics_by_province(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_tenant(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_guests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_bookings(UUID, TEXT) TO authenticated;

-- Grant access to verified_slips
GRANT SELECT ON verified_slips TO anon;
GRANT SELECT, INSERT ON verified_slips TO authenticated;

-- Grant access to cookie_consent_stats view
GRANT SELECT ON cookie_consent_stats TO authenticated;

-- =====================================================
-- SECTION 13: COMMENTS
-- =====================================================

COMMENT ON TABLE audit_logs IS 'Immutable audit log for admin actions, security events, and system changes';
COMMENT ON FUNCTION public.get_room_booked_dates(UUID) IS 
'Returns booked date ranges for a specific room. Used for calendar availability display.
Only returns check_in and check_out dates (no user info) for privacy.
Bypasses RLS to show all bookings regardless of who made them.';
COMMENT ON FUNCTION check_booking_overlap() IS 
'Prevents double bookings by checking for overlapping date ranges on the same room. 
Only applies to bookings with status pending or confirmed.';
COMMENT ON COLUMN profiles.locale IS 'User preferred language (th, en)';
COMMENT ON COLUMN upload_tokens.slip_content_hash IS 'SHA-256 hash of the slip image content for duplicate detection';
COMMENT ON COLUMN platform_settings.line_channel_access_token IS 'LINE Messaging API channel access token for admin notifications';
COMMENT ON COLUMN platform_settings.line_user_id IS 'LINE User ID of the admin to receive notifications';

-- =====================================================
-- END OF PRODUCTION INIT SQL
-- =====================================================
