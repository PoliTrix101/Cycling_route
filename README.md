# CycleTrack

Mobile-first cycling route tracker built with React, Vite, Leaflet, and OpenStreetMap. Each person signs up with an email and password and sees only their own data. Record rides with GPS, add stops and photos, save favorite places, and share completed rides with a public link. It runs as a website and as an Android app via Capacitor.

| Part | Stack | Hosted on |
| --- | --- | --- |
| Web app (`src/`) | React 19, Vite, TypeScript, react-leaflet | Vercel: https://cycling-route.vercel.app |
| API (`backend/`) | Express 5, Node.js | Railway: https://cycletrack-api-production-8300.up.railway.app |
| Database | Turso (libSQL) | Turso |
| Ride photos | Cloudinary | Cloudinary |
| Android app (`android/`) | Capacitor 8 | APK built by GitHub Actions |

Pushing to `main` redeploys the API on Railway and the web app on Vercel, and builds a new APK.

## Deploy the API (Railway)

1. Create a Turso database and copy its database URL and auth token.
2. In Railway, create a service from this GitHub repository and set its **Root Directory** to `backend`. Railway runs `npm install` and `npm start`.
3. In the service's **Variables**, set:

   | Variable | Required | Purpose |
   | --- | --- | --- |
   | `TURSO_DATABASE_URL` | Yes | Turso database URL. The server exits on startup without it. |
   | `TURSO_AUTH_TOKEN` | Yes | Turso auth token. |
   | `AUTH_SECRET` | Yes | Random string of at least 32 characters that signs login tokens. The server exits on startup without it. Changing it logs everyone out. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
   | `FRONTEND_URL` | Recommended | The web app URL, e.g. `https://cycling-route.vercel.app`. Share links point here, including links shared from the Android app. |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | For photos | Without them, photo uploads return an error. |

4. Deploy, then check `/api/health` (API is running, Cloudinary configured) and `/api/health/db` (database connected). Database tables are created or updated automatically on startup.

### Accounts

- Sign-up and login are at `/api/auth/signup` and `/api/auth/login`. Passwords are hashed with scrypt, and logins last 30 days.
- Every ride, place, and photo endpoint requires a login and only returns the logged-in user's data. Shared ride links (`/api/shared/:token`) stay public.
- Rides and places recorded before accounts existed belong to the **first account that signs up**.
- There is no password reset yet.

`render.yaml` is an alternative Render blueprint for the API. It is not used by the current deployment.

## Deploy the web app (Vercel)

1. Import this repository into Vercel with the project root as the root directory. `vercel.json` configures the Vite build and SPA fallback.
2. Optionally set these environment variables. Vite embeds them at build time, so redeploy after changing them.

   | Variable | Default | Purpose |
   | --- | --- | --- |
   | `VITE_API_URL` | The Railway API URL above | API base URL, ending in `/api`. |
   | `VITE_PUBLIC_APP_URL` | `https://cycling-route.vercel.app` | Used for share links when the API doesn't return one. |

## Android APK

### From GitHub Actions

Every push to `main` runs the **Build CycleTrack APK** workflow. Open the run in the repository's **Actions** tab and download the `CycleTrack-APK` artifact, which contains a debug APK.

### Build locally

1. Install Android Studio with the Android SDK, and JDK 21 or newer.
2. To point the app at a different API, set `VITE_API_URL` in `.env.production`. Never use `localhost` for a phone build.
3. Build the web app, copy it into the Android project, and open Android Studio:

   ```sh
   npm run android:sync
   npm run android:open
   ```

4. In Android Studio, build a debug APK for testing, or use **Build > Generate Signed Bundle / APK** for a release APK.

The Android app uses Capacitor's native location permission and GPS APIs. Recording a ride needs precise location permission and a GPS fix. Map tiles come from OpenStreetMap and need an internet connection.

## Local development

1. Create `backend/.env` from `backend/.env.example` and fill in your Turso credentials and an `AUTH_SECRET`. `.env` files are git-ignored; never put real credentials in the `.env.example` files.
2. Start the API from the `backend` folder, so it can find `backend/.env`:

   ```sh
   cd backend
   npm install
   npm start
   ```

3. In the project root, create `.env.local` with `VITE_API_URL=http://localhost:4000/api`, then start the web app:

   ```sh
   npm install
   npm run dev
   ```

Without `.env.local`, the local web app talks to the live Railway API and its real data.

Run `npm run lint` and `npm run build` before pushing.
