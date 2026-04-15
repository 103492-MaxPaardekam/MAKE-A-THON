import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import { MongoClient } from "mongodb";
import { mockIncidents, mockDemoUpdate } from "../shared/mockIncidents.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS || 30000);
const ENABLE_DEMO_MODE = process.env.ENABLE_DEMO_MODE !== "false";
const ENABLE_MONGODB = process.env.ENABLE_MONGODB === "true";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/safe-zone";

const AIR_ALERT_PRIMARY_URL = process.env.AIR_ALERT_PRIMARY_URL || "";
const AIR_ALERT_FALLBACK_URL = process.env.AIR_ALERT_FALLBACK_URL || "";

const UKRAINE_OBLAST_COORDS = {
  "Vinnytsia oblast": { lat: 49.2331, lng: 28.4682 },
  "Volyn oblast": { lat: 50.7472, lng: 25.3254 },
  "Dnipropetrovsk oblast": { lat: 48.4647, lng: 35.0462 },
  "Donetsk oblast": { lat: 48.0159, lng: 37.8028 },
  "Zhytomyr oblast": { lat: 50.2547, lng: 28.6587 },
  "Zakarpattia oblast": { lat: 48.6208, lng: 22.2879 },
  "Zaporizhzhia oblast": { lat: 47.8388, lng: 35.1396 },
  "Ivano-Frankivsk oblast": { lat: 48.9226, lng: 24.7111 },
  "Kyiv oblast": { lat: 50.4501, lng: 30.5234 },
  "Kirovohrad oblast": { lat: 48.5079, lng: 32.2623 },
  "Luhansk oblast": { lat: 48.574, lng: 39.3078 },
  "Lviv oblast": { lat: 49.8397, lng: 24.0297 },
  "Mykolaiv oblast": { lat: 46.975, lng: 31.9946 },
  "Odesa oblast": { lat: 46.4825, lng: 30.7233 },
  "Poltava oblast": { lat: 49.5883, lng: 34.5514 },
  "Rivne oblast": { lat: 50.6199, lng: 26.2516 },
  "Sumy oblast": { lat: 50.9077, lng: 34.7981 },
  "Ternopil oblast": { lat: 49.5535, lng: 25.5948 },
  "Kharkiv oblast": { lat: 49.9935, lng: 36.2304 },
  "Kherson oblast": { lat: 46.6354, lng: 32.6169 },
  "Khmelnytskyi oblast": { lat: 49.4229, lng: 26.9871 },
  "Cherkasy oblast": { lat: 49.4444, lng: 32.0598 },
  "Chernivtsi oblast": { lat: 48.2921, lng: 25.9358 },
  "Chernihiv oblast": { lat: 51.4982, lng: 31.2893 },
  "Autonomous Republic of Crimea": { lat: 44.9521, lng: 34.1024 },
  Kyiv: { lat: 50.4501, lng: 30.5234 },
  Sevastopol: { lat: 44.6167, lng: 33.5254 },
};

const SAFE_LOCATIONS_KYIV = [
  {
    id: "shelter-1",
    title: "St. Michael's Golden-Domed Monastery Shelter",
    region: "Kyiv",
    coordinates: { lat: 50.4521, lng: 30.5408 },
    type: "shelter",
    capacity: 500,
  },
  {
    id: "shelter-2",
    title: "Kyiv Metro Central Emergency Shelter",
    region: "Kyiv",
    coordinates: { lat: 50.4478, lng: 30.5236 },
    type: "shelter",
    capacity: 1200,
  },
  {
    id: "hospital-1",
    title: "National Heart Institute",
    region: "Kyiv",
    coordinates: { lat: 50.4101, lng: 30.5625 },
    type: "hospital",
    capacity: 250,
  },
  {
    id: "hospital-2",
    title: "Emergency Medical Center",
    region: "Kyiv",
    coordinates: { lat: 50.4312, lng: 30.5189 },
    type: "hospital",
    capacity: 400,
  },
  {
    id: "shelter-3",
    title: "Pechersk Community Center",
    region: "Kyiv",
    coordinates: { lat: 50.3985, lng: 30.5498 },
    type: "shelter",
    capacity: 300,
  },
  {
    id: "info-1",
    title: "Kyiv Civil Protection Office",
    region: "Kyiv",
    coordinates: { lat: 50.4456, lng: 30.5623 },
    type: "information",
    capacity: 50,
  },
];

let mongoClient = null;
let incidentsCollection = null;

function isMongoConnected() {
  return Boolean(mongoClient && incidentsCollection);
}

// Initialize MongoDB connection
async function initMongoDB() {
  if (!ENABLE_MONGODB) {
    console.log("ℹ MongoDB disabled, using in-memory cache");
    return false;
  }

  try {
    console.log("ℹ Connecting to MongoDB...");
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      directConnection: true,
    });

    await mongoClient.connect();
    const database = mongoClient.db();
    incidentsCollection = database.collection("incidents");

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

