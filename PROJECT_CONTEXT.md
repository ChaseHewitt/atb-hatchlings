# ATB Hatchlings — Project Context & Handoff

## What this is

A classroom rewards system with two halves sharing one Firebase backend:

- **This repo (`atb-web`)**: a web app that runs on a classroom TV/monitor. It
  DISPLAYS each student's virtual pet — an egg that hatches into one permanent
  random creature as the student earns points. Staff can also add/remove points
  from individual cards or the whole-class Everyone bar while students watch
  their progress.
- **The iOS app ("ATB", separate Swift repo `/Users/v/Desktop/atb live`)**: the school
  attendance app all staff already use. It will be the CONTROLLER — staff give
  and take points from their phones (per-student and in bulk), and the TV
  updates in real time via Firestore listeners.

The pet concept: each student has ONE persistent pet (not a collection). Egg →
hatch (one of 47 creatures rolled with equal odds, then permanent). Pets do not
evolve after hatching. Points can be
TAKEN AWAY for behavior (deductions usually applied to groups/bulk, not one kid,
to avoid singling students out).

## Current state

The web display is wired to the existing Firebase project and the iOS controller
is implemented locally. The shared hatch goal defaults to 20 and is configurable
by an admin from the iOS app.

Key files:
- `src/types.ts` — THE CONTRACT + fallback tuning knobs. `HATCH_AT = 20`, the 47-creature
  catalog, sprite metadata, and pure lookup/roll helpers. Every creature has
  equal odds and its id is stored permanently in the existing `species` field.
- `src/Pet.tsx` — renders a CSS-drawn egg (no emoji), which wobbles harder near
  hatch, or the assigned creature's 25-frame animated idle strip + hatch burst.
  Sprite strips live in `public/sprites` and came from the Desktop `sprites`
  ZIP archives. The 128px sources render at 104px and 12 FPS. Animation runs
  only while a sprite intersects the viewport and the browser tab is visible;
  the first frame remains displayed while paused. Avoid filters on the animated
  element because they cause costly repaints; the glow is a static pseudo-element.
- `src/StudentCard.tsx` — card UI. `src/rewardLogic.ts` contains
  `applyDelta(student, delta, hatchAt)`, the reference game-write logic (clamp points ≥ 0,
  track `peak`, roll one permanent creature at hatch) that the iOS app must replicate.
- `src/App.tsx` — mock student array, alphabetical flat grid (user explicitly
  removed grouping-by-room), an "Everyone" bar with bulk ±1 for group actions.

## The data contract (agreed, do not change casually)

Firestore, inside the EXISTING attendance app's project (`atbAtten`), with
all data scoped to the workspace verified for the signed-in user:

```
schools/{workspaceId}/schoolYears/{yearId}/rewards/{studentId}
{
  name: string,        // denormalized for display
  room: string,
  grade: string,
  points: number,      // current, can go down, floor 0
  peak: number,        // high-water mark, never decreases (drives permanent stages)
  species: string|null // null until hatch; species id rolled once at configured goal
}
```

Rules of the architecture:
1. **The writer owns all game logic.** Hatch/creature roll/peak tracking happen
   where points are written. Both the iOS controller and authenticated web
   controls implement the same Firestore transaction semantics; `applyDelta`
   is the pure reference implementation.
2. **Rewards are per school year** (like all attendance data). New school year
   ⇒ no rewards docs yet ⇒ everyone starts as a fresh egg automatically. Docs
   are created lazily on a student's first point. Old years remain intact
   (future "hall of fame" feature).
3. **The hatch goal is school-wide.** It is stored as `hatchlingsHatchAt` on
   `schools/{workspaceId}`, defaults to 20 when absent, and is constrained to
   1...100 by both clients. Changing it never removes an already assigned pet.

## Phase 2 — wire the web app to Firebase (IN PROGRESS)

1. **Complete:** Firebase Web App registered in existing project
   `atbattendance`; config lives in git-ignored `.env.local`, with safe
   placeholders in `.env.example`. `src/firebase.ts` exports Auth; the separate
   `src/firestore.ts` entry keeps Firestore out of the login bundle until real data is used.
