# Homestay Booking Platform

A multi-tenant homestay booking platform built with Next.js 16, React 19, Supabase, and shadcn/ui. Designed for the Thai market with PromptPay payments and LINE notifications.

## Features

### For Property Owners (Hosts)
- 🏠 Create and manage multiple rooms with images
- 📅 Availability calendar with price overrides
- 📊 Dashboard with booking analytics and revenue tracking
- 💳 PromptPay payment integration with QR codes
- 🔔 LINE notifications for new bookings
- 🎨 Customizable branding (logo, colors, hero images)
- 🚗 Transport service booking (pickup/dropoff)
- ⭐ Review management
- 👥 Guest management with demographics

### For Guests
- 🔍 Browse available rooms with filters
- 📖 View room details, amenities, and photo galleries
- 📆 Check availability and book online
- 💰 Pay via PromptPay with slip verification
- 📝 View booking history
- ⭐ Leave reviews after checkout
- 🌐 Multi-language support (English/Thai)

### For Super Admins
- 👥 Manage all tenants and users
- 📊 Platform-wide analytics
- 💰 Subscription management (Free/Pro plans)
- ⚙️ Platform settings (currency, payment, branding)
- 📜 Audit logs for security monitoring
- 🍪 Cookie consent logs (GDPR compliance)

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router) |
| **UI Library** | React 19 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Email, Google, Facebook OAuth) |
| **Styling** | Tailwind CSS 4 |
| **Components** | shadcn/ui (Radix UI primitives) |
| **Forms** | React Hook Form + Zod validation |
| **Icons** | Lucide React |
| **Dates** | date-fns, react-day-picker |
| **i18n** | next-intl (Thai/English) |
| **QR Codes** | qrcode.react |
| **Notifications** | Sonner (toasts), LINE Messaging API |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd homestay-booking
```

2. Install dependencies:
```bash
npm install
```

3. Create a Supabase project and run the schema:
```bash
# For new installations, run the consolidated schema:
# In Supabase SQL Editor, run: supabase/production_init.sql

# For incremental updates, run individual migrations in order:
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/002_row_level_security.sql
# ... and so on
```

4. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your credentials:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Payment Verification
EASYSLIP_API_KEY=your-easyslip-api-key
```

5. Set up Supabase Storage buckets:
```
- tenants (for logos, hero images)
- rooms (for room images)
- payment-proofs (for payment slips)
- promptpay-qr (for PromptPay QR codes)
- subscription-proofs (for subscription payment proofs)
```

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
homestay-booking/
├── app/                          # Next.js App Router
│   ├── admin/                    # Super admin panel
│   │   ├── analytics/            # Platform analytics
│   │   ├── audit/                # Audit logs viewer
│   │   ├── consent/              # Cookie consent logs
│   │   ├── login/                # Admin login
│   │   ├── settings/             # Platform settings
│   │   ├── subscriptions/        # Subscription management
│   │   ├── tenants/              # Tenant management
│   │   └── users/                # User management
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin APIs
│   │   ├── booking/              # Booking APIs
│   │   ├── consent/              # Cookie consent API
│   │   ├── payment/              # Payment verification
│   │   ├── subscription/         # Subscription upgrade
│   │   ├── upload/               # File upload APIs
│   │   └── user/                 # User account APIs
│   ├── host/                     # Host registration/login
│   ├── upload/[token]/           # Mobile file upload
│   ├── [slug]/                   # Tenant-specific pages
│   │   ├── booking/              # Booking flow
│   │   ├── complete-profile/     # Guest profile completion
│   │   ├── dashboard/            # Host dashboard
│   │   ├── my-bookings/          # Guest bookings
│   │   ├── rooms/                # Room listings
│   │   ├── settings/             # Guest settings
│   │   ├── login/                # Guest login
│   │   └── register/             # Guest registration
│   ├── privacy/                  # Privacy policy
│   ├── terms/                    # Terms of service
│   └── page.tsx                  # Platform landing page
├── components/
│   ├── admin/                    # Admin panel components
│   ├── auth/                     # Authentication components
│   ├── booking/                  # Booking flow components
│   ├── dashboard/                # Host dashboard components
│   ├── landing/                  # Landing page components
│   ├── legal/                    # Privacy/Terms components
│   ├── providers/                # React context providers
│   ├── review/                   # Review components
│   ├── room/                     # Room display components
│   ├── tenant/                   # Tenant page components
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── supabase/                 # Supabase clients
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client (+ admin)
│   │   └── middleware.ts         # Middleware client
│   ├── api-client.ts             # Client-side API helpers
│   ├── audit.ts                  # Audit logging utility
│   ├── currency.ts               # Currency formatting
│   ├── easyslip.ts               # EasySlip payment verification
│   ├── i18n.ts                   # Internationalization
│   ├── line-notify.ts            # LINE notification
│   ├── logger.ts                 # Production-safe logging
│   ├── pagination.ts             # Pagination helpers
│   ├── promptpay.ts              # PromptPay QR generation
│   ├── rate-limit.ts             # API rate limiting
│   ├── subscription.ts           # Subscription helpers
│   ├── thailand-locations.ts     # Thai province/district data
│   └── utils.ts                  # Utility functions
├── messages/                     # i18n translations
│   ├── en.json                   # English
│   └── th.json                   # Thai
├── supabase/
│   ├── migrations/               # Individual migrations (39 files)
│   └── production_init.sql       # Consolidated schema for new deployments
├── types/
│   └── database.ts               # TypeScript types
└── middleware.ts                 # Auth & tenant validation
```

## User Roles

| Role | Access |
|------|--------|
| `super_admin` | Full platform access, manage all tenants, users, and settings |
| `host` | Manage own tenant, rooms, bookings, and view analytics |
| `guest` | Book rooms, view own bookings, write reviews, manage profile |

## Routes

### Public Routes
| Route | Description |
|-------|-------------|
| `/` | Platform landing page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/{slug}` | Tenant landing page |
| `/{slug}/rooms` | Room listings |
| `/{slug}/rooms/{id}` | Room details |
| `/{slug}/login` | Guest login |
| `/{slug}/register` | Guest registration |

