-- =====================================================
-- HOMESTAY BOOKING PLATFORM - PRODUCTION INITIALIZATION
-- =====================================================
-- This file combines all migrations into a single script
-- for fresh production deployments.
-- 
-- Generated: 2026-01-06
-- Last Migration: 038_database_cleanup.sql
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SECTION 1: TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1.1 TENANTS TABLE
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  is_active BOOLEAN DEFAULT TRUE,
  -- Subscription columns
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled')),
  -- Settings JSONB
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
      "promptpay_qr_url": "",
      "payment_timeout_minutes": 15,
      "easyslip_enabled": true,
      "line_channel_access_token": "",
      "line_user_id": ""
    },
    "transport": {
      "pickup_enabled": false,
      "pickup_price": 0,
      "pickup_description": "Airport/Train Station pickup",
      "dropoff_enabled": false,
      "dropoff_price": 0,
      "dropoff_description": "Airport/Train Station drop-off"
    }
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.2 PROFILES TABLE
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'guest' CHECK (role IN ('super_admin', 'host', 'guest')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  is_blocked BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  phone TEXT,
  province TEXT,
  district TEXT,
  sub_district TEXT,
  locale VARCHAR(5) DEFAULT 'th',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraints for profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_tenant_unique ON profiles(email, tenant_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_super_admin_unique ON profiles(email) WHERE role = 'super_admin';

-- -----------------------------------------------------
-- 1.3 ROOMS TABLE
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 1.4 BOOKINGS TABLE
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  -- Payment fields
  payment_slip_url TEXT,
  payment_verified_at TIMESTAMPTZ,
  payment_ref TEXT,
  easyslip_data JSONB,
  payment_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- -----------------------------------------------------
-- 1.5 ROOM AVAILABILITY TABLE
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_blocked BOOLEAN DEFAULT TRUE,
  price_override DECIMAL(10,2),
  UNIQUE(room_id, date)
);

-- -----------------------------------------------------
-- 1.6 REVIEWS TABLE
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- -----------------------------------------------------
-- 1.7 RESERVATION LOCKS TABLE
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 1.8 NOTIFICATION QUEUE TABLE
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 1.9 DATE WAITLIST TABLE
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 1.10 VERIFIED SLIPS TABLE
-- -----------------------------------------------------
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
  CONSTRAINT unique_trans_ref_if_not_null UNIQUE (trans_ref)
);

-- -----------------------------------------------------
-- 1.11 UPLOAD TOKENS TABLE
-- -----------------------------------------------------
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.12 PLATFORM SETTINGS TABLE
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name VARCHAR(255) DEFAULT 'Homestay Booking',
  support_email VARCHAR(255) DEFAULT 'support@homestay.com',
  default_currency VARCHAR(10) DEFAULT 'THB',
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

-- Insert default platform settings
INSERT INTO platform_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------
-- 1.13 SUBSCRIPTION PAYMENTS TABLE
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 1.14 PLAN FEATURES TABLE
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 1.15 COOKIE CONSENT LOGS TABLE
-- -----------------------------------------------------
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

-- =====================================================
-- SECTION 2: INDEXES
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_province ON profiles(province);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON profiles(district);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_province ON profiles(tenant_id, province);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active) WHERE is_active = TRUE;

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- Room availability indexes
CREATE INDEX IF NOT EXISTS idx_room_availability_room ON room_availability(room_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_date ON room_availability(date);

-- Tenants indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_settings ON tenants USING GIN (settings);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

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

-- Upload tokens indexes
CREATE INDEX IF NOT EXISTS idx_upload_tokens_token ON upload_tokens(token);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_expires ON upload_tokens(expires_at);

-- Subscription payments indexes
CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);

-- Cookie consent indexes
CREATE INDEX IF NOT EXISTS idx_cookie_consent_created_at ON cookie_consent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user_id ON cookie_consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_ip ON cookie_consent_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_status ON cookie_consent_logs(consent_status);

-- =====================================================
-- SECTION 3: HELPER FUNCTIONS
-- =====================================================

-- Get user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get user tenant ID
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is host
CREATE OR REPLACE FUNCTION public.is_host()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'host'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================================================
-- SECTION 4: BUSINESS LOGIC FUNCTIONS
-- =====================================================

-- Handle new user registration
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

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Check booking conflict
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

