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
const ENABLE_MONGODB = process.env.ENABLE_MONGODB === "false";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "safezone2026";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/safe-zone";

const AIR_ALERT_PRIMARY_URL =
  process.env.AIR_ALERT_PRIMARY_URL || "https://api.alerts.in.ua/api/states";
const AIR_ALERT_FALLBACK_URL = process.env.AIR_ALERT_FALLBACK_URL || "";

const MANUAL_ZONE_REASONS = {
  high: ["Luchtaanval", "Beschietingen", "Explosies", "Mijnenveld"],
  medium: [
    "Troepenbeweging",
    "Wegblokkade",
    "Beperkte toegang",
    "Onbekende dreiging",
  ],
  low: [
    "Schuilplaats beschikbaar",
    "Hulppost",
    "Vrij doorgaan",
    "Rustig gebied",
  ],
};

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

let incidentCache = new Map();

function initIncidentCache() {
  const initialIncidents = withIds(mockIncidents);
  initialIncidents.forEach((incident) => {
    incidentCache.set(incident.id, incident);
  });
}

initIncidentCache();
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

function parseBasicAuthHeader(headerValue = "") {
  if (!headerValue || !headerValue.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = headerValue.slice(6);
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const [username, ...rest] = decoded.split(":");
    return {
      username: username || "",
      password: rest.join(":"),
    };
  } catch {
    return null;
  }
}

function getAuthCredentials(req) {
  const headerCredentials = parseBasicAuthHeader(req.headers.authorization);
  if (headerCredentials) return headerCredentials;

  const username = req.body?.username;
  const password = req.body?.password;
  if (username && password) {
    return { username, password };
  }

  return null;
}

function requireAdmin(req, res, next) {
  const credentials = getAuthCredentials(req);

  if (
    !credentials ||
    credentials.username !== ADMIN_USERNAME ||
    credentials.password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      ok: false,
      message: "Admin authentication required",
    });
  }

  return next();
}

function cleanMongoDoc(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

async function loadUserZonesFromMongo() {
  if (!isMongoConnected()) return [];

  const userZones = await incidentsCollection
    .find({ userCreated: true })
    .sort({ time: -1 })
    .toArray();

  return withIds(userZones.map(cleanMongoDoc));
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
  const changedAt = Date.parse(raw?.changed || "");
  const isRecent =
    !Number.isNaN(changedAt) && Date.now() - changedAt <= 2 * 60 * 60 * 1000;

  if (raw?.alert && isRecent) return "high";
  if (isRecent) return "medium";

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
    const persistedUserZones = await loadUserZonesFromMongo();
    const cachedUserZones = Array.from(incidentCache.values()).filter(
      (item) => item.userCreated,
    );

    const userZoneMap = new Map();
    [...cachedUserZones, ...persistedUserZones].forEach((zone) => {
      if (zone?.id) {
        userZoneMap.set(zone.id, zone);
      }
    });
    const userZones = Array.from(userZoneMap.values());

    // Combine multiple sources: alerts + seismic + safe locations
    const newIncidents = [
      ...primaryIncidents,
      ...fallbackIncidents.slice(0, 5),
      ...safeLocations,
      ...userZones,
    ];

    // Create set of IDs that should be active
    const activeIds = new Set(newIncidents.map((inc) => inc.id));

    // Remove incidents that are no longer active
    for (const [id, incident] of incidentCache) {
      if (!activeIds.has(id)) {
        incidentCache.delete(id);
      }
    }

    // Add new incidents
    newIncidents.forEach((incident) => {
      if (!incidentCache.has(incident.id)) {
        incidentCache.set(incident.id, incident);
      }
    });

    // Save to MongoDB if connected
    if (isMongoConnected()) {
      const nonUserIncidents = newIncidents.filter((item) => !item.userCreated);
      await incidentsCollection.deleteMany({ userCreated: { $ne: true } });
      if (nonUserIncidents.length > 0) {
        await incidentsCollection.insertMany(nonUserIncidents);
      }
    }

    const sourceList = [
      primaryIncidents.length > 0 && "air-alert-ukraine",
      fallbackIncidents.length > 0 && "seismic-usgs",
      userZones.length > 0 && "manual-zones",
    ]
      .filter(Boolean)
      .join(", ");

    cacheMeta = {
      ...cacheMeta,
      mode: "live-multi-source",
      activeSource: sourceList || "fallback",
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    cacheMeta = {
      ...cacheMeta,
      mode: "fallback",
      activeSource: "fallback",
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
    incidents: Array.from(incidentCache.values()),
    cacheMeta,
  });
});

