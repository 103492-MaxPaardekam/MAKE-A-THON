import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import mongoose from "mongoose";
import { mockIncidents, mockDemoUpdate } from "../shared/mockIncidents.js";
import Incident from "./models/Incident.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS || 30000);
const ENABLE_DEMO_MODE = process.env.ENABLE_DEMO_MODE !== "false";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/safe-zone";

const AIR_ALERT_PRIMARY_URL = process.env.AIR_ALERT_PRIMARY_URL || "";
const AIR_ALERT_FALLBACK_URL = process.env.AIR_ALERT_FALLBACK_URL || "";

// Initialize MongoDB connection
async function initMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✓ MongoDB connected:", MONGODB_URI);
    return true;
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error?.message || error);
    console.log("⚠ Falling back to in-memory cache (incidents won't persist)");
    return false;
  }
}

let incidentCache = withIds(mockIncidents);
let cacheMeta = {
  mode: "fallback-mock",
  activeSource: "mock",
  lastUpdated: new Date().toISOString(),
  refreshIntervalMs: REFRESH_INTERVAL_MS,
};

function withIds(incidents) {
  return incidents.map((item, index) => ({
    id: item.id || `inc-${Date.now()}-${index}`,
    validationStatus: item.validationStatus || "unknown",
    ...item,
  }));
}

function adviceFromStatus(status = "medium") {
  if (status === "high") return "gevaar";
  if (status === "low") return "veilig";
  return "let op";
}

function normalizeRawIncident(raw, sourceLabel = "official") {
  const latitude =
    raw?.coordinates?.lat ??
    raw?.lat ??
    raw?.latitude ??
    (Array.isArray(raw?.coordinates) ? raw.coordinates[1] : null) ??
    null;

  const longitude =
    raw?.coordinates?.lng ??
    raw?.lng ??
    raw?.longitude ??
    (Array.isArray(raw?.coordinates) ? raw.coordinates[0] : null) ??
    null;

  const status = ["low", "medium", "high"].includes(raw?.status)
    ? raw.status
    : "medium";

  return {
    id:
      raw?.id || `inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: raw?.title || raw?.name || "Onbekend incident",
    region: raw?.region || raw?.city || raw?.location || "onbekend",
    coordinates: {
      lat: latitude,
      lng: longitude,
    },
    time:
      raw?.time ||
      raw?.timestamp ||
      raw?.publishedAt ||
      new Date().toISOString(),
    source: raw?.source || sourceLabel,
    confidenceScore: Number(raw?.confidenceScore || 5),
    validationStatus: raw?.validationStatus || "verified",
    status,
    advice: raw?.advice || adviceFromStatus(status),
  };
}

function normalizeExternalPayload(payload, sourceLabel) {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeRawIncident(item, sourceLabel));
  }

  if (Array.isArray(payload?.incidents)) {
    return payload.incidents.map((item) =>
      normalizeRawIncident(item, sourceLabel),
    );
  }

  if (Array.isArray(payload?.features)) {
    return payload.features.map((feature) => {
      const lng = feature?.geometry?.coordinates?.[0] ?? null;
      const lat = feature?.geometry?.coordinates?.[1] ?? null;
      return normalizeRawIncident(
        {
          ...feature?.properties,
          coordinates: { lat, lng },
        },
        sourceLabel,
      );
    });
  }

  return [];
}

async function fetchFromSource(url, sourceLabel) {
  if (!url) return [];

  const response = await axios.get(url, {
    timeout: 9000,
    headers: {
      Accept:
        "application/json, application/geo+json, application/xml, text/xml, */*",
    },
  });

  const normalized = normalizeExternalPayload(response.data, sourceLabel);
  return normalized.filter((item) => item?.title);
}

async function refreshIncidents() {
  try {
    const primaryIncidents = await fetchFromSource(
      AIR_ALERT_PRIMARY_URL,
      "air-alert-ukraine",
    );

    if (primaryIncidents.length > 0) {
      incidentCache = withIds(primaryIncidents);

      // Save to MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        await Incident.deleteMany({});
        await Incident.insertMany(primaryIncidents);
      }

      cacheMeta = {
        ...cacheMeta,
        mode: "live-primary",
        activeSource: "air-alert-ukraine",
        lastUpdated: new Date().toISOString(),
      };
      return;
    }

    const fallbackIncidents = await fetchFromSource(
      AIR_ALERT_FALLBACK_URL,
      "state-emergency-service",
    );

    if (fallbackIncidents.length > 0) {
      incidentCache = withIds(fallbackIncidents);

      // Save to MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        await Incident.deleteMany({});
        await Incident.insertMany(fallbackIncidents);
      }

      cacheMeta = {
        ...cacheMeta,
        mode: "live-fallback",
        activeSource: "state-emergency-service",
        lastUpdated: new Date().toISOString(),
      };
      return;
    }

    cacheMeta = {
      ...cacheMeta,
      mode: "fallback-mock",
      activeSource: "mock",
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    cacheMeta = {
      ...cacheMeta,
      mode: "fallback-mock",
      activeSource: "mock",
      lastUpdated: new Date().toISOString(),
      lastError: error?.message || "unknown-source-error",
    };
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "safe-zone-api",
    uptimeSeconds: Math.round(process.uptime()),
    mongodbConnected: mongoose.connection.readyState === 1,
    cacheMeta,
  });
});

app.get("/api/incidents", (req, res) => {
  res.json({
    incidents: incidentCache,
    cacheMeta,
  });
});

app.post("/api/demo/trigger-update", (req, res) => {
  if (!ENABLE_DEMO_MODE) {
    return res.status(403).json({
      ok: false,
      message: "Demo mode disabled",
    });
  }

  const injected = {
    ...mockDemoUpdate,
    id: `inc-demo-${Date.now()}`,
    source: "air-alert-ukraine",
    validationStatus: "verified",
  };

  incidentCache = [injected, ...incidentCache].slice(0, 100);
  cacheMeta = {
    ...cacheMeta,
    lastUpdated: new Date().toISOString(),
    mode: `${cacheMeta.mode}-demo-injected`,
  };

  return res.json({
    ok: true,
    incident: injected,
    cacheMeta,
  });
});

// Start server
async function start() {
  const mongoConnected = await initMongoDB();

  await refreshIncidents();
  setInterval(refreshIncidents, REFRESH_INTERVAL_MS);

  app.listen(PORT, () => {
    console.log(`\n✓ Safe Zone API listening on http://localhost:${PORT}`);
    if (mongoConnected) {
      console.log("✓ Database: MongoDB (persistent)");
    } else {
      console.log("⚠ Database: In-memory cache (will reset on restart)");
    }
    console.log(`ℹ Demo mode: ${ENABLE_DEMO_MODE ? "enabled" : "disabled"}`);
    console.log(`ℹ Health check: GET http://localhost:${PORT}/api/health\n`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
