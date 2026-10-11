
const express = require("express");
const cors = require("cors");
const { createClient } = require("@libsql/client");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Check required environment variables
if (
  !process.env.TURSO_DATABASE_URL ||
  !process.env.TURSO_AUTH_TOKEN
) {
  console.error(
    "Missing Turso credentials. Check Railway Variables."
  );
  process.exit(1);
}

// Connect to Turso
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Basic health check for Railway.
// This checks the web server without querying Turso.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "CycleTrack API is running",
  });
});

// Separate database health check
app.get("/api/health/db", async (req, res) => {
  try {
    await db.execute("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Turso health check failed:", error.message);

    res.status(503).json({
      status: "error",
      database: "disconnected",
    });
  }
});

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
      `CREATE INDEX IF NOT EXISTS idx_points_ride
        ON route_points(ride_id)`,
      `CREATE INDEX IF NOT EXISTS idx_waypoints_ride
        ON waypoints(ride_id)`,
      `CREATE INDEX IF NOT EXISTS idx_rides_start
        ON rides(start_time)`,
    ],
    "write"
  );

  console.log("Turso database tables are ready.");
}

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

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

// List rides
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

// Get one ride, including GPS points and waypoints
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

// Start a ride
app.post("/api/rides", async (req, res) => {
  try {
    const id = require("crypto").randomUUID();

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

// Save GPS points
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
      return res.status(409).json({
        error: "Ride is already completed",
      });
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

// Add a waypoint
app.post("/api/rides/:id/waypoints", async (req, res) => {
  try {
    const { name, latitude, longitude, note } = req.body;

    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        error: "Valid latitude and longitude are required",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Waypoint name is required",
      });
    }

    const ride = await db.execute({
      sql: "SELECT id FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const result = await db.execute({
      sql: `INSERT INTO waypoints
        (ride_id, name, latitude, longitude, note)
        VALUES (?, ?, ?, ?, ?)`,
      args: [
        req.params.id,
        name.trim().slice(0, 100),
        latitude,
        longitude,
        typeof note === "string" ? note.slice(0, 500) : null,
      ],
    });

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      ride_id: req.params.id,
      name: name.trim().slice(0, 100),
      latitude,
      longitude,
      note: typeof note === "string" ? note.slice(0, 500) : null,
    });
  } catch (error) {
    console.error("Add waypoint error:", error.message);
    res.status(500).json({ error: "Could not save waypoint" });
  }
});

// Finish a ride
app.post("/api/rides/:id/finish", async (req, res) => {
  try {
    const ride = await db.execute({
      sql: "SELECT * FROM rides WHERE id = ?",
      args: [req.params.id],
    });

    if (!ride.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    await db.execute({
      sql: `UPDATE rides
        SET status = 'completed',
            end_time = datetime('now'),
            distance_meters = ?,
            duration_seconds = ?
        WHERE id = ? AND status = 'active'`,
      args: [
        Math.max(0, Number(req.body.distance_meters) || 0),
        Math.max(0, Math.floor(Number(req.body.duration_seconds) || 0)),
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

// Export a ride as CSV
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
        FROM route_points
        WHERE ride_id = ?
        ORDER BY recorded_at`,
      args: [req.params.id],
    });

    const header =
      "latitude,longitude,altitude,accuracy,speed,recorded_at";

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

// Initialize database before accepting requests
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`CycleTrack API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      "Could not initialize Turso database:",
      error.message
    );
    process.exit(1);
  }
}

startServer();
