import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bgBase: "#05090f",
  bgSurface: "#0a1220",
  bgElevated: "#0e1a2e",
  bgCard: "#0c1628",

  borderSubtle: "rgba(148,163,184,0.07)",
  borderDefault: "rgba(148,163,184,0.12)",

  textPrimary: "#f0f4f8",
  textSecondary: "#8a9bae",
  textMuted: "#3d4f62",

  accentBlue: "#3b82f6",
  accentBlueDim: "rgba(59,130,246,0.13)",

  high: "#ef4444",
  highDim: "rgba(239,68,68,0.11)",
  highBorder: "rgba(239,68,68,0.28)",

  medium: "#f59e0b",
  mediumDim: "rgba(245,158,11,0.11)",
  mediumBorder: "rgba(245,158,11,0.26)",

  low: "#22c55e",
  lowDim: "rgba(34,197,94,0.09)",
  lowBorder: "rgba(34,197,94,0.20)",

  font: "'Manrope', system-ui, -apple-system, sans-serif",
  fontDisplay: "'Sora', 'Manrope', system-ui, sans-serif",
};

// ─── Status helpers ───────────────────────────────────────────────────────────
function statusMeta(status) {
  if (status === "high")
    return {
      color: C.high,
      bg: C.highDim,
      border: C.highBorder,
      label: "HIGH",
    };
  if (status === "medium")
    return {
      color: C.medium,
      bg: C.mediumDim,
      border: C.mediumBorder,
      label: "MED",
    };
  return { color: C.low, bg: C.lowDim, border: C.lowBorder, label: "LOW" };
}

function scoreColor(score) {
  if (score >= 5) return C.high;
  if (score >= 4) return C.medium;
  if (score >= 3) return "#f59e0b";
  if (score >= 2) return "#84cc16";
  return C.low;
}

function markerColorFromStatus(status) {
  if (status === "high") return C.high;
  if (status === "medium") return C.medium;
  return C.low;
}

