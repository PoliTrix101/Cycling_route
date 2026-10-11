
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation, type Position } from "@capacitor/geolocation";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import {
  Bike,
  MapPin,
  Clock3,
  Navigation,
  Play,
  Square,
  History,
  Bookmark,
  UserRound,
  Plus,
  Download,
  Share2,
  Crosshair,
  ChevronRight,
  ArrowLeft,
  LocateFixed,
  Route,
  ShieldCheck,
  AlertCircle,
  Gauge,
  Activity,
  Timer,
  RefreshCw,
  Target,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:4000/api"
).replace(/\/$/, "");

type Point = {
  latitude: number;
  longitude: number;
  recorded_at?: string;
  speed?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
};

type Ride = {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  distance_meters: number;
  duration_seconds: number;
  status: string;
};

type Waypoint = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  note?: string | null;
};

type Tab = "map" | "rides" | "saved" | "profile";
type GpsPosition = GeolocationPosition | Position;

const INITIAL_POSITION: [number, number] = [10.3157, 123.8854];

function MapFocus({
  position,
  enabled,
}: {
  position: [number, number];
  enabled: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (enabled) {
      map.setView(position, Math.max(map.getZoom(), 15), {
        animate: true,
      });
    }
  }, [map, position, enabled]);

  return null;
}

function formatDistance(meters: number) {
  const safeMeters = Number.isFinite(meters) ? Math.max(0, meters) : 0;

  return safeMeters >= 1000
    ? `${(safeMeters / 1000).toFixed(2)} km`
    : `${Math.round(safeMeters)} m`;
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0)
  );

  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;

  return [h, m, s]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatSpeed(speed: number) {
  return Number.isFinite(speed) ? Math.max(0, speed).toFixed(1) : "0.0";
}

function haversine(a: Point, b: Point) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const radius = 6371000;

  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(value));
}

async function getCurrentPosition(): Promise<GpsPosition> {
  if (Capacitor.isNativePlatform()) {
    let permission = await Geolocation.checkPermissions();

    if (permission.location !== "granted") {
      permission = await Geolocation.requestPermissions({
        permissions: ["location"],
      });
    }

    if (permission.location !== "granted") {
      throw new Error(
        "Allow location access to record your cycling route."
      );
    }

    return Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser does not support GPS location."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (gpsError) => {
        const message =
          gpsError.code === gpsError.PERMISSION_DENIED
            ? "Location permission is blocked. Allow location access in your device or browser settings."
            : gpsError.code === gpsError.POSITION_UNAVAILABLE
              ? "GPS could not determine your location. Try moving to an open area."
              : gpsError.code === gpsError.TIMEOUT
                ? "GPS took too long to respond. Try again outdoors."
                : "Unable to read your GPS location.";

        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  });
}

function positionToPoint(position: GpsPosition): Point {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    speed: position.coords.speed,
    recorded_at: new Date().toISOString(),
  };
}

