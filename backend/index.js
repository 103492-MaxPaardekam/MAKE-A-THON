import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import { mockIncidents, mockDemoUpdate } from "../shared/mockIncidents.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS || 30000);
const ENABLE_DEMO_MODE = process.env.ENABLE_DEMO_MODE !== "false";

const AIR_ALERT_PRIMARY_URL = process.env.AIR_ALERT_PRIMARY_URL || "";
const AIR_ALERT_FALLBACK_URL = process.env.AIR_ALERT_FALLBACK_URL || "";

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

await refreshIncidents();
setInterval(refreshIncidents, REFRESH_INTERVAL_MS);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "safe-zone-api",
    uptimeSeconds: Math.round(process.uptime()),
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

app.listen(PORT, () => {
  console.log(`Safe Zone API listening on http://localhost:${PORT}`);
});
