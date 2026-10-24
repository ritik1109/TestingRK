# Home Appliance Service

The customer-facing app is being developed with Expo for Android, iOS, and web.
The existing static site remains under `frontend` for web administration, and
the Express/MongoDB API is in `backend`.

## Development setup

- Install Node.js 20 LTS or newer.
- Configure the API using `backend/.env.example` and `backend/README.md`.
- Run backend tests with `npm test` from `backend`.
- From `mobile`, install Expo-compatible packages with `npx expo install`,
  copy `.env.example` to `.env`, and set the API URL.
- Run the shared app with `npm run start`; use `npm run web` for the browser
  version.

Never commit `.env` files or put server secrets in Expo's public client
configuration. See `docs/STORE-RELEASE-CHECKLIST.md` for unfinished production,
policy, testing, and store-submission requirements.