-- Check if dates are blocked
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

-- Check booking overlap trigger function
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

DROP TRIGGER IF EXISTS prevent_booking_overlap ON bookings;
CREATE TRIGGER prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_overlap();

-- Get room booked dates
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

GRANT EXECUTE ON FUNCTION public.get_room_booked_dates TO anon;
GRANT EXECUTE ON FUNCTION public.get_room_booked_dates TO authenticated;

-- Create tenant for registration
CREATE OR REPLACE FUNCTION public.create_tenant_for_registration(
  p_name TEXT,
  p_slug TEXT,
  p_primary_color TEXT DEFAULT '#3B82F6',
  p_plan TEXT DEFAULT 'free'
)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  INSERT INTO public.tenants (name, slug, primary_color, plan, is_active)
  VALUES (p_name, p_slug, p_primary_color, p_plan, false)
  RETURNING id INTO v_tenant_id;
  
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_tenant_for_registration(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_for_registration(TEXT, TEXT, TEXT, TEXT) TO anon;

-- Set user as host
CREATE OR REPLACE FUNCTION public.set_user_as_host(
  p_user_id UUID,
  p_tenant_id UUID,
  p_full_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET 
    role = 'host',
    tenant_id = p_tenant_id,
    full_name = COALESCE(p_full_name, full_name)
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, full_name, role, tenant_id)
    SELECT 
      p_user_id,
      email,
      COALESCE(p_full_name, ''),
      'host',
      p_tenant_id
    FROM auth.users
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_user_as_host TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_as_host TO anon;

-- Get tenant guests
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
    RAISE EXCEPTION 'Access denied';
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

GRANT EXECUTE ON FUNCTION public.get_tenant_guests TO authenticated;

-- Get tenant bookings
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
    RAISE EXCEPTION 'Access denied';
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
  LEFT JOIN public.rooms r ON b.room_id = r.id
  LEFT JOIN public.profiles p ON b.user_id = p.id
  WHERE b.tenant_id = p_tenant_id
    AND (p_status IS NULL OR b.status = p_status)
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_tenant_bookings TO authenticated;

-- Get tenant stats
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

GRANT EXECUTE ON FUNCTION public.get_tenant_stats(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_stats(UUID) TO authenticated;

-- Get guest demographics by province
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

GRANT EXECUTE ON FUNCTION get_guest_demographics_by_province TO authenticated;

-- Check reservation lock
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

-- Create reservation lock
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
  
  SELECT id, expires_at INTO v_lock_id, v_expires_at
  FROM reservation_locks
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

-- Release reservation lock
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

-- Notify waitlist on lock release
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

DROP TRIGGER IF EXISTS trigger_notify_waitlist ON reservation_locks;
CREATE TRIGGER trigger_notify_waitlist
  AFTER DELETE ON reservation_locks
  FOR EACH ROW
  EXECUTE FUNCTION notify_waitlist_on_lock_release();

-- Check slip duplicate by hash
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

GRANT EXECUTE ON FUNCTION check_slip_duplicate_by_hash TO authenticated;
GRANT EXECUTE ON FUNCTION check_slip_duplicate_by_hash TO anon;

-- Get profile for deletion
CREATE OR REPLACE FUNCTION get_profile_for_deletion(p_user_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  role TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.tenant_id,
    p.role::TEXT,
    p.email
  FROM profiles p
  WHERE p.id = p_user_id
    AND p.tenant_id = p_tenant_id;
END;
$$;

-- Delete tenant guest
CREATE OR REPLACE FUNCTION delete_tenant_guest(
  p_user_id UUID, 
  p_tenant_id UUID,
  p_host_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_role TEXT;
  v_host_role TEXT;
  v_host_tenant_id UUID;
BEGIN
  SELECT role, tenant_id INTO v_host_role, v_host_tenant_id
  FROM profiles
  WHERE id = p_host_id;
  
  IF v_host_role != 'host' OR v_host_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Not authorized to delete users';
  END IF;
  
  SELECT role INTO v_target_role
  FROM profiles
  WHERE id = p_user_id AND tenant_id = p_tenant_id;
  
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User not found in this tenant';
  END IF;
  
  IF v_target_role IN ('host', 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete host or admin accounts';
  END IF;
  
  DELETE FROM bookings WHERE user_id = p_user_id;
  DELETE FROM reviews WHERE user_id = p_user_id;
  DELETE FROM reservation_locks WHERE user_id = p_user_id;
  DELETE FROM date_waitlist WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Delete own account
CREATE OR REPLACE FUNCTION delete_own_account(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only delete your own account';
  END IF;
  
  SELECT role INTO v_role
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  
  IF v_role IN ('host', 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete host or admin accounts through this method';
  END IF;
  
  DELETE FROM bookings WHERE user_id = p_user_id;
  DELETE FROM reviews WHERE user_id = p_user_id;
  DELETE FROM reservation_locks WHERE user_id = p_user_id;
  DELETE FROM date_waitlist WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_profile_for_deletion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_tenant_guest(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_own_account(UUID) TO authenticated;

-- Set tenant trial dates trigger
CREATE OR REPLACE FUNCTION set_tenant_trial_dates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trial_started_at := NOW();
  NEW.trial_ends_at := NOW() + INTERVAL '2 months';
  NEW.subscription_status := 'trial';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_trial_dates_trigger ON tenants;
CREATE TRIGGER set_trial_dates_trigger
  BEFORE INSERT ON tenants
  FOR EACH ROW
  WHEN (NEW.trial_started_at IS NULL)
  EXECUTE FUNCTION set_tenant_trial_dates();

-- Check subscription status
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

-- Update platform settings timestamp
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_settings_updated_at ON platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

-- Cleanup expired upload tokens
CREATE OR REPLACE FUNCTION cleanup_expired_upload_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM upload_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION check_reservation_lock TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_reservation_lock TO authenticated;
GRANT EXECUTE ON FUNCTION release_reservation_lock TO authenticated;

-- =====================================================
-- SECTION 5: ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
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

-- -----------------------------------------------------
-- TENANTS POLICIES
-- -----------------------------------------------------
CREATE POLICY "tenants_select_active"
  ON tenants FOR SELECT
  USING (is_active = true);

CREATE POLICY "tenants_select_own"
  ON tenants FOR SELECT
  USING (id = public.get_my_tenant_id());

CREATE POLICY "tenants_update_host"
  ON tenants FOR UPDATE
  USING (public.is_host() AND id = public.get_my_tenant_id());

CREATE POLICY "tenants_all_super_admin"
  ON tenants FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- -----------------------------------------------------
-- PROFILES POLICIES
-- -----------------------------------------------------
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_select_super_admin"
  ON profiles FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "profiles_all_super_admin"
  ON profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "profiles_select_host_guests"
  ON profiles FOR SELECT
  USING (
    public.is_host() 
    AND (
      tenant_id = public.get_my_tenant_id()
      OR
      id IN (
        SELECT DISTINCT b.user_id 
        FROM bookings b
        WHERE b.tenant_id = public.get_my_tenant_id()
      )
    )
  );

-- -----------------------------------------------------
-- ROOMS POLICIES
-- -----------------------------------------------------
CREATE POLICY "rooms_select_active"
  ON rooms FOR SELECT
  USING (is_active = true);

CREATE POLICY "rooms_select_host"
  ON rooms FOR SELECT
  USING (public.is_host() AND tenant_id = public.get_my_tenant_id());

CREATE POLICY "rooms_all_host"
  ON rooms FOR ALL
  USING (public.is_host() AND tenant_id = public.get_my_tenant_id());

CREATE POLICY "rooms_all_super_admin"
  ON rooms FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- BOOKINGS POLICIES
-- -----------------------------------------------------
CREATE POLICY "bookings_select_own"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_own"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_update_own"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_delete_own_pending"
  ON bookings FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "bookings_select_host"
  ON bookings FOR SELECT
  USING (public.is_host() AND tenant_id = public.get_my_tenant_id());

CREATE POLICY "bookings_update_host"
  ON bookings FOR UPDATE
  USING (public.is_host() AND tenant_id = public.get_my_tenant_id());

CREATE POLICY "bookings_all_super_admin"
  ON bookings FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- ROOM AVAILABILITY POLICIES
-- -----------------------------------------------------
CREATE POLICY "room_availability_select_all"
  ON room_availability FOR SELECT
  USING (true);

CREATE POLICY "room_availability_select_host"
  ON room_availability FOR SELECT
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_availability.room_id 
      AND rooms.tenant_id = public.get_my_tenant_id()
    )
  );

CREATE POLICY "room_availability_insert_host"
  ON room_availability FOR INSERT
  WITH CHECK (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_id 
      AND rooms.tenant_id = public.get_my_tenant_id()
    )
  );

CREATE POLICY "room_availability_update_host"
  ON room_availability FOR UPDATE
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_availability.room_id 
      AND rooms.tenant_id = public.get_my_tenant_id()
    )
  )
  WITH CHECK (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_id 
      AND rooms.tenant_id = public.get_my_tenant_id()
    )
  );

CREATE POLICY "room_availability_delete_host"
  ON room_availability FOR DELETE
  USING (
    public.is_host() 
    AND EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = room_availability.room_id 
      AND rooms.tenant_id = public.get_my_tenant_id()
    )
  );

CREATE POLICY "room_availability_all_super_admin"
  ON room_availability FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- REVIEWS POLICIES
-- -----------------------------------------------------
CREATE POLICY "reviews_select_all"
  ON reviews FOR SELECT
  USING (true);

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

CREATE POLICY "reviews_update_own"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "reviews_all_super_admin"
  ON reviews FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- RESERVATION LOCKS POLICIES
-- -----------------------------------------------------
CREATE POLICY "Anyone can view all locks"
  ON reservation_locks FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own locks"
  ON reservation_locks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locks"
  ON reservation_locks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own or expired locks"
  ON reservation_locks FOR DELETE
  USING (auth.uid() = user_id OR expires_at < NOW());

GRANT SELECT ON reservation_locks TO anon;
GRANT SELECT ON reservation_locks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON reservation_locks TO authenticated;

-- -----------------------------------------------------
-- NOTIFICATION QUEUE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Hosts can view tenant notifications"
  ON notification_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = notification_queue.tenant_id
        AND profiles.role = 'host'
    )
  );

