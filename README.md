# Neon Loop

Run-of-show, live graphics and pledging for fundraising events: the rundown and output window,
content and the Content Designer, guest check-in, pledge entry, the live tally, takeovers,
the thank-you wall, timing against the schedule, breaks, and remote control from a tablet or phone.

## Where things stand

Neon Loop started as one self-contained HTML file. That file is complete and tested, and it ships
inside this app at **`/legacy/`** (shown to people as the *live show*) so it keeps running shows while the
React rebuild catches up. The two share one sign-in (`neonloop.session` in localStorage), the live show
finds the Supabase project from the app's settings, and `/legacy/?event=<id>&view=run|lib|gst|plg|set`
opens an event straight into a section. Each screen moves over as it is rebuilt; then `/legacy/` goes.

| Part | Status |
| --- | --- |
| Sign-in, events list, create and delete events | Rebuilt in React |
| Timing, breaks, pledge totals, matching, takeovers, guest import | Ported to typed modules in `src/domain`, with unit tests |
| Rundown, output, content, guests, pledges, remote | Running from `/legacy/`; being rebuilt screen by screen |
| Guests and pledges in the database | Schema ready (`supabase/migrations`), app not yet using it |

The end-to-end suites in `tests/legacy` (about 400 checks) describe what the current app does.
A screen counts as rebuilt when the React version passes the same behaviour.

## Stack

- **React + TypeScript + Vite**, a single-page app.
- **Supabase** for sign-in, Postgres with row-level security, file storage and Realtime.
- **Vercel** for hosting, with a preview deployment for every branch.
- **Installable and offline-first**: the service worker caches the app, including `/legacy/`,
  so the show laptop keeps running with no internet. Pledges and changes sync when it returns.

## Run it locally

```bash
npm install
cp .env.example .env.local     # add your Supabase URL and anon public key
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Unit tests for `src/domain` |
| `npm run test:legacy` | End-to-end suites against `/legacy/` (needs `npx playwright install chromium`) |
| `npm run test:app` | Builds the app against a mock Supabase and checks the shared sign-in with the live show |

## Environment variables

Set these in Vercel (Project Settings, Environment Variables) and in `.env.local`:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The **anon public** key |

Both end up in the browser, which is expected for these two. **Never** use the `service_role` or
`sb_secret_` key in this app, in Vercel's public variables or in a commit. The app refuses to start
with it. Keys for text messages, email or Salesforce will live only in server-side functions.

## Database

Migrations are in `supabase/migrations`:

1. `…0001_initial.sql`: people, events, members, content, permissions and the private `content` bucket.
2. `…0002_remote_channel.sql`: the private live channel per event used by remote mode.
3. `…0003_guests_pledges.sql`: organisations, guests and pledges as tables, staff-only access to
   personal details, pledges voided instead of deleted.

With the Supabase CLI:

```bash
supabase link --project-ref <project-ref>
# If you already ran the setup script by hand, mark those parts as applied first:
supabase migration repair --status applied 20261009000001 20261009000002
supabase db push
```

`supabase/setup-by-hand.sql` is the original script for pasting into the SQL editor.

## Deploy on Vercel

1. In Vercel, **Add New Project** and import this repository. The framework is detected as Vite.
2. Add the two environment variables above, then deploy.
3. Pushes to `main` go to production; other branches and pull requests get preview URLs.
4. Optional: add a domain such as `app.neonloop.com.au` under Project Settings, Domains.

## Using it on the night

- **Show laptop:** open the app and choose **Install** in Chrome or Edge, so it opens without
  internet. Open the event in **Open current Neon Loop** while online, so its content is on the laptop.
- **Remote (Surface, tablet, phone):** open `/remote`, sign in and choose the event. The laptop must
  have the event open with **Settings, Remote control** switched on. Remotes need internet.
- **Switcher:** the output window goes full screen on the laptop's second display (1920 × 1080, 50 Hz)
  into an HDMI input on the ATEM.

## Layout

```
public/legacy/index.html   the complete single-file Neon Loop (served at /legacy/)
src/domain/                timing, breaks, pledges, takeovers, guest import (+ tests)
src/lib/                   Supabase client, sign-in, offline helpers
src/pages/                 screens
supabase/migrations/       database schema and permissions
tests/legacy/              end-to-end suites and a mock Supabase (REST + Realtime)
```

## Next

1. Rundown and output window in React, using `src/domain/forecast.ts`.
2. Guests and pledges read and written through the new tables, with offline queueing.
3. Remote mode on database changes instead of messages only.
4. Guest QR pledge pages and text-message links (server-side functions).
5. Salesforce or ERP export for reconciliation.