app.get("/api/zones/reasons", (req, res) => {
  res.json({ ok: true, reasons: MANUAL_ZONE_REASONS });
});

app.post("/api/zones", async (req, res) => {
  try {
    const status = req.body?.status;
    const reason = req.body?.reason;
    const coordinates = req.body?.coordinates || {};
    const lat = Number(coordinates.lat);
    const lng = Number(coordinates.lng);

    if (!["high", "medium", "low"].includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid status",
      });
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid coordinates",
      });
    }

    if (!MANUAL_ZONE_REASONS[status]?.includes(reason)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid reason for selected status",
      });
    }

    const zone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `${reason} - handmatig gemarkeerd`,
      region: req.body?.region || "Custom zone",
      coordinates: { lat, lng },
      time: new Date().toISOString(),
      source: "manual",
      confidenceScore: 2,
      validationStatus: "unverified",
      status,
      advice: adviceFromStatus(status),
      reason,
      userCreated: true,
    };

    if (isMongoConnected()) {
      await incidentsCollection.insertOne(zone);
    }

    incidentCache.set(zone.id, zone);
    cacheMeta = {
      ...cacheMeta,
      lastUpdated: new Date().toISOString(),
    };

    return res.status(201).json({ ok: true, zone });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to create zone",
      error: error?.message,
    });
  }
});

app.get("/api/zones/unverified", requireAdmin, async (req, res) => {
  try {
    let zones = Array.from(incidentCache.values()).filter(
      (item) => item.userCreated && item.validationStatus === "unverified",
    );

    if (isMongoConnected()) {
      const persisted = await incidentsCollection
        .find({ userCreated: true, validationStatus: "unverified" })
        .sort({ time: -1 })
        .toArray();
      zones = withIds(persisted.map(cleanMongoDoc));
    }

    return res.json({ ok: true, zones });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to load unverified zones",
      error: error?.message,
    });
  }
});

app.patch("/api/zones/:id/verify", requireAdmin, async (req, res) => {
  const zoneId = req.params.id;
  const existing = incidentCache.get(zoneId);

  if (!existing) {
    return res.status(404).json({ ok: false, message: "Zone not found" });
  }

  const updated = {
    ...existing,
    validationStatus: "verified",
  };

  incidentCache.set(zoneId, updated);

  if (isMongoConnected()) {
    await incidentsCollection.updateOne(
      { id: zoneId, userCreated: true },
      { $set: { validationStatus: "verified" } },
    );
  }

  return res.json({ ok: true, zone: updated });
});

app.delete("/api/zones/:id", async (req, res) => {
  const zoneId = req.params.id;
  const existing = incidentCache.get(zoneId);

  if (!existing || !existing.userCreated) {
    return res.status(404).json({ ok: false, message: "Zone not found" });
  }

  incidentCache.delete(zoneId);

  if (isMongoConnected()) {
    await incidentsCollection.deleteOne({ id: zoneId, userCreated: true });
  }

  return res.json({ ok: true, deletedId: zoneId });
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

  incidentCache.set(injected.id, injected);
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

  if (mongoConnected) {
    const startupUserZones = await loadUserZonesFromMongo();
    if (startupUserZones.length > 0) {
      const merged = [
        ...Array.from(incidentCache.values()),
        ...startupUserZones,
      ];
      const uniqueMap = new Map();
      merged.forEach((item) => {
        if (item?.id) uniqueMap.set(item.id, item);
      });
      incidentCache.clear();
      uniqueMap.forEach((inc, id) => incidentCache.set(id, inc));
    }
  }

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
