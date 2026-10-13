
import {
  useCallback,
  useEffect,
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
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "https://cycletrack-api-production-8300.up.railway.app/api"
).replace(/\/$/, "");

const PROFILE_PICTURE_KEY = "cycletrack-profile-picture";

type Ride = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  status: "active" | "completed";
  created_at: string;
};

type GPSPoint = {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
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

async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, options);
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

function formatDate(value?: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
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

export default function App() {
  const [tab, setTab] = useState<Tab>("map");
  const [rides, setRides] = useState<Ride[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [photos, setPhotos] = useState<RidePhoto[]>([]);

  // Profile picture is saved locally in this browser/device.
  const [profilePicture, setProfilePicture] = useState(() => {
    try {
      return localStorage.getItem(PROFILE_PICTURE_KEY) || "";
    } catch {
      return "";
    }
  });

  const [position, setPosition] =
    useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] =
    useState<[number, number]>(DEFAULT_CENTER);

  const [tracking, setTracking] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
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
  const [sharedLoading, setSharedLoading] = useState(false);

  const watchId = useRef<string | number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPoints = useRef<GPSPoint[]>([]);
  const lastPosition = useRef<[number, number] | null>(null);
  const startedAt = useRef<number | null>(null);
  const busyRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

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
        localStorage.setItem(PROFILE_PICTURE_KEY, reader.result);
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

  const distanceMeters = points.reduce((total, point, index) => {
    if (index === 0) return total;

    const previous = points[index - 1];
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadius = 6371000;

    const dLat = radians(point.latitude - previous.latitude);
    const dLon = radians(point.longitude - previous.longitude);
    const lat1 = radians(previous.latitude);
    const lat2 = radians(point.latitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLon / 2) ** 2;

    const distance =
      earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return total + (Number.isFinite(distance) ? distance : 0);
  }, 0);

  const loadRides = useCallback(async () => {
    try {
      const result = await api<Ride[]>("/rides");
      setRides(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load rides.",
      );
    }
  }, []);

  const loadSavedPlaces = useCallback(async () => {
    try {
      const result = await api<SavedPlace[]>("/places");
      setSavedPlaces(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load saved places.",
      );
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

  useEffect(() => {
    void loadRides();
    void loadSavedPlaces();

    const params = new URLSearchParams(window.location.search);
    const token = params.get("share");

    if (token) {
      setSharedLoading(true);

      api<SharedRide>(`/shared/${encodeURIComponent(token)}`)
        .then((result) => setSharedRide(result))
        .catch((err) => {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load shared ride.",
          );
        })
        .finally(() => setSharedLoading(false));
    }
  }, [loadRides, loadSavedPlaces]);

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
    async (rideId: string, flushAll = false) => {
      if (busyRef.current) return;

      const batch = flushAll
        ? [...pendingPoints.current]
        : pendingPoints.current.slice(0, 5);

      if (!batch.length) return;

      busyRef.current = true;

      try {
        await api(`/rides/${encodeURIComponent(rideId)}/points`, {
          ...jsonOptions({ points: batch }),
        });

        pendingPoints.current.splice(0, batch.length);
      } catch (err) {
        setError(
          err instanceof Error
            ? `GPS points could not be saved: ${err.message}`
            : "GPS points could not be saved.",
        );
      } finally {
        busyRef.current = false;
      }
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

      const next: [number, number] = [
        coords.latitude,
        coords.longitude,
      ];

      const previous = lastPosition.current;

      if (previous) {
        const latDiff = next[0] - previous[0];
        const lonDiff = next[1] - previous[1];
        const approximateMeters =
          Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000;

        if (approximateMeters < 2 || approximateMeters > 150) return;
      }

      lastPosition.current = next;
      setPosition(next);
      setMapCenter(next);

      const point: GPSPoint = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude ?? null,
        accuracy: coords.accuracy ?? null,
        speed: coords.speed ?? null,
        recorded_at: new Date().toISOString(),
      };

      setPoints((previousPoints) => [...previousPoints, point]);
      pendingPoints.current.push(point);

      if (activeRide && pendingPoints.current.length >= 5) {
        void sendPendingPoints(activeRide.id);
      }
    },
    [activeRide, sendPendingPoints],
  );

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

      setActiveRide(ride);
      setSelectedRide(null);
      setRideDetails(null);
      setPoints([]);
      setWaypoints([]);
      setPhotos([]);
      pendingPoints.current = [];
      lastPosition.current = initialPosition;
      startedAt.current = Date.now();
      setElapsedSeconds(0);

      const initialPoint: GPSPoint = {
        latitude: initialPosition[0],
        longitude: initialPosition[1],
        recorded_at: new Date().toISOString(),
      };

      setPoints([initialPoint]);
      pendingPoints.current.push(initialPoint);
      setTracking(true);
      setNotice("Ride started. Cycle safely!");

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

      await loadRides();
    } catch (err) {
      setTracking(false);
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

      setTracking(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await sendPendingPoints(activeRide.id, true);

      const completedRide = await api<Ride>(
        `/rides/${encodeURIComponent(activeRide.id)}/finish`,
        jsonOptions({
          distance_meters: distanceMeters,
          duration_seconds: elapsedSeconds,
        }),
      );

      setActiveRide(null);
      setSelectedRide(completedRide);
      setNotice("Ride saved successfully!");
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not finish ride.",
      );
    } finally {
      setLoading(false);
    }
  };

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
        `${window.location.origin}/?share=${result.share_token}`;

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

  const exportRide = (ride: Ride) => {
    window.open(
      `${API}/rides/${encodeURIComponent(ride.id)}/export.csv`,
      "_blank",
      "noopener,noreferrer",
    );
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

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, and WebP photos are allowed.");
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
  };

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
          </div>

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
          onClick={() => exportRide(ride)}
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

              {sharedRide.waypoints.map((point) => (
                <Marker
                  key={point.id}
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
            sharedRide.waypoints.map((point) => (
              <article className="simple-card" key={point.id}>
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
                    src={photo.image_url}
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

                {points.length > 1 && (
                  <Polyline
                    positions={points.map(
                      (point) =>
                        [point.latitude, point.longitude] as [
                          number,
                          number,
                        ],
                    )}
                    pathOptions={{ color: "#2563eb", weight: 5 }}
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

                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() => exportRide(rideDetails.ride)}
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

            <div className="saved-place-tip">
              <Bookmark size={19} />
              <p>
                You can tap any location on the map and select Save Place.
                These places are stored in Turso and remain saved when you
                reopen the app.
              </p>
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
                <strong>
                  {formatDistance(
                    rides.reduce(
                      (total, ride) =>
                        total + (Number(ride.distance_meters) || 0),
                      0,
                    ),
                  )}
                </strong>
                <span>Total recorded distance</span>
              </div>
            </div>

            <div className="simple-card">
              <div>
              
              </div>
            </div>

            {profilePicture && (
              <button
                className="secondary-button full-width"
                onClick={() => {
                  try {
                    localStorage.removeItem(PROFILE_PICTURE_KEY);
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
              <label htmlFor="ride-photo">Choose photo</label>
              <input
                id="ride-photo"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPhotoChange}
                required
              />

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
                      src={photo.image_url}
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
