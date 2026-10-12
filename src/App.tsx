
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
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

type GPSPoint = {
  latitude: number;
  longitude: number;
};

const DEFAULT_POSITION: [number, number] = [
  10.3157,
  123.8854,
];

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const resizeMap = () => {
      map.invalidateSize({ pan: false });
    };

    const timeoutId = window.setTimeout(resizeMap, 150);
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

  const handleLocation = useCallback(
    (
      location: GeolocationPosition,
      addToRoute: boolean
    ) => {
      const point: GPSPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setPosition([point.latitude, point.longitude]);

      if (addToRoute) {
        setRoute((previous) => {
          const last = previous[previous.length - 1];

          if (
            last &&
            last.latitude === point.latitude &&
            last.longitude === point.longitude
          ) {
            return previous;
          }

          return [...previous, point];
        });
      }

      setMessage(
        `GPS connected · Accuracy approximately ${Math.round(
          location.coords.accuracy
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
        maximumAge: 2000,
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

  const routeCoordinates: [number, number][] = route.map(
    (point) => [point.latitude, point.longitude]
  );

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
              <strong>{tracking ? "ON" : "OFF"}</strong>
              <span>GPS tracking</span>
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

          <p className="privacy-note">
            GPS tracking requires location permission. Keep this page
            open while recording your route.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        CycleTrack · Ride your way
      </footer>
    </div>
  );
}

