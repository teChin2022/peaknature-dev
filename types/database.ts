// Database types for Supabase
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Tenant Settings Types
export interface TenantAmenity {
  id: string
  name: string
  icon: string
  enabled: boolean
}

export type CurrencyCode = 'USD' | 'THB'

export interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  name: string
  locale: string
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
}

export interface TenantSettings {
  currency: CurrencyCode
  // Location
  location: {
    province: string       // Thai province name (Thai language)
    province_en: string    // Thai province name (English)
    district: string       // District name (Thai)
    district_en: string    // District name (English)
    sub_district: string   // Sub-district name (Thai)
    sub_district_en: string // Sub-district name (English)
    postal_code: string    // Postal/ZIP code
  }
  hero: {
    tagline: string
    description: string
    images: string[] // Array of image URLs for hero section
  }
  amenities: TenantAmenity[]
  contact: {
    address: string
    city: string
    postal_code: string
    country: string
    phone: string
    email: string
    directions: string
    map_url: string
    map_embed: string
  }
  stats: {
    show_stats: boolean
    custom_stat_label: string
    custom_stat_value: string
  }
  social: {
    facebook: string
    instagram: string
    twitter: string
    line: string
    whatsapp: string
  }
  payment: {
    promptpay_id: string              // Phone number or National ID (13 digits)
    promptpay_name: string            // Display name for the account
    promptpay_qr_url: string          // Uploaded QR code image URL from bank
    payment_timeout_minutes: number   // How long guest has to complete payment
    easyslip_enabled: boolean         // Whether to use EasySlip verification
    line_channel_access_token: string // LINE Messaging API channel access token
    line_user_id: string              // LINE User ID to receive notifications
  }
  transport: {
    pickup_enabled: boolean           // Whether pickup service is available
    pickup_price: number              // Price for pickup service
    pickup_description: string        // Description (e.g., "From airport/train station")
    dropoff_enabled: boolean          // Whether dropoff service is available
    dropoff_price: number             // Price for dropoff service
    dropoff_description: string       // Description (e.g., "To airport/train station")
  }
}

export const defaultTenantSettings: TenantSettings = {
  currency: 'THB',
  location: {
    province: '',
    province_en: '',
    district: '',
    district_en: '',
    sub_district: '',
    sub_district_en: '',
    postal_code: '',
  },
  hero: {
    tagline: 'Highly Rated Homestay',
    description: 'Discover comfort and tranquility in our carefully curated spaces. Your perfect retreat awaits with authentic hospitality and modern amenities.',
    images: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80'
    ]
  },
  amenities: [
    { id: 'wifi', name: 'Free WiFi', icon: 'wifi', enabled: true },
    { id: 'parking', name: 'Free Parking', icon: 'car', enabled: true },
    { id: 'breakfast', name: 'Breakfast', icon: 'coffee', enabled: true },
    { id: 'kitchen', name: 'Kitchen', icon: 'utensils', enabled: true },
    { id: 'ac', name: 'Air Conditioning', icon: 'wind', enabled: true },
    { id: 'tv', name: 'Smart TV', icon: 'tv', enabled: true },
  ],
  contact: {
    address: '',
    city: '',
    postal_code: '',
    country: '',
    phone: '',
    email: '',
    directions: '',
    map_url: '',
    map_embed: ''
  },
  stats: {
    show_stats: true,
    custom_stat_label: 'Cozy Rooms',
    custom_stat_value: ''
  },
  social: {
    facebook: '',
    instagram: '',
    twitter: '',
    line: '',
    whatsapp: ''
  },
  payment: {
    promptpay_id: '',
    promptpay_name: '',
    promptpay_qr_url: '',
    payment_timeout_minutes: 15,
    easyslip_enabled: true,
    line_channel_access_token: '',
    line_user_id: ''
  },
  transport: {
    pickup_enabled: false,
    pickup_price: 0,
    pickup_description: 'Airport/Train Station pickup',
    dropoff_enabled: false,
    dropoff_price: 0,
    dropoff_description: 'Airport/Train Station drop-off'
  }
}

// Subscription status type
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled'