function formatRelativeTime(isoTime) {
  if (!isoTime) return "zojuist";
  const ts = Date.parse(isoTime);
  if (Number.isNaN(ts)) return isoTime; // keep "Now", "12 min ago", etc.
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}u geleden`;
  return `${Math.floor(diffH / 24)}d geleden`;
}

const STATUS_ORDER = { high: 0, medium: 1, low: 2 };

// ─── Mapbox helpers (logic unchanged) ────────────────────────────────────────
function getAreaRadiusKm(incident) {
  if (incident?.status === "high") return 60;
  if (incident?.status === "medium") return 35;
  if (incident?.source === "safe-locations-kyiv") return 8;
  return 20;
}

function createAreaPolygon(lng, lat, radiusKm, steps = 24) {
  const coords = [];
  const latRadius = radiusKm / 111.32;
  const lngRadius = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    coords.push([
      lng + lngRadius * Math.cos(angle),
      lat + latRadius * Math.sin(angle),
    ]);
  }
  return coords;
}

function buildRiskAreasGeoJSON(incidents) {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter((i) => i?.coordinates?.lat && i?.coordinates?.lng)
      .map((i) => ({
        type: "Feature",
        properties: {
          id: i.id,
          title: i.title,
          region: i.region,
          source: i.source,
          status: i.status || "medium",
          advice: i.advice || "let op",
          confidenceScore: Number(i.confidenceScore || 3),
        },
        geometry: {
          type: "Point",
          coordinates: [i.coordinates.lng, i.coordinates.lat],
        },
      })),
  };
}

function buildRiskAreaPolygonsGeoJSON(incidents) {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter((i) => i?.coordinates?.lat && i?.coordinates?.lng)
      .map((i) => ({
        type: "Feature",
        properties: {
          id: i.id,
          status: i.status || "medium",
          source: i.source,
          title: i.title,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            createAreaPolygon(
              i.coordinates.lng,
              i.coordinates.lat,
              getAreaRadiusKm(i),
            ),
          ],
        },
      })),
  };
}

function ensureRiskAreaLayers(map) {
  if (map.getSource("risk-areas") && map.getSource("risk-area-polygons"))
    return;

  map.addSource("risk-areas", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("risk-area-polygons", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "risk-area-fill",
    type: "fill",
    source: "risk-area-polygons",
    paint: {
      "fill-color": [
        "match",
        ["get", "status"],
        "high",
        "#dc2626",
        "medium",
        "#f59e0b",
        "#22c55e",
      ],
      "fill-opacity": 0.18,
    },
  });
  map.addLayer({
    id: "risk-area-outline",
    type: "line",
    source: "risk-area-polygons",
    paint: {
      "line-color": [
        "match",
        ["get", "status"],
        "high",
        "#fca5a5",
        "medium",
        "#fde68a",
        "#86efac",
      ],
      "line-width": 1.5,
      "line-opacity": 0.7,
    },
  });
  map.addLayer({
    id: "risk-areas-fill",
    type: "circle",
    source: "risk-areas",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        4,
        8,
        6,
        11,
        10,
      ],
      "circle-color": [
        "match",
        ["get", "status"],
        "high",
        "#ef4444",
        "medium",
        "#f59e0b",
        "#22c55e",
      ],
      "circle-opacity": 0.25,
      "circle-stroke-width": 1.2,
      "circle-stroke-color": [
        "match",
        ["get", "status"],
        "high",
        "#fca5a5",
        "medium",
        "#fde68a",
        "#86efac",
      ],
    },
  });
}

// ─── API helpers ──────────────────────────────────────────────────────────────
const API_BASE_URL_CANDIDATES = [
  process.env.EXPO_PUBLIC_API_BASE_URL,
  process.env.REACT_APP_API_BASE_URL,
  "http://localhost:3001",
  "http://127.0.0.1:3001",
].filter(Boolean);

async function fetchFromApi(path, options) {
  let lastError = null;
  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, options);
      if (!response.ok) throw new Error(`API ${response.status} on ${baseUrl}`);
      return { payload: await response.json(), baseUrl };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("All API base URLs failed");
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const incidentsSeed = [
  {
    id: "inc-1",
    title: "Air raid alert - Kyiv downtown",
    region: "Kyiv",
    coordinates: { lat: 50.4501, lng: 30.5234 },
    source: "Air Alert Ukraine",
    confidenceScore: 5,
    validationStatus: "verified",
    status: "high",
    advice: "gevaar",
    time: "Now",
  },
  {
    id: "inc-2",
    title: "Movement restrictions in eastern district",
    region: "Kyiv",
    coordinates: { lat: 50.4256, lng: 30.6432 },
    source: "State Emergency Service",
    confidenceScore: 4,
    validationStatus: "verified",
    status: "medium",
    advice: "let op",
    time: "12 min ago",
  },
  {
    id: "inc-3",
    title: "Safe shelter capacity updated",
    region: "Kyiv",
    coordinates: { lat: 50.4012, lng: 30.5498 },
    source: "ReliefWeb",
    confidenceScore: 4,
    validationStatus: "verified",
    status: "low",
    advice: "veilig",
    time: "23 min ago",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Pulsing green dot for LIVE indicator */
function LivePulseDot({ color = C.low }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 10,
        height: 10,
      }}
    >
      <span
        className="sz-pulse-ring"
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: "50%",
          border: `1px solid ${color}`,
        }}
      />
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
    </span>
  );
}

/** Small metric pill shown in the stats row */
function StatPill({ count, label, color }) {
  return (
    <div
      className="sz-stat-pill"
      style={{
        background:
          "linear-gradient(180deg, rgba(15,26,46,0.9), rgba(9,16,30,0.88))",
        border: `1px solid ${C.borderSubtle}`,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 20px rgba(3,8,18,0.28)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <div>
        <div
          className="sz-stat-pill__count"
          style={{ color, fontFamily: C.font }}
        >
          {count}
        </div>
        <div
          className="sz-stat-pill__label"
          style={{ color: C.textMuted, fontFamily: C.font }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/** Animated incident card */
function IncidentCard({ incident }) {
  const meta = statusMeta(incident.status);
  const isDemo = String(incident.id).startsWith("inc-demo-");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -14 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{
        position: "relative",
        background:
          "linear-gradient(170deg, rgba(18,29,48,0.92), rgba(11,21,38,0.94))",
        border: `1px solid ${C.borderDefault}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 8,
        padding: "10px 12px",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 8px 18px rgba(2,8,20,0.28)",
      }}
    >
      {/* DEMO badge */}
      {isDemo && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "#dc2626",
            color: "#fff",
            fontSize: 9,
            fontWeight: 800,
            padding: "2px 6px",
            borderRadius: 4,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            fontFamily: C.font,
          }}
        >
          DEMO
        </span>
      )}

      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.textPrimary,
            lineHeight: 1.4,
            fontFamily: C.font,
            flex: 1,
          }}
        >
          {incident.title}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: 9,
            fontWeight: 700,
            padding: "3px 7px",
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            fontFamily: C.font,
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* Meta row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 7,
        }}
      >
        <span
          style={{ fontSize: 11, color: C.textSecondary, fontFamily: C.font }}
        >
          {incident.region}
        </span>
        <span
          style={{
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: C.textMuted,
            flexShrink: 0,
          }}
        />
        <span
          style={{ fontSize: 11, color: C.textSecondary, fontFamily: C.font }}
        >
          {incident.source}
        </span>
        <span
          style={{
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: C.textMuted,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: C.font }}>
          {formatRelativeTime(incident.time)}
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div
          style={{
            flex: 1,
            height: 3,
            borderRadius: 999,
            background: C.bgSurface,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(incident.confidenceScore / 5) * 100}%`,
              background: scoreColor(incident.confidenceScore),
              borderRadius: 999,
            }}
          />
        </div>
        <span
          style={{
            fontSize: 10,
            color: C.textMuted,
            fontFamily: C.font,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {incident.confidenceScore}/5
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AppWeb() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const hasFittedMapRef = useRef(false);

  const [incidents, setIncidents] = useState(incidentsSeed);
  const [apiStatus, setApiStatus] = useState("loading");
  const [lastFetched, setLastFetched] = useState(Date.now());

  const isLiveDataReady = apiStatus.startsWith("live-");

  const isDemoMode = useMemo(() => {
    const search =
      typeof globalThis !== "undefined" && globalThis.location
        ? globalThis.location.search || ""
        : "";
    return new URLSearchParams(search).get("mode") === "demo";
  }, []);

  const mapToken =
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
    process.env.REACT_APP_MAPBOX_TOKEN ||
    "";

  // Sorted by severity: high → medium → low
  const sortedIncidents = useMemo(
    () =>
      [...incidents].sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
      ),
    [incidents],
  );

  const highCount = useMemo(
    () => incidents.filter((i) => i.status === "high").length,
    [incidents],
  );
  const mediumCount = useMemo(
    () => incidents.filter((i) => i.status === "medium").length,
    [incidents],
  );
  const lowCount = useMemo(
    () => incidents.filter((i) => i.status === "low").length,
    [incidents],
  );

  const lastUpdatedStr = useMemo(
    () =>
      new Date(lastFetched).toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [lastFetched],
  );

  // ── Inject Google Fonts + global CSS keyframes ──
  useEffect(() => {
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap";
    document.head.appendChild(fontLink);

    const styleEl = document.createElement("style");
    styleEl.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #05090f; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      @keyframes sz-pulse { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0; transform: scale(2.4); } }
      .sz-pulse-ring { animation: sz-pulse 2.2s ease-out infinite; }
      @keyframes sz-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      /* ── Layout classes ────────────────────────────────────────── */
      .sz-page {
        display: flex; flex-direction: column;
        min-height: 100vh; padding: 20px 24px;
        box-sizing: border-box; gap: 14px;
      }
      .sz-page--center { align-items: center; justify-content: center; }

      .sz-topbar {
        display: flex; align-items: center;
        justify-content: space-between; gap: 14px; flex-shrink: 0;
      }
      .sz-topbar-left  { flex: 1; min-width: 0; }
      .sz-topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

      .sz-title    { margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; line-height: 1; }
      .sz-subtitle { margin: 5px 0 0; font-size: 13px; }

      .sz-stats-row   { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
      .sz-stats-right { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }

      .sz-stat-pill {
        display: flex; align-items: center; gap: 8px;
        border-radius: 8px; padding: 8px 14px;
      }
      .sz-stat-pill__count { font-size: 20px; font-weight: 700; line-height: 1; letter-spacing: -0.5px; }
      .sz-stat-pill__label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 2px; font-weight: 600; }

      .sz-layout {
        display: grid; grid-template-columns: 1.65fr 1fr;
        gap: 14px; flex: 1; min-height: 0;
      }

      .sz-map-card  { border-radius: 12px; overflow: hidden; height: calc(100vh - 192px); min-height: 480px; }
      .sz-feed-card { border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; height: calc(100vh - 192px); min-height: 480px; }
      .sz-feed-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 7px; min-height: 0; }

      /* ── Tablet: 769 – 1100 px ────────────────────────────────── */
      @media (min-width: 769px) and (max-width: 1100px) {
        .sz-page    { padding: 16px 18px; gap: 12px; }
        .sz-layout  { grid-template-columns: 1fr 1fr; gap: 12px; }
        .sz-map-card  { height: calc(100vh - 205px); min-height: 360px; }
        .sz-feed-card { height: calc(100vh - 205px); min-height: 360px; }
        .sz-title   { font-size: 26px; }
      }

      /* ── Mobile: ≤ 768 px ─────────────────────────────────────── */
      @media (max-width: 768px) {
        .sz-page    { padding: 12px 14px; gap: 10px; }
        .sz-topbar  { flex-wrap: wrap; gap: 8px; }
        .sz-title   { font-size: 22px; }
        .sz-subtitle { display: none; }
        .sz-layout  { grid-template-columns: 1fr; gap: 10px; flex: none; }
        .sz-map-card  { height: 44vh; min-height: 240px; }
        .sz-feed-card { height: auto; min-height: 280px; max-height: 48vh; }
        .sz-stats-right { margin-left: 0; width: 100%; }
        .sz-stat-pill__count { font-size: 16px; }
        .sz-stat-pill { padding: 6px 10px; gap: 6px; }
      }

      /* ── Small mobile: ≤ 480 px ───────────────────────────────── */
      @media (max-width: 480px) {
        .sz-page  { padding: 8px 10px; gap: 8px; }
        .sz-title { font-size: 18px; }
        .sz-map-card  { height: 40vh; min-height: 200px; }
        .sz-feed-card { max-height: 44vh; }
        .sz-topbar-right { gap: 6px; }
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      if (document.head.contains(fontLink)) document.head.removeChild(fontLink);
      if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
    };
  }, []);

  // ── Load incidents every 30 s ──
  useEffect(() => {
    async function loadIncidents() {
      try {
        const { payload } = await fetchFromApi("/api/incidents");
        setApiStatus(payload?.cacheMeta?.mode || "loading");
        if (Array.isArray(payload?.incidents) && payload.incidents.length > 0) {
          setIncidents(payload.incidents);
          setLastFetched(Date.now());
        }
      } catch {
        setApiStatus("loading");
      }
    }
    loadIncidents();
    const timer = setInterval(loadIncidents, 30000);
    return () => clearInterval(timer);
  }, []);

  // ── Init Mapbox ──
  useEffect(() => {
    if (
      !isLiveDataReady ||
      !mapContainerRef.current ||
      mapRef.current ||
      !mapToken
    )
      return;

    mapboxgl.accessToken = mapToken;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [31.2, 48.7],
      zoom: 5.6,
      pitch: 20,
      attributionControl: false,
    });
    mapRef.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapToken, isLiveDataReady]);

  // ── Update markers & risk areas ──
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const applyRiskAreas = () => {
      ensureRiskAreaLayers(mapRef.current);
      const src = mapRef.current.getSource("risk-areas");
      const polySrc = mapRef.current.getSource("risk-area-polygons");
      if (src) src.setData(buildRiskAreasGeoJSON(incidents));
      if (polySrc) polySrc.setData(buildRiskAreaPolygonsGeoJSON(incidents));
    };

    if (mapRef.current.isStyleLoaded()) applyRiskAreas();
    else mapRef.current.once("load", applyRiskAreas);

    incidents.forEach((incident) => {
      if (!incident.coordinates) return;
      const marker = new mapboxgl.Marker({
        color: markerColorFromStatus(incident.status),
        scale: 0.9,
      })
        .setLngLat([incident.coordinates.lng, incident.coordinates.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18 }).setHTML(
            `<div style="min-width:240px;padding:12px 14px;border-radius:10px;` +
              `background:#0c1628;color:#f0f4f8;font-family:'Inter',sans-serif;line-height:1.5;` +
              `border:1px solid rgba(148,163,184,0.12);">` +
              `<div style="font-size:13px;font-weight:700;margin-bottom:5px;">${incident.title}</div>` +
              `<div style="font-size:11px;color:#8a9bae;margin-bottom:3px;">${incident.region} · ${incident.source}</div>` +
              `<div style="font-size:11px;color:#8a9bae;">Zekerheid: ${incident.confidenceScore}/5 · Advies: ${incident.advice}</div>` +
              `</div>`,
          ),
        )
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    });

    if (!hasFittedMapRef.current) {
      const coords = incidents
        .filter((i) => i?.coordinates?.lat && i?.coordinates?.lng)
        .map((i) => [i.coordinates.lng, i.coordinates.lat]);
      if (coords.length > 1) {
        const bounds = coords.reduce(
          (acc, [lng, lat]) => acc.extend([lng, lat]),
          new mapboxgl.LngLatBounds(coords[0], coords[0]),
        );
        mapRef.current.fitBounds(bounds, {
          padding: 70,
          maxZoom: 6.2,
          duration: 900,
        });
      }
      hasFittedMapRef.current = true;
    }
  }, [incidents]);

  // ── Demo update ──
  async function triggerDemoUpdate() {
    try {
      const { payload } = await fetchFromApi("/api/demo/trigger-update", {
        method: "POST",
      });
      if (payload?.incident) {
        setIncidents((cur) => [payload.incident, ...cur]);
        setApiStatus(payload?.cacheMeta?.mode || "demo-injected");
      }
    } catch {
      setIncidents((cur) => [
        {
          id: `inc-demo-${Date.now()}`,
          title: "Emergency update — New high risk alert",
          region: "Kyiv",
          coordinates: { lat: 50.3925, lng: 30.6812 },
          source: "Air Alert Ukraine",
          confidenceScore: 5,
          validationStatus: "verified",
          status: "high",
          advice: "gevaar",
          time: new Date().toISOString(),
        },
        ...cur,
      ]);
      setApiStatus("demo-local-fallback");
    }
  }

  // ── Missing token screen ──
  if (!mapToken) {
    return (
      <div className="sz-page sz-page--center" style={S.page}>
        <div style={S.errorCard}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
          <h2
            style={{
              color: C.textPrimary,
              fontFamily: C.font,
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Mapbox token ontbreekt
          </h2>
          <p
            style={{
              color: C.textSecondary,
              fontFamily: C.font,
              fontSize: 13,
              lineHeight: 1.65,
            }}
          >
            Voeg{" "}
            <code
              style={{
                background: C.bgElevated,
                padding: "1px 6px",
                borderRadius: 4,
                color: C.accentBlue,
              }}
            >
              EXPO_PUBLIC_MAPBOX_TOKEN
            </code>{" "}
            toe in{" "}
            <code
              style={{
                background: C.bgElevated,
                padding: "1px 6px",
                borderRadius: 4,
                color: C.accentBlue,
              }}
            >
              frontend/.env
            </code>
          </p>
        </div>
      </div>
    );
  }

  // ── Loading screen ──
  if (!isLiveDataReady) {
    return (
      <div className="sz-page sz-page--center" style={{ ...S.page, gap: 0 }}>
        {/* Concentric spinning rings */}
        <div
          style={{
            position: "relative",
            width: 72,
            height: 72,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid rgba(239,68,68,0.18)",
              borderTopColor: C.high,
              animation: "sz-spin 1.0s linear infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: "50%",
              border: "2px solid rgba(59,130,246,0.18)",
              borderTopColor: C.accentBlue,
              animation: "sz-spin 1.4s linear infinite reverse",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 20,
              borderRadius: "50%",
              border: "2px solid rgba(34,197,94,0.18)",
              borderTopColor: C.low,
              animation: "sz-spin 1.8s linear infinite",
            }}
          />
        </div>
        <h2
          style={{
            color: C.textPrimary,
            fontFamily: C.font,
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 7,
          }}
        >
          Safe Zone
        </h2>
        <p style={{ color: C.textSecondary, fontFamily: C.font, fontSize: 13 }}>
          Live data ophalen van bronnen...
        </p>
      </div>
    );
  }

  // ── Main app ──
  return (
    <div className="sz-page" style={S.page}>
      {/* ── Top Bar ── */}
      <div className="sz-topbar" style={S.topBar}>
        <div className="sz-topbar-left">
          <h1 className="sz-title" style={S.title}>
            Safe Zone
          </h1>
          <p className="sz-subtitle" style={S.subtitle}>
            Live veiligheidsupdates voor burgers in conflictgebieden
          </p>
        </div>
        <div className="sz-topbar-right">
          {isDemoMode && (
            <button style={S.demoButton} onClick={triggerDemoUpdate}>
              ⚡ Demo update
            </button>
          )}
          <div style={S.liveBadge}>
            <LivePulseDot />
            <span
              style={{
                fontFamily: C.font,
                fontSize: 11,
                fontWeight: 700,
                color: C.low,
                letterSpacing: "0.6px",
              }}
            >
              LIVE
            </span>
          </div>
          <div style={S.countryBadge}>🇺🇦 Ukraine</div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="sz-stats-row" style={S.statsRow}>
        <StatPill count={highCount} label="Hoog risico" color={C.high} />
        <StatPill count={mediumCount} label="Middel risico" color={C.medium} />
        <StatPill count={lowCount} label="Laag / Veilig" color={C.low} />
        <div
          className="sz-stats-right"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{ fontSize: 11, color: C.textMuted, fontFamily: C.font }}
          >
            API:
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.accentBlue,
              fontFamily: C.font,
              background: C.accentBlueDim,
              padding: "3px 9px",
              borderRadius: 99,
              border: "1px solid rgba(59,130,246,0.18)",
            }}
          >
            {apiStatus}
          </span>
          <span
            style={{ fontSize: 11, color: C.textMuted, fontFamily: C.font }}
          >
            · {lastUpdatedStr}
          </span>
        </div>
      </div>

      {/* ── Map + Feed grid ── */}
      <div className="sz-layout">
        {/* Map */}
        <div className="sz-map-card" style={S.mapCard}>
          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Feed */}
        <div className="sz-feed-card" style={S.feedCard}>
          {/* Feed header */}
          <div style={S.feedHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.textPrimary,
                  fontFamily: C.font,
                  letterSpacing: "0.2px",
                }}
              >
                Incident Feed
              </h3>
              <span
                style={{
                  fontSize: 11,
                  color: C.textSecondary,
                  fontFamily: C.font,
                  fontWeight: 600,
                  background: C.bgSurface,
                  border: `1px solid ${C.borderSubtle}`,
                  borderRadius: 99,
                  padding: "1px 8px",
                }}
              >
                {sortedIncidents.length}
              </span>
            </div>
          </div>

          {/* Scrollable list */}
          <div className="sz-feed-list" style={S.feedList}>
            <AnimatePresence mode="popLayout">
              {sortedIncidents.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={S.emptyState}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <div
                    style={{
                      color: C.textSecondary,
                      fontFamily: C.font,
                      fontSize: 13,
                    }}
                  >
                    Geen actieve meldingen
                  </div>
                </motion.div>
              ) : (
                sortedIncidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div style={S.legend}>
            {[
              { color: C.high, label: "Onveilig" },
              { color: C.medium, label: "Gemiddeld" },
              { color: C.low, label: "Veilig" },
            ].map(({ color, label }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: color,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: C.textMuted,
                    fontFamily: C.font,
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stylesheet (visual tokens only — layout is in injected CSS classes) ────────
const S = {
  // Only keeps non-layout visual tokens; layout/sizing live in .sz-* CSS classes
  page: {
    background: [
      "radial-gradient(ellipse 80% 50% at 15% -10%, rgba(29,78,216,0.18) 0%, transparent 60%)",
      "radial-gradient(ellipse 65% 40% at 95% 5%, rgba(127,29,29,0.20) 0%, transparent 55%)",
      C.bgBase,
    ].join(", "),
    color: C.textPrimary,
    fontFamily: C.font,
  },

  topBar: {}, // layout handled by .sz-topbar
  statsRow: {}, // layout handled by .sz-stats-row

  title: {
    color: C.textPrimary,
    fontFamily: C.fontDisplay,
    letterSpacing: "-0.8px",
    textShadow: "0 1px 0 rgba(255,255,255,0.04)",
  },

  subtitle: {
    color: C.textSecondary,
    fontFamily: C.font,
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background:
      "linear-gradient(180deg, rgba(20,42,31,0.55), rgba(15,31,24,0.45))",
    border: "1px solid rgba(34,197,94,0.22)",
    borderRadius: 999,
    padding: "6px 12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },

  countryBadge: {
    background:
      "linear-gradient(180deg, rgba(22,35,58,0.9), rgba(14,26,45,0.84))",
    border: `1px solid ${C.borderSubtle}`,
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: C.textSecondary,
    fontFamily: C.font,
  },

  demoButton: {
    border: 0,
    background: "linear-gradient(180deg, #ef4444, #dc2626)",
    color: "#fff",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: C.font,
    boxShadow: "0 6px 18px rgba(185,28,28,0.32)",
  },

  // layout/sizing for grid + cards handled by .sz-layout / .sz-map-card / .sz-feed-card CSS classes
  mapCard: {
    border: `1px solid rgba(148,163,184,0.15)`,
    background:
      "linear-gradient(180deg, rgba(13,22,38,0.9), rgba(8,15,28,0.94))",
    boxShadow: "0 18px 46px rgba(0,0,0,0.42)",
  },

  feedCard: {
    border: `1px solid rgba(148,163,184,0.15)`,
    background:
      "linear-gradient(180deg, rgba(12,21,37,0.94), rgba(8,15,28,0.96))",
    boxShadow: "0 18px 46px rgba(0,0,0,0.4)",
  },

  feedHeader: {
    padding: "11px 14px",
    borderBottom: `1px solid ${C.borderSubtle}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },

  // layout for feedList handled by .sz-feed-list CSS class
  feedList: {},

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    background: C.bgCard,
    border: `1px dashed ${C.borderSubtle}`,
    borderRadius: 8,
  },

  legend: {
    padding: "9px 14px",
    borderTop: `1px solid ${C.borderSubtle}`,
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexShrink: 0,
    background:
      "linear-gradient(180deg, rgba(9,16,29,0.98), rgba(7,12,22,0.98))",
    borderRadius: "0 0 12px 12px",
  },

  errorCard: {
    background: C.bgElevated,
    border: "1px solid rgba(239,68,68,0.22)",
    borderRadius: 12,
    padding: "28px 32px",
    maxWidth: 480,
    textAlign: "center",
  },
};
