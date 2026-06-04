# Galveston Reservation System (Next.js + Vercel)

Modernized version of the Galveston short-term rental booking system (Bayfront Retreat, Jamaica Beach).

**Goal**: Full migration from the original Flask app (running on a VPS at str.ptpsystem.com) to a modern, fully serverless, authoritative source of truth on **Vercel (Hobby)** + **Neon Postgres (free)**.

All bookings go through a **request → review/quote → approve** workflow (no instant book). Pricing is calculated precisely on approval and shown only after admin review.

## Features

- **Interactive public calendar** (react-day-picker) — required first step before submitting a request; shows real-time availability (blocks CONFIRMED bookings including imported VRBO dates).
- **Exact pricing engine** — $500 weekday (M-Th), $650 weekend (F-Su), $700 holiday, $350 weekly discount per 7 nights. Guest total = base + 9% Jamaica Beach tax + 6% Texas tax + $300 cleaning fee.
- **Internal split on quote** — 22% management fee + owner proceeds (5-line breakdown visible to admin).
- **Request-to-approve workflow** — PENDING → REVIEWING (auto on open) → CONFIRMED (or REJECTED/CANCELLED). "Confirm and Send Quote" emails full breakdown + dates to guest + internals to PM/Owner.
- **Bidirectional VRBO iCal** — Manual "Sync VRBO Calendar (Import)" + one-click "Copy iCal Export Link" for VRBO side. Automatic sync via Vercel Cron (daily at midnight UTC, Hobby plan limit). Imported bookings land as CONFIRMED with `source=VRBO` and block dates.
- **Role-based admin** — ADMIN (everything + invite admins), OWNER (everything except invite ADMIN), PROPERTY_MANAGER (bookings, rates, holidays only).
- **Easy user management** — Invite by email (7-day token), click link to set password, 30-day email reconfirmation (6-digit code), first-user bootstrap at `/setup`.
- **Mobile-first admin UI** — Hamburger drawer, card-based lists (requests, quote nights, holidays) replacing wide tables, sticky actions, large tap targets.
- **Full Resend emails** — Confirmation on submit, quote email on approval (rephrased "Your Reservation is Confirmed"), internal notifications. Live status panel + strict validation (no silent failures).
- **Admin portals** — Booking requests (status/date sorting, VRBO badges, Sync + Export buttons), Rates & Pricing, Holidays & Peak Periods (inline edit + seed + duplicate cleaner), Users & Invites (resend/delete pending), Email Recipients + status.
- **Other** — Zelle manual payments only (no payment processor), native `<select>` in guest form, high-contrast UI, Prisma + Edge-safe middleware.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Auth**: Auth.js v5 (NextAuth) + Prisma Adapter + Credentials provider + bcryptjs (30-day reconfirm, invites)
- **Database**: Neon Postgres (serverless) + Prisma 7 (`@prisma/adapter-pg`)
- **Emails**: Resend (transactional, with templates + config)
- **Hosting & Jobs**: Vercel (Hobby) + Vercel Cron + `vercel.json`
- **Calendar Sync**: iCalendar via `ical.js` (bidirectional with VRBO)
- **Availability UI**: `react-day-picker`
- **Other**: date-fns, lucide-react icons, Zod validations

## Getting Started (Local Development)

```bash
# 1. Copy the example (it is committed; runtime .env* files are gitignored)
cp .env.example .env

# 2. Install (postinstall runs `prisma generate`)
npm install

# 3. Configure Neon Postgres (free)
#    - Create project at https://neon.tech
#    - Use the pooled connection for DATABASE_URL
#    - Use the direct (non-pooled) connection for DIRECT_URL
#    - Also set NEXT_PUBLIC_APP_URL=http://localhost:3000

# 4. Apply schema (use db push for rapid iteration; migrations exist for history)
npx prisma db push

# 5. (Optional) Seed initial holidays
npm run prisma:seed
# or tsx prisma/seed.ts

# 6. Start dev server
npm run dev
```

### First Admin User
Visit `http://localhost:3000/setup` — this only works when there are zero users in the database and creates the first ADMIN.

### Email Setup (for real sending)
- Create account at https://resend.com
- Add a verified domain or use a verified address for `RESEND_FROM_EMAIL`
- Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to your .env

### Test Scripts
```bash
# Send a test email (override from address)
node scripts/test-emails.ts --from=howard@ptpsystem.com

# Exercise booking flow
npx tsx scripts/test-booking-flow.ts
```

## Environment Variables

See the committed `.env.example` for full list and comments.

