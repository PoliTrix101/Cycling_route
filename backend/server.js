
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");
const { createClient } = require("@libsql/client");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("Missing Turso credentials. Check Railway Variables.");
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const cloudinaryConfigured =
  Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(process.env.CLOUDINARY_API_KEY) &&
  Boolean(process.env.CLOUDINARY_API_SECRET);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG, and WebP images are allowed.")
      );
    }

    callback(null, true);
  },
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "CycleTrack API is running",
    cloudinary: cloudinaryConfigured ? "configured" : "not_configured",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    await db.execute("SELECT 1");
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Turso health check failed:", error.message);
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

/* --------------------------------------------------
   DATABASE INITIALIZATION
-------------------------------------------------- */

async function initializeDatabase() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS rides (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Cycling Ride',
        start_time TEXT NOT NULL DEFAULT (datetime('now')),
        end_time TEXT,
        distance_meters REAL NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'completed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,

      `CREATE TABLE IF NOT EXISTS route_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        accuracy REAL,
        speed REAL,
        recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS waypoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id TEXT NOT NULL,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS ride_photos (
        id TEXT PRIMARY KEY,
        ride_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        public_id TEXT NOT NULL,
        caption TEXT NOT NULL DEFAULT '',
        location_name TEXT,
        latitude REAL,
        longitude REAL,
        captured_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS ride_shares (
        ride_id TEXT PRIMARY KEY,
        share_token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
      )`,

      // New table for favorite places, independent of rides.
      `CREATE TABLE IF NOT EXISTS saved_places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,

      `CREATE INDEX IF NOT EXISTS idx_points_ride
        ON route_points(ride_id)`,

      `CREATE INDEX IF NOT EXISTS idx_waypoints_ride
        ON waypoints(ride_id)`,

      `CREATE INDEX IF NOT EXISTS idx_rides_start
        ON rides(start_time)`,

      `CREATE INDEX IF NOT EXISTS idx_photos_ride
        ON ride_photos(ride_id)`,

      `CREATE INDEX IF NOT EXISTS idx_saved_places_created
        ON saved_places(created_at)`,
    ],
    "write"
  );

  // Speed stat columns were added after launch; add them to older databases.
  const rideColumns = await db.execute("PRAGMA table_info(rides)");
  const existingColumns = new Set(rideColumns.rows.map((row) => row.name));

  for (const column of ["avg_speed_kmh", "max_speed_kmh", "min_speed_kmh"]) {
    if (!existingColumns.has(column)) {
      await db.execute(`ALTER TABLE rides ADD COLUMN ${column} REAL`);
    }
  }

  console.log("Turso database tables are ready.");
}

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function isValidCoordinate(latitude, longitude) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// A speed in km/h, or null when missing or not plausible.
function cleanSpeed(value) {
  if (value === null || value === undefined || value === "") return null;

  const speed = Number(value);
  return Number.isFinite(speed) && speed >= 0 && speed <= 200 ? speed : null;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "cycletrack",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

/* --------------------------------------------------
   RIDES
-------------------------------------------------- */

// List rides.
app.get("/api/rides", async (req, res) => {
  try {
    const result = await db.execute(
      "SELECT * FROM rides ORDER BY start_time DESC"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("List rides error:", error.message);
    res.status(500).json({ error: "Could not retrieve rides" });
  }
});

// Get one ride, including GPS points and waypoints.
app.get("/api/rides/:id", async (req, res) => {
  try {
    const ride = await db.execute({
      sql: "SELECT * FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const [points, waypoints] = await Promise.all([
      db.execute({
        sql: `SELECT * FROM route_points
          WHERE ride_id = ? ORDER BY recorded_at`,
        args: [req.params.id],
      }),
      db.execute({
        sql: `SELECT * FROM waypoints
          WHERE ride_id = ? ORDER BY created_at`,
        args: [req.params.id],
      }),
    ]);

    res.json({
      ride: ride.rows[0],
      points: points.rows,
      waypoints: waypoints.rows,
    });
  } catch (error) {
    console.error("Get ride error:", error.message);
    res.status(500).json({ error: "Could not retrieve ride" });
  }
});

// Start a ride.
app.post("/api/rides", async (req, res) => {
  try {
    const id = crypto.randomUUID();

    const title =
      typeof req.body.title === "string" && req.body.title.trim()
        ? req.body.title.trim().slice(0, 100)
        : "Cycling Ride";

    await db.execute({
      sql: "INSERT INTO rides (id, title) VALUES (?, ?)",
      args: [id, title],
    });

    const result = await db.execute({
      sql: "SELECT * FROM rides WHERE id = ?",
      args: [id],
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Start ride error:", error.message);
    res.status(500).json({ error: "Could not start ride" });
  }
});

// Delete a ride and all associated database records.
app.delete("/api/rides/:id", async (req, res) => {
  const rideId = req.params.id;

  try {
    const ride = await db.execute({
      sql: "SELECT id FROM rides WHERE id = ?",
      args: [rideId],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Read image IDs before deleting photo records.
    const photos = await db.execute({
      sql: "SELECT public_id FROM ride_photos WHERE ride_id = ?",
      args: [rideId],
    });

    // Delete database records first. Cloudinary cleanup is best-effort.
    await db.batch(
      [
        {
          sql: "DELETE FROM ride_shares WHERE ride_id = ?",
          args: [rideId],
        },
        {
          sql: "DELETE FROM ride_photos WHERE ride_id = ?",
          args: [rideId],
        },
        {
          sql: "DELETE FROM waypoints WHERE ride_id = ?",
          args: [rideId],
        },
        {
          sql: "DELETE FROM route_points WHERE ride_id = ?",
          args: [rideId],
        },
        {
          sql: "DELETE FROM rides WHERE id = ?",
          args: [rideId],
        },
      ],
      "write"
    );

    if (cloudinaryConfigured) {
      for (const photo of photos.rows) {
        if (!photo.public_id) continue;

        try {
          await cloudinary.uploader.destroy(photo.public_id);
        } catch (imageError) {
          console.error(
            "Cloudinary image cleanup failed:",
            imageError.message
          );
        }
      }
    }

    res.json({
      success: true,
      message: "Ride deleted successfully",
      id: rideId,
    });
  } catch (error) {
    console.error("Delete ride error:", error.message);
    res.status(500).json({ error: "Could not delete ride" });
  }
});

// Save GPS points.
app.post("/api/rides/:id/points", async (req, res) => {
  try {
    const ride = await db.execute({
      sql: "SELECT status FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.rows[0].status !== "active") {
      return res.status(409).json({ error: "Ride is already completed" });
    }

    const points = Array.isArray(req.body.points)
      ? req.body.points
      : [req.body];

    if (!points.length || points.length > 500) {
      return res.status(400).json({
        error: "Send between 1 and 500 GPS points per request",
      });
    }

    const statements = [];

    for (const point of points) {
      const {
        latitude,
        longitude,
        altitude,
        accuracy,
        speed,
        recorded_at,
      } = point;

      if (!isValidCoordinate(latitude, longitude)) {
        return res.status(400).json({
          error: "Each point needs valid latitude and longitude values",
        });
      }

      statements.push({
        sql: `INSERT INTO route_points
          (ride_id, latitude, longitude, altitude, accuracy, speed, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          req.params.id,
          latitude,
          longitude,
          typeof altitude === "number" ? altitude : null,
          typeof accuracy === "number" ? accuracy : null,
          typeof speed === "number" ? speed : null,
          typeof recorded_at === "string"
            ? recorded_at
            : new Date().toISOString(),
        ],
      });
    }

    await db.batch(statements, "write");
    res.status(201).json({ saved: points.length });
  } catch (error) {
    console.error("Save GPS points error:", error.message);
    res.status(500).json({ error: "Could not save GPS points" });
  }
});

