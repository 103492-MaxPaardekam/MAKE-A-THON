import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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
      if (!response.ok) {
        throw new Error(`API ${response.status} on ${baseUrl}`);
      }
      const payload = await response.json();
      return { payload, baseUrl };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("All API base URLs failed");
}

function scoreColor(score) {
  if (score >= 5) return "#ef4444";
  if (score >= 4) return "#f97316";
  if (score >= 3) return "#f59e0b";
  if (score >= 2) return "#84cc16";
  return "#22c55e";
}

function markerColorFromStatus(status) {
  if (status === "high") return "#ef4444";
  if (status === "medium") return "#f59e0b";
  return "#22c55e";
}

function formatRelativeTime(isoTime) {
  if (!isoTime) return "zojuist";

  const timestamp = Date.parse(isoTime);
  if (Number.isNaN(timestamp)) return "zojuist";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "zojuist";
  if (diffMinutes < 60) return `${diffMinutes} min geleden`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} uur geleden`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} dag(en) geleden`;
}

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

  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const x = lng + lngRadius * Math.cos(angle);
    const y = lat + latRadius * Math.sin(angle);
    coords.push([x, y]);
  }

  return coords;
}

function buildRiskAreasGeoJSON(incidents) {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter(
        (incident) => incident?.coordinates?.lat && incident?.coordinates?.lng,
      )
      .map((incident) => ({
        type: "Feature",
        properties: {
          id: incident.id,
          title: incident.title,
          region: incident.region,
          source: incident.source,
          status: incident.status || "medium",
          advice: incident.advice || "let op",
          confidenceScore: Number(incident.confidenceScore || 3),
        },
        geometry: {
          type: "Point",
          coordinates: [incident.coordinates.lng, incident.coordinates.lat],
        },
      })),
  };
}

function buildRiskAreaPolygonsGeoJSON(incidents) {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter(
        (incident) => incident?.coordinates?.lat && incident?.coordinates?.lng,
      )
      .map((incident) => ({
        type: "Feature",
        properties: {
          id: incident.id,
          status: incident.status || "medium",
          source: incident.source,
          title: incident.title,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            createAreaPolygon(
              incident.coordinates.lng,
              incident.coordinates.lat,
              getAreaRadiusKm(incident),
            ),
          ],
        },
      })),
  };
}