function App() {
  const [tab, setTab] = useState<Tab>("map");
  const [position, setPosition] =
    useState<[number, number]>(INITIAL_POSITION);

  const [rides, setRides] = useState<Ride[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const [distance, setDistance] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const [tracking, setTracking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [loadingRides, setLoadingRides] = useState(true);
  const [locating, setLocating] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [waypointOpen, setWaypointOpen] = useState(false);
  const [waypointName, setWaypointName] = useState("");
  const [savingWaypoint, setSavingWaypoint] = useState(false);

  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const watchRef = useRef<number | string | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const distanceRef = useRef(0);
  const secondsRef = useRef(0);
  const trackingRef = useRef(false);
  const rideRef = useRef<Ride | null>(null);
  const startingRef = useRef(false);
  const finishingRef = useRef(false);
  const pendingPointsRef = useRef<Point[]>([]);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const updatePoints = (next: Point[]) => {
    pointsRef.current = next;
    setPoints(next);
  };

  const updateDistance = (next: number) => {
    distanceRef.current = next;
    setDistance(next);
  };

  const updateSeconds = (next: number) => {
    secondsRef.current = next;
    setSeconds(next);
  };

  const averageSpeed = seconds > 0 ? (distance / seconds) * 3.6 : 0;

  const completedRides = useMemo(
    () => rides.filter((ride) => ride.status === "completed"),
    [rides]
  );

  const totalDistance = useMemo(
    () =>
      completedRides.reduce(
        (total, ride) => total + Number(ride.distance_meters || 0),
        0
      ),
    [completedRides]
  );

  const totalRideSeconds = useMemo(
    () =>
      completedRides.reduce(
        (total, ride) => total + Number(ride.duration_seconds || 0),
        0
      ),
    [completedRides]
  );

  const routeCoordinates = useMemo(
    () =>
      points.map(
        (point): [number, number] => [
          point.latitude,
          point.longitude,
        ]
      ),
    [points]
  );

  const loadRides = useCallback(async () => {
    try {
      const response = await fetch(`${API}/rides`);

      if (!response.ok) {
        throw new Error("Unable to load ride history.");
      }

      const data: Ride[] = await response.json();
      setRides(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setError("Cannot connect to the API. Check your backend URL.");
    } finally {
      setLoadingRides(false);
    }
  }, []);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  useEffect(() => {
    if (!tracking) return;

    const timer = window.setInterval(() => {
      updateSeconds(secondsRef.current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [tracking]);

  const stopGpsWatch = useCallback(() => {
    if (watchRef.current === null) return;

    if (typeof watchRef.current === "string") {
      void Geolocation.clearWatch({ id: watchRef.current });
    } else {
      navigator.geolocation?.clearWatch(watchRef.current);
    }

    watchRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        if (typeof watchRef.current === "string") {
          void Geolocation.clearWatch({ id: watchRef.current });
        } else {
          navigator.geolocation?.clearWatch(watchRef.current);
        }
      }
    };
  }, []);

  const savePoints = async (rideId: string, batch: Point[]) => {
    if (batch.length === 0) return;

    const response = await fetch(`${API}/rides/${rideId}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: batch }),
    });

    if (!response.ok) {
      throw new Error("Could not save GPS points to the server.");
    }
  };

  const flushPendingPoints = async (rideId: string) => {
    if (savePromiseRef.current) {
      await savePromiseRef.current;
    }

    const batch = pendingPointsRef.current.splice(0);

    if (batch.length === 0) return;

    const promise = savePoints(rideId, batch);
    savePromiseRef.current = promise;

    try {
      await promise;
    } catch (err) {
      pendingPointsRef.current.unshift(...batch);
      throw err;
    } finally {
      savePromiseRef.current = null;
    }
  };

  const startRide = async () => {
    if (startingRef.current || trackingRef.current) return;

    startingRef.current = true;
    setStarting(true);
    setError("");
    setNotice("");

    try {
      const gps = await getCurrentPosition();
      const firstPoint = positionToPoint(gps);

      if (
        firstPoint.accuracy != null &&
        firstPoint.accuracy > 60
      ) {
        throw new Error(
          "GPS accuracy is too low. Wait for a better GPS signal and try again."
        );
      }

      const response = await fetch(`${API}/rides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Cycling Ride" }),
      });

      if (!response.ok) {
        throw new Error("Could not create your ride.");
      }

      const ride: Ride = await response.json();

      rideRef.current = ride;
      updatePoints([firstPoint]);
      lastPointRef.current = firstPoint;
      pendingPointsRef.current = [];

      updateDistance(0);
      updateSeconds(0);
      setCurrentSpeed(0);

      setWaypoints([]);
      setPosition([firstPoint.latitude, firstPoint.longitude]);
      setGpsAccuracy(firstPoint.accuracy ?? null);

      await savePoints(ride.id, [firstPoint]);

      trackingRef.current = true;
      setTracking(true);
      setNotice("Your ride is now recording.");

      const handleGpsUpdate = (
        location: GpsPosition | null,
        gpsError?: Error
      ) => {
        if (gpsError) {
          setError(`GPS problem: ${gpsError.message}`);
          return;
        }

        if (!location || !trackingRef.current) return;

        const point = positionToPoint(location);
        const previous = lastPointRef.current;

        setGpsAccuracy(point.accuracy ?? null);

        if (point.accuracy != null && point.accuracy > 60) {
          return;
        }

        if (previous) {
          const segment = haversine(previous, point);

          if (segment >= 150) {
            return;
          }

          if (segment > 0) {
            const previousTime = Date.parse(
              previous.recorded_at ?? ""
            );
            const currentTime = Date.parse(
              point.recorded_at ?? ""
            );
            const elapsed = (currentTime - previousTime) / 1000;

            if (
              location.coords.speed != null &&
              location.coords.speed >= 0
            ) {
              setCurrentSpeed(location.coords.speed * 3.6);
            } else if (elapsed > 0) {
              setCurrentSpeed((segment / elapsed) * 3.6);
            }

            updateDistance(distanceRef.current + segment);
          } else if (
            location.coords.speed != null &&
            location.coords.speed >= 0
          ) {
            setCurrentSpeed(location.coords.speed * 3.6);
          }
        } else if (
          location.coords.speed != null &&
          location.coords.speed >= 0
        ) {
          setCurrentSpeed(location.coords.speed * 3.6);
        }

        lastPointRef.current = point;

        const nextPoints = [...pointsRef.current, point];
        pointsRef.current = nextPoints;
        setPoints(nextPoints);

        setPosition([point.latitude, point.longitude]);
        pendingPointsRef.current.push(point);

        if (pendingPointsRef.current.length >= 5) {
          void flushPendingPoints(ride.id).catch(() => {
            setError(
              "GPS points could not be synced. Check your connection."
            );
          });
        }
      };

      if (Capacitor.isNativePlatform()) {
        watchRef.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 15000,
          },
          handleGpsUpdate
        );
      } else {
        watchRef.current = navigator.geolocation.watchPosition(
          (location) => handleGpsUpdate(location),
          (gpsError) =>
            handleGpsUpdate(null, new Error(gpsError.message)),
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 15000,
          }
        );
      }

      setTab("map");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to start your ride.";

      setError(message);
      trackingRef.current = false;
      setTracking(false);
      stopGpsWatch();
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const stopRide = async () => {
    const ride = rideRef.current;

    if (!ride || finishingRef.current) return;

    finishingRef.current = true;
    setFinishing(true);
    setError("");
    setNotice("");

    trackingRef.current = false;
    setTracking(false);
    stopGpsWatch();

    try {
      await flushPendingPoints(ride.id);

      const response = await fetch(`${API}/rides/${ride.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_meters: distanceRef.current,
          duration_seconds: secondsRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not finish your ride.");
      }

      rideRef.current = null;
      setCurrentSpeed(0);
      setNotice("Ride finished and saved successfully.");

      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Your ride data may need to be synced.`
          : "Could not finish your ride."
      );
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const addWaypoint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const ride = rideRef.current;

    if (!ride || !waypointName.trim() || savingWaypoint) return;

    setSavingWaypoint(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/rides/${ride.id}/waypoints`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: waypointName.trim(),
            latitude: position[0],
            longitude: position[1],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Could not save this waypoint.");
      }

      const waypoint: Waypoint = await response.json();

      setWaypoints((previous) => [...previous, waypoint]);
      setWaypointName("");
      setWaypointOpen(false);
      setNotice("Waypoint saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Waypoint save failed."
      );
    } finally {
      setSavingWaypoint(false);
    }
  };

  const centerOnCurrentLocation = async () => {
    if (locating) return;

    setLocating(true);
    setError("");

    try {
      const location = await getCurrentPosition();

      setPosition([
        location.coords.latitude,
        location.coords.longitude,
      ]);
      setGpsAccuracy(location.coords.accuracy);
      setNotice("Map centered on your current location.");
    } catch (gpsError) {
      setError(
        gpsError instanceof Error
          ? gpsError.message
          : "Unable to read your GPS location."
      );
    } finally {
      setLocating(false);
    }
  };

  const showTab = (nextTab: Tab) => {
    setError("");
    setNotice("");
    setTab(nextTab);
  };

  const exportRide = (ride: Ride) => {
    window.open(
      `${API}/rides/${encodeURIComponent(ride.id)}/export.csv`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // Create a share link for a completed ride.
  const shareRide = async (ride: Ride) => {
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/rides/${encodeURIComponent(ride.id)}/share`,
        {
          method: "POST",
        }
      );

      const data: {
        share_url?: string;
        error?: string;
      } = await response.json();

      if (!response.ok || !data.share_url) {
        throw new Error(
          data.error || "Could not create the share link."
        );
      }

      try {
        await navigator.clipboard.writeText(data.share_url);
        setNotice("Share link copied! Send it to your friends.");
      } catch {
        setNotice(`Copy this share link: ${data.share_url}`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not share this ride."
      );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <button
          className="brand"
          onClick={() => showTab("map")}
          aria-label="Go to map"
        >
          <span className="brand-mark">
            <Bike size={23} />
          </span>
          <span className="brand-copy">
            <strong>CycleTrack</strong>
            <small>RIDE YOUR WAY</small>
          </span>
        </button>

        <div className="header-right">
          <span className={`gps-chip ${tracking ? "gps-active" : ""}`}>
            <span className="gps-dot" />
            {tracking ? "GPS ACTIVE" : "GPS READY"}
          </span>

          <button
            className="avatar-button"
            onClick={() => showTab("profile")}
            aria-label="Open profile"
          >
            <UserRound size={19} />
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div
          className={`message-bar ${
            error ? "message-error" : "message-success"
          }`}
          role={error ? "alert" : "status"}
        >
          {error ? (
            <AlertCircle size={17} />
          ) : (
            <ShieldCheck size={17} />
          )}

          <span>{error || notice}</span>

          <button
            onClick={() => {
              setError("");
              setNotice("");
            }}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <main className="app-main">
        {tab === "map" && (
          <section className="map-screen">
            <div className="map-heading">
              <div>
                <p className="section-kicker">YOUR CYCLING DASHBOARD</p>

                <h1>{tracking ? "Ride in progress" : "Ready to ride?"}</h1>

                <p className="heading-subtitle">
                  {tracking
                    ? "Keep moving. Your ride is being recorded."
                    : "Every ride starts with one pedal stroke."}
                </p>
              </div>

              <div className="weather-placeholder">
                <Navigation size={16} />
                <span>{tracking ? "Recording" : "GPS map"}</span>
              </div>
            </div>

            <div className="map-stage">
              <MapContainer
                center={position}
                zoom={15}
                scrollWheelZoom
                zoomControl={false}
                className="cycling-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapFocus position={position} enabled={tracking} />

                {routeCoordinates.length > 1 && (
                  <Polyline
                    positions={routeCoordinates}
                    pathOptions={{
                      color: "#c7f464",
                      weight: 5,
                      opacity: 0.95,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                )}

                {gpsAccuracy != null && gpsAccuracy < 100 && (
                  <Circle
                    center={position}
                    radius={Math.max(gpsAccuracy, 5)}
                    pathOptions={{
                      color: "#c7f464",
                      fillColor: "#c7f464",
                      fillOpacity: 0.12,
                      weight: 1,
                    }}
                  />
                )}

                <Marker position={position} />

                {waypoints.map((waypoint) => (
                  <Marker
                    key={waypoint.id}
                    position={[
                      waypoint.latitude,
                      waypoint.longitude,
                    ]}
                  />
                ))}
              </MapContainer>

              <div className="map-overlay-top">
                <span className="map-tag">
                  <span className="map-tag-dot" />
                  {tracking ? "LIVE TRACKING" : "EXPLORE MAP"}
                </span>

                <button
                  className="map-float-button"
                  onClick={() => void centerOnCurrentLocation()}
                  title="Find my location"
                  aria-label="Find my location"
                  disabled={locating}
                >
                  {locating ? (
                    <RefreshCw className="spin-icon" size={19} />
                  ) : (
                    <LocateFixed size={19} />
                  )}
                </button>
              </div>

              {!tracking && routeCoordinates.length === 0 && (
                <div className="map-hint">
                  <MapPin size={15} />
                  <span>Start a ride to record your real route</span>
                </div>
              )}
            </div>

            <div className="ride-card">
              <div className="ride-card-top">
                <div>
                  <span className="ride-state-label">
                    <span
                      className={
                        tracking ? "recording-dot" : "ready-dot"
                      }
                    />
                    {tracking ? "RIDE IN PROGRESS" : "YOUR RIDE"}
                  </span>

                  <h2>{tracking ? "Keep moving" : "Ride summary"}</h2>
                </div>

                <div className="ride-icon">
                  <Bike size={24} />
                </div>
              </div>

              <div className="live-stats">
                <div className="live-stat">
                  <span>
                    <Route size={15} />
                    DISTANCE
                  </span>

                  <strong>
                    {(distance / 1000).toFixed(2)}
                    <small> km</small>
                  </strong>
                </div>

                <div className="stat-separator" />

                <div className="live-stat">
                  <span>
                    <Clock3 size={15} />
                    DURATION
                  </span>

                  <strong className="duration-number">
                    {formatDuration(seconds)}
                  </strong>
                </div>

                <div className="stat-separator" />

                <div className="live-stat">
                  <span>
                    <Gauge size={15} />
                    SPEED
                  </span>

                  <strong>
                    {tracking ? formatSpeed(currentSpeed) : "0.0"}
                    <small> km/h</small>
                  </strong>
                </div>

                <div className="stat-separator" />

                <div className="live-stat">
                  <span>
                    <Activity size={15} />
                    AVG SPEED
                  </span>

                  <strong>
                    {formatSpeed(averageSpeed)}
                    <small> km/h</small>
                  </strong>
                </div>
              </div>

              {!tracking ? (
                <button
                  className="start-button"
                  onClick={() => void startRide()}
                  disabled={starting || finishing}
                >
                  <span className="start-icon">
                    <Play size={18} fill="currentColor" />
                  </span>

                  {starting ? "Getting GPS fix..." : "Start ride"}
                </button>
              ) : (
                <div className="active-controls">
                  <button
                    className="waypoint-button"
                    onClick={() => setWaypointOpen(true)}
                  >
                    <Plus size={19} />
                    Add stop
                  </button>

                  <button
                    className="stop-button"
                    onClick={() => void stopRide()}
                    disabled={finishing}
                  >
                    <Square size={16} fill="currentColor" />
                    {finishing ? "Saving ride..." : "Finish ride"}
                  </button>
                </div>
              )}

              {tracking && (
                <div className="tracking-caption">
                  <span className="pulse-dot" />

                  <span>
                    {gpsAccuracy == null
                      ? "Recording GPS location."
                      : `GPS accuracy: approximately ${Math.round(
                          gpsAccuracy
                        )} m.`}{" "}
                    Keep the app open during your ride.
                  </span>
                </div>
              )}
            </div>

            <div className="quick-tip">
              <div className="tip-icon">
                <Target size={19} />
              </div>

              <div>
                <strong>Make every mile count</strong>
                <p>
                  {completedRides.length} completed{" "}
                  {completedRides.length === 1 ? "ride" : "rides"} ·{" "}
                  {formatDistance(totalDistance)} recorded in total
                </p>
              </div>

              <ChevronRight size={18} />
            </div>
          </section>
        )}

        {tab === "rides" && (
          <section className="content-screen">
            <button
              className="back-link"
              onClick={() => showTab("map")}
            >
              <ArrowLeft size={17} />
              Back to map
            </button>

            <p className="section-kicker">YOUR CYCLING JOURNEY</p>
            <h1>Ride history</h1>

            <p className="heading-subtitle">
              Review your completed rides, share your rides, and export
              your records.
            </p>

            <div className="history-summary">
              <div>
                <span>TOTAL DISTANCE</span>
                <strong>{formatDistance(totalDistance)}</strong>
              </div>

              <div>
                <span>COMPLETED RIDES</span>
                <strong>{completedRides.length}</strong>
              </div>

              <div>
                <span>TOTAL RIDE TIME</span>
                <strong>{formatDuration(totalRideSeconds)}</strong>
              </div>
            </div>

            <div className="content-section-title">
              <h2>Previous rides</h2>

              <button
                onClick={() => void loadRides()}
                className="text-action"
                disabled={loadingRides}
              >
                <RefreshCw
                  size={14}
                  className={loadingRides ? "spin-icon" : ""}
                />
                Refresh
              </button>
            </div>

            {loadingRides ? (
              <div className="empty-card">Loading your rides...</div>
            ) : rides.length === 0 ? (
              <div className="empty-card">
                <div className="empty-icon">
                  <Bike size={28} />
                </div>

                <h3>No rides recorded</h3>

                <p>
                  Your rides will appear here after you finish and save
                  your first trip.
                </p>

                <button
                  className="small-primary"
                  onClick={() => showTab("map")}
                >
                  Start a ride
                </button>
              </div>
            ) : (
              <div className="ride-history-list">
                {rides.map((ride) => (
                  <article className="history-card" key={ride.id}>
                    <div className="history-icon">
                      <Bike size={22} />
                    </div>

                    <div className="history-main">
                      <strong>{ride.title || "Cycling Ride"}</strong>

                      <span>
                        {new Date(ride.start_time).toLocaleString()}
                      </span>

                      <div className="history-metrics">
                        <span>
                          <Route size={13} />
                          {formatDistance(
                            Number(ride.distance_meters || 0)
                          )}
                        </span>

                        <span>
                          <Clock3 size={13} />
                          {formatDuration(
                            Number(ride.duration_seconds || 0)
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="history-actions">
                      <span
                        className={`history-status ${ride.status}`}
                      >
                        {ride.status}
                      </span>

                      {ride.status === "completed" && (
                        <>
                          <button
                            className="icon-action"
                            onClick={() => exportRide(ride)}
                            aria-label="Export ride CSV"
                            title="Export CSV"
                          >
                            <Download size={18} />
                          </button>

                          <button
                            className="icon-action"
                            onClick={() => void shareRide(ride)}
                            aria-label="Share ride"
                            title="Create share link"
                          >
                            <Share2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "saved" && (
          <section className="content-screen">
            <button
              className="back-link"
              onClick={() => showTab("map")}
            >
              <ArrowLeft size={17} />
              Back to map
            </button>

            <p className="section-kicker">YOUR FAVORITE PLACES</p>
            <h1>Saved places</h1>

            <p className="heading-subtitle">
              Places marked during your current ride.
            </p>

            {!waypoints.length ? (
              <div className="empty-card saved-empty">
                <div className="empty-icon">
                  <Bookmark size={27} />
                </div>

                <h3>No saved places yet</h3>

                <p>
                  Start a ride and add a waypoint to mark a place along
                  your route.
                </p>

                <button
                  className="small-primary"
                  onClick={() => showTab("map")}
                >
                  Go to map
                </button>
              </div>
            ) : (
              <div className="saved-list">
                {waypoints.map((waypoint) => (
                  <article className="saved-card" key={waypoint.id}>
                    <div className="saved-pin">
                      <MapPin size={21} />
                    </div>

                    <div className="saved-main">
                      <strong>{waypoint.name}</strong>

                      <span>
                        {waypoint.latitude.toFixed(5)},{" "}
                        {waypoint.longitude.toFixed(5)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="saved-note">
              <AlertCircle size={15} />
              Waypoints belong to the ride where you marked them.
            </p>
          </section>
        )}

        {tab === "profile" && (
          <section className="content-screen">
            <p className="section-kicker">RIDER ACCOUNT</p>
            <h1>Your profile</h1>

            <p className="heading-subtitle">
              Your cycling activity at a glance.
            </p>

            <div className="profile-card">
              <div className="profile-avatar">
                <Bike size={32} />
              </div>

              <div>
                <h2>Cyclist</h2>
                <p>Ready for your next ride</p>
              </div>
            </div>

            <div className="content-section-title profile-section-title">
              <h2>Your activity</h2>
            </div>

            <div className="profile-stats">
              <div>
                <span className="profile-stat-icon">
                  <Bike size={18} />
                </span>
                <strong>{completedRides.length}</strong>
                <span>Completed rides</span>
              </div>

              <div>
                <span className="profile-stat-icon">
                  <Route size={18} />
                </span>
                <strong>{formatDistance(totalDistance)}</strong>
                <span>Total distance</span>
              </div>

              <div>
                <span className="profile-stat-icon">
                  <Timer size={18} />
                </span>
                <strong>{formatDuration(totalRideSeconds)}</strong>
                <span>Total ride time</span>
              </div>

              <div>
                <span className="profile-stat-icon">
                  <Activity size={18} />
                </span>
                <strong>
                  {completedRides.length
                    ? formatDistance(
                        totalDistance / completedRides.length
                      )
                    : "0 m"}
                </strong>
                <span>Average ride distance</span>
              </div>
            </div>

            <div className="profile-note">
              <ShieldCheck size={18} />
              <div>
                <strong>Your rides, your progress</strong>
                <p>
                  Activity totals are calculated from completed rides
                  returned by your CycleTrack server.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button
          className={tab === "map" ? "nav-button selected" : "nav-button"}
          onClick={() => showTab("map")}
          aria-current={tab === "map" ? "page" : undefined}
        >
          <span>
            <Navigation size={21} />
          </span>
          <small>Map</small>
        </button>

        <button
          className={tab === "rides" ? "nav-button selected" : "nav-button"}
          onClick={() => showTab("rides")}
          aria-current={tab === "rides" ? "page" : undefined}
        >
          <span>
            <History size={21} />
          </span>
          <small>Rides</small>
        </button>

        <button
          className={tab === "saved" ? "nav-button selected" : "nav-button"}
          onClick={() => showTab("saved")}
          aria-current={tab === "saved" ? "page" : undefined}
        >
          <span>
            <Bookmark size={21} />
          </span>
          <small>Saved</small>
        </button>

        <button
          className={
            tab === "profile" ? "nav-button selected" : "nav-button"
          }
          onClick={() => showTab("profile")}
          aria-current={tab === "profile" ? "page" : undefined}
        >
          <span>
            <UserRound size={21} />
          </span>
          <small>Profile</small>
        </button>
      </nav>

      {waypointOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setWaypointOpen(false)}
        >
          <form
            className="waypoint-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={addWaypoint}
          >
            <div className="modal-grabber" />

            <div className="modal-heading">
              <div className="modal-pin">
                <MapPin size={22} />
              </div>

              <div>
                <h2>Add a stop</h2>
                <p>Save a place at your current GPS location.</p>
              </div>
            </div>

            <label htmlFor="waypoint-name">Place name</label>

            <input
              id="waypoint-name"
              autoFocus
              value={waypointName}
              onChange={(event) => setWaypointName(event.target.value)}
              placeholder="e.g. Water break"
              maxLength={100}
              required
            />

            <p className="modal-coordinates">
              <Crosshair size={14} />
              {position[0].toFixed(5)}, {position[1].toFixed(5)}
            </p>

            <button
              className="start-button"
              type="submit"
              disabled={savingWaypoint || !waypointName.trim()}
            >
              {savingWaypoint ? "Saving place..." : "Save waypoint"}
            </button>

            <button
              className="modal-cancel"
              type="button"
              onClick={() => setWaypointOpen(false)}
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
