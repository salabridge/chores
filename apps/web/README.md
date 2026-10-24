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
(`src/lib/analytics.ts`). Errors go there too, from the browser and the server
(see "Error tracking" below). It's off unless `PUBLIC_POSTHOG_KEY` is set, and it's
set in Vercel for production only. Without the key, `posthog-js` is never
imported, nothing is sent, and `/ingest` returns 404. Local dev, e2e and
previews run like this.

**What we track.**

- One `$pageview` per navigation, captured in the root layout's
  `afterNavigate`. Each is named by its SvelteKit route id
  (`/(protected)/(app)/chores/[id]`), never the raw path, and every later
  event carries the same id as `route`.
- A few key events, captured in the browser once the action succeeds:
  `household_created`, `setup_completed`, `invite_sent`, `invite_accepted`,
  `chore_created`, `chore_completed`, `reward_redeemed` and
  `bonus_points_gifted`. `AnalyticsEvents` in `src/lib/analytics.ts` lists
  each event's properties. `chore_completed` means a completion was recorded,
  so it includes a favour that still waits for approval.
- Autocaptured clicks, with no element text or attribute values
  (`mask_all_text`, `mask_all_element_attributes`). Those hold chore names,
  kid names and input values.

- Session replays (SB-92), with typed values masked. Replays only record
  when "Record user sessions" is on in the PostHog project settings. The SDK
  loads that setting from remote config, which is why the config uses
  `advanced_disable_feature_flags` and not `advanced_disable_flags`: the
  latter also skips remote config. Snapshots go through `before_send` like
  any other event, so the URLs in them are scrubbed. For that to work,
  `session_recording.compress_events` is off. A compressed snapshot is gzip
  bytes held in a string, and scrubbing those bytes corrupts the snapshot,
  so the recording can't be played.

Surveys and feature flags are off.

**First-party proxy.** The SDK sends to `/ingest` on our own origin, so ad
blockers don't drop events. `hooks.server.ts` forwards those requests to
PostHog (`src/lib/server/posthog-proxy.ts`) before it looks up the session.
It never forwards cookies or auth headers, and it passes the client IP for
geolocation. The service worker must never cache `/ingest`.

**URLs.** `before_send` (`scrubEvent`) runs on every event. It drops query
strings and hashes from every URL, because `redirectTo` can carry an invite
link. That includes URLs and paths inside longer text, such as an error
message. It replaces `/invite/<token>` with `/invite/[token]`. It also drops the
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

**Adding an event.**

1. Add the event to `AnalyticsEvents` in `src/lib/analytics.ts`, with its
   properties. Properties are ids, counts, booleans and enums only. Never add
   free text such as chore titles, gift reasons or names, which people type.
2. Call `track('event_name', { ... })` in the browser, after the action has
   succeeded. That's usually the `enhance` callback, once `submit()` returns
   true. With analytics off, `track` does nothing, so components can call it
   in stories and tests.
3. Add the event to the list above.

### Error tracking

Errors go to PostHog error tracking under the same key, so with
`PUBLIC_POSTHOG_KEY` unset nothing is captured anywhere, and no SDK loads just
to report one. 404s are never captured: they're missing pages, not bugs.

- **Browser.** `handleError` in `src/hooks.client.ts` reports errors SvelteKit
  catches (a load or a component throwing) through `captureException` in
  `src/lib/analytics.ts`. The SDK's `capture_exceptions` also reports uncaught
  errors and unhandled promise rejections, such as an event handler throwing.
  Console errors aren't captured, because anything can be logged, including
  text people typed. The SDK starts in `hooks.client.ts`'s `init`, so an error
  in the first page's load is still reported.
- **Server.** `handleError` in `src/hooks.server.ts` reports errors from server
  loads, actions, endpoints and remote functions through `posthog-node`
  (`src/lib/server/error-tracking.ts`). The SDK is imported on the first
  error, and only when the key is set. It sends straight to
  `PUBLIC_POSTHOG_HOST` and the hook waits for it, because a Vercel function
  can stop as soon as the response is out and a queued event would be lost.

**Privacy.** Both sides follow the rules above. Exceptions go through the same
scrubbing as every other event (`scrubEvent` in the browser,
`scrubServerEvent` on the server), so URLs in messages and stack frames lose
their query strings and invite tokens. A server error carries the error, the
scrubbed URL and the route id. It never carries the request body, form data,
headers or cookies. It's attributed to whoever the browser's SDK already
reports (the `distinct_id` in its `ph_<key>_posthog` cookie), which is a
parent's user id or an anonymous id. The server never looks anyone up from the
session, so kids still aren't identified. Without that cookie, or when it isn't
an identified parent, the error is sent with no person profile.

Error messages can still hold text people typed, for example when a message
quotes the value it rejected. Keep user input out of the messages of errors
we throw.

**Source maps.** On Vercel production builds, `scripts/upload-sourcemaps.js`
runs after `vite build`. It uploads the browser build's source maps with the
PostHog CLI (`sourcemap process`), so stack traces point at our source. The
CLI tags each chunk with an id the SDK reports, then deletes the maps so
they're never served. It needs `POSTHOG_CLI_API_KEY` and
`POSTHOG_CLI_PROJECT_ID` (see the root README). Without the key, Vite writes no
maps and nothing is uploaded. If the upload fails, the build still passes: the
maps are deleted and that release's browser stack traces stay minified. The
server build isn't minified, so its stack traces are readable without maps.