-- -----------------------------------------------------
-- DATE WAITLIST POLICIES
-- -----------------------------------------------------
CREATE POLICY "Users can view their waitlist entries"
  ON date_waitlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to waitlist"
  ON date_waitlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from waitlist"
  ON date_waitlist FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------
-- VERIFIED SLIPS POLICIES
-- -----------------------------------------------------
CREATE POLICY "Anyone can check duplicates" ON verified_slips
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert" ON verified_slips
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT ON verified_slips TO anon;
GRANT SELECT, INSERT ON verified_slips TO authenticated;

-- -----------------------------------------------------
-- UPLOAD TOKENS POLICIES
-- -----------------------------------------------------
CREATE POLICY "upload_tokens_select_own"
  ON upload_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "upload_tokens_insert_own"
  ON upload_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "upload_tokens_update_own"
  ON upload_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "upload_tokens_delete_own"
  ON upload_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "upload_tokens_select_by_token"
  ON upload_tokens FOR SELECT
  TO anon
  USING (token IS NOT NULL AND expires_at > NOW());

CREATE POLICY "upload_tokens_update_by_token"
  ON upload_tokens FOR UPDATE
  TO anon
  USING (token IS NOT NULL AND expires_at > NOW() AND is_uploaded = FALSE);

-- -----------------------------------------------------
-- PLATFORM SETTINGS POLICIES
-- -----------------------------------------------------
CREATE POLICY "platform_settings_select_super_admin"
  ON platform_settings FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "platform_settings_insert_super_admin"
  ON platform_settings FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "platform_settings_update_super_admin"
  ON platform_settings FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "platform_settings_public_read"
  ON platform_settings FOR SELECT
  USING (true);