### Host Routes
| Route | Description |
|-------|-------------|
| `/host/login` | Host login |
| `/host/register` | Host registration |
| `/{slug}/dashboard` | Dashboard overview |
| `/{slug}/dashboard/rooms` | Room management |
| `/{slug}/dashboard/bookings` | Booking management |
| `/{slug}/dashboard/calendar` | Availability calendar |
| `/{slug}/dashboard/guests` | Guest management |
| `/{slug}/dashboard/analytics` | Analytics (Pro plan) |
| `/{slug}/dashboard/reviews` | Review management |
| `/{slug}/dashboard/subscription` | Subscription management |
| `/{slug}/dashboard/settings` | Tenant settings |

### Guest Routes (Protected)
| Route | Description |
|-------|-------------|
| `/{slug}/booking/{roomId}` | Booking flow |
| `/{slug}/booking/payment` | Payment page |
| `/{slug}/booking/confirmation` | Booking confirmation |
| `/{slug}/my-bookings` | My bookings |
| `/{slug}/settings` | Guest profile settings |
| `/{slug}/complete-profile` | Complete profile |

### Admin Routes (Super Admin)
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard |
| `/admin/tenants` | Tenant management |
| `/admin/users` | User management |
| `/admin/subscriptions` | Subscription management |
| `/admin/analytics` | Platform analytics |
| `/admin/settings` | Platform settings |
| `/admin/audit` | Audit logs |
| `/admin/consent` | Cookie consent logs |

### Utility Routes
| Route | Description |
|-------|-------------|
| `/upload/{token}` | Mobile file upload (QR code accessible) |

## Database Schema

### Core Tables
| Table | Description |
|-------|-------------|
| `tenants` | Property/homestay information |
| `profiles` | User profiles (extends auth.users) |
| `rooms` | Room/accommodation details |
| `bookings` | Reservations |
| `room_availability` | Date-specific availability/pricing |
| `reviews` | Guest reviews |

### Payment & Subscription Tables
| Table | Description |
|-------|-------------|
| `reservation_locks` | Temporary booking locks during payment |
| `verified_slips` | Verified payment slip hashes |
| `subscription_payments` | Tenant subscription payment records |
| `platform_settings` | Global platform configuration |

### Utility Tables
| Table | Description |
|-------|-------------|
| `upload_tokens` | Temporary tokens for mobile upload |
| `cookie_consent_logs` | GDPR cookie consent records |
| `audit_logs` | Admin action audit trail |

## Subscription Plans

| Feature | Free | Pro (฿699/month) |
|---------|:----:|:----------------:|
| Rooms | 3 | Unlimited |
| Bookings | Unlimited | Unlimited |
| PromptPay Payments | ✅ | ✅ |
| LINE Notifications | ✅ | ✅ |
| Advanced Analytics | ❌ | ✅ |
| Priority Support | ❌ | ✅ |

## Internationalization (i18n)

The platform supports multiple languages:
- 🇺🇸 English (default)
- 🇹🇭 Thai

Language files are in the `messages/` directory. Users can switch languages via the language switcher in the header.

## Payment Integration

### PromptPay
- Hosts configure their PromptPay ID (phone or national ID)
- Optional: Upload bank-generated QR code
- QR codes are generated dynamically with booking amount

### Slip Verification (Optional)
- EasySlip API integration for automatic slip verification
- Fallback to manual host approval

### LINE Notifications
- Hosts receive booking notifications via LINE
- Requires LINE Messaging API channel setup

## Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Role-based access control
- ✅ Secure authentication with Supabase Auth
- ✅ Protected routes via middleware
- ✅ API rate limiting
- ✅ Audit logging for admin actions
- ✅ CORS and security headers configured
- ✅ GDPR-compliant cookie consent

## Development

### Running Locally
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## Documentation

- [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md) - Detailed business logic documentation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details
