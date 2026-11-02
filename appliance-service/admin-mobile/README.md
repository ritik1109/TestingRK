# RR Service Admin app

This is a separate Android app for authorized administrators. It uses the same
backend API as the customer app and provides:

- Admin sign-in using the backend's configured admin credentials.
- Booking totals, status filters, customer search, and booking status updates.
- Customer list with saved profile details and search.
- Secure storage for the short-lived admin access token.

The backend must be updated and running with the admin API routes. Configure
`EXPO_PUBLIC_API_URL` in the EAS `preview` environment (for example,
`https://api.rrconsulting.me/api`) before building.

## Build the internal Android APK

Use this directory as the EAS base directory and select the `preview` build
profile. The Android package ID is `com.rrconsultancy.applianceservice.admin`,
separate from the customer app.

```sh
npm install
npx eas-cli build --platform android --profile preview
```

Admin access exposes personal customer and booking data. Only install this APK
on trusted devices, use a unique rotated admin password, and sign out when done.
