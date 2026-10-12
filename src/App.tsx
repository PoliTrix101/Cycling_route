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
  Share2,
  Copy,
  Camera,
  ImagePlus,
  X,
  ExternalLink,
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

type RidePhoto = {
  id: string | number;
  ride_id?: string;
  image_url: string;
  caption?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  captured_at?: string | null;
  created_at?: string | null;
};

type SharedRideData = {
  ride: Ride;
  points: Point[];
  waypoints: Waypoint[];
  photos: RidePhoto[];
};

type Tab = "map" | "rides" | "saved" | "profile";
type GpsPosition = GeolocationPosition | Position;

const INITIAL_POSITION: [number, number] = [10.3157, 123.8854];

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const resizeMap = () => {
      map.invalidateSize({ pan: false });
    };

    const firstTimeout = window.setTimeout(resizeMap, 150);
    const secondTimeout = window.setTimeout(resizeMap, 500);

    window.addEventListener("resize", resizeMap);

    let observer: ResizeObserver | undefined;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resizeMap);

      const container = map.getContainer();
      observer.observe(container);

      if (container.parentElement) {
        observer.observe(container.parentElement);
      }
    }

    return () => {
      window.clearTimeout(firstTimeout);
      window.clearTimeout(secondTimeout);
      window.removeEventListener("resize", resizeMap);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

function MapFocus({
  position,
  enabled,
  recenterKey,
}: {
  position: [number, number];
  enabled: boolean;
  recenterKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize({ pan: false });
  }, [map]);

  useEffect(() => {
    if (!enabled) return;

    // Keep the current GPS position centered while recording.
    // Disable animation here to avoid jitter on frequent GPS updates.
    map.setView(position, Math.max(map.getZoom(), 15), {
      animate: false,
    });
  }, [map, position, enabled]);

  useEffect(() => {
    if (recenterKey === 0) return;

    // Animated recentering happens only when requested by the user.
    map.flyTo(position, Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.8,
    });
  }, [map, position, recenterKey]);

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

function formatDate(value?: string | null) {
  if (!value) return "Date not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date not available"
    : date.toLocaleString();
}

function localDateTimeValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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

  const [recenterKey, setRecenterKey] = useState(0);

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
  const [waypointPhotoFile, setWaypointPhotoFile] =
    useState<File | null>(null);
  const [waypointDescription, setWaypointDescription] = useState("");
  const [waypointPhotoCapturedAt, setWaypointPhotoCapturedAt] =
    useState(localDateTimeValue());

  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const [shareRide, setShareRide] = useState<Ride | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [creatingShare, setCreatingShare] = useState(false);
  const [revokingShare, setRevokingShare] = useState(false);

  const [photoRide, setPhotoRide] = useState<Ride | null>(null);
  const [photos, setPhotos] = useState<RidePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoLocation, setPhotoLocation] = useState("");
  const [photoCapturedAt, setPhotoCapturedAt] =
    useState(localDateTimeValue());

  const [photoCoordinates, setPhotoCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [sharedRideData, setSharedRideData] =
    useState<SharedRideData | null>(null);
  const [sharedRideLoading, setSharedRideLoading] = useState(false);
  const [sharedRideError, setSharedRideError] = useState("");

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

  const sharedToken = useMemo(
    () => new URLSearchParams(window.location.search).get("share"),
    []
  );

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

  const sharedRouteCoordinates = useMemo(
    () =>
      (sharedRideData?.points ?? []).map(
        (point): [number, number] => [
          point.latitude,
          point.longitude,
        ]
      ),
    [sharedRideData]
  );

  const loadRides = useCallback(async () => {
    try {
      const response = await fetch(`${API}/rides`);

      if (!response.ok) {
        throw new Error("Unable to load ride history.");
      }

      const data = await response.json();
      setRides(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setError("Cannot connect to the API. Check your backend URL.");
    } finally {
      setLoadingRides(false);
    }
  }, []);

  useEffect(() => {
    if (sharedToken) {
      setSharedRideLoading(true);
      setSharedRideError("");

      fetch(`${API}/shared/${encodeURIComponent(sharedToken)}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              "This shared ride could not be found. The link may have expired or been revoked."
            );
          }

          return response.json();
        })
        .then((data) => {
          const rideData = data?.ride
            ? data
            : data?.data?.ride
              ? data.data
              : null;

          if (!rideData?.ride) {
            throw new Error("The server returned an invalid shared ride.");
          }

          setSharedRideData({
            ride: rideData.ride,
            points: Array.isArray(rideData.points)
              ? rideData.points
              : [],
            waypoints: Array.isArray(rideData.waypoints)
              ? rideData.waypoints
              : [],
            photos: Array.isArray(rideData.photos)
              ? rideData.photos
              : [],
          });
        })
        .catch((err) => {
          setSharedRideError(
            err instanceof Error
              ? err.message
              : "Unable to load this shared ride."
          );
        })
        .finally(() => setSharedRideLoading(false));

      return;
    }

    void loadRides();
  }, [loadRides, sharedToken]);

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
      setRecenterKey((previous) => previous + 1);

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
          (location, gpsError) => {
            handleGpsUpdate(
              location,
              gpsError
                ? new Error(String(gpsError.message ?? gpsError))
                : undefined
            );
          }
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

    if (
      waypointPhotoFile &&
      waypointPhotoFile.size > 8 * 1024 * 1024
    ) {
      setError("The photo must be 8 MB or smaller.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (
      waypointPhotoFile &&
      !allowedTypes.includes(waypointPhotoFile.type)
    ) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    setSavingWaypoint(true);
    setError("");
    setNotice("");

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
            note: waypointDescription.trim(),
          }),
        }
      );

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          responseData.error ||
            responseData.message ||
            "Could not save this waypoint."
        );
      }

      const waypoint: Waypoint =
        responseData.waypoint ??
        responseData.data?.waypoint ??
        responseData;

      setWaypoints((previous) => [...previous, waypoint]);

      let photoSaved = false;

      if (waypointPhotoFile) {
        const formData = new FormData();

        formData.append("photo", waypointPhotoFile);
        formData.append("caption", waypointDescription.trim());
        formData.append("location_name", waypointName.trim());
        formData.append(
          "captured_at",
          waypointPhotoCapturedAt
            ? new Date(waypointPhotoCapturedAt).toISOString()
            : new Date().toISOString()
        );
        formData.append("latitude", String(position[0]));
        formData.append("longitude", String(position[1]));

        const photoResponse = await fetch(
          `${API}/rides/${ride.id}/photos`,
          {
            method: "POST",
            body: formData,
          }
        );

        const photoData = await photoResponse.json().catch(() => ({}));

        if (!photoResponse.ok) {
          setError(
            `Stop saved, but the photo could not be uploaded: ${
              photoData.error ||
              photoData.message ||
              "Please check your photo API."
            }`
          );
        } else {
          photoSaved = true;
        }
      }

      setWaypointName("");
      setWaypointDescription("");
      setWaypointPhotoFile(null);
      setWaypointPhotoCapturedAt(localDateTimeValue());
      setWaypointOpen(false);

      if (!waypointPhotoFile) {
        setNotice("Stop saved. You can add a photo next time too.");
      } else if (photoSaved) {
        setNotice("Stop and photo saved with location and time.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Stop save failed."
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

      const nextPosition: [number, number] = [
        location.coords.latitude,
        location.coords.longitude,
      ];

      setPosition(nextPosition);
      setGpsAccuracy(location.coords.accuracy);

      // Trigger the map's animated recenter action.
      setRecenterKey((previous) => previous + 1);

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

  const createShareLink = async (ride: Ride) => {
    setCreatingShare(true);
    setError("");
    setNotice("");
    setShareRide(ride);
    setShareUrl("");

    try {
      const response = await fetch(`${API}/rides/${ride.id}/share`, {
        method: "POST",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Could not create a share link. Check your backend settings."
        );
      }

      if (!data.share_url) {
        throw new Error(
          "The server did not return a share URL. Check FRONTEND_URL in Railway."
        );
      }

      setShareUrl(data.share_url);
      setNotice("Your ride share link is ready.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create the share link."
      );
    } finally {
      setCreatingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied to clipboard.");
    } catch {
      setError(
        "Clipboard access is unavailable. Select and copy the link manually."
      );
    }
  };

  const revokeShareLink = async () => {
    if (!shareRide || revokingShare) return;

    const confirmed = window.confirm(
      "Revoke this ride's share link? Anyone using the old link will no longer be able to open it."
    );

    if (!confirmed) return;

    setRevokingShare(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/rides/${shareRide.id}/share`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Could not revoke the share link."
        );
      }

      setShareUrl("");
      setNotice("The share link has been revoked.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not revoke the share link."
      );
    } finally {
      setRevokingShare(false);
    }
  };

  const openPhotos = async (ride: Ride) => {
    setPhotoRide(ride);
    setPhotos([]);
    setPhotoFile(null);
    setPhotoCaption("");
    setPhotoLocation("");
    setPhotoCapturedAt(localDateTimeValue());
    setPhotoCoordinates(null);
    setLoadingPhotos(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/rides/${ride.id}/photos`);

      if (!response.ok) {
        throw new Error("Could not load this ride's photos.");
      }

      const data = await response.json();

      const photoList = Array.isArray(data)
        ? data
        : Array.isArray(data.photos)
          ? data.photos
          : [];

      setPhotos(photoList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load the photo gallery."
      );
    } finally {
      setLoadingPhotos(false);
    }
  };

  const usePhotoGps = async () => {
    setError("");

    try {
      const location = await getCurrentPosition();

      setPhotoCoordinates({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setNotice("Current GPS coordinates added to the photo.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not get GPS coordinates."
      );
    }
  };

  const uploadRidePhoto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!photoRide || !photoFile || uploadingPhoto) return;

    if (photoFile.size > 8 * 1024 * 1024) {
      setError("The photo must be 8 MB or smaller.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(photoFile.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    setUploadingPhoto(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();

      formData.append("photo", photoFile);
      formData.append("caption", photoCaption.trim());
      formData.append("location_name", photoLocation.trim());
      formData.append(
        "captured_at",
        photoCapturedAt
          ? new Date(photoCapturedAt).toISOString()
          : new Date().toISOString()
      );

      if (photoCoordinates) {
        formData.append(
          "latitude",
          String(photoCoordinates.latitude)
        );
        formData.append(
          "longitude",
          String(photoCoordinates.longitude)
        );
      }

      const response = await fetch(
        `${API}/rides/${photoRide.id}/photos`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Photo upload failed."
        );
      }

      setNotice("Photo uploaded successfully.");
      setPhotoFile(null);
      setPhotoCaption("");
      setPhotoLocation("");
      setPhotoCapturedAt(localDateTimeValue());
      setPhotoCoordinates(null);

      const galleryResponse = await fetch(
        `${API}/rides/${photoRide.id}/photos`
      );

      if (galleryResponse.ok) {
        const galleryData = await galleryResponse.json();

        setPhotos(
          Array.isArray(galleryData)
            ? galleryData
            : Array.isArray(galleryData.photos)
              ? galleryData.photos
              : []
        );
      } else if (data.photo) {
        setPhotos((previous) => [data.photo, ...previous]);
      } else if (data.image_url) {
        setPhotos((previous) => [data, ...previous]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Photo upload failed."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (sharedToken) {
    if (sharedRideLoading) {
      return (
        <div className="app">
          <main className="content-screen">
            <div className="empty-card">
              <RefreshCw className="spin-icon" size={25} />
              <h3>Loading shared ride...</h3>
              <p>Getting the ride route and details.</p>
            </div>
          </main>
        </div>
      );
    }

    if (sharedRideError || !sharedRideData) {
      return (
        <div className="app">
          <header className="app-header">
            <div className="brand">
              <span className="brand-mark">
                <Bike size={23} />
              </span>
              <span className="brand-copy">
                <strong>CycleTrack</strong>
                <small>SHARED RIDE</small>
              </span>
            </div>
          </header>

          <main className="content-screen">
            <div className="empty-card">
              <div className="empty-icon">
                <AlertCircle size={28} />
              </div>
              <h3>Unable to open this ride</h3>
              <p>
                {sharedRideError ||
                  "This shared ride may no longer be available."}
              </p>
              <a className="small-primary" href="/">
                Open CycleTrack
              </a>
            </div>
          </main>
        </div>
      );
    }

    const publicRide = sharedRideData.ride;
    const publicPoints = sharedRideData.points;
    const publicWaypoints = sharedRideData.waypoints;
    const publicPhotos = sharedRideData.photos;

    const publicCenter: [number, number] =
      publicPoints.length > 0
        ? [
            publicPoints[0].latitude,
            publicPoints[0].longitude,
          ]
        : INITIAL_POSITION;

    return (
      <div className="app">
        <header className="app-header">
          <a className="brand" href="/" aria-label="Open CycleTrack">
            <span className="brand-mark">
              <Bike size={23} />
            </span>
            <span className="brand-copy">
              <strong>CycleTrack</strong>
              <small>SHARED RIDE</small>
            </span>
          </a>

          <a className="text-action" href="/">
            <ExternalLink size={15} />
            CycleTrack
          </a>
        </header>

        <main className="content-screen">
          <p className="section-kicker">SHARED CYCLING JOURNEY</p>
          <h1>{publicRide.title || "Cycling Ride"}</h1>
          <p className="heading-subtitle">
            This ride was shared with you through CycleTrack.
          </p>

          <div className="history-summary">
            <div>
              <span>DISTANCE</span>
              <strong>
                {formatDistance(Number(publicRide.distance_meters || 0))}
              </strong>
            </div>
            <div>
              <span>DURATION</span>
              <strong>
                {formatDuration(
                  Number(publicRide.duration_seconds || 0)
                )}
              </strong>
            </div>
            <div>
              <span>STATUS</span>
              <strong>{publicRide.status}</strong>
            </div>
          </div>

          <div className="profile-note">
            <Clock3 size={18} />
            <div>
              <strong>Ride date</strong>
              <p>{formatDate(publicRide.start_time)}</p>
            </div>
          </div>

          <div className="content-section-title">
            <h2>Recorded route</h2>
            <span>{publicPoints.length} GPS points</span>
          </div>

          <div className="map-stage">
            <MapContainer
              center={publicCenter}
              zoom={14}
              scrollWheelZoom
              className="cycling-map"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                maxZoom={20}
              />

              <MapResizeFix />

              {sharedRouteCoordinates.length > 1 && (
                <Polyline
                  positions={sharedRouteCoordinates}
                  pathOptions={{
                    color: "#c7f464",
                    weight: 5,
                    opacity: 0.95,
                  }}
                />
              )}

              {publicPoints.length > 0 && (
                <Marker
                  position={[
                    publicPoints[0].latitude,
                    publicPoints[0].longitude,
                  ]}
                />
              )}

              {publicWaypoints.map((waypoint) => (
                <Marker
                  key={waypoint.id}
                  position={[
                    waypoint.latitude,
                    waypoint.longitude,
                  ]}
                />
              ))}
            </MapContainer>
          </div>

          {publicWaypoints.length > 0 && (
            <>
              <div className="content-section-title">
                <h2>Saved stops</h2>
              </div>

              <div className="saved-list">
                {publicWaypoints.map((waypoint) => (
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
                      {waypoint.note && <p>{waypoint.note}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="content-section-title">
            <h2>Ride photos</h2>
            <span>{publicPhotos.length} photos</span>
          </div>

          {publicPhotos.length === 0 ? (
            <div className="empty-card">
              <Camera size={25} />
              <p>No photos were included with this ride.</p>
            </div>
          ) : (
            <div className="photo-gallery">
              {publicPhotos.map((photo) => (
                <article className="photo-card" key={photo.id}>
                  <a
                    href={photo.image_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open full-size ride photo"
                  >
                    <img
                      src={photo.image_url}
                      alt={photo.caption || "Cycling ride"}
                      loading="lazy"
                    />
                  </a>

                  <div className="photo-card-info">
                    <strong>{photo.caption || "Ride photo"}</strong>

                    {photo.location_name && (
                      <span>
                        <MapPin size={13} />
                        {photo.location_name}
                      </span>
                    )}

                    <small>
                      {formatDate(
                        photo.captured_at || photo.created_at
                      )}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="profile-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Shared through CycleTrack</strong>
              <p>
                This page is accessible to anyone who has this share link.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
                  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  maxZoom={20}
                />

                <MapResizeFix />

                <MapFocus
                  position={position}
                  enabled={tracking}
                  recenterKey={recenterKey}
                />

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
              Review your completed rides, share memories, and export your records.
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
                      <span>{formatDate(ride.start_time)}</span>

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
                      <span className={`history-status ${ride.status}`}>
                        {ride.status}
                      </span>

                      {ride.status === "completed" && (
                        <div className="ride-action-buttons">
                          <button
                            className="icon-action"
                            onClick={() => void createShareLink(ride)}
                            aria-label="Share ride"
                            title="Share ride"
                          >
                            <Share2 size={18} />
                          </button>

                          <button
                            className="icon-action"
                            onClick={() => void openPhotos(ride)}
                            aria-label="Ride photos"
                            title="Ride photos"
                          >
                            <Camera size={18} />
                          </button>

                          <button
                            className="icon-action"
                            onClick={() => exportRide(ride)}
                            aria-label="Export ride CSV"
                            title="Export CSV"
                          >
                            <Download size={18} />
                          </button>
                        </div>
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
                      {waypoint.note && <p>{waypoint.note}</p>}
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
          <span><Navigation size={21} /></span>
          <small>Map</small>
        </button>

        <button
          className={tab === "rides" ? "nav-button selected" : "nav-button"}
          onClick={() => showTab("rides")}
          aria-current={tab === "rides" ? "page" : undefined}
        >
          <span><History size={21} /></span>
          <small>Rides</small>
        </button>

        <button
          className={tab === "saved" ? "nav-button selected" : "nav-button"}
          onClick={() => showTab("saved")}
          aria-current={tab === "saved" ? "page" : undefined}
        >
          <span><Bookmark size={21} /></span>
          <small>Saved</small>
        </button>

        <button
          className={
            tab === "profile" ? "nav-button selected" : "nav-button"
          }
          onClick={() => showTab("profile")}
          aria-current={tab === "profile" ? "page" : undefined}
        >
          <span><UserRound size={21} /></span>
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
              Current GPS: {position[0].toFixed(5)}, {position[1].toFixed(5)}
            </p>

            <div className="waypoint-photo-section">
              <div className="waypoint-photo-title">
                <Camera size={17} />
                <strong>Add a photo of this stop (optional)</strong>
              </div>

              <label htmlFor="waypoint-photo">
                Take a photo or choose one
              </label>
              <input
                id="waypoint-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setWaypointPhotoFile(file);

                  if (file) {
                    setWaypointPhotoCapturedAt(localDateTimeValue());
                  }
                }}
              />

              <label htmlFor="waypoint-description">
                Description / memory
              </label>
              <textarea
                id="waypoint-description"
                value={waypointDescription}
                onChange={(event) =>
                  setWaypointDescription(event.target.value)
                }
                placeholder="What did you see here? Add a note about this stop..."
                rows={3}
                maxLength={1000}
              />

              <label htmlFor="waypoint-photo-time">Photo time</label>
              <input
                id="waypoint-photo-time"
                type="datetime-local"
                value={waypointPhotoCapturedAt}
                onChange={(event) =>
                  setWaypointPhotoCapturedAt(event.target.value)
                }
              />

              <small className="field-help">
                Time is filled in when you select or take the photo.
                GPS coordinates are saved with it.
              </small>
            </div>

            <button
              className="start-button"
              type="submit"
              disabled={savingWaypoint || !waypointName.trim()}
            >
              {savingWaypoint
                ? waypointPhotoFile
                  ? "Saving stop and photo..."
                  : "Saving stop..."
                : waypointPhotoFile
                  ? "Save stop + photo"
                  : "Save stop"}
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

      {shareRide && (
        <div
          className="modal-backdrop"
          onClick={() => setShareRide(null)}
        >
          <section
            className="waypoint-modal feature-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="feature-modal-close"
              onClick={() => setShareRide(null)}
              aria-label="Close share dialog"
            >
              <X size={20} />
            </button>

            <div className="modal-heading">
              <div className="modal-pin">
                <Share2 size={22} />
              </div>
              <div>
                <h2>Share your ride</h2>
                <p>{shareRide.title || "Cycling Ride"}</p>
              </div>
            </div>

            {creatingShare ? (
              <div className="empty-card">
                <RefreshCw className="spin-icon" size={22} />
                <p>Creating your share link...</p>
              </div>
            ) : shareUrl ? (
              <>
                <p className="feature-help">
                  Anyone with this link can view the shared ride, route,
                  saved stops, and attached photos.
                </p>

                <label htmlFor="share-url">Your share link</label>
                <input
                  id="share-url"
                  value={shareUrl}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />

                <button
                  type="button"
                  className="start-button"
                  onClick={() => void copyShareLink()}
                >
                  <Copy size={17} />
                  Copy share link
                </button>

                <button
                  type="button"
                  className="modal-cancel"
                  onClick={() =>
                    window.open(
                      shareUrl,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  <ExternalLink size={16} />
                  Preview shared page
                </button>

                <button
                  type="button"
                  className="modal-cancel danger-action"
                  onClick={() => void revokeShareLink()}
                  disabled={revokingShare}
                >
                  {revokingShare
                    ? "Revoking link..."
                    : "Revoke share link"}
                </button>
              </>
            ) : (
              <>
                <p className="feature-help">
                  A public link will be generated for this completed ride.
                  Anyone with the link may be able to view its route and
                  attached photos.
                </p>

                <button
                  type="button"
                  className="start-button"
                  onClick={() => void createShareLink(shareRide)}
                >
                  <Share2 size={17} />
                  Try again
                </button>
              </>
            )}

            <button
              type="button"
              className="modal-cancel"
              onClick={() => setShareRide(null)}
            >
              Close
            </button>
          </section>
        </div>
      )}

      {photoRide && (
        <div
          className="modal-backdrop"
          onClick={() => setPhotoRide(null)}
        >
          <section
            className="waypoint-modal feature-modal photo-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="feature-modal-close"
              onClick={() => setPhotoRide(null)}
              aria-label="Close photo gallery"
            >
              <X size={20} />
            </button>

            <div className="modal-heading">
              <div className="modal-pin">
                <Camera size={22} />
              </div>
              <div>
                <h2>Ride photos</h2>
                <p>{photoRide.title || "Cycling Ride"}</p>
              </div>
            </div>

            <form onSubmit={uploadRidePhoto} className="photo-upload-form">
              <label htmlFor="ride-photo">Choose a photo</label>
              <input
                id="ride-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setPhotoFile(event.target.files?.[0] ?? null)
                }
                required
              />

              <small className="field-help">
                JPG, PNG, or WebP. Maximum file size: 8 MB.
              </small>

              <label htmlFor="photo-caption">Caption</label>
              <input
                id="photo-caption"
                value={photoCaption}
                onChange={(event) => setPhotoCaption(event.target.value)}
                placeholder="e.g. Morning ride"
                maxLength={500}
              />

              <label htmlFor="photo-location">
                Location name (optional)
              </label>
              <input
                id="photo-location"
                value={photoLocation}
                onChange={(event) => setPhotoLocation(event.target.value)}
                placeholder="e.g. Coastal road"
                maxLength={200}
              />

              <label htmlFor="photo-captured-at">
                Photo date and time
              </label>
              <input
                id="photo-captured-at"
                type="datetime-local"
                value={photoCapturedAt}
                onChange={(event) =>
                  setPhotoCapturedAt(event.target.value)
                }
              />

              <button
                type="button"
                className="waypoint-button gps-photo-button"
                onClick={() => void usePhotoGps()}
              >
                <LocateFixed size={17} />
                {photoCoordinates
                  ? "Update GPS coordinates"
                  : "Attach current GPS location"}
              </button>

              {photoCoordinates && (
                <p className="modal-coordinates">
                  <Crosshair size={14} />
                  {photoCoordinates.latitude.toFixed(5)},{" "}
                  {photoCoordinates.longitude.toFixed(5)}
                </p>
              )}

              <button
                type="submit"
                className="start-button"
                disabled={!photoFile || uploadingPhoto}
              >
                <ImagePlus size={18} />
                {uploadingPhoto ? "Uploading photo..." : "Upload photo"}
              </button>
            </form>

            <div className="content-section-title photo-gallery-heading">
              <h2>Gallery</h2>
              <button
                type="button"
                className="text-action"
                onClick={() => void openPhotos(photoRide)}
                disabled={loadingPhotos}
              >
                <RefreshCw
                  size={14}
                  className={loadingPhotos ? "spin-icon" : ""}
                />
                Refresh
              </button>
            </div>

            {loadingPhotos ? (
              <div className="empty-card">Loading photos...</div>
            ) : photos.length === 0 ? (
              <div className="empty-card">
                <Camera size={25} />
                <h3>No photos yet</h3>
                <p>Upload a photo to remember this ride.</p>
              </div>
            ) : (
              <div className="photo-gallery">
                {photos.map((photo) => (
                  <article className="photo-card" key={photo.id}>
                    <a
                      href={photo.image_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open full-size photo"
                    >
                      <img
                        src={photo.image_url}
                        alt={photo.caption || "Cycling ride"}
                        loading="lazy"
                      />
                    </a>

                    <div className="photo-card-info">
                      <strong>{photo.caption || "Ride photo"}</strong>

                      {photo.location_name && (
                        <span>
                          <MapPin size={13} />
                          {photo.location_name}
                        </span>
                      )}

                      <small>
                        {formatDate(
                          photo.captured_at || photo.created_at
                        )}
                      </small>

                      {photo.latitude != null &&
                        photo.longitude != null && (
                          <small>
                            GPS: {Number(photo.latitude).toFixed(5)},{" "}
                            {Number(photo.longitude).toFixed(5)}
                          </small>
                        )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <button
              type="button"
              className="modal-cancel"
              onClick={() => setPhotoRide(null)}
            >
              Close gallery
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