**Required for full functionality**:
- `DATABASE_URL` + `DIRECT_URL` (Neon)
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (verified sender in Resend)
- `AUTH_SECRET` (generate: `openssl rand -base64 32`)
- `CRON_SECRET` (protects `/api/cron/*`; generate strong random)
- `VRBO_ICAL_URL` (your private VRBO feed for import/sync)
- `NEXT_PUBLIC_APP_URL`

Legacy/optional: `APPROVAL_TOKEN_SECRET` (tokens are now generated with `crypto.randomBytes`).

Google Calendar variables are no longer used.

## Project Structure

```
app/
├── page.tsx                    # Hero + How It Works + AvailabilityCalendar (required step)
├── request/                    # Public request form (prefills dates, native selects)
├── booking/[token]/            # Guest-facing quote/confirmed view (via approvalToken)
├── login/, invite/, verify/, setup/   # Auth flows (invite link, code entry, bootstrap)
├── admin/                      # Protected admin (layout has mobile drawer + role nav)
│   ├── requests/               # List (mobile cards + desktop table, Sync + Copy Export)
│   ├── requests/[id]/          # Quote editor (night cards on mobile, adjustments, approve/reject)
│   ├── rates/, holidays/, users/, emails/
├── api/
│   ├── bookings/               # Public submit (creates PENDING + approvalToken)
│   ├── availability/           # Blocks for calendar (all CONFIRMED)
│   ├── ical/vrbo/              # Export feed for VRBO
│   ├── admin/                  # ... (sync-vrbo, sync-status, invites, rates, etc.)
│   ├── cron/sync-vrbo/         # Protected by CRON_SECRET
│   ├── auth/[...nextauth]/, setup/, invite/, verify/...
├── layout.tsx
components/
└── AvailabilityCalendar.tsx    # react-day-picker + request CTA

lib/
├── prisma.ts                   # Singleton + @prisma/adapter-pg + directUrl
├── auth.ts                     # Auth.js config + role callbacks
├── email.ts                    # Resend client + 4 send* functions + getEmailConfigStatus
├── vrbo-sync.ts                # ical.js parser + create/update BookingRequest (source=VRBO)
├── seed-holidays.ts
├── validations/booking.ts
└── types/pricing.ts

prisma/
└── schema.prisma               # BookingRequest (source, status, pricing JSON, externalId, adjustments), HolidayPeriod, RateSetting, EmailSetting, User, Invite, Role, SyncLog, ...

vercel.json                     # Cron schedule for /api/cron/sync-vrbo
```

## Booking Workflow (Public)

1. Visitor lands on homepage → clicks "Request to Book" → scrolls to interactive calendar.
2. Selects dates (calendar blocks unavailable CONFIRMED dates).
3. "Request These Dates" prefills the request form.
4. Submits → creates PENDING booking + sends confirmation email.
5. Admin reviews in /admin/requests (smart sort puts PENDING/REVIEWING on top).
6. Opens request → auto-moves to REVIEWING → enters/adjusts pricing (nights + taxes + cleaning + internal split).
7. "Confirm and Send Quote" → sets CONFIRMED + emails guest the full breakdown + dates + internals to configured recipients.
8. (Manual) Guest pays via Zelle; admin may mark or just leave as CONFIRMED.

See also `docs/WORKFLOW_DESIGN.md` and `docs/PRICING_MODEL.md`.

## Admin Features

- **Requests list**: Status-first + date sorting, VRBO badges, mobile card view (large "Review Request" buttons), desktop table with sticky Review column.
- **Quote screen**: Night-by-night breakdown (switches to vertical cards on mobile), editable adjustments, guest summary, 5-line internal payout (22% mgmt / owner), action buttons (Confirm & Send Quote, Mark Reviewing, Reject).
- **Holidays**: Calendar + list with inline editing, "Seed Common Holidays", "Clean Duplicates" (handles overlapping periods).
- **Users**: Invite form (role-restricted), pending invites list with Resend/Delete + auto-refresh.
- **Rates & Emails**: Simple portals + live email sending status panel.
- Fully responsive with high-contrast text (hardened labels, inputs, body).

## Authentication & Roles

- Three roles defined in Prisma `Role` enum.
- Invite flow: Admin creates invite → email with unique 7-day token link → set password page → account created.
- Existing users get 30-day email reconfirm (lastEmailVerification timestamp + 6-digit code flow).
- Middleware: Edge-safe cookie check only (no Prisma/Node imports) → redirects unauth to /login.
- First user: `/setup` page + API (guarded to User.count() === 0).
- Passwords hashed with bcryptjs. Sessions via Auth.js.

## VRBO Integration (Bidirectional iCal)