2. **Complete:** `useWorkspace.ts` reads the signed-in user's cross-device
   `users/{uid}.lastWorkspaceId` pointer and verifies the matching
   `schools/{workspaceId}/members/{uid}` staff membership before any school data
   is loaded. There is deliberately no fallback to `district`; missing or invalid
   membership fails closed. `useSchoolYears.ts` then listens to
   `schools/{workspaceId}/schoolYears`, honors a `?year=` document-id/name override,
   otherwise selects the newest `isActive` year, then falls back to date-range
   containment. The header dropdown can override or return to Automatic mode.
3. **Complete in web code:** `useRewardStudents.ts` merges real-time `students`
   (the complete roster) with optional `rewards` documents, so students with no
   reward doc still display as eggs. The mock roster and web write controls are
   removed. A newly stored species triggers the hatch animation. The canonical
   iOS `firestore.rules` now contains the nested `rewards` match, but it has not
   yet been pasted/deployed to Firebase.
   Permanent Add 1/Remove 1 controls appear on every student card, with an
   Everyone bar for whole-class changes. They use Firestore transactions and
   the shared hatch contract; the former `Test points` toggle and testing labels
   have been removed.
4. **Auth UI complete:** persistent username-or-email/password and Google
   login, username-aware password reset, and sign-out. The signed-in header
   displays the workspace username rather than exposing the email. Usernames resolve through
   the existing `usernames/{lowercasedUsername}` index. Anonymous sign-in is intentionally not offered. Before
   real data, Firestore rules must restrict `rewards` reads to authenticated
   workspace members and writes to staff; `request.auth != null` alone is not
   enough because the Firebase project also enables Anonymous Auth.
5. Deploy target: Cloudflare Pages (user already hosts chasesys.dev there);
   a subdomain like points.chasesys.dev is planned.

## Phase 3 — iOS controller (implemented locally)

The Swift attendance app now has a dedicated **Hatchlings** bottom tab. It uses
a lightweight two-column grid of tappable student-name tiles and a top segmented
scope selector for All Here, B-Wing, and C-Wing. Every scope is based on students
marked present today and updates with local attendance changes. A persistent
floating Liquid Glass island shows the selection count and Remove/Add actions;
selecting one tile handles an individual student, while multiple tiles
(including Select All) handle a group. Firestore
transactions clamp at zero, maintain the permanent peak, lazily create reward
documents, and assign one of the same 47 species exactly once at the hatch goal.

Admins also have **Settings → Hatchlings**, where the school-wide hatch goal can
be set from 1...100. The web app listens to this value in real time through
`src/useHatchThreshold.ts`, so its progress bars and test writer stay aligned.
The relevant Swift files are `HatchlingsModels.swift`,
`HatchlingsPointsView.swift`, and `HatchlingsSettingsView.swift`.

The app has an established Xcode Cloud release pipeline; version 1.0 is in App
Store review, so these local controller changes are intended for the next build.

### iOS multi-account isolation fix in progress

The iOS repo is `/Users/v/Desktop/atb live`. A device that had previously used
the legacy `district` account could show its cached school years after signing
into the Apple demo account. Two causes were found and patched locally:

- `restoreWorkspaceSession()` checked the device-global workspace before the
  authenticated user's root `lastWorkspaceId`; it now verifies the account's
  pointer first and uses the local value only as a membership-checked legacy
  fallback.
- SwiftData `SchoolYear` rows had no workspace identity. They now carry an
  optional `workspaceId`, and the authentication flow, selector, cleanup,
  join helper, and real-time listeners scope cached years to the current
  workspace. Existing rows are preserved rather than deleting another
  account's offline attendance.

Swift parsing passes, and a full unsigned iOS Simulator build succeeds with the
complete Xcode installation at `/Users/v/Downloads/Xcode-beta.app`.

## Conventions / cautions

- **Security rules prepared, not deployed:** the canonical iOS
  `firestore.rules` now requires a real `username` field for both legacy
  `district` profile fallbacks, so pointer-only demo documents do not qualify.
  It also includes the Hatchlings `rewards` rule. These changes still need to
  be pasted/deployed in Firebase; client-side routing is not a security boundary.
- Keep fallback tuning knobs and species/motion values in `types.ts`; the live
  hatch threshold comes from the school document.
- Creature art uses the real sprite strips; do not reintroduce emoji pets or
  evolution stages.
- User preference: flat alphabetical grid (no room grouping); bulk actions
  exist so deductions don't single out individual kids.
- TypeScript strict; `npx tsc --noEmit` must stay clean.
- Dev server: `npm run dev` (or `npx vite --port 5199`).