function normalizeSafeLocations() {
  return SAFE_LOCATIONS_KYIV.map((loc) => ({
    id: loc.id,
    title: `${loc.title} (${loc.capacity} capacity)`,
    region: loc.region,
    coordinates: loc.coordinates,
    time: new Date().toISOString(),
    source: "safe-locations-kyiv",
    confidenceScore: 4,
    validationStatus: "verified",
    status: "low",
    advice: "veilig",
    type: loc.type,
  }));
}

function statusFromOblastState(raw) {
  if (raw?.alert) return "high";

  const changedAt = Date.parse(raw?.changed || "");
  if (!Number.isNaN(changedAt)) {
    const ageMs = Date.now() - changedAt;
    if (ageMs <= 2 * 60 * 60 * 1000) {
      return "medium";
    }
  }

  return "low";
}

function normalizeUkrainianStatePayload(payload, sourceLabel) {
  if (!Array.isArray(payload?.states)) return [];

  const fetchedAt = new Date().toISOString();

  return payload.states
    .map((state) => {
      const region = state?.name_en || state?.name || "onbekend";
      const coordinates = UKRAINE_OBLAST_COORDS[region] || null;
      const status = statusFromOblastState(state);

      return {
        id: `ua-state-${state?.id || Math.random().toString(36).slice(2, 8)}`,
        title:
          status === "high"
            ? `Air raid alert active - ${region}`
            : `No active air raid alert - ${region}`,
        region,
        coordinates,
        // Use fetch time for realtime UX; keep source timestamp for traceability.
        time: fetchedAt,
        sourceChangedTime: state?.changed || null,
        source: sourceLabel,
        confidenceScore: 5,
        validationStatus: "verified",
        status,
        advice: adviceFromStatus(status),
      };
    })
    .filter((item) => item.coordinates?.lat && item.coordinates?.lng);
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
  // Check for Ukrainian state payload first
  const ukrainianStates = normalizeUkrainianStatePayload(payload, sourceLabel);
  if (ukrainianStates.length > 0) {
    return ukrainianStates;
  }

  // Handle GeoJSON (USGS seismic, etc.)
  if (Array.isArray(payload?.features)) {
    return payload.features
      .slice(0, 10)
      .map((feature) => {
        const lng = feature?.geometry?.coordinates?.[0] ?? null;
        const lat = feature?.geometry?.coordinates?.[1] ?? null;
        const mag = feature?.properties?.mag ?? null;
        const place = feature?.properties?.place ?? "Unknown location";

        // Map seismic magnitude to incident status
        let status = "low";
        if (mag >= 7) status = "high";
        else if (mag >= 5) status = "medium";

        return normalizeRawIncident(
          {
            id: `usgs-${feature?.id}`,
            title: `M${mag?.toFixed(1) || "?"} earthquake - ${place}`,
            region: place.split(",").slice(-1)[0]?.trim() || place,
            coordinates: { lat, lng },
            time: new Date(feature?.properties?.time).toISOString(),
            source: sourceLabel,
            status,
            confidenceScore: Math.max(3, Math.min(5, Math.ceil(mag || 3))),
          },
          sourceLabel,
        );
      })
      .filter(
        (item) =>
          item?.title && item?.coordinates?.lat && item?.coordinates?.lng,
      );
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeRawIncident(item, sourceLabel));
  }

  if (Array.isArray(payload?.incidents)) {
    return payload.incidents.map((item) =>
      normalizeRawIncident(item, sourceLabel),
    );
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

    const fallbackIncidents = await fetchFromSource(
      AIR_ALERT_FALLBACK_URL,
      "seismic-usgs",
    );

    const safeLocations = normalizeSafeLocations();

    // Combine multiple sources: alerts + seismic + safe locations
    const combined = [
      ...primaryIncidents,
      ...fallbackIncidents.slice(0, 5),
      ...safeLocations,
    ];

    if (combined.length > 0) {
      incidentCache = withIds(combined);

      // Save to MongoDB if connected
      if (isMongoConnected()) {
        await incidentsCollection.deleteMany({});
        await incidentsCollection.insertMany(combined);
      }

      const sourceList = [
        primaryIncidents.length > 0 && "air-alert-ukraine",
        fallbackIncidents.length > 0 && "seismic-usgs",
      ]
        .filter(Boolean)
        .join(", ");

      cacheMeta = {
        ...cacheMeta,
        mode: "live-multi-source",
        activeSource: sourceList || "mock",
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
    mongodbConnected: isMongoConnected(),
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

  const server = app.listen(PORT, () => {
    console.log(`\n✓ Safe Zone API listening on http://localhost:${PORT}`);
    if (mongoConnected) {
      console.log("✓ Database: MongoDB (persistent)");
    } else {
      console.log("⚠ Database: In-memory cache (will reset on restart)");
    }
    console.log(`ℹ Demo mode: ${ENABLE_DEMO_MODE ? "enabled" : "disabled"}`);
    console.log(`ℹ Health check: GET http://localhost:${PORT}/api/health\n`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the existing process or change PORT in backend/.env.`,
      );
      process.exit(1);
    }

    console.error("Server failed to start:", error);
    process.exit(1);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
