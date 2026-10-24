# Mobile store release checklist

## Product and business decisions

- [ ] Confirm legal operator name, support contacts, actual service areas, and
      the app's audience/age rating.
- [ ] Choose a permanent Android application ID and iOS bundle ID; verify both
      are available and controlled by the organization.
- [ ] Confirm booking, cancellation, pricing, payment, warranty, and customer
      support policies.
- [ ] Decide customer account deletion and data retention processes.
- [ ] Complete legal review of the privacy policy and terms templates.

## Backend and operations

- [ ] Deploy the API behind HTTPS with production `MONGO_URI`, a unique random
      `JWT_SECRET`, `ADMIN_USERNAME`, bcrypt `ADMIN_PASSWORD_HASH`, and exact
      `CORS_ORIGINS`; keep these only in the host's secret manager.
- [ ] Configure a production MongoDB service with least-privilege credentials,
      network access restrictions, encryption, backups, and a tested restore.
- [ ] Configure a real SMS provider and verify OTP delivery, cost controls,
      consent language, rate limits, delivery failures, and support process.
- [ ] Replace the in-process OTP/admin rate-limit store with a shared
      distributed limiter before running multiple API instances.
- [ ] Add durable monitoring, alerts, audit logging for admin changes, incident
      response, uptime checks, and log/PII retention controls.
- [ ] Review authorization, input validation, dependency advisories, abuse
      handling, backup recovery, and privacy disclosures.
- [ ] Move browser web authentication from JavaScript-readable storage to
      HttpOnly/Secure/SameSite cookies before public web use with real accounts.
- [ ] Add token refresh/revocation and a session recovery plan before production.

## App quality and accessibility

- [ ] Install the mobile app dependencies and run `npm run typecheck`.
- [ ] Run backend `npm test`, API integration tests against a non-production
      database, and a full web/mobile booking test.
- [ ] Test OTP send, resend cooldown, expiry, invalid-attempt lock, successful
      login, profile completion/editing, booking creation, and each admin status.
- [ ] Test Android phones/tablets and iPhones/iPads, small screens, screen
      readers, keyboard navigation, slow/offline networks, and app relaunch.
- [ ] Verify errors, empty/loading states, date/time locale handling, and that
      no secrets, OTPs, tokens, or unnecessary PII appear in logs.
- [ ] Add account deletion, support/contact, privacy, and terms entry points in
      the UI as required by law and both stores.

## Google Play

- [ ] Create/verify a Play Console developer account and organization profile.
- [ ] Set the permanent application ID, production version/build number, app
      icon, splash screen, screenshots, feature graphic, and store listing.
- [ ] Build and sign a release Android App Bundle (AAB) using a protected
      signing key or Play App Signing; securely back up signing credentials.
- [ ] Verify the target Android API level and all current Play requirements.
- [ ] Publish a public privacy policy and complete the Data safety form from
      actual SDK/API data flows; disclose OTP and address/location data correctly.
- [ ] Complete content rating, app access instructions for reviewers, ads,
      permissions, and account deletion declarations.
- [ ] Run internal testing, then required closed testing, resolve all review
      feedback, and stage a gradual production rollout.

## Apple App Store

- [ ] Enroll in the Apple Developer Program and confirm the legal seller name.
- [ ] Build/sign/archive the iOS app on macOS using an Apple distribution
      certificate and provisioning profile; protect signing materials.
- [ ] Complete App Store Connect listing, screenshots for supported device
      sizes, privacy policy URL, support URL, age rating, and review notes.
- [ ] Complete App Privacy disclosures from real collection/sharing behavior.
- [ ] Verify Sign in with Apple requirements if another third-party sign-in
      provider is later introduced; phone OTP alone does not automatically
      determine that requirement.
- [ ] Test TestFlight builds on real devices, resolve review feedback, and stage
      release.

## Release operations

- [ ] Build separate Android/iOS artifacts and a web export from the shared app.
- [ ] Test the production API configuration without exposing secrets in client
      bundles or source maps.
- [ ] Record release version, build identifiers, store submission status,
      migration/rollback plan, support owner, and incident contact.
- [ ] After release, monitor crashes, authentication/booking failures, abuse,
      support reports, and store policy changes; schedule regular dependency
      and privacy reviews.

> This checklist is intentionally not marked complete. Store policies, target
> API levels, privacy declarations, and legal obligations change; verify current
> requirements in Play Console and App Store Connect before each submission.
