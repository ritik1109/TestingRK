# Cross-platform app

This Expo app is the customer-facing Android, iOS, and web client. The existing
`../frontend` site remains available for web administration while the new app
is developed and verified.

## Local setup

1. Install Node.js 20 LTS or newer.
2. From this directory, install the declared Expo dependencies with
   `npx expo install` so native package versions match the installed SDK.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the API base
   URL, including `/api`.
4. Start the app:

   ```sh
   npm run start
   ```

   Choose an Android emulator/device, an iOS simulator/device on macOS, or press
   `w` to open the web build. `npm run web` starts directly in web mode.
5. For local API development, start the backend separately and use its reachable
   HTTPS URL (or `http://<computer-LAN-IP>:3001/api` on a trusted local network).

Never put server-side secrets in this app's `EXPO_PUBLIC_*` variables; Expo
embeds those values in the public client bundle.

To produce a static web export for a web host, run
`npx expo export --platform web`; the generated `dist/` folder is the web
artifact. Configure the target host's public API URL and allowed backend origin
separately from Android/iOS builds.

For store builds, configure EAS CLI and the EAS project first, then use
`eas build --platform android --profile production` for Play Console and
`eas build --platform ios --profile production` for App Store Connect. These
are separate signed store artifacts from the web export.

## Session storage

Android and iOS store access tokens, rotating refresh tokens, and a cached
profile using the platform secure-store plugin. The customer session remains
signed in across app restarts and refreshes access credentials automatically;
it ends when the customer signs out or reinstalls the app. A local app-sandbox
marker detects fresh installs and removes secure credentials that iOS Keychain
could otherwise preserve across reinstall.
The backend keeps only hashed refresh credentials and limits each account to
ten active device sessions. The web client uses tab-scoped `sessionStorage`;
browser JavaScript can still read those tokens, so a production web deployment
should move to a backend HttpOnly, Secure, SameSite cookie session before
handling real customer data.

## Platform and release identity

The Android application ID and iOS bundle ID in `app.json` are initial
identifiers. Confirm they are owned and unused before release; changing either
after publishing creates a different store app. Android and iOS builds are
separate from the web export, even though screens and business logic are shared.

Customer flows implemented here: sign-up by default with a separate phone OTP
sign-in option for existing accounts, first-time profile completion,
PIN-code verification with customer-entered locality and address,
appliance/service selection on a single dashboard, calendar-based booking
requests with five 10 AM–7 PM appointment windows and same-day availability
filtering, a top-right profile avatar, a profile page with personal details and
up to four recent bookings, one full booking-management page, separate
profile-details editing, and sign-out. Admin management remains on the existing
web admin screen and is not exposed in the customer app.
