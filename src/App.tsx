
import { useCallback, useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  useMap,
} from "react-leaflet";
import {
  LocateFixed,
  Bike,
  RefreshCw,
  MapPin,
  Navigation,
  Route as RouteIcon,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

type GPSPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
};

const DEFAULT_POSITION: [number, number] = [
  10.3157,
  123.8854,
];

const MIN_ROUTE_DISTANCE_METERS = 3;

function distanceBetween(
  first: GPSPoint,
  second: GPSPoint
): number {
  const earthRadius = 6371000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1 = radians(first.latitude);
  const lat2 = radians(second.latitude);
  const deltaLat = radians(second.latitude - first.latitude);
  const deltaLon = radians(second.longitude - first.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(2)} km`;
}

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const resizeMap = () => {
      map.invalidateSize({ pan: false });
    };

    const timeoutId = window.setTimeout(resizeMap, 150);
    const secondTimeoutId = window.setTimeout(resizeMap, 500);

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
      window.clearTimeout(timeoutId);
      window.clearTimeout(secondTimeoutId);
      window.removeEventListener("resize", resizeMap);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

function MapUpdater({
  center,
  recenterKey,
}: {
  center: [number, number];
  recenterKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize({ pan: false });
  }, [map]);

  useEffect(() => {
    if (recenterKey === 0) return;

    map.flyTo(center, Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.8,
    });
  }, [map, center, recenterKey]);

  return null;
}

export default function App() {
  const [position, setPosition] =
    useState<[number, number]>(DEFAULT_POSITION);

  const [route, setRoute] = useState<GPSPoint[]>([]);
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);

  const [message, setMessage] = useState(
    "Use My location to find yourself, or start GPS tracking."
  );

  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);

  const handleLocation = useCallback(
    (location: GeolocationPosition, addToRoute: boolean) => {
      const point: GPSPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp || Date.now(),
        accuracy: location.coords.accuracy,
      };

      setPosition([point.latitude, point.longitude]);
      setLastAccuracy(point.accuracy);

      if (addToRoute) {
        if (point.accuracy > 100) {
          setMessage(
            `GPS signal is weak · Accuracy approximately ${Math.round(
              point.accuracy
            )} m. Waiting for a better signal.`
          );
          return;
        }

        setRoute((previous) => {
          const last = previous[previous.length - 1];

          if (
            last &&
            distanceBetween(last, point) <
              MIN_ROUTE_DISTANCE_METERS
          ) {
            return previous;
          }

          return [...previous, point];
        });
      }

      setMessage(
        `GPS connected · Accuracy approximately ${Math.round(
          point.accuracy
        )} m`
      );
    },
    []
  );

  useEffect(() => {
    if (!tracking) return;

    if (!navigator.geolocation) {
      setMessage("GPS is not supported by this browser.");
      setTracking(false);
      return;
    }

    setMessage("Waiting for your GPS location...");

    const watchId = navigator.geolocation.watchPosition(
      (location) => {
        handleLocation(location, true);
      },
      (error) => {
        const errors: Record<number, string> = {
          1: "Location permission denied. Allow location access.",
          2: "GPS signal unavailable. Try an open area.",
          3: "GPS timed out. Waiting for another GPS update...",
        };

        setMessage(
          errors[error.code] ?? "Unable to get GPS location."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [tracking, handleLocation]);

  async function locateMe() {
    if (!navigator.geolocation) {
      setMessage("Your browser does not support GPS.");
      return;
    }

    setLoading(true);
    setMessage("Finding your current location...");

    navigator.geolocation.getCurrentPosition(
      (location) => {
        handleLocation(location, false);
        setRecenterKey((previous) => previous + 1);

        setMessage(
          `Your location found · Accuracy approximately ${Math.round(
            location.coords.accuracy
          )} m`
        );

        setLoading(false);
      },
      (error) => {
        const errors: Record<number, string> = {
          1: "Location permission denied. Allow location access in your browser or phone settings.",
          2: "Location unavailable. Turn on GPS and try again.",
          3: "GPS timed out. Try again outdoors.",
        };

        setMessage(
          errors[error.code] ?? "Could not find your location."
        );

        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );
  }

  function startTracking() {
    setRoute([]);
    setTracking(true);
    setRecenterKey((previous) => previous + 1);
    setMessage("Waiting for your GPS location...");
  }

  function stopTracking() {
    setTracking(false);

    setMessage(
      `Tracking stopped · ${route.length} GPS points recorded.`
    );
  }

  function clearRoute() {
    if (tracking) {
      setMessage("Stop GPS tracking before clearing your route.");
      return;
    }

    setRoute([]);
    setMessage("Route cleared. You are ready for your next ride.");
  }

  const routeCoordinates: [number, number][] = route.map(
    (point) => [point.latitude, point.longitude]
  );

  const totalDistance = route.reduce(
    (total, point, index) => {
      if (index === 0) return total;

      return total + distanceBetween(route[index - 1], point);
    },
    0
  );

  const elapsedSeconds =
    route.length > 1
      ? Math.max(
          0,
          Math.floor(
            (route[route.length - 1].timestamp -
              route[0].timestamp) /
              1000
          )
        )
      : 0;

  const averageSpeedKmh =
    elapsedSeconds > 0
      ? (totalDistance / elapsedSeconds) * 3.6
      : 0;

  function exportRoute() {
    if (route.length === 0) {
      setMessage("Record some GPS points before exporting your route.");
      return;
    }

    const header = "latitude,longitude,timestamp,accuracy_m";

    const rows = route.map((point) =>
      [
        point.latitude,
        point.longitude,
        new Date(point.timestamp).toISOString(),
        point.accuracy,
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `cycletrack-route-${Date.now()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setMessage("Your route CSV has been exported.");
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">
            <Bike size={24} />
          </span>

          <div>
            <h1>CycleTrack</h1>
            <p>YOUR CYCLING MAP</p>
          </div>
        </div>

        <span className={`gps-status ${tracking ? "active" : ""}`}>
          <span className="status-dot" />
          {tracking ? "TRACKING" : "MAP READY"}
        </span>
      </header>

      <main className="main-content">
        <section className="intro">
          <div>
            <p className="eyebrow">EXPLORE YOUR ROUTE</p>

            <h2>
              {tracking ? "Ride in progress" : "Ready to ride?"}
            </h2>

            <p className="subtitle">
              View the map, find your location, and record your route.
            </p>
          </div>
        </section>

        <section className="map-card">
          <div className="map-toolbar">
            <span>
              <MapPin size={16} />
              OpenStreetMap
            </span>

            <button
              type="button"
              className="location-button"
              onClick={() => void locateMe()}
              disabled={loading}
              aria-label="Find my current location"
            >
              {loading ? (
                <RefreshCw className="spin" size={18} />
              ) : (
                <LocateFixed size={18} />
              )}

              <span>
                {loading ? "Locating..." : "My location"}
              </span>
            </button>
          </div>

          <div className="map-container">
            <MapContainer
              center={DEFAULT_POSITION}
              zoom={14}
              minZoom={3}
              maxZoom={19}
              scrollWheelZoom={true}
              className="cycling-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />

              <MapResizeFix />

              <MapUpdater
                center={position}
                recenterKey={recenterKey}
              />

              {routeCoordinates.length > 1 && (
                <Polyline
                  positions={routeCoordinates}
                  pathOptions={{
                    color: "#65a30d",
                    weight: 6,
                    opacity: 0.9,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              )}

              <CircleMarker
                center={position}
                radius={9}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: "#65a30d",
                  fillOpacity: 1,
                }}
              />

              {routeCoordinates.length > 1 && (
                <CircleMarker
                  center={routeCoordinates[0]}
                  radius={6}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#2563eb",
                    fillOpacity: 1,
                  }}
                />
              )}
            </MapContainer>
          </div>

          <div className="map-footer">
            <span className="map-footer-dot" />
            <p>{message}</p>
          </div>
        </section>

        <section className="ride-panel">
          <div className="ride-panel-heading">
            <div>
              <p className="eyebrow">YOUR RIDE</p>

              <h3>
                {tracking
                  ? "Recording your route"
                  : "Start exploring"}
              </h3>
            </div>

            <Bike size={26} />
          </div>

          <div className="ride-stats">
            <div>
              <strong>{route.length}</strong>
              <span>GPS points</span>
            </div>

            <div>
              <strong>{formatDistance(totalDistance)}</strong>
              <span>Distance</span>
            </div>

            <div>
              <strong>{averageSpeedKmh.toFixed(1)}</strong>
              <span>Avg. km/h</span>
            </div>
          </div>

          <div className="ride-stats secondary-stats">
            <div>
              <strong>{tracking ? "ON" : "OFF"}</strong>
              <span>GPS tracking</span>
            </div>

            <div>
              <strong>
                {lastAccuracy === null
                  ? "--"
                  : `${Math.round(lastAccuracy)} m`}
              </strong>
              <span>GPS accuracy</span>
            </div>
          </div>

          {!tracking ? (
            <button
              type="button"
              className="primary-button"
              onClick={startTracking}
            >
              <Bike size={19} />
              Start GPS tracking
            </button>
          ) : (
            <button
              type="button"
              className="stop-button"
              onClick={stopTracking}
            >
              Stop GPS tracking
            </button>
          )}

          <div className="ride-actions">
            <button
              type="button"
              className="location-button"
              onClick={exportRoute}
              disabled={route.length === 0}
            >
              <RouteIcon size={17} />
              Export CSV
            </button>

            <button
              type="button"
              className="location-button"
              onClick={clearRoute}
              disabled={tracking || route.length === 0}
            >
              <RefreshCw size={17} />
              Clear route
            </button>

            <button
              type="button"
              className="location-button"
              onClick={() => {
                setRecenterKey((previous) => previous + 1);
              }}
            >
              <Navigation size={17} />
              Recenter map
            </button>
          </div>

          <p className="privacy-note">
            GPS tracking requires location permission. Keep this page
            open while recording your route. GPS points are stored in
            this page's memory and are not automatically saved to your
            backend.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        CycleTrack · Ride your way
      </footer>
    </div>
  );
}

