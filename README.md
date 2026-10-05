# BabyCare

A shared baby-care journal for families and caregivers. React Native + Expo + Firebase.
Full spec: `# Baby Care & Family Tracker.txt`. BabyCare tracks daily care; it is not a medical
device and gives no medical advice.

## Setup

1. Create a Firebase project. Enable **Authentication → Email/Password**, **Realtime Database**
   and **Storage**. Cloud Functions need the **Blaze** plan to deploy.
2. Register a Web app (Project settings → General → Your apps) and copy its config into `.env`
   (see `.env.example`). Restart with `npx expo start -c` after changing it.
3. Deploy rules and functions (the app does not work against older rules):

   ```bash
   npx firebase login
   npx firebase use <project-id>
   npx firebase deploy --only database,storage,functions
   ```

   Functions deploy to `asia-southeast1` (next to the Realtime Database). To use another region,
   change `setGlobalOptions` in `functions/src/index.ts` and set `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`
   to match; keep it close to your database.
4. **Google sign-in** (optional): in Firebase console → Authentication → Sign-in method, enable
   **Google**. For Android, add your build's SHA-1 under Project settings → Your apps (get it with
   `cd android && ./gradlew signingReport` after a prebuild, or from `eas credentials`), then
   re-download `google-services.json` into the project root. Put the Web client ID in
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. The Android package in `app.json` must match the app
   registered in Firebase. iOS also needs `GoogleService-Info.plist` and the plugin's `iosUrlScheme`.
5. QR scanning, notifications, shake-to-log and Google sign-in use native modules. Expo Go covers
   some of it (not Google sign-in, and not notifications on Android); use a development build
   (`npx expo run:android` / `run:ios`) for the full set.

## Scripts

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check of the app |
| `npm test` | Unit and component tests (Jest) |
| `npm run test:rules` | Database and Storage security rules against the emulators (needs Java 17+) |
| `npm run test:functions` | Cloud Functions, auth and activities end to end against the emulators |

## How it fits together

- **Rooms and membership** are written only by Cloud Functions (`functions/src/index.ts`);
  the rules deny clients. Roles: owner, parent, caregiver, viewer (`src/lib/permissions.ts`),
  enforced by the rules, not just the UI.
- **Activities** live at `rooms/{room}/babies/{baby}/activities/{id}`, indexed by start time. A
  timed activity with no `endedAt` is a running timer, shared by everyone in the room.
- **Offline**: changes are applied on screen immediately and queued on the device
  (`src/services/activities/writeQueue.ts`), then sent in order when the connection allows.
  Activity ids are created on the device, so a replay can never duplicate an entry. The last
  rooms, babies and activities are cached, so the app opens without a connection.
- **Photos** are private per room. Storage rules can't read the database, so access comes from a
  `rooms` custom claim that the functions keep in sync. A removed member's token can keep reading
  photos for up to an hour; database data is cut off immediately.
- **Time**: stored as UTC milliseconds; "today" follows the user's time zone (the phone's by
  default, or a chosen zone).
- **Reminders** are scheduled on the device from synced data (`src/lib/reminders.ts`). The feeding
  reminder moves when the app syncs a new feed; there is no server push yet.

## Plans and limits

Plans belong to the family room, not to a person. The room's plan is `rooms/{roomId}/entitlement`
(readable by members, writable only by Cloud Functions); nothing the app can do changes it.

- **Free:** 1 baby and 1 owned room. **BabyCare Plus** (Monthly, Yearly or Lifetime, all the same):
  up to 5 babies. Limits and prices live in `src/lib/billing/config.ts`; the server's copy of the rules
  is `functions/src/billing.ts`, and `src/lib/billing/parity.test.ts` fails if the two disagree.
- New babies are created by the `addBaby` Cloud Function, which applies the limit. Existing babies
  are never removed or hidden if a plan ends; the room just can't add more.
- Plus is decided from the dates as well as the status, so a stale record can't grant access forever.
- There is no purchase flow yet. To try Plus on a room, use the developer-only script (it needs your
  Firebase CLI login, or the local emulator):

  ```bash
  node scripts/grant-plan.mjs <roomId> plus_yearly --days 365 --project <firebase-project-id>
  node scripts/grant-plan.mjs <roomId> free --project <firebase-project-id>   # back to Free
  ```

- Upgrade screens show in development builds only. Set `EXPO_PUBLIC_BILLING_ENABLED=true` to show
  them in a release build. The paywall can't take payment until Google Play billing is added.

## Known limits

- Conflicts are last-write-wins. A queued edit that is replayed after someone else changed the
  same entry overwrites it.
- Deleting a baby removes its profile photo but not photos attached to its activities; those are
  removed when the room is deleted.
- Reminder times for daily reminders follow the phone's clock, not the chosen time zone.