function ensureRiskAreaLayers(map) {
  if (map.getSource("risk-areas") && map.getSource("risk-area-polygons")) {
    return;
  }

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
      "fill-opacity": 0.22,
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
      "line-width": 1.6,
      "line-opacity": 0.75,
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
      "circle-opacity": 0.28,
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

export default function AppWeb() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const hasFittedMapRef = useRef(false);
  const [incidents, setIncidents] = useState(incidentsSeed);
  const [apiStatus, setApiStatus] = useState("loading");
  const isLiveDataReady = apiStatus.startsWith("live-");

  const activeIncidents = useMemo(
    () => incidents.filter((incident) => incident?.status === "high"),
    [incidents],
  );

  const isDemoMode = useMemo(() => {
    const search =
      typeof globalThis !== "undefined" && globalThis.location
        ? globalThis.location.search || ""
        : "";
    const params = new URLSearchParams(search);
    return params.get("mode") === "demo";
  }, []);

  const mapToken =
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
    process.env.REACT_APP_MAPBOX_TOKEN ||
    "";

  useEffect(() => {
    async function loadIncidents() {
      try {
        const { payload } = await fetchFromApi("/api/incidents");
        setApiStatus(payload?.cacheMeta?.mode || "loading");

        if (Array.isArray(payload?.incidents) && payload.incidents.length > 0) {
          setIncidents(payload.incidents);
          return;
        }
      } catch (error) {
        setApiStatus("loading");
      }
    }

    loadIncidents();
    const timer = setInterval(loadIncidents, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isLiveDataReady) return;
    if (!mapContainerRef.current || mapRef.current || !mapToken) return;

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

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const applyRiskAreas = () => {
      ensureRiskAreaLayers(mapRef.current);
      const source = mapRef.current.getSource("risk-areas");
      const polygonSource = mapRef.current.getSource("risk-area-polygons");
      if (source) {
        source.setData(buildRiskAreasGeoJSON(incidents));
      }
      if (polygonSource) {
        polygonSource.setData(buildRiskAreaPolygonsGeoJSON(incidents));
      }
    };

    if (mapRef.current.isStyleLoaded()) {
      applyRiskAreas();
    } else {
      mapRef.current.once("load", applyRiskAreas);
    }

    incidents.forEach((incident) => {
      if (!incident.coordinates) return;

      const marker = new mapboxgl.Marker({
        color: markerColorFromStatus(incident.status),
        scale: 0.9,
      })
        .setLngLat([incident.coordinates.lng, incident.coordinates.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18 }).setHTML(
            `<div style="min-width:240px;padding:10px 12px;border-radius:10px;background:#f8fafc;color:#0f172a;font-family:'Trebuchet MS','Segoe UI',sans-serif;line-height:1.4;">` +
              `<div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;">${incident.title}</div>` +
              `<div style="font-size:12px;color:#334155;margin-bottom:4px;">${incident.region} | ${incident.source}</div>` +
              `<div style="font-size:12px;color:#1e293b;margin-bottom:3px;">Confidence: ${incident.confidenceScore}/5</div>` +
              `<div style="font-size:12px;color:#1e293b;">Advice: ${incident.advice}</div>` +
              `</div>`,
          ),
        )
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });

    if (!hasFittedMapRef.current) {
      const coords = incidents
        .filter(
          (incident) =>
            incident?.coordinates?.lat && incident?.coordinates?.lng,
        )
        .map((incident) => [
          incident.coordinates.lng,
          incident.coordinates.lat,
        ]);

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

  async function triggerDemoUpdate() {
    try {
      const { payload } = await fetchFromApi("/api/demo/trigger-update", {
        method: "POST",
      });
      if (payload?.incident) {
        setIncidents((current) => [payload.incident, ...current]);
        setApiStatus(payload?.cacheMeta?.mode || "demo-injected");
      }
    } catch (error) {
      setIncidents((current) => {
        const next = {
          id: `inc-demo-${Date.now()}`,
          title: "Emergency update - New high risk alert",
          region: "Kyiv",
          coordinates: { lat: 50.3925, lng: 30.6812 },
          source: "Air Alert Ukraine",
          confidenceScore: 5,
          validationStatus: "verified",
          status: "high",
          advice: "gevaar",
          time: "Now",
        };
        return [next, ...current];
      });
      setApiStatus("demo-local-fallback");
    }
  }

  if (!mapToken) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>Safe Zone</div>
        <div style={styles.missingTokenCard}>
          <h2 style={styles.missingTitle}>Mapbox token ontbreekt</h2>
          <p style={styles.missingText}>
            Zet EXPO_PUBLIC_MAPBOX_TOKEN in je frontend/.env om de kaart te
            laden.
          </p>
        </div>
      </div>
    );
  }

  if (!isLiveDataReady) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <div style={styles.loadingPulse} />
          <h2 style={styles.loadingTitle}>Safe Zone wordt geladen</h2>
          <p style={styles.loadingText}>
            Wachten op live data van de bronnen...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.title}>Safe Zone</h1>
          <p style={styles.subtitle}>
            Live safety updates for civilians in conflict areas
          </p>
        </div>
        <div style={styles.badge}>Ukraine | Web Demo</div>
      </div>

      <div style={styles.apiStatus}>API status: {apiStatus}</div>

      <div style={styles.layout}>
        <div style={styles.mapCard}>
          <div ref={mapContainerRef} style={styles.mapContainer} />
        </div>

        <div style={styles.feedCard}>
          <div style={styles.feedHeader}>
            <h3 style={styles.feedTitle}>Incident Feed</h3>
            {isDemoMode ? (
              <button style={styles.demoButton} onClick={triggerDemoUpdate}>
                Trigger demo update
              </button>
            ) : null}
          </div>

          <div style={styles.feedList}>
            {activeIncidents.length === 0 ? (
              <div style={styles.feedEmptyState}>
                Geen actieve meldingen op dit moment.
              </div>
            ) : (
              activeIncidents.map((incident) => (
                <div key={incident.id} style={styles.feedItem}>
                  <div style={styles.feedItemTitleRow}>
                    <strong style={styles.feedItemTitle}>
                      {incident.title}
                    </strong>
                    <span
                      style={{
                        ...styles.dot,
                        backgroundColor: scoreColor(incident.confidenceScore),
                      }}
                    />
                  </div>
                  <div style={styles.feedMeta}>
                    {incident.region} | {incident.source} |{" "}
                    {formatRelativeTime(incident.time)}
                  </div>
                  <div style={styles.feedMeta}>
                    Confidence: {incident.confidenceScore}/5 | Advice:{" "}
                    {incident.advice}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={styles.feedLegend}>
            <div style={styles.feedLegendTitle}>Legenda</div>
            <div style={styles.feedLegendRow}>
              <span style={{ ...styles.legendItem, borderColor: "#ef4444" }}>
                Rood: onveilig
              </span>
              <span style={{ ...styles.legendItem, borderColor: "#f59e0b" }}>
                Geel: gemiddeld
              </span>
              <span style={{ ...styles.legendItem, borderColor: "#22c55e" }}>
                Groen: veilig
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 450px at 20% -20%, #1d4ed8 0%, rgba(29,78,216,0) 70%), radial-gradient(900px 500px at 100% 0%, #7f1d1d 0%, rgba(127,29,29,0) 60%), #060a14",
    color: "#e2e8f0",
    padding: "28px",
    boxSizing: "border-box",
    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
  },
  topBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    marginBottom: "14px",
  },
  title: {
    margin: 0,
    fontSize: "42px",
    lineHeight: 1,
    letterSpacing: "0.8px",
    color: "#f8fafc",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#93c5fd",
    fontSize: "14px",
  },
  badge: {
    alignSelf: "center",
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#cbd5e1",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "12px",
    fontWeight: 700,
  },
  apiStatus: {
    marginBottom: "10px",
    color: "#93c5fd",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
  },
  legendItem: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "#e2e8f0",
    background: "rgba(15, 23, 42, 0.85)",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: "14px",
  },
  mapCard: {
    border: "1px solid #1e293b",
    background: "#0b1220",
    borderRadius: "12px",
    overflow: "hidden",
    minHeight: "72vh",
    boxShadow: "0 10px 40px rgba(2,6,23,0.45)",
  },
  mapContainer: {
    width: "100%",
    height: "72vh",
  },
  feedCard: {
    border: "1px solid #1e293b",
    background: "#0f172a",
    borderRadius: "12px",
    minHeight: "72vh",
    maxHeight: "72vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 40px rgba(2,6,23,0.45)",
  },
  feedHeader: {
    padding: "14px 14px 10px",
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  feedTitle: {
    margin: 0,
    fontSize: "16px",
    color: "#f8fafc",
  },
  demoButton: {
    border: 0,
    background: "#dc2626",
    color: "white",
    borderRadius: "8px",
    padding: "8px 11px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  feedList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  feedLegend: {
    borderTop: "1px solid #1e293b",
    padding: "10px 10px 12px",
    background: "#0b1220",
  },
  feedLegendTitle: {
    color: "#cbd5e1",
    fontSize: "12px",
    marginBottom: "7px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    fontWeight: 700,
  },
  feedLegendRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  feedItem: {
    background: "#111b2d",
    border: "1px solid #1f2a40",
    borderRadius: "10px",
    padding: "10px",
  },
  feedEmptyState: {
    background: "#0f172a",
    border: "1px dashed #334155",
    color: "#94a3b8",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "13px",
  },
  feedItemTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  feedItemTitle: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: 700,
  },
  feedMeta: {
    color: "#94a3b8",
    marginTop: "4px",
    fontSize: "12px",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    display: "inline-block",
    flexShrink: 0,
  },
  header: {
    fontSize: "28px",
    color: "#fff",
    marginBottom: "12px",
    fontWeight: 800,
  },
  missingTokenCard: {
    border: "1px solid #7f1d1d",
    background: "#1f0a0a",
    borderRadius: "12px",
    padding: "16px",
    maxWidth: "720px",
  },
  missingTitle: {
    marginTop: 0,
    marginBottom: "8px",
    color: "#fecaca",
  },
  missingText: {
    margin: 0,
    color: "#fca5a5",
  },
  loadingWrap: {
    minHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  },
  loadingPulse: {
    width: "58px",
    height: "58px",
    borderRadius: "999px",
    border: "3px solid rgba(59, 130, 246, 0.45)",
    borderTopColor: "#ef4444",
    animation: "spin 0.9s linear infinite",
  },
  loadingTitle: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "26px",
  },
  loadingText: {
    margin: 0,
    color: "#93c5fd",
    fontSize: "14px",
  },
};
