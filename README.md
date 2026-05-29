# Galveston Reservation System (Next.js + Vercel)

Modernized version of the Galveston short-term rental booking system.

**Goal**: Full migration from the original Flask app (running on a VPS at str.ptpsystem.com) to a modern, fully serverless stack on **Vercel (free)** + **Neon Postgres (free)**.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript + Tailwind
- **Database**: Neon Postgres (serverless)
- **ORM**: Prisma
- **Emails**: Resend (replacing Gmail SMTP)
- **Hosting**: Vercel Hobby (free tier)
- **Background Jobs**: Vercel Cron
- **Calendar**: Google Calendar API (service account)

## Project Structure (Planned)

```
app/
├── api/
│   ├── bookings/          # Public booking requests
│   ├── admin/             # Admin approval endpoints
│   ├── calendar/          # Availability + sync
│   └── cron/              # Protected Vercel cron jobs
├── (public)/              # Marketing + booking flow
├── admin/                 # Admin dashboard (protected)
└── ...
lib/
├── prisma.ts
├── google-calendar.ts
├── email.ts               # Resend client
└── ...
prisma/
└── schema.prisma
```

## Getting Started (Local Development)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Install dependencies (already done)
npm install

# 3. Set up Neon database (free)
#    - Create project at https://neon.tech
#    - Paste connection string into DATABASE_URL

# 4. Run migrations
npx prisma migrate dev

# 5. Start dev server
npm run dev
```

## Environment Variables

See `.env.example`. Key ones for Vercel + Neon + Resend:

- `DATABASE_URL` — from Neon
- `RESEND_API_KEY` — from Resend (free tier)
- `GOOGLE_CREDENTIALS_JSON` or base64 version
- `APPROVAL_TOKEN_SECRET`

## Migration Status

This is the **new modern codebase** being built to replace the original Flask application in `/Users/howardshen/Developer/Github/Galveston-Reservation`.

The old Flask + Docker + systemd + VPS deployment will be retired once this is live.

## Original System

The previous version was a Flask 3 app with:
- Jinja2 + Bootstrap templates
- SQLAlchemy models (`BookingRequest`, `CalendarEvent`, `SyncLog`)
- Gmail SMTP + Google Calendar integration
- Custom remote deployment scripts

See the original repo for reference during migration.

## Database Setup (Completed)

- Prisma 7 configured with Neon (pooled + direct connections)
- Prisma Client generated to `app/generated/prisma`
- Singleton pattern implemented at `lib/prisma.ts`
- Test endpoint available at `/api/health`

### Using Prisma in the App

```ts
import prisma from '@/lib/prisma'

// Example in a Route Handler or Server Component
const bookings = await prisma.bookingRequest.findMany()
```

See `app/api/health/route.ts` for a working example.

## Current Progress

### ✅ Completed
- Prisma + Neon setup with proper singleton + adapter
- Public booking submission endpoint: `POST /api/bookings`
- Basic availability checking against existing approved bookings
- Approval / Rejection token links (`/api/admin/approve` and `/api/admin/reject`)
- Email notification skeleton (works when `RESEND_API_KEY` is set)

### Next Steps (Current Focus)
- [ ] Add a nice public booking form UI (Next.js + React)
- [ ] Improve availability checking (integrate with Google Calendar cache)
- [ ] Build a modern admin dashboard
- [ ] Full Google Calendar event creation on approval
- [ ] Switch email delivery to Resend with better templates
- [ ] Add Vercel Cron for calendar sync jobs
- [ ] Domain cutover + retire old VPS

---

**This project is under active development as part of the full migration.**

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
