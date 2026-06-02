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
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — from Resend (required for real emails; must be a verified domain/sender in Resend)
- `AUTH_SECRET` — for NextAuth.js sessions (generate: `openssl rand -base64 32`)
- `CRON_SECRET` — protects the Vercel cron endpoints
- `VRBO_ICAL_URL` — your private VRBO iCal feed for automatic + manual import (see below)
- `APPROVAL_TOKEN_SECRET` (legacy)

Note: Google Calendar vars are no longer used (bidirectional iCal + VRBO is the channel sync method).

## Vercel Cron + VRBO Sync (Automatic Import)

The system now supports scheduled import of VRBO blocked dates:

- **Manual trigger**: In `/admin/requests` click "Sync VRBO Calendar (Import)". Also has one-click "Copy iCal Export Link" (paste that into VRBO as external calendar subscription for the reverse direction).
- **Automatic**: `vercel.json` defines a cron that hits `/api/cron/sync-vrbo` every 2 hours (`0 */2 * * *`).
- The cron and the admin sync endpoint both call the same `lib/vrbo-sync.ts` (uses `ical.js`, dedupes by iCal UID into `BookingRequest` with `source=VRBO`, `status=CONFIRMED`).
- Sync attempts (success + errors) are recorded in the `SyncLog` table and surfaced in the admin UI under the sync buttons ("Last VRBO import: ...").

### To enable automatic cron on Vercel (after this commit is deployed):

1. Go to your Vercel project → Settings → Environment Variables.
2. Add:
   - `CRON_SECRET` = a long random string (e.g. `openssl rand -base64 48`)
   - `VRBO_ICAL_URL` = your full private feed URL from VRBO (Host tools → Calendar → Export iCalendar; usually includes `?nonTentative&includeTentative=true`)
3. Redeploy (or let the next cron fire; you can also trigger manually from the admin UI).
4. (Optional but recommended) In Vercel Dashboard → Deployments → your latest → Functions → you can invoke the cron function manually for testing, or use curl with the secret:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/sync-vrbo
   ```

The `/api/admin/sync-status` endpoint (used by the UI) and SyncLog make it easy to see if the last run succeeded and how many events were imported/updated.

Once configured, VRBO bookings will appear in the requests list (with "VRBO" badge) and will block dates on the public availability calendar (same as confirmed direct bookings).

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
- Public booking submission endpoint + interactive calendar prefill
- Full request → review/quote/approve/reject/confirmed workflow with exact pricing (night-by-night, taxes, 22% mgmt, owner proceeds)
- Modern mobile-friendly admin (cards, drawer nav, sticky actions)
- Resend emails with validation + status panel + full breakdown on confirmation
- Role-based accounts (ADMIN/OWNER/PROPERTY_MANAGER) + easy invites + 30-day reconfirm + /setup bootstrap
- Bidirectional VRBO iCal (manual sync button + copy export link + scheduled cron)
- Rates, holidays/peak periods, SyncLog + last-sync visibility in admin

### Next Steps (Current Focus)
- [ ] Add a real /admin overview dashboard (currently sub-pages only)
- [ ] Owner reporting (revenue, occupancy, taxes)
- [ ] Forgot-password self-serve + auth polish
- [ ] Automated guest reminders (pre-arrival etc.)
- [ ] Full conflict UI for iCal overlaps
- [ ] Domain cutover + retire old VPS

---

**This project is under active development as part of the full migration.**

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