// Plan type (only free and pro)
export type PlanType = 'free' | 'pro'

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          primary_color: string
          plan: PlanType
          is_active: boolean
          created_at: string
          settings: TenantSettings | null
          // Subscription fields
          trial_started_at: string | null
          trial_ends_at: string | null
          subscription_started_at: string | null
          subscription_ends_at: string | null
          subscription_status: SubscriptionStatus
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          primary_color?: string
          plan?: PlanType
          is_active?: boolean
          created_at?: string
          settings?: TenantSettings | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          subscription_status?: SubscriptionStatus
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          primary_color?: string
          plan?: PlanType
          is_active?: boolean
          created_at?: string
          settings?: TenantSettings | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          subscription_status?: SubscriptionStatus
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'super_admin' | 'host' | 'guest'
          tenant_id: string | null
          is_blocked: boolean
          avatar_url: string | null
          phone: string | null
          province: string | null
          district: string | null
          sub_district: string | null
          locale: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'super_admin' | 'host' | 'guest'
          tenant_id?: string | null
          is_blocked?: boolean
          avatar_url?: string | null
          phone?: string | null
          province?: string | null
          district?: string | null
          sub_district?: string | null
          locale?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'super_admin' | 'host' | 'guest'
          tenant_id?: string | null
          is_blocked?: boolean
          avatar_url?: string | null
          province?: string | null
          district?: string | null
          sub_district?: string | null
          locale?: string | null
          phone?: string | null
          created_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          images: string[]
          base_price: number
          max_guests: number
          amenities: string[]
          rules: string[]
          is_active: boolean
          check_in_time: string
          check_out_time: string
          min_nights: number
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          description?: string | null
          images?: string[]
          base_price: number
          max_guests: number
          amenities?: string[]
          rules?: string[]
          is_active?: boolean
          check_in_time?: string
          check_out_time?: string
          min_nights?: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          description?: string | null
          images?: string[]
          base_price?: number
          max_guests?: number
          amenities?: string[]
          rules?: string[]
          is_active?: boolean
          check_in_time?: string
          check_out_time?: string
          min_nights?: number
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          user_id: string | null // Nullable after migration 032
          check_in: string
          check_out: string
          guests: number
          total_price: number
          status: 'pending' | 'awaiting_payment' | 'confirmed' | 'cancelled' | 'completed'
          notes: string | null
          created_at: string
          payment_slip_url: string | null
          payment_verified_at: string | null
          payment_ref: string | null
          easyslip_data: Json | null
          payment_amount: number | null
        }
        Insert: {
          id?: string
          tenant_id: string
          room_id: string
          user_id?: string | null
          check_in: string
          check_out: string
          guests: number
          total_price: number
          status?: 'pending' | 'awaiting_payment' | 'confirmed' | 'cancelled' | 'completed'
          notes?: string | null
          created_at?: string
          payment_slip_url?: string | null
          payment_verified_at?: string | null
          payment_ref?: string | null
          easyslip_data?: Json | null
          payment_amount?: number | null
        }
        Update: {
          id?: string
          tenant_id?: string
          room_id?: string
          user_id?: string | null
          check_in?: string
          check_out?: string
          guests?: number
          total_price?: number
          status?: 'pending' | 'awaiting_payment' | 'confirmed' | 'cancelled' | 'completed'
          notes?: string | null
          created_at?: string
          payment_slip_url?: string | null
          payment_verified_at?: string | null
          payment_ref?: string | null
          easyslip_data?: Json | null
          payment_amount?: number | null
        }
      }
      room_availability: {
        Row: {
          id: string
          room_id: string
          date: string
          is_blocked: boolean
          price_override: number | null
        }
        Insert: {
          id?: string
          room_id: string
          date: string
          is_blocked?: boolean
          price_override?: number | null
        }
        Update: {
          id?: string
          room_id?: string
          date?: string
          is_blocked?: boolean
          price_override?: number | null
        }
      }
      reviews: {
        Row: {
          id: string
          booking_id: string
          user_id: string | null // Nullable after migration 038
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          user_id?: string | null
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          user_id?: string | null
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      reservation_locks: {
        Row: {
          id: string
          room_id: string
          user_id: string
          check_in: string
          check_out: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          check_in: string
          check_out: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          check_in?: string
          check_out?: string
          expires_at?: string
          created_at?: string
        }
      }
      notification_queue: {
        Row: {
          id: string
          tenant_id: string
          booking_id: string | null
          type: 'email' | 'line'
          recipient: string
          subject: string | null
          message: string
          status: 'pending' | 'sent' | 'failed'
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          booking_id?: string | null
          type: 'email' | 'line'
          recipient: string
          subject?: string | null
          message: string
          status?: 'pending' | 'sent' | 'failed'
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          booking_id?: string | null
          type?: 'email' | 'line'
          recipient?: string
          subject?: string | null
          message?: string
          status?: 'pending' | 'sent' | 'failed'
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
      date_waitlist: {
        Row: {
          id: string
          room_id: string
          user_id: string
          email: string
          check_in: string
          check_out: string
          notified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          email: string
          check_in: string
          check_out: string
          notified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          email?: string
          check_in?: string
          check_out?: string
          notified?: boolean
          created_at?: string
        }
      }
      verified_slips: {
        Row: {
          id: string
          trans_ref: string | null
          slip_url_hash: string
          booking_id: string
          tenant_id: string
          amount: number | null
          verified_at: string
          slip_url: string | null
          easyslip_data: Json | null
        }
        Insert: {
          id?: string
          trans_ref?: string | null
          slip_url_hash: string
          booking_id: string
          tenant_id: string
          amount?: number | null
          verified_at?: string
          slip_url?: string | null
          easyslip_data?: Json | null
        }
        Update: {
          id?: string
          trans_ref?: string | null
          slip_url_hash?: string
          booking_id?: string
          tenant_id?: string
          amount?: number | null
          verified_at?: string
          slip_url?: string | null
          easyslip_data?: Json | null
        }
      }
      upload_tokens: {
        Row: {
          id: string
          token: string
          user_id: string
          tenant_id: string
          room_id: string
          check_in: string
          check_out: string
          guests: number
          total_price: number
          notes: string | null
          slip_url: string | null
          is_uploaded: boolean
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          token: string
          user_id: string
          tenant_id: string
          room_id: string
          check_in: string
          check_out: string
          guests: number
          total_price: number
          notes?: string | null
          slip_url?: string | null
          is_uploaded?: boolean
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          token?: string
          user_id?: string
          tenant_id?: string
          room_id?: string
          check_in?: string
          check_out?: string
          guests?: number
          total_price?: number
          notes?: string | null
          slip_url?: string | null
          is_uploaded?: boolean
          expires_at?: string
          created_at?: string
        }
      }
      subscription_payments: {
        Row: {
          id: string
          tenant_id: string
          amount: number
          currency: string
          payment_method: string
          payment_proof_url: string | null
          period_start: string
          period_end: string
          status: 'pending' | 'verified' | 'rejected'
          verified_by: string | null
          verified_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          amount: number
          currency?: string
          payment_method?: string
          payment_proof_url?: string | null
          period_start: string
          period_end: string
          status?: 'pending' | 'verified' | 'rejected'
          verified_by?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          amount?: number
          currency?: string
          payment_method?: string
          payment_proof_url?: string | null
          period_start?: string
          period_end?: string
          status?: 'pending' | 'verified' | 'rejected'
          verified_by?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      plan_features: {
        Row: {
          id: string
          plan: string
          feature_key: string
          feature_name: string
          description: string | null
          limit_value: number | null
          is_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          plan: string
          feature_key: string
          feature_name: string
          description?: string | null
          limit_value?: number | null
          is_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          plan?: string
          feature_key?: string
          feature_name?: string
          description?: string | null
          limit_value?: number | null
          is_enabled?: boolean
          created_at?: string
        }
      }
      platform_settings: {
        Row: {
          id: string
          platform_name: string
          support_email: string
          default_currency: CurrencyCode
          default_timezone: string
          smtp_host: string
          smtp_port: number
          from_email: string
          from_name: string
          promptpay_name: string
          promptpay_qr_url: string
          platform_fee_percent: number
          line_channel_access_token: string
          line_user_id: string
          require_email_verification: boolean
          require_2fa_admin: boolean
          notify_new_tenant: boolean
          notify_daily_summary: boolean
          notify_errors: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          platform_name?: string
          support_email?: string
          default_currency?: CurrencyCode
          default_timezone?: string
          smtp_host?: string
          smtp_port?: number
          from_email?: string
          from_name?: string
          promptpay_name?: string
          promptpay_qr_url?: string
          platform_fee_percent?: number
          line_channel_access_token?: string
          line_user_id?: string
          require_email_verification?: boolean
          require_2fa_admin?: boolean
          notify_new_tenant?: boolean
          notify_daily_summary?: boolean
          notify_errors?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          platform_name?: string
          support_email?: string
          default_currency?: CurrencyCode
          default_timezone?: string
          smtp_host?: string
          smtp_port?: number
          from_email?: string
          from_name?: string
          promptpay_name?: string
          promptpay_qr_url?: string
          platform_fee_percent?: number
          line_channel_access_token?: string
          line_user_id?: string
          require_email_verification?: boolean
          require_2fa_admin?: boolean
          notify_new_tenant?: boolean
          notify_daily_summary?: boolean
          notify_errors?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      cookie_consent_logs: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          consent_status: 'accepted' | 'declined'
          consent_categories: Json
          ip_address: string | null
          user_agent: string | null
          referrer: string | null
          page_url: string | null
          country_code: string | null
          region: string | null
          privacy_policy_version: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          consent_status: 'accepted' | 'declined'
          consent_categories?: Json
          ip_address?: string | null
          user_agent?: string | null
          referrer?: string | null
          page_url?: string | null
          country_code?: string | null
          region?: string | null
          privacy_policy_version?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          consent_status?: 'accepted' | 'declined'
          consent_categories?: Json
          ip_address?: string | null
          user_agent?: string | null
          referrer?: string | null
          page_url?: string | null
          country_code?: string | null
          region?: string | null
          privacy_policy_version?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      cookie_consent_stats: {
        Row: {
          consent_status: string
          count: number
          date: string
        }
      }
    }
    Functions: {
      get_tenant_guests: {
        Args: { p_tenant_id: string }
        Returns: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          tenant_id: string
          is_blocked: boolean
          avatar_url: string | null
          created_at: string
        }[]
      }
      get_tenant_bookings: {
        Args: { p_tenant_id: string; p_status?: string | null }
        Returns: {
          id: string
          tenant_id: string
          room_id: string
          user_id: string
          check_in: string
          check_out: string
          guests: number
          total_price: number
          status: string
          notes: string | null
          created_at: string
          room_name: string | null
          guest_full_name: string | null
          guest_email: string | null
          guest_phone: string | null
        }[]
      }
      create_tenant_for_registration: {
        Args: { p_name: string; p_slug: string; p_primary_color?: string; p_plan?: string }
        Returns: string
      }
      set_user_as_host: {
        Args: { p_user_id: string; p_tenant_id: string; p_full_name?: string | null }
        Returns: void
      }
      check_reservation_lock: {
        Args: { p_room_id: string; p_check_in: string; p_check_out: string; p_user_id?: string | null }
        Returns: {
          is_locked: boolean
          locked_by: string | null
          expires_at: string | null
          seconds_remaining: number | null
        }[]
      }
      create_reservation_lock: {
        Args: { p_room_id: string; p_user_id: string; p_check_in: string; p_check_out: string; p_timeout_minutes?: number }
        Returns: {
          success: boolean
          lock_id: string | null
          expires_at: string | null
          error_message: string | null
        }[]
      }
      release_reservation_lock: {
        Args: { p_room_id: string; p_user_id: string; p_check_in: string; p_check_out: string }
        Returns: boolean
      }
      check_subscription_status: {
        Args: { tenant_uuid: string }
        Returns: string
      }
      check_slip_duplicate_by_hash: {
        Args: { p_slip_url_hash: string }
        Returns: {
          is_duplicate: boolean
          original_booking_id: string | null
          verified_at: string | null
        }[]
      }
      get_guest_demographics_by_province: {
        Args: { p_tenant_id: string }
        Returns: {
          province: string
          guest_count: number
          booking_count: number
          total_revenue: number
        }[]
      }
      cleanup_expired_upload_tokens: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {
      user_role: 'super_admin' | 'host' | 'guest'
      booking_status: 'pending' | 'awaiting_payment' | 'confirmed' | 'cancelled' | 'completed'
      plan_type: 'free' | 'pro'
      subscription_status: 'trial' | 'active' | 'expired' | 'cancelled'
      notification_type: 'email' | 'line'
      notification_status: 'pending' | 'sent' | 'failed'
      payment_status: 'pending' | 'verified' | 'rejected'
      consent_status: 'accepted' | 'declined'
    }
  }
}

// Convenience types
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type TenantInsert = Database['public']['Tables']['tenants']['Insert']
export type TenantUpdate = Database['public']['Tables']['tenants']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomInsert = Database['public']['Tables']['rooms']['Insert']
export type RoomUpdate = Database['public']['Tables']['rooms']['Update']

export type Booking = Database['public']['Tables']['bookings']['Row']
export type BookingInsert = Database['public']['Tables']['bookings']['Insert']
export type BookingUpdate = Database['public']['Tables']['bookings']['Update']

export type RoomAvailability = Database['public']['Tables']['room_availability']['Row']
export type RoomAvailabilityInsert = Database['public']['Tables']['room_availability']['Insert']
export type RoomAvailabilityUpdate = Database['public']['Tables']['room_availability']['Update']

export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']
export type ReviewUpdate = Database['public']['Tables']['reviews']['Update']

// Extended types with relations
export type RoomWithTenant = Room & {
  tenant: Tenant
}

export type BookingWithDetails = Booking & {
  room: Room
  user: Profile | null
  tenant: Tenant
}

export type ProfileWithTenant = Profile & {
  tenant: Tenant | null
}

// New table types
export type ReservationLock = Database['public']['Tables']['reservation_locks']['Row']
export type ReservationLockInsert = Database['public']['Tables']['reservation_locks']['Insert']
export type NotificationQueue = Database['public']['Tables']['notification_queue']['Row']
export type NotificationQueueInsert = Database['public']['Tables']['notification_queue']['Insert']
export type DateWaitlist = Database['public']['Tables']['date_waitlist']['Row']
export type DateWaitlistInsert = Database['public']['Tables']['date_waitlist']['Insert']

// Additional table types
export type VerifiedSlip = Database['public']['Tables']['verified_slips']['Row']
export type VerifiedSlipInsert = Database['public']['Tables']['verified_slips']['Insert']
export type UploadToken = Database['public']['Tables']['upload_tokens']['Row']
export type UploadTokenInsert = Database['public']['Tables']['upload_tokens']['Insert']
export type SubscriptionPayment = Database['public']['Tables']['subscription_payments']['Row']
export type SubscriptionPaymentInsert = Database['public']['Tables']['subscription_payments']['Insert']
export type PlanFeature = Database['public']['Tables']['plan_features']['Row']
export type PlanFeatureInsert = Database['public']['Tables']['plan_features']['Insert']
export type PlatformSettings = Database['public']['Tables']['platform_settings']['Row']
export type PlatformSettingsUpdate = Database['public']['Tables']['platform_settings']['Update']
export type CookieConsentLog = Database['public']['Tables']['cookie_consent_logs']['Row']
export type CookieConsentLogInsert = Database['public']['Tables']['cookie_consent_logs']['Insert']

// EasySlip API types
export interface EasySlipVerifyRequest {
  image: string  // Base64 encoded image
}

export interface EasySlipSender {
  bank: {
    id: string
    name: string
    short: string
  }
  account: {
    name: {
      th: string
      en: string
    }
    bank: {
      type: string
      account: string
    }
  }
}

export interface EasySlipReceiver {
  bank: {
    id: string
    name: string
    short: string
  }
  account: {
    name: {
      th: string
      en: string
    }
    bank?: {
      type: string
      account: string
    }
    proxy?: {
      type: string
      account: string
    }
  }
  displayName: string
}

export interface EasySlipData {
  transRef: string
  date: string
  countryCode: string
  amount: {
    amount: number
    local: {
      amount: number
      currency: string
    }
  }
  fee: number
  ref1: string
  ref2: string
  ref3: string
  sender: EasySlipSender
  receiver: EasySlipReceiver
}

export interface EasySlipVerifyResponse {
  status: number
  data?: EasySlipData
  error?: {
    code: string
    message: string
  }
}

// Reservation lock check result
export interface ReservationLockStatus {
  isLocked: boolean
  lockedBy: string | null
  expiresAt: string | null
  secondsRemaining: number | null
}