// Add a waypoint to a ride.
app.post("/api/rides/:id/waypoints", async (req, res) => {
  try {
    const { name, latitude, longitude, note } = req.body;

    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        error: "Valid latitude and longitude are required",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Waypoint name is required" });
    }

    const ride = await db.execute({
      sql: "SELECT id FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const cleanName = name.trim().slice(0, 100);
    const cleanNote = typeof note === "string" ? note.slice(0, 500) : null;

    const result = await db.execute({
      sql: `INSERT INTO waypoints
        (ride_id, name, latitude, longitude, note)
        VALUES (?, ?, ?, ?, ?)`,
      args: [req.params.id, cleanName, latitude, longitude, cleanNote],
    });

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      ride_id: req.params.id,
      name: cleanName,
      latitude,
      longitude,
      note: cleanNote,
    });
  } catch (error) {
    console.error("Add waypoint error:", error.message);
    res.status(500).json({ error: "Could not save waypoint" });
  }
});

// Finish a ride.
app.post("/api/rides/:id/finish", async (req, res) => {
  try {
    const ride = await db.execute({
      sql: "SELECT * FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.rows[0].status === "completed") {
      return res.json(ride.rows[0]);
    }

    await db.execute({
      sql: `UPDATE rides
        SET status = 'completed',
            end_time = datetime('now'),
            distance_meters = ?,
            duration_seconds = ?,
            avg_speed_kmh = ?,
            max_speed_kmh = ?,
            min_speed_kmh = ?
        WHERE id = ? AND status = 'active'`,
      args: [
        Math.max(0, Number(req.body.distance_meters) || 0),
        Math.max(0, Math.floor(Number(req.body.duration_seconds) || 0)),
        cleanSpeed(req.body.avg_speed_kmh),
        cleanSpeed(req.body.max_speed_kmh),
        cleanSpeed(req.body.min_speed_kmh),
        req.params.id,
      ],
    });

    const updated = await db.execute({
      sql: "SELECT * FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    res.json(updated.rows[0]);
  } catch (error) {
    console.error("Finish ride error:", error.message);
    res.status(500).json({ error: "Could not finish ride" });
  }
});

/* --------------------------------------------------
   SAVED PLACES
-------------------------------------------------- */

// List saved places.
app.get("/api/places", async (req, res) => {
  try {
    const result = await db.execute(
      "SELECT * FROM saved_places ORDER BY created_at DESC"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("List saved places error:", error.message);
    res.status(500).json({ error: "Could not retrieve saved places" });
  }
});

// Save a favorite place.
app.post("/api/places", async (req, res) => {
  try {
    const { name, latitude, longitude, note } = req.body;

    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        error: "Valid latitude and longitude are required",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Place name is required" });
    }

    const id = crypto.randomUUID();
    const cleanName = name.trim().slice(0, 100);
    const cleanNote =
      typeof note === "string" ? note.trim().slice(0, 500) : "";

    await db.execute({
      sql: `INSERT INTO saved_places
        (id, name, latitude, longitude, note)
        VALUES (?, ?, ?, ?, ?)`,
      args: [id, cleanName, latitude, longitude, cleanNote],
    });

    const result = await db.execute({
      sql: "SELECT * FROM saved_places WHERE id = ?",
      args: [id],
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Save place error:", error.message);
    res.status(500).json({ error: "Could not save place" });
  }
});

// Delete a saved place.
app.delete("/api/places/:id", async (req, res) => {
  try {
    const result = await db.execute({
      sql: "DELETE FROM saved_places WHERE id = ?",
      args: [req.params.id],
    });

    if (Number(result.rowsAffected) === 0) {
      return res.status(404).json({ error: "Saved place not found" });
    }

    res.json({ success: true, message: "Saved place deleted" });
  } catch (error) {
    console.error("Delete saved place error:", error.message);
    res.status(500).json({ error: "Could not delete saved place" });
  }
});

/* --------------------------------------------------
   RIDE PHOTOS
-------------------------------------------------- */

// Upload a photo for a ride.
app.post("/api/rides/:id/photos", upload.single("photo"), async (req, res) => {
  let uploadedPublicId = null;

  try {
    if (!cloudinaryConfigured) {
      return res.status(503).json({
        error: "Photo storage is not configured on the server",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Choose a JPEG, PNG, or WebP photo",
      });
    }

    const rideResult = await db.execute({
      sql: "SELECT id FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!rideResult.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const caption =
      typeof req.body.caption === "string"
        ? req.body.caption.trim().slice(0, 500)
        : "";

    const locationName =
      typeof req.body.location_name === "string"
        ? req.body.location_name.trim().slice(0, 150)
        : null;

    const latitude =
      req.body.latitude !== undefined && req.body.latitude !== ""
        ? Number(req.body.latitude)
        : null;

    const longitude =
      req.body.longitude !== undefined && req.body.longitude !== ""
        ? Number(req.body.longitude)
        : null;

    if ((latitude === null) !== (longitude === null)) {
      return res.status(400).json({
        error: "Provide both latitude and longitude, or neither",
      });
    }

    if (latitude !== null && !isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        error: "Photo location coordinates are invalid",
      });
    }

    const capturedAt =
      typeof req.body.captured_at === "string" &&
      !Number.isNaN(Date.parse(req.body.captured_at))
        ? new Date(req.body.captured_at).toISOString()
        : new Date().toISOString();

    const image = await uploadToCloudinary(req.file.buffer);
    uploadedPublicId = image.public_id;

    const photoId = crypto.randomUUID();

    await db.execute({
      sql: `INSERT INTO ride_photos
        (id, ride_id, image_url, public_id, caption, location_name,
         latitude, longitude, captured_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        photoId,
        req.params.id,
        image.secure_url,
        image.public_id,
        caption,
        locationName || null,
        latitude,
        longitude,
        capturedAt,
      ],
    });

    res.status(201).json({
      id: photoId,
      ride_id: req.params.id,
      image_url: image.secure_url,
      caption,
      location_name: locationName || null,
      latitude,
      longitude,
      captured_at: capturedAt,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Photo upload error:", error.message);

    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (cleanupError) {
        console.error("Cloudinary cleanup failed:", cleanupError.message);
      }
    }

    res.status(500).json({ error: "Could not upload photo" });
  }
});

// List photos for a ride.
app.get("/api/rides/:id/photos", async (req, res) => {
  try {
    const ride = await db.execute({
      sql: "SELECT id FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const result = await db.execute({
      sql: `SELECT id, ride_id, image_url, caption, location_name,
        latitude, longitude, captured_at, created_at
        FROM ride_photos WHERE ride_id = ? ORDER BY captured_at DESC`,
      args: [req.params.id],
    });

    res.json(result.rows);
  } catch (error) {
    console.error("List photos error:", error.message);
    res.status(500).json({ error: "Could not retrieve photos" });
  }
});

/* --------------------------------------------------
   RIDE SHARING
-------------------------------------------------- */

// Create or retrieve a share link for a completed ride.
app.post("/api/rides/:id/share", async (req, res) => {
  try {
    const ride = await db.execute({
      sql: "SELECT id, status FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.rows[0].status !== "completed") {
      return res.status(409).json({
        error: "Only completed rides can be shared",
      });
    }

    let share = await db.execute({
      sql: "SELECT share_token FROM ride_shares WHERE ride_id = ?",
      args: [req.params.id],
    });

    if (!share.rows.length) {
      const token = crypto.randomBytes(32).toString("hex");

      await db.execute({
        sql: `INSERT OR IGNORE INTO ride_shares (ride_id, share_token)
          VALUES (?, ?)`,
        args: [req.params.id, token],
      });

      share = await db.execute({
        sql: "SELECT share_token FROM ride_shares WHERE ride_id = ?",
        args: [req.params.id],
      });
    }

    const baseUrl = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.replace(/\/+$/, "")
      : null;

    res.status(200).json({
      ride_id: req.params.id,
      share_token: share.rows[0].share_token,
      share_url: baseUrl
        ? `${baseUrl}/?share=${share.rows[0].share_token}`
        : null,
    });
  } catch (error) {
    console.error("Create share link error:", error.message);
    res.status(500).json({ error: "Could not create share link" });
  }
});

// Revoke a share link.
app.delete("/api/rides/:id/share", async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM ride_shares WHERE ride_id = ?",
      args: [req.params.id],
    });

    res.json({ success: true, message: "Share link revoked" });
  } catch (error) {
    console.error("Revoke share link error:", error.message);
    res.status(500).json({ error: "Could not revoke share link" });
  }
});

// Public view for a shared ride.
app.get("/api/shared/:token", async (req, res) => {
  try {
    const share = await db.execute({
      sql: "SELECT ride_id FROM ride_shares WHERE share_token = ?",
      args: [req.params.token],
    });

    if (!share.rows.length) {
      return res.status(404).json({
        error: "Shared ride not found or link has been revoked",
      });
    }

    const rideId = share.rows[0].ride_id;

    const [ride, points, waypoints, photos] = await Promise.all([
      db.execute({
        sql: `SELECT id, title, start_time, end_time, distance_meters,
          duration_seconds, avg_speed_kmh, max_speed_kmh, min_speed_kmh,
          status, created_at
          FROM rides WHERE id = ?`,
        args: [rideId],
      }),
      db.execute({
        sql: `SELECT latitude, longitude, altitude, recorded_at
          FROM route_points WHERE ride_id = ? ORDER BY recorded_at`,
        args: [rideId],
      }),
      db.execute({
        sql: `SELECT name, latitude, longitude, note, created_at
          FROM waypoints WHERE ride_id = ? ORDER BY created_at`,
        args: [rideId],
      }),
      db.execute({
        sql: `SELECT id, image_url, caption, location_name, latitude,
          longitude, captured_at FROM ride_photos
          WHERE ride_id = ? ORDER BY captured_at DESC`,
        args: [rideId],
      }),
    ]);

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    res.json({
      ride: ride.rows[0],
      points: points.rows,
      waypoints: waypoints.rows,
      photos: photos.rows,
    });
  } catch (error) {
    console.error("Get shared ride error:", error.message);
    res.status(500).json({ error: "Could not retrieve shared ride" });
  }
});

/* --------------------------------------------------
   CSV EXPORT
-------------------------------------------------- */

app.get("/api/rides/:id/export.csv", async (req, res) => {
  try {
    const ride = await db.execute({
      sql: "SELECT * FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const points = await db.execute({
      sql: `SELECT latitude, longitude, altitude, accuracy, speed, recorded_at
        FROM route_points WHERE ride_id = ? ORDER BY recorded_at`,
      args: [req.params.id],
    });

    const header = "latitude,longitude,altitude,accuracy,speed,recorded_at";

    const lines = points.rows.map((point) =>
      [
        point.latitude,
        point.longitude,
        point.altitude ?? "",
        point.accuracy ?? "",
        point.speed ?? "",
        escapeCsv(point.recorded_at),
      ].join(",")
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ride-${req.params.id}.csv"`
    );

    res.send([header, ...lines].join("\r\n"));
  } catch (error) {
    console.error("Export CSV error:", error.message);
    res.status(500).json({ error: "Could not export ride" });
  }
});

/* --------------------------------------------------
   ERROR HANDLING
-------------------------------------------------- */

// Friendly errors for invalid image uploads.
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Photo must be 8 MB or smaller"
        : "Invalid photo upload";

    return res.status(400).json({ error: message });
  }

  if (
    error &&
    error.message === "Only JPEG, PNG, and WebP images are allowed."
  ) {
    return res.status(400).json({ error: error.message });
  }

  console.error("Unhandled request error:", error?.message);
  res.status(500).json({ error: "Unexpected server error" });
});

/* --------------------------------------------------
   START SERVER
-------------------------------------------------- */

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`CycleTrack API listening on port ${PORT}`);
      console.log(
        `Cloudinary: ${cloudinaryConfigured ? "configured" : "NOT CONFIGURED"}`
      );
    });
  } catch (error) {
    console.error("Could not initialize Turso database:", error.message);
    process.exit(1);
  }
}

startServer();
