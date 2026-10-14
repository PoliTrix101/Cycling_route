import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  Bike,
  MapPin,
  Clock3,
  Route,
  Play,
  Square,
  Plus,
  Trash2,
  Bookmark,
  Camera,
  Share2,
  Download,
  Home,
  History,
  UserRound,
  X,
  LocateFixed,
  LoaderCircle,
  ImagePlus,
  ExternalLink,
  Navigation,
  RefreshCw,
  Gauge,
  TrendingUp,
  TrendingDown,
  Zap,
  TriangleAlert,
  LogOut,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "https://cycletrack-api-production-8300.up.railway.app/api"
).replace(/\/$/, "");

/**
 * Public web address used in share links. Inside the Android app the page
 * origin is https://localhost, which nobody else can open.
 */
const PUBLIC_APP_URL = (
  import.meta.env.VITE_PUBLIC_APP_URL || "https://cycling-route.vercel.app"
).replace(/\/+$/, "");

const PROFILE_PICTURE_KEY = "cycletrack-profile-picture";
const MIN_SPEED_ALERT_KEY = "cycletrack-min-speed-alert";

/**
 * Reads a setting saved on this device for one account. A value saved
 * before accounts existed is moved to the first account that reads it.
 */
function readUserSetting(base: string, userId?: string): string | null {
  if (!userId) return null;

  try {
    const key = `${base}:${userId}`;
    const value = localStorage.getItem(key);
    if (value !== null) return value;

    const legacy = localStorage.getItem(base);
    if (legacy === null) return null;

    localStorage.setItem(key, legacy);
    localStorage.removeItem(base);
    return legacy;
  } catch {
    return null;
  }
}

/** Saves (or with null, removes) a setting for one account on this device. */
function writeUserSetting(base: string, userId: string, value: string | null) {
  const key = `${base}:${userId}`;

  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

/** Below this speed (km/h) the rider is treated as stopped. */
const MOVING_KMH = 1;
/** Anything faster than this is treated as a GPS glitch for a bicycle. */
const MAX_REASONABLE_KMH = 90;
/** Extra distance (m) allowed on top of max speed for GPS position error. */
const GPS_JUMP_SLACK_METERS = 150;
/** After this many glitch rejections in a row, accept the new position. */
const MAX_REJECTED_FIXES = 3;

type Ride = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  /** Speed stats saved when the ride finished, km/h (null on older rides). */
  avg_speed_kmh?: number | null;
  max_speed_kmh?: number | null;
  min_speed_kmh?: number | null;
  status: "active" | "completed";
  created_at: string;
};

type GPSPoint = {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  /** Speed in metres per second. */
  speed?: number | null;
  recorded_at?: string;
};

type Waypoint = {
  id: number | string;
  ride_id?: string;
  name: string;
  latitude: number;
  longitude: number;
  note?: string | null;
  created_at?: string;
};

type SavedPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  note: string;
  created_at: string;
};

type RidePhoto = {
  id: string;
  ride_id: string;
  image_url: string;
  caption: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  captured_at: string;
  created_at: string;
};

type SharedRide = {
  ride: Ride;
  points: GPSPoint[];
  waypoints: Waypoint[];
  photos: RidePhoto[];
};

type SpeedStats = {
  /** Average moving speed, km/h. */
  avg: number;
  /** Top speed, km/h. */
  max: number;
  /** Slowest moving speed, km/h (null if no movement yet). */
  min: number | null;
};

type Tab = "map" | "rides" | "saved" | "profile";

const DEFAULT_CENTER: [number, number] = [10.3157, 123.8854];

const markerIcon = L.divIcon({
  className: "cycletrack-marker",
  html: '<div style="background:#2563eb;width:17px;height:17px;border:3px solid white;border-radius:50%;box-shadow:0 1px 8px #0005"></div>',
  iconSize: [23, 23],
  iconAnchor: [11, 11],
});

const stopIcon = L.divIcon({
  className: "cycletrack-stop-marker",
  html: '<div style="background:#f59e0b;width:19px;height:19px;border:3px solid white;border-radius:6px;transform:rotate(45deg);box-shadow:0 1px 8px #0005"></div>',
  iconSize: [25, 25],
  iconAnchor: [12, 12],
});

const savedIcon = L.divIcon({
  className: "cycletrack-saved-marker",
  html: '<div style="background:#16a34a;color:white;width:28px;height:28px;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 1px 8px #0005">★</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const AUTH_KEY = "cycletrack-auth";

type AuthUser = { id: string; email: string };
type AuthSession = { token: string; user: AuthUser };

/** The login saved on this device, if any. */
function readStoredAuth(): AuthSession | null {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    return stored?.token && stored?.user?.id ? stored : null;
  } catch {
    return null;
  }
}

/** Login token sent with every API request. */
let authToken: string | null = readStoredAuth()?.token ?? null;

function saveAuth(session: AuthSession) {
  authToken = session.token;

  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } catch {
    /* still logged in for this session */
  }
}

/** Forget the login and start the app again at the login screen. */
function logOut() {
  authToken = null;

  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore storage errors */
  }

  window.location.reload();
}

async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const response = await fetch(`${API}${path}`, { ...options, headers });

  // The saved login expired or is no longer valid.
  if (response.status === 401 && authToken) logOut();

  const contentType = response.headers.get("content-type") || "";

  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof result === "object" && result?.error
        ? result.error
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return result as T;
}

async function fetchRides(): Promise<Ride[]> {
  const result = await api<Ride[]>("/rides");
  return Array.isArray(result) ? result : [];
}

async function fetchSavedPlaces(): Promise<SavedPlace[]> {
  const result = await api<SavedPlace[]>("/places");
  return Array.isArray(result) ? result : [];
}