See the dedicated section below (added during the cron completion work).

Manual sync and export link live in `/admin/requests`. Cron runs automatically once `CRON_SECRET` + `VRBO_ICAL_URL` are set on Vercel.

## Pricing & Holidays

Full model (night counting, weekly discount, taxes, cleaning, 22% internal fee) is implemented in the quote flow and stored as JSON `pricing` + `PricingAdjustment` rows.

Admin can change base rates and manage `HolidayPeriod` records (which override to $700).

See [docs/PRICING_MODEL.md](./docs/PRICING_MODEL.md) for the exact spec and future seasonal ideas.

## Emails (Resend)

- Four main templates: booking confirmation (submit), quote (on approve, "Your Reservation is Confirmed" + full charge + dates), internal new request, internal quote sent.
- Recipients configurable in `/admin/emails` (Property Manager + Owner both get copies).
- Live "Email Sending Status" panel on the emails page (checks API key + verified from address).
- Test script supports custom `--from`.

## Environment & Deployment Notes

### Local
Use `.env` (copied from `.env.example`).

### Vercel
Add all the variables listed in the Environment Variables section.

**Cron-specific** (to enable automatic VRBO sync):
- `CRON_SECRET`
- `VRBO_ICAL_URL`

After setting them, redeploy. The schedule is defined in `vercel.json` (daily at midnight UTC on Hobby plan; Pro unlocks more frequent).

Note: Vercel Hobby accounts are limited to one cron job execution per day.

**First deploy gotcha**: If no users exist yet, visit `https://your-app.vercel.app/setup` to bootstrap the first ADMIN.

**Build**: `package.json` build script runs `prisma generate && next build`. `postinstall` also runs generate.

**Recommended**:
- Verify your sending domain in the Resend dashboard.
- Use a real custom domain for the app (helps with email deliverability and iCal URLs).

## Scripts & Maintenance

- `npm run dev` / `build` / `start` / `lint`
- `npm run prisma:seed`
- `node scripts/test-emails.ts --from=...`
- `npx tsx scripts/test-booking-flow.ts`
- `npx prisma studio`
- Holiday cleanup: `scripts/cleanup-holiday-duplicates.ts` + SQL helper

## Documentation

- [docs/PRICING_MODEL.md](./docs/PRICING_MODEL.md) — exact rates, taxes, fees, night counting, internal split.
- [docs/WORKFLOW_DESIGN.md](./docs/WORKFLOW_DESIGN.md) — original design (some states evolved; current uses PENDING/REVIEWING/CONFIRMED etc.).
- `prisma/schema.prisma` — source of truth for models and enums.

## Current Progress

### ✅ Completed
- Prisma + Neon + singleton + Edge-safe middleware
- Interactive calendar + request flow (dates prefill, no instant book)
- Full request → quote → approve workflow with precise pricing + adjustments + internal breakdown
- Mobile-friendly admin UI (cards, drawer, large targets, status sorting)
- Resend emails (submit + quote + internals) with validation + status panel
- Roles + invites + password set + 30-day reconfirm + /setup bootstrap
- Bidirectional VRBO iCal (import via button + cron, easy export copy link, SyncLog + last-sync UI)
- Rates editor, Holiday calendar (seed + clean duplicates), Email recipients
- Zelle manual only (no payments integration)

### Next Steps (Current Focus)
- [ ] Add a real /admin overview dashboard (stats, upcoming, last sync, quick actions)
- [ ] Owner reporting (revenue, occupancy, taxes, commissions)
- [ ] Forgot-password self-serve flow + further auth polish
- [ ] Automated guest reminders (pre-arrival, post-stay)
- [ ] Visual conflict highlighting for overlapping VRBO vs DIRECT bookings
- [ ] Domain cutover + retire old VPS/Flask system

---

**This project is the live authoritative system.** The original Flask app is being retired.

## Original System (for reference)

The previous version was a Flask 3 app with Jinja2 + Bootstrap, SQLAlchemy, Gmail SMTP, and Google Calendar sync.

See the original repo (`/Users/howardshen/Developer/Github/Galveston-Reservation`) during any historical reference.

## Deploy on Vercel

Connect the GitHub repo to Vercel. Add the environment variables from `.env.example`. The first push that includes `vercel.json` registers the cron.

After deploy, use `/setup` (if needed) and configure your VRBO feed + Resend.

For the most up-to-date instructions see the "Vercel Cron + VRBO Sync" section above and the live `/admin/emails` status panel.

---

*Last major README update: after completion of automatic VRBO cron (daily for Hobby) + last-sync UI + role-based accounts.*