-- -----------------------------------------------------
-- SUBSCRIPTION PAYMENTS POLICIES
-- -----------------------------------------------------
CREATE POLICY "subscription_payments_select_host"
  ON subscription_payments FOR SELECT
  USING (
    tenant_id = public.get_my_tenant_id()
    OR public.is_super_admin()
  );

CREATE POLICY "subscription_payments_insert_host"
  ON subscription_payments FOR INSERT
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    OR public.is_super_admin()
  );

CREATE POLICY "subscription_payments_all_super_admin"
  ON subscription_payments FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- PLAN FEATURES POLICIES
-- -----------------------------------------------------
CREATE POLICY "plan_features_select_all"
  ON plan_features FOR SELECT
  USING (true);

CREATE POLICY "plan_features_all_super_admin"
  ON plan_features FOR ALL
  USING (public.is_super_admin());

-- -----------------------------------------------------
-- COOKIE CONSENT LOGS POLICIES
-- -----------------------------------------------------
CREATE POLICY "cookie_consent_logs_select_super_admin" 
  ON cookie_consent_logs FOR SELECT 
  USING (public.is_super_admin());

CREATE POLICY "cookie_consent_logs_insert_public" 
  ON cookie_consent_logs FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "cookie_consent_logs_delete_super_admin" 
  ON cookie_consent_logs FOR DELETE 
  USING (public.is_super_admin());