/** Photos for every ride in one request, grouped by ride id. */
async function fetchPhotoMap(): Promise<Record<string, RidePhoto[]>> {
  const found = await api<RidePhoto[]>("/photos").catch(
    () => [] as RidePhoto[],
  );
  const grouped: Record<string, RidePhoto[]> = {};

  for (const photo of Array.isArray(found) ? found : []) {
    (grouped[photo.ride_id] ||= []).push(photo);
  }

  return grouped;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function jsonOptions(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function formatDistance(meters: number): string {
  const distance = Number(meters) || 0;

  return distance >= 1000
    ? `${(distance / 1000).toFixed(2)} km`
    : `${Math.round(distance)} m`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${secs}s`;
}

/**
 * Parses an API timestamp. SQLite's datetime('now') gives UTC without a
 * zone ("2026-10-14 06:44:55"), which browsers would read as local time.
 */
function parseTimestamp(value: string): Date {
  const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

  return new Date(
    sqliteUtc.test(value) ? `${value.replace(" ", "T")}Z` : value,
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Not available";

  const date = parseTimestamp(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

/** Makes sure photo URLs from the API always load (handles relative paths). */
function photoSrc(url: string): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  const origin = API.replace(/\/api$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function formatSpeed(kmh: number | null | undefined): string {
  if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) {
    return "—";
  }

  return `${kmh.toFixed(1)} km/h`;
}

/** Distance in metres between two coordinates (haversine). */
function haversine(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const distance =
    earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return Number.isFinite(distance) ? distance : 0;
}

/** Total length of a route in metres. */
function routeDistance(points: GPSPoint[]): number {
  return points.reduce(
    (total, point, index) =>
      index === 0 ? total : total + haversine(points[index - 1], point),
    0,
  );
}

/** Seconds between the first and last recorded point of a route. */
function routeElapsedSeconds(points: GPSPoint[]): number {
  if (points.length < 2) return 0;

  const first = Date.parse(points[0].recorded_at || "");
  const last = Date.parse(points[points.length - 1].recorded_at || "");

  return Number.isFinite(first) && Number.isFinite(last) && last > first
    ? Math.floor((last - first) / 1000)
    : 0;
}

/**
 * Average speed of a finished ride, km/h. Uses the stored moving average,
 * falling back to distance / total time for rides saved before it existed.
 */
function rideAverageKmh(ride: Ride): number {
  if (typeof ride.avg_speed_kmh === "number") return ride.avg_speed_kmh;

  const seconds = Number(ride.duration_seconds) || 0;
  const meters = Number(ride.distance_meters) || 0;

  return seconds > 0 ? (meters / seconds) * 3.6 : 0;
}

/** Average / max / min moving speed from a list of GPS points. */
function computeSpeedStats(points: GPSPoint[]): SpeedStats {
  let max = 0;
  let min: number | null = null;
  let movingDistance = 0;
  let movingTime = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    const distance = haversine(previous, current);

    const t0 = previous.recorded_at
      ? Date.parse(previous.recorded_at)
      : NaN;
    const t1 = current.recorded_at
      ? Date.parse(current.recorded_at)
      : NaN;
    const seconds = (t1 - t0) / 1000;

    const gpsSpeed =
      current.speed === null || current.speed === undefined
        ? NaN
        : Number(current.speed);

    let kmh: number | null = null;

    if (Number.isFinite(gpsSpeed) && gpsSpeed >= 0) {
      kmh = gpsSpeed * 3.6;
    } else if (Number.isFinite(seconds) && seconds >= 1) {
      kmh = (distance / seconds) * 3.6;
    }

    if (kmh === null || kmh > MAX_REASONABLE_KMH || kmh < MOVING_KMH) {
      continue;
    }

    max = Math.max(max, kmh);
    min = min === null ? kmh : Math.min(min, kmh);

    if (Number.isFinite(seconds) && seconds > 0) {
      movingDistance += distance;
      movingTime += seconds;
    }
  }

  return {
    avg: movingTime > 0 ? (movingDistance / movingTime) * 3.6 : 0,
    max,
    min,
  };
}

/** Speed stats saved with the ride, or computed from its points if missing. */
function rideSpeedStats(ride: Ride, points: GPSPoint[]): SpeedStats {
  if (typeof ride.avg_speed_kmh !== "number") {
    return computeSpeedStats(points);
  }

  return {
    avg: ride.avg_speed_kmh,
    max: Number(ride.max_speed_kmh) || 0,
    min: typeof ride.min_speed_kmh === "number" ? ride.min_speed_kmh : null,
  };
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (position: [number, number]) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

/**
 * Keeps the rider on screen while following. Dragging the map turns
 * following off so the rider can look around without it snapping back.
 */
function FollowRider({
  position,
  follow,
  onUserPan,
}: {
  position: [number, number] | null;
  follow: boolean;
  onUserPan: () => void;
}) {
  const map = useMap();

  useMapEvents({
    dragstart() {
      onUserPan();
    },
  });

  useEffect(() => {
    if (follow && position) map.panTo(position, { animate: true });
  }, [map, position, follow]);

  return null;
}

/** Log in or create an account. */
function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === "signup" && password !== confirmPassword) {
      setAuthError("Passwords don't match.");
      return;
    }

    setBusy(true);
    setAuthError("");

    try {
      const session = await api<AuthSession>(
        mode === "login" ? "/auth/login" : "/auth/signup",
        jsonOptions({ email: email.trim(), password }),
      );

      saveAuth(session);
      onAuthenticated(session.user);
    } catch (err) {
      setAuthError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Bike size={24} />
          </div>
          <div>
            <h1>CycleTrack</h1>
            <p>Your cycling companion</p>
          </div>
        </div>
      </header>

      <section className="page-content">
        <section className="modal-card" style={{ margin: "24px auto 0" }}>
          <div className="modal-heading">
            <div>
              <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>
              <p>
                {mode === "login"
                  ? "Log in to see your rides and saved places."
                  : "Your rides and places are private to your account."}
              </p>
            </div>
          </div>

          {authError && (
            <div className="message-banner error" role="alert">
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
              maxLength={200}
            />

            {mode === "signup" && (
              <>
                <p className="coordinate-note">Use at least 8 characters.</p>

                <label htmlFor="auth-confirm-password">Confirm password</label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  maxLength={200}
                />
              </>
            )}

            <button
              className="primary-button full-width"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <UserRound size={18} />
              )}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setConfirmPassword("");
              setAuthError("");
            }}
          >
            {mode === "login"
              ? "New to CycleTrack? Create an account"
              : "Already have an account? Log in"}
          </button>
        </section>
      </section>
    </main>
  );
}

/** Four speed cards: now / average / top / minimum. */
function SpeedCards({
  current,
  stats,
}: {
  current?: number | null;
  stats: SpeedStats;
}) {
  return (
    <div className="stats-grid">
      {current !== undefined && (
        <div className="stat-card">
          <Gauge size={20} />
          <strong>{formatSpeed(current)}</strong>
          <span>Current speed</span>
        </div>
      )}

      <div className="stat-card">
        <Zap size={20} />
        <strong>{formatSpeed(stats.avg || null)}</strong>
        <span>Average speed</span>
      </div>

      <div className="stat-card">
        <TrendingUp size={20} />
        <strong>{formatSpeed(stats.max || null)}</strong>
        <span>Top speed</span>
      </div>

      <div className="stat-card">
        <TrendingDown size={20} />
        <strong>{formatSpeed(stats.min)}</strong>
        <span>Minimum speed</span>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(
    () => readStoredAuth()?.user ?? null,
  );
  const [tab, setTab] = useState<Tab>("map");
  const [rides, setRides] = useState<Ride[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [photos, setPhotos] = useState<RidePhoto[]>([]);
  // Photos for every ride, keyed by ride id (shown on the ride cards).
  const [ridePhotoMap, setRidePhotoMap] = useState<
    Record<string, RidePhoto[]>
  >({});

  // Profile picture, saved on this device for the logged-in account.
  const [profilePicture, setProfilePicture] = useState(
    () => readUserSetting(PROFILE_PICTURE_KEY, user?.id) || "",
  );

  // Slow-speed alert threshold in km/h (0 = off), saved on this device for
  // the logged-in account.
  const [minSpeedAlert, setMinSpeedAlert] = useState<number>(
    () => Number(readUserSetting(MIN_SPEED_ALERT_KEY, user?.id)) || 0,
  );

  const [position, setPosition] =
    useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] =
    useState<[number, number]>(DEFAULT_CENTER);

  const [tracking, setTracking] = useState(false);
  const [followRider, setFollowRider] = useState(true);
  const stopFollowing = useCallback(() => setFollowRider(false), []);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [rideDetails, setRideDetails] = useState<SharedRide | null>(null);

  const [showStopForm, setShowStopForm] = useState(false);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const [draftPosition, setDraftPosition] =
    useState<[number, number] | null>(null);

  const [stopName, setStopName] = useState("");
  const [stopNote, setStopNote] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeNote, setPlaceNote] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoLocation, setPhotoLocation] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  const [sharedRide, setSharedRide] = useState<SharedRide | null>(null);
  // A ?share= link starts in the loading state until the shared ride arrives.
  const [sharedLoading, setSharedLoading] = useState(() =>
    new URLSearchParams(window.location.search).has("share"),
  );

  const watchId = useRef<string | number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPoints = useRef<GPSPoint[]>([]);
  const lastPosition = useRef<[number, number] | null>(null);
  const lastPointTime = useRef<number | null>(null);
  // GPS fixes rejected as glitches in a row.
  const rejectedFixes = useRef(0);
  const startedAt = useRef<number | null>(null);
  // The GPS point upload currently in flight, if any.
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  // Always holds the latest active ride so the GPS watcher never uses a stale value.
  const activeRideRef = useRef<Ride | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Preview of the photo that is about to be uploaded.
  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : ""),
    [photoFile],
  );

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const [mapMode, setMapMode] = useState<"standard" | "terrain">(
    "standard",
  );

  // Select and save a profile picture.
  const handleProfilePictureChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image.");
      event.target.value = "";
      return;
    }

    // Keep the image small enough for browser local storage.
    if (file.size > 2 * 1024 * 1024) {
      setError("Profile pictures must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not read the selected image.");
        return;
      }

      try {
        if (!user) return;
        writeUserSetting(PROFILE_PICTURE_KEY, user.id, reader.result);
        setProfilePicture(reader.result);
        setError("");
        setNotice("Profile picture updated successfully.");
      } catch {
        setError(
          "Could not save the picture. Try a smaller image.",
        );
      }
    };

    reader.onerror = () => {
      setError("Could not read the selected image.");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const updateMinSpeedAlert = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(60, Number(event.target.value) || 0));

    setMinSpeedAlert(value);

    try {
      if (user) writeUserSetting(MIN_SPEED_ALERT_KEY, user.id, String(value));
    } catch {
      /* ignore storage errors */
    }
  };

  const distanceMeters = useMemo(() => routeDistance(points), [points]);

  const trailCoordinates = useMemo(
    () =>
      points.map(
        (point) => [point.latitude, point.longitude] as [number, number],
      ),
    [points],
  );

  const liveSpeedStats = useMemo(() => computeSpeedStats(points), [points]);

  const detailSpeedStats = useMemo(
    () =>
      rideDetails
        ? rideSpeedStats(rideDetails.ride, rideDetails.points)
        : { avg: 0, max: 0, min: null },
    [rideDetails],
  );

  const sharedSpeedStats = useMemo(
    () =>
      sharedRide
        ? rideSpeedStats(sharedRide.ride, sharedRide.points)
        : { avg: 0, max: 0, min: null },
    [sharedRide],
  );

  const belowMinimumSpeed =
    tracking &&
    minSpeedAlert > 0 &&
    elapsedSeconds > 15 &&
    currentSpeed < minSpeedAlert;

  const loadRides = useCallback(async () => {
    void fetchPhotoMap().then(setRidePhotoMap);

    try {
      setRides(await fetchRides());
    } catch (err) {
      setError(errorMessage(err, "Could not load rides."));
    }
  }, []);

  const loadSavedPlaces = useCallback(async () => {
    try {
      setSavedPlaces(await fetchSavedPlaces());
    } catch (err) {
      setError(errorMessage(err, "Could not load saved places."));
    }
  }, []);

  const loadRideDetails = useCallback(async (ride: Ride) => {
    setLoading(true);
    setError("");

    try {
      const result = await api<{
        ride: Ride;
        points: GPSPoint[];
        waypoints: Waypoint[];
      }>(`/rides/${encodeURIComponent(ride.id)}`);

      const ridePhotos = await api<RidePhoto[]>(
        `/rides/${encodeURIComponent(ride.id)}/photos`,
      ).catch(() => []);

      setSelectedRide(ride);
      setRideDetails({
        ride: result.ride,
        points: result.points || [],
        waypoints: result.waypoints || [],
        photos: ridePhotos,
      });

      setPhotos(ridePhotos);
      setTab("rides");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load ride.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the user's data once logged in. State is only set from the
  // request callbacks.
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const showError = (fallback: string) => (err: unknown) => {
      if (!cancelled) setError(errorMessage(err, fallback));
    };

    fetchRides()
      .then((list) => {
        if (!cancelled) setRides(list);
      })
      .catch(showError("Could not load rides."));

    void fetchPhotoMap().then((map) => {
      if (!cancelled) setRidePhotoMap(map);
    });

    fetchSavedPlaces()
      .then((list) => {
        if (!cancelled) setSavedPlaces(list);
      })
      .catch(showError("Could not load saved places."));

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Shared ride links work without logging in.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("share");
    if (!token) return;

    let cancelled = false;

    api<SharedRide>(`/shared/${encodeURIComponent(token)}`)
      .then((result) => {
        if (!cancelled) setSharedRide(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(errorMessage(err, "Could not load shared ride."));
        }
      })
      .finally(() => {
        if (!cancelled) setSharedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);

      if (watchId.current !== null) {
        if (Capacitor.isNativePlatform()) {
          void Geolocation.clearWatch({
            id: String(watchId.current),
          });
        } else if (typeof watchId.current === "number") {
          navigator.geolocation.clearWatch(watchId.current);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!tracking) return;

    timerRef.current = setInterval(() => {
      if (startedAt.current !== null) {
        setElapsedSeconds(
          Math.floor((Date.now() - startedAt.current) / 1000),
        );
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tracking]);

  const getCurrentPosition = useCallback(async () => {
    setLocating(true);
    setError("");

    try {
      let coords: { latitude: number; longitude: number };

      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.checkPermissions();

        if (permission.location !== "granted") {
          const requested = await Geolocation.requestPermissions();

          if (requested.location !== "granted") {
            throw new Error(
              "Location permission was not granted. Enable location access for CycleTrack.",
            );
          }
        }

        const result = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 3000,
        });

        coords = result.coords;
      } else {
        coords = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported."));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (result) => resolve(result.coords),
            (geoError) =>
              reject(
                new Error(
                  geoError.message || "Could not get location.",
                ),
              ),
            {
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 3000,
            },
          );
        });
      }

      const next: [number, number] = [
        coords.latitude,
        coords.longitude,
      ];

      setPosition(next);
      setMapCenter(next);
      return next;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not get location.",
      );
      return null;
    } finally {
      setLocating(false);
    }
  }, []);

  const sendPendingPoints = useCallback(
    async (rideId: string, flushAll = false): Promise<boolean> => {
      if (inFlightRef.current) {
        if (!flushAll) return true;

        // Wait for the in-flight batch so the final flush sends everything.
        await inFlightRef.current;
      }

      do {
        // The API accepts at most 500 points per request.
        const batch = pendingPoints.current.slice(0, flushAll ? 500 : 5);

        if (!batch.length) return true;

        const request = api(`/rides/${encodeURIComponent(rideId)}/points`, {
          ...jsonOptions({ points: batch }),
        })
          .then(() => {
            pendingPoints.current.splice(0, batch.length);
            return true;
          })
          .catch((err) => {
            setError(
              err instanceof Error
                ? `GPS points could not be saved: ${err.message}`
                : "GPS points could not be saved.",
            );
            return false;
          });

        inFlightRef.current = request;
        const saved = await request;
        if (inFlightRef.current === request) inFlightRef.current = null;

        if (!saved) return false;
      } while (flushAll);

      return true;
    },
    [],
  );

  const recordPosition = useCallback(
    (coords: {
      latitude: number;
      longitude: number;
      altitude?: number | null;
      accuracy?: number | null;
      speed?: number | null;
    }) => {
      if (
        typeof coords.accuracy === "number" &&
        coords.accuracy > 60
      ) {
        return;
      }

      const now = Date.now();
      const next: [number, number] = [
        coords.latitude,
        coords.longitude,
      ];

      // Prefer the GPS-reported speed (m/s); fall back to distance / time.
      let speedMps: number | null =
        typeof coords.speed === "number" &&
        Number.isFinite(coords.speed) &&
        coords.speed >= 0
          ? coords.speed
          : null;

      const previous = lastPosition.current;

      if (previous) {
        const meters = haversine(
          { latitude: previous[0], longitude: previous[1] },
          { latitude: next[0], longitude: next[1] },
        );

        const seconds = lastPointTime.current
          ? (now - lastPointTime.current) / 1000
          : 0;

        if (speedMps === null && seconds > 0) {
          speedMps = meters / seconds;
        }

        // Barely moved: show the rider as slowing/stopped.
        if (meters < 2) {
          setCurrentSpeed(Math.min((speedMps ?? 0) * 3.6, MAX_REASONABLE_KMH));
          return;
        }

        // A jump farther than a bike could travel since the last accepted
        // point is a GPS glitch. The limit grows with time, so a signal
        // dropout (tunnel, buildings) doesn't block the rest of the ride.
        const reachable =
          GPS_JUMP_SLACK_METERS + (MAX_REASONABLE_KMH / 3.6) * seconds;

        if (meters > reachable) {
          rejectedFixes.current += 1;

          // Several rejections in a row mean the last accepted point was
          // the bad one: trust the new position instead.
          if (rejectedFixes.current < MAX_REJECTED_FIXES) return;
        }
      }

      rejectedFixes.current = 0;

      const kmh = Math.min((speedMps ?? 0) * 3.6, MAX_REASONABLE_KMH);

      lastPosition.current = next;
      lastPointTime.current = now;
      setPosition(next);
      setMapCenter(next);
      setCurrentSpeed(kmh);

      const point: GPSPoint = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude ?? null,
        accuracy: coords.accuracy ?? null,
        speed: speedMps,
        recorded_at: new Date(now).toISOString(),
      };

      setPoints((previousPoints) => [...previousPoints, point]);
      pendingPoints.current.push(point);

      const ride = activeRideRef.current;

      if (ride && pendingPoints.current.length >= 5) {
        void sendPendingPoints(ride.id);
      }
    },
    [sendPendingPoints],
  );

  // Start feeding GPS fixes into recordPosition.
  const startWatching = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      watchId.current = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 1000,
        },
        (nextPosition, watchError) => {
          if (watchError) {
            setError(watchError.message);
            return;
          }

          if (nextPosition) recordPosition(nextPosition.coords);
        },
      );
    } else {
      if (!navigator.geolocation) {
        throw new Error("Your browser does not support GPS tracking.");
      }

      watchId.current = navigator.geolocation.watchPosition(
        (result) => recordPosition(result.coords),
        (geoError) => setError(geoError.message),
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 20000,
        },
      );
    }
  }, [recordPosition]);

  const startTracking = async () => {
    setError("");
    setNotice("");

    const initialPosition = await getCurrentPosition();
    if (!initialPosition) return;

    setLoading(true);

    try {
      const ride = await api<Ride>(
        "/rides",
        jsonOptions({ title: "Cycling Ride" }),
      );

      activeRideRef.current = ride;
      setActiveRide(ride);
      setSelectedRide(null);
      setRideDetails(null);
      setPoints([]);
      setWaypoints([]);
      setPhotos([]);
      pendingPoints.current = [];
      lastPosition.current = initialPosition;
      rejectedFixes.current = 0;
      lastPointTime.current = Date.now();
      startedAt.current = Date.now();
      setElapsedSeconds(0);
      setCurrentSpeed(0);

      const initialPoint: GPSPoint = {
        latitude: initialPosition[0],
        longitude: initialPosition[1],
        recorded_at: new Date().toISOString(),
      };

      setPoints([initialPoint]);
      pendingPoints.current.push(initialPoint);
      setFollowRider(true);
      setTracking(true);
      setNotice("Ride started. Cycle safely!");

      await startWatching();
      await loadRides();
    } catch (err) {
      setTracking(false);
      activeRideRef.current = null;
      setActiveRide(null);
      setError(
        err instanceof Error ? err.message : "Could not start ride.",
      );
    } finally {
      setLoading(false);
    }
  };

  const stopTracking = async () => {
    if (!activeRide) return;

    setLoading(true);
    setError("");

    try {
      if (watchId.current !== null) {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.clearWatch({
            id: String(watchId.current),
          });
        } else if (typeof watchId.current === "number") {
          navigator.geolocation.clearWatch(watchId.current);
        }

        watchId.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Never complete the ride while points are unsaved: the server rejects
      // points for completed rides, so they would be lost for good.
      const flushed = await sendPendingPoints(activeRide.id, true);

      if (!flushed) {
        setError(
          "Could not save your last GPS points. Check your connection and tap Finish Ride again.",
        );
        return;
      }

      setTracking(false);

      const finalStats = computeSpeedStats(points);

      const completedRide = await api<Ride>(
        `/rides/${encodeURIComponent(activeRide.id)}/finish`,
        jsonOptions({
          distance_meters: distanceMeters,
          duration_seconds: elapsedSeconds,
          avg_speed_kmh: finalStats.avg,
          max_speed_kmh: finalStats.max,
          min_speed_kmh: finalStats.min,
        }),
      );

      activeRideRef.current = null;
      setActiveRide(null);
      setCurrentSpeed(0);
      setSelectedRide(completedRide);
      setNotice(
        `Ride saved! Avg ${formatSpeed(finalStats.avg || null)} · Top ${formatSpeed(finalStats.max || null)}`,
      );
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not finish ride.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Continue recording a ride that was left open (e.g. the app was closed).
  const resumeRide = useCallback(async (ride: Ride) => {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const [details, ridePhotos] = await Promise.all([
        api<{ ride: Ride; points: GPSPoint[]; waypoints: Waypoint[] }>(
          `/rides/${encodeURIComponent(ride.id)}`,
        ),
        api<RidePhoto[]>(`/rides/${encodeURIComponent(ride.id)}/photos`).catch(
          () => [] as RidePhoto[],
        ),
      ]);

      if (details.ride.status !== "active") {
        throw new Error("This ride has already been finished.");
      }

      const savedPoints = details.points || [];
      const elapsed = routeElapsedSeconds(savedPoints);

      activeRideRef.current = details.ride;
      setActiveRide(details.ride);
      setSelectedRide(null);
      setRideDetails(null);
      setPoints(savedPoints);
      setWaypoints(details.waypoints || []);
      setPhotos(ridePhotos);
      pendingPoints.current = [];
      // The rider may be far from the last saved point; accept the next fix
      // instead of rejecting it as a GPS jump.
      lastPosition.current = null;
      rejectedFixes.current = 0;
      lastPointTime.current = null;
      // Ride time continues from the recorded time, not the time spent away.
      startedAt.current = Date.now() - elapsed * 1000;
      setElapsedSeconds(elapsed);
      setCurrentSpeed(0);

      await startWatching();
      setFollowRider(true);
      setTracking(true);
      setTab("map");
      setNotice("Ride resumed. Cycle safely!");
    } catch (err) {
      activeRideRef.current = null;
      setActiveRide(null);
      setError(
        err instanceof Error ? err.message : "Could not resume ride.",
      );
    } finally {
      setLoading(false);
    }
  }, [startWatching]);

  // Finish a ride that was left open, using the points it saved.
  const finishOpenRide = async (ride: Ride) => {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const details = await api<{ ride: Ride; points: GPSPoint[] }>(
        `/rides/${encodeURIComponent(ride.id)}`,
      );

      const savedPoints = details.points || [];
      const stats = computeSpeedStats(savedPoints);

      await api<Ride>(
        `/rides/${encodeURIComponent(ride.id)}/finish`,
        jsonOptions({
          distance_meters: routeDistance(savedPoints),
          duration_seconds: routeElapsedSeconds(savedPoints),
          avg_speed_kmh: stats.avg,
          max_speed_kmh: stats.max,
          min_speed_kmh: stats.min,
        }),
      );

      setNotice("Unfinished ride saved.");
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not finish ride.",
      );
    } finally {
      setLoading(false);
    }
  };

  // The newest ride left open from an earlier session, if any.
  const openRide = tracking
    ? undefined
    : rides.find((ride) => ride.status === "active");

  const openStopForm = () => {
    if (!activeRide || !position) {
      setError("Start a ride and wait for your GPS location first.");
      return;
    }

    setDraftPosition(position);
    setStopName("");
    setStopNote("");
    setShowStopForm(true);
  };

  const saveStop = async (event: FormEvent) => {
    event.preventDefault();

    if (!activeRide || !draftPosition) {
      setError("Start a ride before adding a stop.");
      return;
    }

    if (!stopName.trim()) {
      setError("Please enter a stop name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const saved = await api<Waypoint>(
        `/rides/${encodeURIComponent(activeRide.id)}/waypoints`,
        jsonOptions({
          name: stopName.trim(),
          latitude: draftPosition[0],
          longitude: draftPosition[1],
          note: stopNote.trim(),
        }),
      );

      setWaypoints((current) => [...current, saved]);
      setShowStopForm(false);
      setNotice("Stop saved!");
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save stop.",
      );
    } finally {
      setLoading(false);
    }
  };

  const openPlaceForm = (coords?: [number, number]) => {
    setDraftPosition(coords || position || mapCenter);
    setPlaceName("");
    setPlaceNote("");
    setShowPlaceForm(true);
  };

  const savePlace = async (event: FormEvent) => {
    event.preventDefault();

    if (!draftPosition) {
      setError("Tap a location on the map first.");
      return;
    }

    if (!placeName.trim()) {
      setError("Please enter a place name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const saved = await api<SavedPlace>(
        "/places",
        jsonOptions({
          name: placeName.trim(),
          latitude: draftPosition[0],
          longitude: draftPosition[1],
          note: placeNote.trim(),
        }),
      );

      setSavedPlaces((current) => [saved, ...current]);
      setShowPlaceForm(false);
      setNotice("Place saved to your Saved Places!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save place.",
      );
    } finally {
      setLoading(false);
    }
  };

  const deletePlace = async (place: SavedPlace) => {
    if (!window.confirm(`Delete saved place "${place.name}"?`)) return;

    setError("");

    try {
      await api(`/places/${encodeURIComponent(place.id)}`, {
        method: "DELETE",
      });

      setSavedPlaces((current) =>
        current.filter((item) => item.id !== place.id),
      );
      setNotice("Saved place deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete place.",
      );
    }
  };

  const deleteRide = async (ride: Ride) => {
    if (
      !window.confirm(
        `Delete "${ride.title}"?\n\nThis permanently removes the ride, route points, stops, photos, and its share link from the database.`,
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api(`/rides/${encodeURIComponent(ride.id)}`, {
        method: "DELETE",
      });

      setRides((current) =>
        current.filter((item) => item.id !== ride.id),
      );

      if (selectedRide?.id === ride.id) {
        setSelectedRide(null);
        setRideDetails(null);
      }

      setNotice("Ride deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete ride.",
      );
    } finally {
      setLoading(false);
    }
  };

  const openPhotoForm = async () => {
    if (!activeRide) {
      setError("Start a ride before adding ride photos.");
      return;
    }

    setPhotoCaption("");
    setPhotoLocation("");
    setPhotoFile(null);
    setDraftPosition(position || null);
    setShowPhotoForm(true);
  };

  const uploadPhoto = async (event: FormEvent) => {
    event.preventDefault();

    if (!activeRide) {
      setError("Start a ride before uploading a photo.");
      return;
    }

    if (!photoFile) {
      setError("Choose a photo first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("photo", photoFile);
      formData.append("caption", photoCaption.trim());
      formData.append("location_name", photoLocation.trim());
      formData.append("captured_at", new Date().toISOString());

      if (draftPosition) {
        formData.append("latitude", String(draftPosition[0]));
        formData.append("longitude", String(draftPosition[1]));
      }

      const uploaded = await api<RidePhoto>(
        `/rides/${encodeURIComponent(activeRide.id)}/photos`,
        {
          method: "POST",
          body: formData,
        },
      );

      setPhotos((current) => [uploaded, ...current]);
      setRidePhotoMap((current) => ({
        ...current,
        [activeRide.id]: [uploaded, ...(current[activeRide.id] || [])],
      }));
      setShowPhotoForm(false);
      setNotice("Photo uploaded successfully!");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Photo upload failed: ${err.message}`
          : "Could not upload photo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const createShareLink = async (ride: Ride) => {
    setError("");
    setLoading(true);

    try {
      const result = await api<{
        share_url: string | null;
        share_token: string;
      }>(
        `/rides/${encodeURIComponent(ride.id)}/share`,
        jsonOptions({}),
      );

      const url =
        result.share_url ||
        (PUBLIC_APP_URL
          ? `${PUBLIC_APP_URL}/?share=${result.share_token}`
          : "");

      if (!url) {
        throw new Error(
          "Share links aren't set up yet: the app doesn't know its public web address.",
        );
      }

      setShareUrl(url);
      setShowShareForm(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create share link.",
      );
    } finally {
      setLoading(false);
    }
  };

  const revokeShareLink = async (ride: Ride) => {
    if (!window.confirm("Revoke this ride's public share link?")) return;

    try {
      await api(`/rides/${encodeURIComponent(ride.id)}/share`, {
        method: "DELETE",
      });

      setNotice("Share link revoked.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not revoke share link.",
      );
    }
  };

  // The download opens in a new window, which can't send the login token,
  // so ask the API for a short-lived download link first.
  const exportRide = async (ride: Ride) => {
    setError("");

    try {
      const { path } = await api<{ path: string }>(
        `/rides/${encodeURIComponent(ride.id)}/export-link`,
        { method: "POST" },
      );

      window.open(`${API}${path}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(errorMessage(err, "Could not export ride."));
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied!");
    } catch {
      setError("Could not copy automatically. Select and copy the link.");
    }
  };

  const selectSavedPlace = (place: SavedPlace) => {
    const coords: [number, number] = [
      Number(place.latitude),
      Number(place.longitude),
    ];

    setMapCenter(coords);
    setPosition(coords);
    setTab("map");
    setNotice(`Showing ${place.name} on the map.`);
  };

  const handleMapClick = (coords: [number, number]) => {
    setDraftPosition(coords);
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setPhotoFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Photo must be 8 MB or smaller.");
      event.target.value = "";
      return;
    }

    setPhotoFile(file);
    setError("");
    event.target.value = "";
  };

  const totalDistance = rides.reduce(
    (total, ride) => total + (Number(ride.distance_meters) || 0),
    0,
  );
  const totalSeconds = rides.reduce(
    (total, ride) => total + (Number(ride.duration_seconds) || 0),
    0,
  );
  const overallAvgKmh =
    totalSeconds > 0 ? (totalDistance / totalSeconds) * 3.6 : 0;
  const fastestRideKmh = rides.reduce(
    (best, ride) => Math.max(best, rideAverageKmh(ride)),
    0,
  );

  const renderRideCard = (ride: Ride) => (
    <article className="ride-card" key={ride.id}>
      <div className="ride-card-main">
        <div className="ride-card-icon">
          <Bike size={22} />
        </div>

        <div className="ride-card-info">
          <h3>{ride.title || "Cycling Ride"}</h3>
          <p>{formatDate(ride.start_time)}</p>

          <div className="ride-card-stats">
            <span>
              <Route size={14} /> {formatDistance(ride.distance_meters)}
            </span>
            <span>
              <Clock3 size={14} />{" "}
              {formatDuration(ride.duration_seconds)}
            </span>
            <span>
              <Gauge size={14} /> {formatSpeed(rideAverageKmh(ride) || null)}
            </span>
          </div>

          {(ridePhotoMap[ride.id] || []).length > 0 && (
            <button
              type="button"
              className="text-button"
              title="View ride photos"
              onClick={() => {
                setPhotos(ridePhotoMap[ride.id] || []);
                setShowGallery(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "10px 0",
              }}
            >
              {(ridePhotoMap[ride.id] || []).slice(0, 3).map((photo) => (
                <img
                  key={photo.id}
                  src={photoSrc(photo.image_url)}
                  alt={photo.caption || "Ride photo"}
                  style={{
                    width: "46px",
                    height: "46px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />
              ))}
              <span>
                <Camera size={14} /> {(ridePhotoMap[ride.id] || []).length}{" "}
                photo{(ridePhotoMap[ride.id] || []).length === 1 ? "" : "s"}
              </span>
            </button>
          )}

          <span
            className={`status-pill ${
              ride.status === "completed" ? "completed" : "active"
            }`}
          >
            {ride.status}
          </span>
        </div>
      </div>

      <div className="ride-card-actions">
        {ride.status === "active" && !tracking && (
          <>
            <button
              className="icon-button"
              title="Resume ride"
              disabled={loading}
              onClick={() => void resumeRide(ride)}
            >
              <Play size={17} />
            </button>

            <button
              className="icon-button"
              title="Finish ride"
              disabled={loading}
              onClick={() => void finishOpenRide(ride)}
            >
              <Square size={16} />
            </button>
          </>
        )}

        <button
          className="icon-button"
          title="View ride details"
          onClick={() => void loadRideDetails(ride)}
        >
          <Navigation size={17} />
        </button>

        <button
          className="icon-button"
          title="Export CSV"
          onClick={() => void exportRide(ride)}
        >
          <Download size={17} />
        </button>

        {ride.status === "completed" && (
          <>
            <button
              className="icon-button"
              title="Share ride"
              onClick={() => void createShareLink(ride)}
            >
              <Share2 size={17} />
            </button>

            <button
              className="icon-button"
              title="Revoke public share link"
              onClick={() => void revokeShareLink(ride)}
            >
              <X size={17} />
            </button>
          </>
        )}

        <button
          className="icon-button danger"
          title="Delete ride"
          onClick={() => void deleteRide(ride)}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );

  if (sharedLoading) {
    return (
      <main className="app-shell">
        <div className="empty-state">
          <LoaderCircle className="spin" size={32} />
          <p>Loading shared ride...</p>
        </div>
      </main>
    );
  }

  if (sharedRide) {
    const sharedCoordinates = sharedRide.points.map(
      (point) =>
        [Number(point.latitude), Number(point.longitude)] as [
          number,
          number,
        ],
    );

    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">
              <Bike size={24} />
            </div>
            <div>
              <h1>CycleTrack</h1>
              <p>Shared ride</p>
            </div>
          </div>

          <button
            className="secondary-button"
            onClick={() => {
              window.history.replaceState(
                {},
                "",
                window.location.pathname,
              );
              setSharedRide(null);
            }}
          >
            Open my app
          </button>
        </header>

        <section className="page-content">
          <div className="section-heading">
            <div>
              <h2>{sharedRide.ride.title}</h2>
              <p>{formatDate(sharedRide.ride.start_time)}</p>
            </div>
            <span className="status-pill completed">Public ride</span>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <Route size={20} />
              <strong>
                {formatDistance(sharedRide.ride.distance_meters)}
              </strong>
              <span>Distance</span>
            </div>

            <div className="stat-card">
              <Clock3 size={20} />
              <strong>
                {formatDuration(sharedRide.ride.duration_seconds)}
              </strong>
              <span>Duration</span>
            </div>

            <div className="stat-card">
              <MapPin size={20} />
              <strong>{sharedRide.waypoints.length}</strong>
              <span>Stops</span>
            </div>
          </div>

          <SpeedCards stats={sharedSpeedStats} />

          <div className="map-frame">
            <MapContainer
              center={sharedCoordinates[0] || DEFAULT_CENTER}
              zoom={14}
              scrollWheelZoom
              className="cycle-map"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={20}
              />

              {sharedCoordinates.length > 1 && (
                <Polyline
                  positions={sharedCoordinates}
                  pathOptions={{ color: "#2563eb", weight: 5 }}
                />
              )}

              {sharedRide.waypoints.map((point, index) => (
                <Marker
                  key={point.id ?? index}
                  position={[point.latitude, point.longitude]}
                  icon={stopIcon}
                />
              ))}
            </MapContainer>
          </div>

          <h2 className="subheading">Ride stops</h2>

          {sharedRide.waypoints.length === 0 ? (
            <p className="muted">No stops were added to this ride.</p>
          ) : (
            sharedRide.waypoints.map((point, index) => (
              <article className="simple-card" key={point.id ?? index}>
                <MapPin size={19} />
                <div>
                  <strong>{point.name}</strong>
                  {point.note && <p>{point.note}</p>}
                </div>
              </article>
            ))
          )}

          <h2 className="subheading">Ride photos</h2>

          {sharedRide.photos.length === 0 ? (
            <p className="muted">No photos are available.</p>
          ) : (
            <div className="photo-grid">
              {sharedRide.photos.map((photo) => (
                <article className="photo-card" key={photo.id}>
                  <img
                    src={photoSrc(photo.image_url)}
                    alt={photo.caption || "Ride photo"}
                  />
                  <div>
                    <strong>{photo.location_name || "Ride photo"}</strong>
                    {photo.caption && <p>{photo.caption}</p>}
                    <small>{formatDate(photo.captured_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={(loggedIn) => {
          setUser(loggedIn);
          setProfilePicture(
            readUserSetting(PROFILE_PICTURE_KEY, loggedIn.id) || "",
          );
          setMinSpeedAlert(
            Number(readUserSetting(MIN_SPEED_ALERT_KEY, loggedIn.id)) || 0,
          );
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Bike size={24} />
          </div>
          <div>
            <h1>CycleTrack</h1>
            <p>Your cycling companion</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {/* Top-right profile picture button */}
          <button
            type="button"
            className="icon-button"
            title="Open profile"
            aria-label="Open profile"
            onClick={() => setTab("profile")}
            style={{
              width: "42px",
              height: "42px",
              padding: 0,
              overflow: "hidden",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {profilePicture ? (
              <img
                src={profilePicture}
                alt="Profile"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "50%",
                }}
              />
            ) : (
              <UserRound size={21} />
            )}
          </button>

          <button
            className="icon-button"
            title="Refresh data"
            aria-label="Refresh data"
            onClick={() => {
              void loadRides();
              void loadSavedPlaces();
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className={`message-banner ${error ? "error" : "success"}`}>
          <span>{error || notice}</span>
          <button
            className="message-close"
            onClick={() => {
              setError("");
              setNotice("");
            }}
            aria-label="Dismiss message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="page-content">
        {tab === "map" && (
          <>
            <div className="section-heading">
              <div>
                <h2>{tracking ? "Ride in progress" : "Explore the map"}</h2>
                <p>
                  {tracking
                    ? "GPS tracking is active"
                    : "Find places and plan your next ride"}
                </p>
              </div>

              <button
                className="secondary-button"
                disabled={locating}
                onClick={() => void getCurrentPosition()}
              >
                {locating ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <LocateFixed size={17} />
                )}
                Locate me
              </button>
            </div>

            {openRide && (
              <div className="simple-card" role="status">
                <TriangleAlert size={19} />
                <div style={{ flex: 1 }}>
                  <strong>Unfinished ride</strong>
                  <p>
                    "{openRide.title}" from {formatDate(openRide.start_time)}{" "}
                    was never finished. Resume recording or save it as it is.
                  </p>
                  <div className="button-row">
                    <button
                      className="primary-button"
                      disabled={loading}
                      onClick={() => void resumeRide(openRide)}
                    >
                      <Play size={17} />
                      Resume
                    </button>
                    <button
                      className="secondary-button"
                      disabled={loading}
                      onClick={() => void finishOpenRide(openRide)}
                    >
                      <Square size={16} />
                      Finish
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-card">
                <Route size={20} />
                <strong>{formatDistance(distanceMeters)}</strong>
                <span>Current distance</span>
              </div>
              <div className="stat-card">
                <Clock3 size={20} />
                <strong>{formatDuration(elapsedSeconds)}</strong>
                <span>Ride time</span>
              </div>
              <div className="stat-card">
                <MapPin size={20} />
                <strong>{waypoints.length}</strong>
                <span>Ride stops</span>
              </div>
            </div>

            {/* Live speed: current / average / top / minimum */}
            <SpeedCards
              current={tracking ? currentSpeed : 0}
              stats={liveSpeedStats}
            />

            {belowMinimumSpeed && (
              <div className="message-banner error" role="alert">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <TriangleAlert size={17} />
                  Below your minimum speed of {minSpeedAlert} km/h — pick up
                  the pace!
                </span>
              </div>
            )}

            <div className="map-toolbar">
              <span>
                <MapPin size={16} />
                Tap the map to choose a place
              </span>

              <select
                aria-label="Map layer"
                value={mapMode}
                onChange={(event) =>
                  setMapMode(event.target.value as "standard" | "terrain")
                }
              >
                <option value="standard">Standard map</option>
                <option value="terrain">Terrain map</option>
              </select>

              {tracking && !followRider && (
                <button
                  type="button"
                  className="secondary-button recenter-button"
                  onClick={() => setFollowRider(true)}
                >
                  <LocateFixed size={16} />
                  Recenter
                </button>
              )}
            </div>

            <div className="map-frame">
              <MapContainer
                center={mapCenter}
                zoom={15}
                scrollWheelZoom
                className="cycle-map"
              >
                {mapMode === "terrain" ? (
                  <TileLayer
                    attribution="Map data &copy; OpenStreetMap contributors"
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                    maxZoom={17}
                  />
                ) : (
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={20}
                  />
                )}

                <MapClickHandler onMapClick={handleMapClick} />

                <FollowRider
                  position={position}
                  follow={tracking && followRider}
                  onUserPan={stopFollowing}
                />

                {position && (
                  <>
                    <Marker position={position} icon={markerIcon} />
                    <Circle
                      center={position}
                      radius={10}
                      pathOptions={{
                        color: "#2563eb",
                        fillColor: "#60a5fa",
                        fillOpacity: 0.15,
                      }}
                    />
                  </>
                )}

                {trailCoordinates.length > 1 && tracking && (
                  <Polyline
                    positions={trailCoordinates}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 9,
                      opacity: 0.9,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                )}

                {trailCoordinates.length > 1 && (
                  <Polyline
                    positions={trailCoordinates}
                    pathOptions={{
                      color: "#2563eb",
                      weight: 5,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                )}

                {tracking && trailCoordinates.length > 0 && (
                  <Circle
                    center={trailCoordinates[0]}
                    radius={6}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: "#16a34a",
                      fillOpacity: 1,
                    }}
                  />
                )}

                {waypoints.map((point) => (
                  <Marker
                    key={point.id}
                    position={[point.latitude, point.longitude]}
                    icon={stopIcon}
                  />
                ))}

                {savedPlaces.map((place) => (
                  <Marker
                    key={place.id}
                    position={[place.latitude, place.longitude]}
                    icon={savedIcon}
                  />
                ))}

                {draftPosition && (
                  <Circle
                    center={draftPosition}
                    radius={8}
                    pathOptions={{
                      color: "#16a34a",
                      fillColor: "#22c55e",
                      fillOpacity: 0.5,
                    }}
                  />
                )}
              </MapContainer>
            </div>

            {draftPosition && (
              <div className="selected-location">
                <div>
                  <strong>Selected map location</strong>
                  <p>
                    {draftPosition[0].toFixed(6)},{" "}
                    {draftPosition[1].toFixed(6)}
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => openPlaceForm(draftPosition)}
                >
                  <Bookmark size={17} />
                  Save Place
                </button>
              </div>
            )}

            <div className="map-action-grid">
              {!tracking ? (
                <button
                  className="primary-button"
                  disabled={loading}
                  onClick={() => void startTracking()}
                >
                  {loading ? (
                    <LoaderCircle className="spin" size={19} />
                  ) : (
                    <Play size={19} />
                  )}
                  Start Ride
                </button>
              ) : (
                <button
                  className="danger-button"
                  disabled={loading}
                  onClick={() => void stopTracking()}
                >
                  <Square size={18} />
                  Finish Ride
                </button>
              )}

              <button
                className="secondary-button"
                onClick={openStopForm}
                disabled={!tracking}
              >
                <Plus size={18} />
                Add Stop
              </button>

              <button
                className="secondary-button"
                onClick={() => void openPhotoForm()}
                disabled={!tracking}
              >
                <Camera size={18} />
                Add Photo
              </button>

              <button
                className="secondary-button"
                onClick={() => openPlaceForm()}
              >
                <Bookmark size={18} />
                Save Place
              </button>
            </div>

            {tracking && (
              <div className="tracking-indicator">
                <span className="live-dot" />
                Recording your ride. Keep CycleTrack open and allow GPS access.
              </div>
            )}

            {photos.length > 0 && (
              <>
                <h2 className="subheading">
                  Ride photos ({photos.length})
                </h2>
                <div className="photo-grid">
                  {photos.map((photo) => (
                    <article className="photo-card" key={photo.id}>
                      <img
                        src={photoSrc(photo.image_url)}
                        alt={photo.caption || "Ride photo"}
                      />
                      <div>
                        <strong>
                          {photo.location_name || "Ride photo"}
                        </strong>
                        {photo.caption && <p>{photo.caption}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            <h2 className="subheading">Current ride stops</h2>

            {waypoints.length === 0 ? (
              <div className="empty-card">
                <MapPin size={24} />
                <p>No stops yet. Start a ride and tap Add Stop.</p>
              </div>
            ) : (
              waypoints.map((point) => (
                <article className="simple-card" key={point.id}>
                  <MapPin size={19} />
                  <div>
                    <strong>{point.name}</strong>
                    {point.note && <p>{point.note}</p>}
                    <small>
                      {point.latitude.toFixed(5)},{" "}
                      {point.longitude.toFixed(5)}
                    </small>
                  </div>
                </article>
              ))
            )}
          </>
        )}

        {tab === "rides" && (
          <>
            <div className="section-heading">
              <div>
                <h2>Ride History</h2>
                <p>Your recorded cycling adventures</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => void loadRides()}
              >
                <RefreshCw size={17} />
                Refresh
              </button>
            </div>

            {loading && <p className="muted">Loading...</p>}

            {rides.length === 0 ? (
              <div className="empty-state">
                <History size={34} />
                <h3>No rides yet</h3>
                <p>Your completed rides will appear here.</p>
                <button
                  className="primary-button"
                  onClick={() => setTab("map")}
                >
                  <Bike size={18} />
                  Start a Ride
                </button>
              </div>
            ) : (
              <div className="ride-list">{rides.map(renderRideCard)}</div>
            )}

            {rideDetails && (
              <section className="details-panel">
                <div className="section-heading">
                  <div>
                    <h2>{rideDetails.ride.title}</h2>
                    <p>Ride details and route data</p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setRideDetails(null);
                      setSelectedRide(null);
                      setPhotos([]);
                    }}
                    aria-label="Close ride details"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <Route size={20} />
                    <strong>
                      {formatDistance(rideDetails.ride.distance_meters)}
                    </strong>
                    <span>Distance</span>
                  </div>
                  <div className="stat-card">
                    <Clock3 size={20} />
                    <strong>
                      {formatDuration(rideDetails.ride.duration_seconds)}
                    </strong>
                    <span>Duration</span>
                  </div>
                  <div className="stat-card">
                    <MapPin size={20} />
                    <strong>{rideDetails.waypoints.length}</strong>
                    <span>Stops</span>
                  </div>
                </div>

                <SpeedCards stats={detailSpeedStats} />

                <p>
                  <strong>Started:</strong>{" "}
                  {formatDate(rideDetails.ride.start_time)}
                </p>
                <p>
                  <strong>Finished:</strong>{" "}
                  {formatDate(rideDetails.ride.end_time)}
                </p>

                <div className="map-frame">
                  <MapContainer
                    center={
                      rideDetails.points.length
                        ? [
                            rideDetails.points[0].latitude,
                            rideDetails.points[0].longitude,
                          ]
                        : DEFAULT_CENTER
                    }
                    zoom={14}
                    scrollWheelZoom
                    className="cycle-map"
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maxZoom={20}
                    />

                    {rideDetails.points.length > 1 && (
                      <Polyline
                        positions={rideDetails.points.map(
                          (point) =>
                            [point.latitude, point.longitude] as [
                              number,
                              number,
                            ],
                        )}
                        pathOptions={{ color: "#2563eb", weight: 5 }}
                      />
                    )}

                    {rideDetails.waypoints.map((point) => (
                      <Marker
                        key={point.id}
                        position={[point.latitude, point.longitude]}
                        icon={stopIcon}
                      />
                    ))}
                  </MapContainer>
                </div>

                <h3 className="subheading">Stops</h3>

                {rideDetails.waypoints.length === 0 ? (
                  <p className="muted">No stops recorded for this ride.</p>
                ) : (
                  rideDetails.waypoints.map((point) => (
                    <article className="simple-card" key={point.id}>
                      <MapPin size={19} />
                      <div>
                        <strong>{point.name}</strong>
                        {point.note && <p>{point.note}</p>}
                      </div>
                    </article>
                  ))
                )}

                <h3 className="subheading">
                  Photos ({rideDetails.photos.length})
                </h3>

                {rideDetails.photos.length === 0 ? (
                  <p className="muted">No photos for this ride.</p>
                ) : (
                  <div className="photo-grid">
                    {rideDetails.photos.map((photo) => (
                      <article className="photo-card" key={photo.id}>
                        <img
                          src={photoSrc(photo.image_url)}
                          alt={photo.caption || "Ride photo"}
                        />
                        <div>
                          <strong>
                            {photo.location_name || "Ride photo"}
                          </strong>
                          {photo.caption && <p>{photo.caption}</p>}
                          <small>{formatDate(photo.captured_at)}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() => void exportRide(rideDetails.ride)}
                  >
                    <Download size={17} />
                    Export CSV
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => {
                      setPhotos(rideDetails.photos);
                      setShowGallery(true);
                    }}
                  >
                    <Camera size={17} />
                    Ride Photos ({rideDetails.photos.length})
                  </button>

                  {rideDetails.ride.status === "completed" && (
                    <button
                      className="primary-button"
                      onClick={() => void createShareLink(rideDetails.ride)}
                    >
                      <Share2 size={17} />
                      Share Ride
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {tab === "saved" && (
          <>
            <div className="section-heading">
              <div>
                <h2>Saved Places</h2>
                <p>Your favorite places, saved independently of rides</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => openPlaceForm()}
              >
                <Plus size={17} />
                Add Place
              </button>
            </div>

            {savedPlaces.length === 0 ? (
              <div className="empty-state">
                <Bookmark size={34} />
                <h3>No saved places</h3>
                <p>
                  Save a scenic spot, favorite destination, or rest stop.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setTab("map")}
                >
                  <MapPin size={18} />
                  Find a Place on Map
                </button>
              </div>
            ) : (
              <div className="saved-place-list">
                {savedPlaces.map((place) => (
                  <article className="saved-place-card" key={place.id}>
                    <div className="saved-place-icon">
                      <Bookmark size={21} />
                    </div>
                    <div className="saved-place-info">
                      <h3>{place.name}</h3>
                      {place.note && <p>{place.note}</p>}
                      <small>
                        {Number(place.latitude).toFixed(5)},{" "}
                        {Number(place.longitude).toFixed(5)}
                      </small>
                      <small>Saved {formatDate(place.created_at)}</small>
                      <button
                        className="text-button"
                        onClick={() => selectSavedPlace(place)}
                      >
                        <Navigation size={15} />
                        Show on map
                      </button>
                    </div>
                    <button
                      className="icon-button danger"
                      title={`Delete ${place.name}`}
                      onClick={() => void deletePlace(place)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "profile" && (
          <>
            <div className="profile-header">
              {/* Tap the profile picture to select another image. */}
              <button
                type="button"
                className="profile-avatar"
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Change profile picture"
                title="Change profile picture"
                style={{
                  position: "relative",
                  padding: 0,
                  overflow: "hidden",
                  cursor: "pointer",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Your profile"
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  <Bike size={36} />
                )}

                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: "30px",
                    height: "30px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    background: "#202a31",
                    border: "2px solid #fff",
                    borderRadius: "50%",
                  }}
                >
                  <Camera size={15} />
                </span>
              </button>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleProfilePictureChange}
              />

              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: "12px",
                  opacity: 0.75,
                }}
              >
                Tap your picture to change it
              </p>

              <h2>CycleTrack</h2>
              <p>Your cycling journey, all in one place.</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <History size={20} />
                <strong>{rides.length}</strong>
                <span>Total rides</span>
              </div>
              <div className="stat-card">
                <Bookmark size={20} />
                <strong>{savedPlaces.length}</strong>
                <span>Saved places</span>
              </div>
              <div className="stat-card">
                <Route size={20} />
                <strong>{formatDistance(totalDistance)}</strong>
                <span>Total recorded distance</span>
              </div>
              <div className="stat-card">
                <Gauge size={20} />
                <strong>{formatSpeed(overallAvgKmh || null)}</strong>
                <span>Overall average speed</span>
              </div>
              <div className="stat-card">
                <TrendingUp size={20} />
                <strong>{formatSpeed(fastestRideKmh || null)}</strong>
                <span>Fastest ride (avg)</span>
              </div>
            </div>

            {/* Minimum speed alert setting */}
            <div className="simple-card">
              <TriangleAlert size={19} />
              <div style={{ flex: 1 }}>
                <strong>Minimum speed alert</strong>
                <p>
                  Get a warning during a ride when you drop below this speed.
                  Set to 0 to turn it off.
                </p>
                <label htmlFor="min-speed-alert">Alert below (km/h)</label>
                <input
                  id="min-speed-alert"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={60}
                  step={1}
                  value={minSpeedAlert}
                  onChange={updateMinSpeedAlert}
                />
              </div>
            </div>

            {profilePicture && (
              <button
                className="secondary-button full-width"
                onClick={() => {
                  try {
                    writeUserSetting(PROFILE_PICTURE_KEY, user.id, null);
                    setProfilePicture("");
                    setNotice("Profile picture removed.");
                    setError("");
                  } catch {
                    setError("Could not remove the profile picture.");
                  }
                }}
              >
                <Trash2 size={17} />
                Remove profile picture
              </button>
            )}

            <button
              className="secondary-button full-width"
              onClick={() => {
                void loadRides();
                void loadSavedPlaces();
              }}
            >
              <RefreshCw size={17} />
              Refresh app data
            </button>

            <p className="muted" style={{ textAlign: "center" }}>
              Logged in as {user.email}
            </p>

            <button
              className="secondary-button full-width"
              disabled={tracking}
              title={tracking ? "Finish your ride before logging out" : ""}
              onClick={() => {
                if (window.confirm("Log out of CycleTrack on this device?")) {
                  logOut();
                }
              }}
            >
              <LogOut size={17} />
              Log out
            </button>
          </>
        )}
      </section>

      <nav className="bottom-nav">
        <button
          className={tab === "map" ? "nav-item active" : "nav-item"}
          onClick={() => setTab("map")}
        >
          <Home size={21} />
          <span>Map</span>
        </button>
        <button
          className={tab === "rides" ? "nav-item active" : "nav-item"}
          onClick={() => setTab("rides")}
        >
          <History size={21} />
          <span>Rides</span>
        </button>
        <button
          className={tab === "saved" ? "nav-item active" : "nav-item"}
          onClick={() => setTab("saved")}
        >
          <Bookmark size={21} />
          <span>Saved</span>
        </button>
        <button
          className={tab === "profile" ? "nav-item active" : "nav-item"}
          onClick={() => setTab("profile")}
        >
          {profilePicture ? (
            <img
              src={profilePicture}
              alt=""
              aria-hidden="true"
              style={{
                width: "23px",
                height: "23px",
                objectFit: "cover",
                borderRadius: "50%",
              }}
            />
          ) : (
            <UserRound size={21} />
          )}
          <span>Profile</span>
        </button>
      </nav>

      {showStopForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowStopForm(false)}
        >
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Add Ride Stop</h2>
                <p>Save a stop to your current ride.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowStopForm(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveStop}>
              <label htmlFor="stop-name">Stop name</label>
              <input
                id="stop-name"
                value={stopName}
                onChange={(event) => setStopName(event.target.value)}
                placeholder="e.g. Rest stop, scenic viewpoint"
                required
                maxLength={100}
              />

              <label htmlFor="stop-note">Description</label>
              <textarea
                id="stop-note"
                value={stopNote}
                onChange={(event) => setStopNote(event.target.value)}
                placeholder="Add details about this stop..."
                rows={3}
                maxLength={500}
              />

              <p className="coordinate-note">
                Location:{" "}
                {draftPosition
                  ? `${draftPosition[0].toFixed(6)}, ${draftPosition[1].toFixed(6)}`
                  : "Unavailable"}
              </p>

              <button
                className="primary-button full-width"
                type="submit"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Stop"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showPlaceForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPlaceForm(false)}
        >
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Save Favorite Place</h2>
                <p>This place is saved separately from your rides.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowPlaceForm(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={savePlace}>
              <label htmlFor="place-name">Place name</label>
              <input
                id="place-name"
                value={placeName}
                onChange={(event) => setPlaceName(event.target.value)}
                placeholder="e.g. Favorite beach, coffee shop"
                required
                maxLength={100}
              />

              <label htmlFor="place-note">Description (optional)</label>
              <textarea
                id="place-note"
                value={placeNote}
                onChange={(event) => setPlaceNote(event.target.value)}
                placeholder="Why do you want to save this place?"
                rows={3}
                maxLength={500}
              />

              <p className="coordinate-note">
                Coordinates:{" "}
                {draftPosition
                  ? `${draftPosition[0].toFixed(6)}, ${draftPosition[1].toFixed(6)}`
                  : "Unavailable"}
              </p>

              <button
                className="primary-button full-width"
                type="submit"
                disabled={loading}
              >
                <Bookmark size={18} />
                {loading ? "Saving..." : "Save Place"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showPhotoForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPhotoForm(false)}
        >
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Add Ride Photo</h2>
                <p>Upload a photo with its time and location.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowPhotoForm(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={uploadPhoto}>
              <label>Ride photo</label>

              {/* Opens the phone camera directly */}
              <input
                id="ride-photo-camera"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={onPhotoChange}
              />

              {/* Opens the gallery / file picker */}
              <input
                id="ride-photo-gallery"
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={onPhotoChange}
              />

              <div className="button-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={18} />
                  Take Photo
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImagePlus size={18} />
                  From Gallery
                </button>
              </div>

              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Selected ride photo preview"
                  style={{
                    width: "100%",
                    maxHeight: "240px",
                    objectFit: "cover",
                    borderRadius: "14px",
                  }}
                />
              )}

              {photoFile && (
                <p className="coordinate-note">
                  {photoFile.name} ·{" "}
                  {(photoFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}

              <label htmlFor="photo-location">Location name</label>
              <input
                id="photo-location"
                value={photoLocation}
                onChange={(event) => setPhotoLocation(event.target.value)}
                placeholder="e.g. Mountain viewpoint"
                maxLength={150}
              />

              <label htmlFor="photo-caption">Description</label>
              <textarea
                id="photo-caption"
                value={photoCaption}
                onChange={(event) => setPhotoCaption(event.target.value)}
                placeholder="Write something about this photo..."
                rows={3}
                maxLength={500}
              />

              <p className="coordinate-note">
                Capture time will be recorded when you upload the photo.
                {draftPosition
                  ? ` Location: ${draftPosition[0].toFixed(5)}, ${draftPosition[1].toFixed(5)}`
                  : ""}
              </p>

              <button
                className="primary-button full-width"
                type="submit"
                disabled={loading}
              >
                <ImagePlus size={18} />
                {loading ? "Uploading..." : "Upload Photo"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showShareForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowShareForm(false)}
        >
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Share Your Ride</h2>
                <p>Anyone with this link can view the shared ride.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowShareForm(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <label htmlFor="share-url">Share link</label>
            <input
              id="share-url"
              value={shareUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />

            <div className="button-row">
              <button
                className="primary-button"
                onClick={() => void copyShareLink()}
              >
                <Share2 size={17} />
                Copy Link
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  window.open(shareUrl, "_blank", "noopener,noreferrer")
                }
              >
                <ExternalLink size={17} />
                Open
              </button>
            </div>
          </section>
        </div>
      )}

      {showGallery && (
        <div
          className="modal-backdrop"
          onClick={() => setShowGallery(false)}
        >
          <section
            className="modal-card gallery-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Ride Photos</h2>
                <p>Photos uploaded for your ride.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowGallery(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {photos.length === 0 ? (
              <div className="empty-state">
                <Camera size={30} />
                <p>No photos uploaded for this ride.</p>
              </div>
            ) : (
              <div className="photo-grid">
                {photos.map((photo) => (
                  <article className="photo-card" key={photo.id}>
                    <img
                      src={photoSrc(photo.image_url)}
                      alt={photo.caption || "Ride photo"}
                    />
                    <div>
                      <strong>{photo.location_name || "Ride photo"}</strong>
                      {photo.caption && <p>{photo.caption}</p>}
                      <small>{formatDate(photo.captured_at)}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
