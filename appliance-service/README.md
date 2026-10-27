# Home Appliance Service

The customer-facing app is being developed with Expo for Android, iOS, and web.
The existing static site remains under `frontend` for web administration, and
the Express/MongoDB API is in `backend`.

## Development setup

- Install Node.js 20 LTS or newer.
- Configure the API using `backend/.env.example` and `backend/README.md`.
- Install backend dependencies with `npm install` from `backend`, and mobile
  dependencies with `npm install` from `mobile`.
- Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_URL` to
  the API base URL, including `/api`. For phone testing on the same Wi-Fi,
  use the computer's local IP, for example
  `http://192.168.1.10:3001/api`, not `localhost`.
- From this `appliance-service` directory, run `.\start-dev.cmd` on Windows or
  `npm run dev` on macOS/Linux to start both the backend and Expo in LAN mode
  in one terminal. Keep it open while testing and press Ctrl+C to stop both
  processes.
- For web-only development, start Expo from `mobile` with `npm run web`.
- Run backend tests with `npm test` from `backend`.

Never commit `.env` files or put server secrets in Expo's public client
configuration. See `docs/STORE-RELEASE-CHECKLIST.md` for unfinished production,
policy, testing, and store-submission requirements.
