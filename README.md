# CycleTrack

Mobile-first cycling route tracker built with React, Vite, Leaflet, and OpenStreetMap. Ride history and route points are stored through the Express API and Turso.

## Deploy the API

1. Create a Turso database and copy its database URL and auth token.
2. Push this repository to GitHub and create a Render Blueprint from it. Render reads `render.yaml` and creates the API service.
3. In the Render service environment, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
4. Wait for `/api/health` to report a successful database connection. Copy the API service URL.
5. Set `FRONTEND_URL` to the deployed web app URL, for example `https://cycling-route.vercel.app`. Share links point there, including links shared from the Android app.

## Deploy the web app to Vercel

1. Import this repository into Vercel using the project root as the root directory. `vercel.json` configures the Vite build and SPA fallback.
2. Add the environment variable `VITE_API_URL` with the deployed API URL and `/api`, for example `https://cycletrack-api.onrender.com/api`.
3. Redeploy after setting the environment variable. Vite embeds it at build time; `localhost` is only the development default.

## Build the Android APK

1. Install Android Studio with the Android SDK and install JDK 21 or newer. Capacitor 8 uses the local Android toolchain to build APKs.
2. Set `VITE_API_URL` to the deployed API in `.env.production` before building. Never use `localhost` for a phone build.
3. Add the Android platform once, then sync the app:

   ```sh
   npm run android:add
   npm run android:sync
   npm run android:open
   ```

4. In Android Studio, build a debug APK for testing or use **Build > Generate Signed Bundle / APK** for a distributable release APK.

The Android build uses Capacitor's native location permission and GPS APIs. Ride recording requires precise location permission and an available GPS fix. Map tiles are served by OpenStreetMap and require an internet connection.

## Local development

Create `backend/.env` from `backend/.env.example` and set the Turso credentials. In the project root, set `VITE_API_URL=http://localhost:4000/api` in `.env.local`. Start the API with `node backend/server.js` and the web app with `npm run dev`.
