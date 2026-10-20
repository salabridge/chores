# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.17.0 create --template minimal --types ts --add tailwindcss="plugins:none" experimental="versions:kit+features:async,remoteFunctions,explicitEnvironmentVariables,handleRenderingErrors" vitest="usages:unit,component" playwright --install pnpm web
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Kid profiles (parent PIN lock)

Managed kids have no login. A parent signs in, picks a kid on `/profiles`
("Who's using ChoreLoop?"), and the device then acts as that kid until a
parent enters their PIN. Invited kids with their own email sign in normally and
none of this applies to them.

**Active profile.** The device cookie (`device-id`, httpOnly) holds only a
random device id. The profile itself is a row in `device_profiles`, keyed by
device and user, so the client never sends (or can forge) a member id. Each
request re-checks, from rows the server loads, that the signed-in user is a
parent in the same household as the kid (`canOpenKidProfile`). The row outlives
the session, so after an expiry or a restart the parent signs in again and the
device goes straight back to the same kid, with no prompt. The row also stores
the session id; if only the device cookie is cleared, it's found again through
the session and the cookie is re-issued, so clearing a cookie isn't a way out.
Code: `src/lib/server/profiles.ts`, pure rules in `profile-state.ts`.

**Acting as the kid.** Kid-side reads and writes must take the member from
`getCurrentMember()` (`src/lib/server/guards.ts`), never from the auth user, so
completions, points and claims land on the kid's member row. Parent-only
actions call `requireParentProfile()`, which returns 403 while a kid profile is
active. Parent-only pages go in `src/routes/(protected)/(parent)/`, which
`hooks.server.ts` redirects to `/today` (or 403s for non-GET) in kid mode. Remote
functions skip route groups, so they must call a guard themselves.

**PIN.** 4 to 6 digits, hashed with scrypt (`pin.ts`), stored in
`household_member_pins`. A parent must set one before opening a kid profile
(the picker prompts for it). Leaving a kid profile (to the parent or another
kid) needs the PIN, and so does signing out: `signOut` and `setPassword` are
refused with 403 server-side while a kid profile is active, and the kid screens
show no sign-out. Lockout (`pin-lock.ts`): each check is counted *before* the
hash is compared (atomically, so parallel guesses can't beat the limit);
from the 3rd failure on, attempts wait a 30 second cool-down; the 5th failure
locks the PIN. A locked PIN unlocks only with the parent's account password
(checked against Neon Auth on a throwaway session, so the real session isn't
touched), which also resets the counters. Changing or resetting the PIN needs
the account password too, and works from inside a kid profile ("Forgot your
PIN?") because that is where a parent who forgot it is stuck. Because a PIN has
at most a million values, a leaked hash can be brute-forced offline; the
lockout and the row-level policy on the table are the defence.

**Why we keep the session refreshed (instead of a kid-mode token).** The
parent's session must not expire quietly while a kid uses the device. We chose
to keep the Neon Auth session itself alive: every request passes through
`hooks.server.ts`, which asks Neon Auth for the session (sliding its expiry),
and the kid screens ping `/api/keep-alive` every 15 minutes and when the tab
becomes visible again. The alternative, a long-lived device-bound token for
kid-scoped actions, would be a second credential that outlives the real session:
it would bypass revocation (a parent signing the device out elsewhere, or
changing their password), need its own storage, rotation and scoping, and
duplicate what the session already does. With the refresh approach, revoking
the session anywhere ends kid mode on that device, and going to the sign-in
screen is the accepted outcome. If a device stays off for longer than the
session lifetime, the parent signs in again and lands back on the same kid.

## Analytics (PostHog)

Product analytics go to PostHog Cloud (US), from the browser only
(`src/lib/analytics.ts`). It's off unless `PUBLIC_POSTHOG_KEY` is set, and it's
set in Vercel for production only. Without the key, `posthog-js` is never
imported, nothing is sent, and `/ingest` returns 404. Local dev, e2e and
previews run like this.

**What we track.**

- One `$pageview` per navigation, captured in the root layout's
  `afterNavigate`. Each is named by its SvelteKit route id
  (`/(protected)/(app)/chores/[id]`), never the raw path, and every later
  event carries the same id as `route`.
- Autocaptured clicks, with no element text or attribute values
  (`mask_all_text`, `mask_all_element_attributes`). Those hold chore names,
  kid names and input values.

Session replay, surveys, feature flags and exception capture are all off.

**First-party proxy.** The SDK sends to `/ingest` on our own origin, so ad
blockers don't drop events. `hooks.server.ts` forwards those requests to
PostHog (`src/lib/server/posthog-proxy.ts`) before it looks up the session.
It never forwards cookies or auth headers, and it passes the client IP for
geolocation. The service worker must never cache `/ingest`.

**URLs.** `before_send` (`scrubEvent`) runs on every event. It drops query
strings and hashes from every URL, because `redirectTo` can carry an invite
link. It replaces `/invite/<token>` with `/invite/[token]`. It also drops the
page title, because a chore page's title is the chore's name.

**Who is identified (kids use this app).** The root layout's server load works
out the identity (`analyticsIdentity` in `src/lib/server/profile-state.ts`),
and `syncIdentity` applies it:

- **A parent or owner in their own view** is identified by their Neon Auth
  user id and grouped by household (group type `household`). Their email and
  name are never sent.
- **A kid**, whether on their own login or as a managed kid's profile on a
  parent's device, is never identified. The only thing sent about them is
  `role: kid`, and kids get no person profile (`person_profiles:
  'identified_only'`).
- **Signed out, or signed in before setup:** anonymous.

Whenever the person on the device changes, the SDK is reset before anything
else happens: on sign-out, when a kid profile opens or closes, and when
another parent signs in. Without the reset, `identify` would merge a kid's
anonymous history, or another parent's, into whoever signs in next on a
shared family device.