-- =====================================================
-- SECTION 6: STORAGE BUCKETS
-- =====================================================

-- Tenants bucket (logos, QR codes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenants',
  'tenants',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Bookings bucket (payment slips)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bookings',
  'bookings',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

-- Rooms bucket (room images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rooms',
  'rooms',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

-- PromptPay QR bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promptpay-qr',
  'promptpay-qr',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Subscription proofs bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('subscription-proofs', 'subscription-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SECTION 7: STORAGE POLICIES
-- =====================================================

-- Tenants bucket policies
CREATE POLICY "Public can view tenant files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenants');

CREATE POLICY "Hosts can upload to tenants"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenants' 
    AND (public.is_host() OR public.is_super_admin())
  );

CREATE POLICY "Hosts can update tenant files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenants' 
    AND (public.is_host() OR public.is_super_admin())
  );

CREATE POLICY "Hosts can delete tenant files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenants' 
    AND (public.is_host() OR public.is_super_admin())
  );

-- Bookings bucket policies
CREATE POLICY "Public can view booking files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bookings');

CREATE POLICY "Authenticated users can upload payment slips"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bookings' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update booking files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bookings' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete booking files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bookings' AND auth.role() = 'authenticated');

-- Rooms bucket policies
CREATE POLICY "Public can view room images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rooms');

CREATE POLICY "Hosts can upload room images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rooms' 
    AND (public.is_host() OR public.is_super_admin())
  );

CREATE POLICY "Hosts can update room images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'rooms' 
    AND (public.is_host() OR public.is_super_admin())
  );

CREATE POLICY "Hosts can delete room images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rooms' 
    AND (public.is_host() OR public.is_super_admin())
  );

-- PromptPay QR policies
CREATE POLICY "promptpay_qr_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'promptpay-qr');

CREATE POLICY "promptpay_qr_insert_super_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'promptpay-qr' 
    AND public.is_super_admin()
  );

CREATE POLICY "promptpay_qr_update_super_admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'promptpay-qr' 
    AND public.is_super_admin()
  );

CREATE POLICY "promptpay_qr_delete_super_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'promptpay-qr' 
    AND public.is_super_admin()
  );

-- Subscription proofs policies
CREATE POLICY "subscription_proofs_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'subscription-proofs');

CREATE POLICY "subscription_proofs_insert_host"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'subscription-proofs'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "subscription_proofs_update_host"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'subscription-proofs'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "subscription_proofs_delete_super_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'subscription-proofs'
    AND public.is_super_admin()
  );

-- =====================================================
-- SECTION 8: AUDIT LOGS TABLE
-- =====================================================

-- Create audit_logs table for admin action tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Action details
  action VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  
  -- Actor (who performed the action)
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  actor_role VARCHAR(50),
  actor_ip VARCHAR(45),
  actor_user_agent TEXT,
  
  -- Target (what was affected)
  target_type VARCHAR(50),
  target_id UUID,
  target_name VARCHAR(255),
  
  -- Context
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Details
  details JSONB DEFAULT '{}',
  old_value JSONB,
  new_value JSONB,
  
  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view audit logs
CREATE POLICY "audit_logs_select_super_admin"
  ON audit_logs FOR SELECT
  USING (public.is_super_admin());

-- Service role can insert (for API routes)
CREATE POLICY "audit_logs_insert_service_role"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE audit_logs IS 'Immutable audit log for admin actions, security events, and system changes';

-- Audit log helper function
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

GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- =====================================================
-- SECTION 9: VIEWS
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

GRANT SELECT ON cookie_consent_stats TO authenticated;

-- =====================================================
-- END OF PRODUCTION INITIALIZATION
-- =====================================================

