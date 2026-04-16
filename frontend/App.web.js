import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const COLORS = {
  page: "#060a14",
  mapCard: "#0b1220",
  feedCard: "#0f172a",
  border: "#1e293b",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
  unverified: "#64748b",
};

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

const API_BASE_URLS = [
  process.env.EXPO_PUBLIC_API_BASE_URL,
  process.env.REACT_APP_API_BASE_URL,
  "http://localhost:3001",
  "http://127.0.0.1:3001",
].filter(Boolean);

function formatRelativeTime(iso) {
  if (!iso) return "zojuist";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return String(iso);
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} uur geleden`;
  return `${Math.floor(hrs / 24)} dag(en) geleden`;
}

function getAreaRadiusKm(incident) {
  if (incident?.source === "manual" && incident?.status === "low") return 10;
  if (incident?.status === "high") return 60;
  if (incident?.status === "medium") return 35;
  return 20;
}

function markerColor(incident) {
  if (incident?.validationStatus === "unverified") return COLORS.unverified;
  if (incident?.status === "high") return COLORS.high;
  if (incident?.status === "medium") return COLORS.medium;
  return COLORS.low;
}

function createAreaPolygon(lng, lat, radiusKm, steps = 28) {
  const coords = [];
  const latRadius = radiusKm / 111.32;
  const lngRadius = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    coords.push([
      lng + lngRadius * Math.cos(angle),
      lat + latRadius * Math.sin(angle),
    ]);
  }
  return coords;
}

function buildCenters(incidents) {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter((i) => i?.coordinates?.lat && i?.coordinates?.lng)
      .map((i) => ({
        type: "Feature",
        properties: {
          id: i.id,
          status: i.status || "medium",
          validationStatus: i.validationStatus || "unknown",
        },
        geometry: {
          type: "Point",
          coordinates: [i.coordinates.lng, i.coordinates.lat],
        },
      })),
  };
}

function buildPolygons(incidents) {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter((i) => i?.coordinates?.lat && i?.coordinates?.lng)
      .map((i) => ({
        type: "Feature",
        properties: {
          id: i.id,
          status: i.status || "medium",
          validationStatus: i.validationStatus || "unknown",
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

function ensureRiskLayers(map) {
  if (!map.getSource("risk-centers")) {
    map.addSource("risk-centers", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource("risk-polygons")) {
    map.addSource("risk-polygons", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer("risk-polygons-fill")) {
    map.addLayer({
      id: "risk-polygons-fill",
      type: "fill",
      source: "risk-polygons",
      paint: {
        "fill-color": [
          "case",
          ["==", ["get", "validationStatus"], "unverified"],
          COLORS.unverified,
          [
            "match",
            ["get", "status"],
            "high",
            COLORS.high,
            "medium",
            COLORS.medium,
            COLORS.low,
          ],
        ],
        "fill-opacity": [
          "case",
          ["==", ["get", "validationStatus"], "unverified"],
          0.14,
          0.23,
        ],
      },
    });
  }

  if (!map.getLayer("risk-polygons-line")) {
    map.addLayer({
      id: "risk-polygons-line",
      type: "line",
      source: "risk-polygons",
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "validationStatus"], "unverified"],
          "#94a3b8",
          [
            "match",
            ["get", "status"],
            "high",
            "#fca5a5",
            "medium",
            "#fde68a",
            "#86efac",
          ],
        ],
        "line-width": 1.6,
        "line-opacity": 0.85,
      },
    });
  }

  if (!map.getLayer("risk-centers")) {
    map.addLayer({
      id: "risk-centers",
      type: "circle",
      source: "risk-centers",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          3,
          8,
          5,
          11,
          8,
        ],
        "circle-color": [
          "case",
          ["==", ["get", "validationStatus"], "unverified"],
          COLORS.unverified,
          [
            "match",
            ["get", "status"],
            "high",
            COLORS.high,
            "medium",
            COLORS.medium,
            COLORS.low,
          ],
        ],
        "circle-opacity": 0.3,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#e2e8f0",
      },
    });
  }
}

async function fetchFromApi(path, options = {}) {
  let lastError = null;
  for (const base of API_BASE_URLS) {
    try {
      const response = await fetch(`${base}${path}`, options);
      if (!response.ok) {
        const msg = await response.text();
        throw new Error(msg || `API ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("API niet bereikbaar");
}

function buildBasicAuth(username, password) {
  if (!username || !password) return "";
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function ConfidenceBar({ score }) {
  const max = 5;
  const color =
    score >= 4 ? COLORS.low : score >= 3 ? COLORS.medium : COLORS.high;
  return (
    <div style={adminStyles.confRow}>
      <span style={adminStyles.confLabel}>Confidence</span>
      <div style={adminStyles.confTrack}>
        {Array.from({ length: max }, (_, i) => (
          <div
            key={i}
            style={{
              ...adminStyles.confDot,
              background: i < score ? color : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
      <span style={{ ...adminStyles.confLabel, color }}>{score}/{max}</span>
    </div>
  );
}

function ZoneCard({ zone, mode, onVerify, onReject, onDelete, onViewMap }) {
  const statusColor =
    zone.status === "high"
      ? COLORS.high
      : zone.status === "medium"
        ? COLORS.medium
        : COLORS.low;
  const statusLabel =
    zone.status === "high"
      ? "High"
      : zone.status === "medium"
        ? "Medium"
        : "Low";

  return (
    <div style={adminStyles.zoneCard}>
      <div style={adminStyles.zoneCardTop}>
        <span
          style={{
            ...adminStyles.statusPill,
            background: `${statusColor}22`,
            color: statusColor,
            border: `1px solid ${statusColor}44`,
          }}
        >
          {statusLabel}
        </span>
        <span style={adminStyles.zoneTime}>{formatRelativeTime(zone.time)}</span>
      </div>
      <div style={adminStyles.zoneTitle}>{zone.title}</div>
      <div style={adminStyles.zoneMeta}>
        <span>📍 {zone.region}</span>
        {zone.reason ? <span>· {zone.reason}</span> : null}
      </div>
      {zone.confidenceScore != null ? (
        <ConfidenceBar score={zone.confidenceScore} />
      ) : null}
      <div style={adminStyles.zoneCoords}>
        <span>
          {zone.coordinates?.lat?.toFixed?.(5)},{" "}
          {zone.coordinates?.lng?.toFixed?.(5)}
        </span>
        <button style={adminStyles.viewMapBtn} onClick={onViewMap}>
          View on map
        </button>
      </div>
      <div style={adminStyles.zoneActions}>
        {mode === "pending" ? (
          <>
            <button style={adminStyles.acceptBtn} onClick={onVerify}>
              Verify
            </button>
            <button style={adminStyles.rejectBtn} onClick={onReject}>
              Reject
            </button>
          </>
        ) : (
          <button style={adminStyles.deleteBtn} onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function AdminPage() {
  const mapToken =
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
    process.env.REACT_APP_MAPBOX_TOKEN ||
    "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [pendingZones, setPendingZones] = useState([]);
  const [verifiedZones, setVerifiedZones] = useState([]);
  const [totalIncidents, setTotalIncidents] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [mapModal, setMapModal] = useState(null);
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }
  const [toasts, setToasts] = useState([]); // [{ id, message, type }]
  const mapModalRef = useRef(null);
  const mapModalInstanceRef = useRef(null);

  // Override Expo's overflow:hidden so the admin page can scroll normally
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    const root = document.getElementById("root");
    if (root) {
      root._adminPrevHeight = root.style.height;
      root.style.height = "auto";
    }
    return () => {
      document.body.style.overflow = prev || "";
      document.body.style.height = "";
      if (root) root.style.height = root._adminPrevHeight || "";
    };
  }, []);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchFromApi("/api/health");
      setHealth(data);
    } catch { }
  }, []);

  const loadVerifiedZones = useCallback(async () => {
    try {
      const payload = await fetchFromApi("/api/incidents");
      const all = payload?.incidents || [];
      setTotalIncidents(all.length);
      setVerifiedZones(
        all.filter((i) => i.userCreated && i.validationStatus === "verified"),
      );
    } catch { }
  }, []);

  const loadPendingZones = useCallback(
    async (header) => {
      const auth = header ?? authHeader;
      if (!auth) return;
      setLoading(true);
      setError("");
      try {
        const payload = await fetchFromApi("/api/zones/unverified", {
          headers: { Authorization: auth },
        });
        const sorted = (payload?.zones || []).sort(
          (a, b) => Date.parse(b.time) - Date.parse(a.time),
        );
        setPendingZones(sorted);
      } catch (e) {
        setError(e?.message || "Could not load pending zones");
      } finally {
        setLoading(false);
      }
    },
    [authHeader],
  );

  const handleRefresh = useCallback(
    async (header) => {
      await Promise.all([
        loadPendingZones(header),
        loadVerifiedZones(),
        loadHealth(),
      ]);
    },
    [loadPendingZones, loadVerifiedZones, loadHealth],
  );

  // Initial load
  useEffect(() => {
    loadHealth();
    const stored = localStorage.getItem("safezone-admin-auth") || "";
    if (stored) {
      setAuthHeader(stored);
      loadPendingZones(stored);
      loadVerifiedZones();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!authHeader) return;
    const interval = setInterval(() => handleRefresh(), 30000);
    return () => clearInterval(interval);
  }, [authHeader, handleRefresh]);

  // Map modal Mapbox instance
  useEffect(() => {
    if (!mapModal || !mapModalRef.current || !mapToken) return;
    const timeout = setTimeout(() => {
      if (!mapModalRef.current) return;
      mapboxgl.accessToken = mapToken;
      mapModalInstanceRef.current = new mapboxgl.Map({
        container: mapModalRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [mapModal.coordinates.lng, mapModal.coordinates.lat],
        zoom: 8,
        attributionControl: false,
      });
      new mapboxgl.Marker({ color: markerColor(mapModal) })
        .setLngLat([mapModal.coordinates.lng, mapModal.coordinates.lat])
        .addTo(mapModalInstanceRef.current);
    }, 50);
    return () => {
      clearTimeout(timeout);
      if (mapModalInstanceRef.current) {
        mapModalInstanceRef.current.remove();
        mapModalInstanceRef.current = null;
      }
    };
  }, [mapModal, mapToken]);

  async function handleLogin(e) {
    e.preventDefault();
    const header = buildBasicAuth(username, password);
    localStorage.setItem("safezone-admin-auth", header);
    setAuthHeader(header);
    setError("");
    await handleRefresh(header);
  }

  async function verifyZone(zoneId) {
    try {
      await fetchFromApi(`/api/zones/${zoneId}/verify`, {
        method: "PATCH",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      });
      addToast("Zone verified and published to the map", "success");
      await handleRefresh();
    } catch (e) {
      addToast(e?.message || "Could not verify zone", "error");
    }
  }

  async function rejectZone(zoneId) {
    try {
      await fetchFromApi(`/api/zones/${zoneId}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });
      addToast("Zone rejected and removed from the map", "success");
      await handleRefresh();
    } catch (e) {
      addToast(e?.message || "Could not reject zone", "error");
    }
  }

  async function deleteVerifiedZone(zoneId) {
    try {
      await fetchFromApi(`/api/zones/${zoneId}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });
      addToast("Zone deleted from the map", "success");
      await handleRefresh();
    } catch (e) {
      addToast(e?.message || "Could not delete zone", "error");
    }
  }

  function askConfirm(message, onConfirm) {
    setConfirm({ message, onConfirm });
  }

  if (!authHeader) {
    return (
      <div style={adminStyles.loginPage}>
        <div style={adminStyles.loginCard}>
          <div style={adminStyles.loginLogo}>🛡</div>
          <h1 style={adminStyles.loginTitle}>Safe Zone Admin</h1>
          <p style={adminStyles.loginSub}>Sign in to moderate zones</p>
          <form onSubmit={handleLogin} style={adminStyles.form}>
            <div>
              <label style={adminStyles.label}>Username</label>
              <input
                style={adminStyles.input}
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label style={adminStyles.label}>Password</label>
              <input
                style={adminStyles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button style={adminStyles.primaryBtn} type="submit">
              Sign in
            </button>
          </form>
          {error ? <div style={adminStyles.errorBox}>{error}</div> : null}
        </div>
      </div>
    );
  }

  const uptime = health?.uptimeSeconds;
  const uptimeStr =
    uptime == null
      ? "—"
      : uptime < 60
        ? `${uptime}s`
        : uptime < 3600
          ? `${Math.floor(uptime / 60)}m`
          : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  const isLiveMode = health?.cacheMeta?.mode?.startsWith("live");

  return (
    <div style={adminStyles.page}>
      {/* Toast stack */}
      <div style={adminStyles.toastStack}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              ...adminStyles.toast,
              ...(t.type === "error" ? adminStyles.toastError : adminStyles.toastSuccess),
            }}
          >
            {t.type === "success" ? "✓" : "✕"} {t.message}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirm ? (
        <div
          style={adminStyles.modalOverlay}
          onClick={() => setConfirm(null)}
        >
          <div
            style={adminStyles.confirmBox}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={adminStyles.confirmMsg}>{confirm.message}</div>
            <div style={adminStyles.confirmActions}>
              <button
                style={adminStyles.ghostBtn}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                style={adminStyles.rejectBtn}
                onClick={() => {
                  confirm.onConfirm();
                  setConfirm(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Map modal */}
      {mapModal ? (
        <div
          style={adminStyles.modalOverlay}
          onClick={() => setMapModal(null)}
        >
          <div
            style={adminStyles.modalBox}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={adminStyles.modalHeader}>
              <div>
                <div style={adminStyles.modalTitle}>{mapModal.title}</div>
                <div style={adminStyles.modalSub}>
                  {mapModal.coordinates?.lat?.toFixed?.(5)},{" "}
                  {mapModal.coordinates?.lng?.toFixed?.(5)}
                </div>
              </div>
              <button
                style={adminStyles.modalClose}
                onClick={() => setMapModal(null)}
              >
                ✕
              </button>
            </div>
            {mapToken ? (
              <div ref={mapModalRef} style={adminStyles.modalMap} />
            ) : (
              <div style={adminStyles.modalNoMap}>
                No Mapbox token — see coordinates above
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Page header */}
      <div style={adminStyles.pageHeader}>
        <div>
          <h1 style={adminStyles.pageTitle}>Safe Zone Admin</h1>
          <p style={adminStyles.pageSub}>
            Zone moderation dashboard · auto-refreshes every 30s
          </p>
        </div>
        <div style={adminStyles.headerActions}>
          <button
            style={adminStyles.refreshBtn}
            onClick={() => handleRefresh()}
            disabled={loading}
          >
            {loading ? "..." : "↻ Refresh"}
          </button>
          <button
            style={adminStyles.ghostBtn}
            onClick={() => {
              localStorage.removeItem("safezone-admin-auth");
              setAuthHeader("");
              setPendingZones([]);
              setVerifiedZones([]);
              setHealth(null);
              setTotalIncidents(null);
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={adminStyles.statsRow}>
        <div style={adminStyles.statCard}>
          <div style={adminStyles.statValue}>{pendingZones.length}</div>
          <div style={adminStyles.statLabel}>Pending Review</div>
        </div>
        <div style={adminStyles.statCard}>
          <div style={adminStyles.statValue}>{verifiedZones.length}</div>
          <div style={adminStyles.statLabel}>Verified Zones</div>
        </div>
        <div style={adminStyles.statCard}>
          <div style={adminStyles.statValue}>
            {totalIncidents != null ? totalIncidents : "—"}
          </div>
          <div style={adminStyles.statLabel}>Total on Map</div>
        </div>
        <div
          style={{
            ...adminStyles.statCard,
            ...(isLiveMode ? adminStyles.statLive : adminStyles.statMock),
          }}
        >
          <div style={adminStyles.statValue}>
            {isLiveMode ? "Live" : health ? "Mock" : "—"}
          </div>
          <div style={adminStyles.statLabel}>API Mode</div>
        </div>
        <div style={adminStyles.statCard}>
          <div style={adminStyles.statValue}>{uptimeStr}</div>
          <div style={adminStyles.statLabel}>Uptime</div>
        </div>
      </div>

      {/* Health bar */}
      {health ? (
        <div style={adminStyles.healthBar}>
          <span style={adminStyles.healthItem}>
            <span
              style={{
                ...adminStyles.healthDot,
                background: health.mongodbConnected ? COLORS.low : COLORS.high,
              }}
            />
            MongoDB:{" "}
            {health.mongodbConnected ? "Connected" : "Offline (in-memory)"}
          </span>
          <span style={adminStyles.healthItem}>
            Source:{" "}
            <strong style={{ color: COLORS.text }}>
              {health.cacheMeta?.activeSource || "—"}
            </strong>
          </span>
          <span style={adminStyles.healthItem}>
            Updated:{" "}
            <strong style={{ color: COLORS.text }}>
              {health.cacheMeta?.lastUpdated
                ? formatRelativeTime(health.cacheMeta.lastUpdated)
                : "—"}
            </strong>
          </span>
          {health.cacheMeta?.lastError ? (
            <span style={{ ...adminStyles.healthItem, color: "#fca5a5" }}>
              Error: {health.cacheMeta.lastError}
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? <div style={adminStyles.errorBox}>{error}</div> : null}

      {/* Tabs */}
      <div style={adminStyles.tabs}>
        <button
          style={{
            ...adminStyles.tab,
            ...(activeTab === "pending" ? adminStyles.tabActive : {}),
          }}
          onClick={() => setActiveTab("pending")}
        >
          Pending
          {pendingZones.length > 0 ? (
            <span style={adminStyles.tabBadge}>{pendingZones.length}</span>
          ) : null}
        </button>
        <button
          style={{
            ...adminStyles.tab,
            ...(activeTab === "verified" ? adminStyles.tabActive : {}),
          }}
          onClick={() => setActiveTab("verified")}
        >
          Verified Zones
          {verifiedZones.length > 0 ? (
            <span style={adminStyles.tabBadge}>{verifiedZones.length}</span>
          ) : null}
        </button>
      </div>

      {loading ? (
        <div style={adminStyles.loadingMsg}>Loading zones...</div>
      ) : null}

      {/* Zone grid */}
      <div style={adminStyles.zoneGrid}>
        {activeTab === "pending" &&
          (pendingZones.length === 0 && !loading ? (
            <div style={adminStyles.emptyState}>
              <div style={adminStyles.emptyIcon}>✓</div>
              <div>No pending zones to review</div>
            </div>
          ) : (
            pendingZones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                mode="pending"
                onVerify={() =>
                  askConfirm(
                    `Verify "${zone.title}"? It will go live on the map.`,
                    () => verifyZone(zone.id),
                  )
                }
                onReject={() =>
                  askConfirm(
                    `Reject "${zone.title}"? It will be removed from the map.`,
                    () => rejectZone(zone.id),
                  )
                }
                onViewMap={() => setMapModal(zone)}
              />
            ))
          ))}
        {activeTab === "verified" &&
          (verifiedZones.length === 0 && !loading ? (
            <div style={adminStyles.emptyState}>
              <div style={adminStyles.emptyIcon}>○</div>
              <div>No verified user zones on record</div>
            </div>
          ) : (
            verifiedZones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                mode="verified"
                onDelete={() =>
                  askConfirm(
                    `Delete "${zone.title}"? It will be removed from the map.`,
                    () => deleteVerifiedZone(zone.id),
                  )
                }
                onViewMap={() => setMapModal(zone)}
              />
            ))
          ))}
      </div>
    </div>
  );
}

export default function AppWeb() {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  if (pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const hasFittedMapRef = useRef(false);

  const [incidents, setIncidents] = useState([]);
  const [apiStatus, setApiStatus] = useState("loading");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [placingMode, setPlacingMode] = useState(false);
  const [zoneError, setZoneError] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 980 : false,
  );

  const mapToken =
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
    process.env.REACT_APP_MAPBOX_TOKEN ||
    "";

  const isLive = apiStatus.startsWith("live-");

  const sortedIncidents = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 };
    return [...incidents].sort(
      (a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99),
    );
  }, [incidents]);

  const reasonOptions = selectedStatus
    ? MANUAL_ZONE_REASONS[selectedStatus]
    : [];

  const loadIncidents = useCallback(async () => {
    try {
      const payload = await fetchFromApi("/api/incidents");
      setApiStatus(payload?.cacheMeta?.mode || "loading");
      setIncidents(Array.isArray(payload?.incidents) ? payload.incidents : []);
    } catch {
      setApiStatus("loading");
    }
  }, []);

  const deleteZone = useCallback(async (zoneId) => {
    try {
      await fetchFromApi(`/api/zones/${zoneId}`, { method: "DELETE" });
      setIncidents((prev) => prev.filter((item) => item.id !== zoneId));
    } catch (e) {
      setZoneError(e?.message || "Kon zone niet verwijderen");
    }
  }, []);

  useEffect(() => {
    window.safeZoneDeleteZone = deleteZone;
    return () => {
      delete window.safeZoneDeleteZone;
    };
  }, [deleteZone]);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      html, body, #root { width: 100%; min-height: 100%; }
      body { margin: 0; background: ${COLORS.page}; }
      .mapboxgl-popup-content { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
      .mapboxgl-popup-tip { border-top-color: ${COLORS.feedCard} !important; }
      @keyframes sz-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes sz-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(styleEl);
    return () => {
      if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
    };
  }, []);

  useEffect(() => {
    loadIncidents();
    const timer = setInterval(loadIncidents, 30000);
    return () => clearInterval(timer);
  }, [loadIncidents]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsMobile(window.innerWidth <= 980);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!mapToken || !isLive || !mapContainerRef.current || mapRef.current)
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
  }, [mapToken, isLive]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (placingMode && selectedStatus && selectedReason) {
      // Set cursor on the Mapbox canvas directly (not the container div)
      map.getCanvas().style.cursor = "crosshair";
      console.log("[SafeZone] Placing mode ON — map click handler registered");

      const handleClick = async (event) => {
        const lngLat = event.lngLat;
        console.log("[SafeZone] Map clicked at", lngLat);

        if (!lngLat) {
          setZoneError("Kon locatie niet bepalen — probeer opnieuw");
          return;
        }

        try {
          await fetchFromApi("/api/zones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: selectedStatus,
              reason: selectedReason,
              coordinates: {
                lat: lngLat.lat,
                lng: lngLat.lng,
              },
              region: "Handmatig gemarkeerd",
            }),
          });
          console.log("[SafeZone] Zone created successfully");
          setPlacingMode(false);
          setSelectedStatus("");
          setSelectedReason("");
          setZoneError("");
          await loadIncidents();
        } catch (e) {
          console.error("[SafeZone] Zone creation failed", e);
          setZoneError(e?.message || "Kon zone niet aanmaken");
        }
      };

      map.on("click", handleClick);
      return () => {
        map.off("click", handleClick);
        map.getCanvas().style.cursor = "";
        console.log("[SafeZone] Placing mode OFF — handler removed");
      };
    }

    map.getCanvas().style.cursor = "";
    return undefined;
  }, [placingMode, selectedReason, selectedStatus, loadIncidents]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const applyLayers = () => {
      ensureRiskLayers(map);
      const centers = map.getSource("risk-centers");
      const polygons = map.getSource("risk-polygons");
      if (centers) centers.setData(buildCenters(incidents));
      if (polygons) polygons.setData(buildPolygons(incidents));
    };

    if (map.isStyleLoaded()) applyLayers();
    else map.once("load", applyLayers);

    incidents.forEach((incident) => {
      if (!incident?.coordinates?.lat || !incident?.coordinates?.lng) return;

      const deleteHtml = incident.userCreated
        ? `<button onclick="window.safeZoneDeleteZone && window.safeZoneDeleteZone('${incident.id}')" style="margin-top:8px;background:#ef4444;border:none;color:#fff;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;">Verwijder zone</button>`
        : "";

      const verifyHtml =
        incident.validationStatus === "unverified"
          ? `<div style="margin-top:6px;padding:4px 7px;border-radius:5px;background:rgba(148,163,184,0.2);color:#cbd5e1;font-size:11px;display:inline-block;">Wacht op verificatie</div>`
          : "";

      const popupHtml =
        `<div style="min-width:250px;background:${COLORS.feedCard};color:${COLORS.text};border:1px solid ${COLORS.border};padding:12px;border-radius:10px;font-family:Manrope,system-ui,sans-serif;">` +
        `<div style="font-size:14px;font-weight:700;line-height:1.4;">${incident.title}</div>` +
        `<div style="font-size:12px;color:${COLORS.textDim};margin-top:5px;">${incident.region} | ${incident.source}</div>` +
        `<div style="font-size:12px;color:${COLORS.textDim};margin-top:3px;">Confidence: ${incident.confidenceScore}/5 | ${incident.advice}</div>` +
        verifyHtml +
        deleteHtml +
        `</div>`;

      const marker = new mapboxgl.Marker({
        color: markerColor(incident),
        scale: 0.88,
      })
        .setLngLat([incident.coordinates.lng, incident.coordinates.lat])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(popupHtml))
        .addTo(map);

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
        map.fitBounds(bounds, { padding: 70, maxZoom: 6.2, duration: 850 });
      }

      hasFittedMapRef.current = true;
    }
  }, [incidents]);

  if (!mapToken) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.errorCard}>
          <h2 style={styles.errorTitle}>Mapbox token ontbreekt</h2>
          <p style={styles.errorText}>
            Zet EXPO_PUBLIC_MAPBOX_TOKEN in frontend/.env
          </p>
        </div>
      </div>
    );
  }

  if (!apiStatus.startsWith("live-")) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.loaderRing} />
        <h2 style={styles.loadingTitle}>Safe Zone laadt...</h2>
        <p style={styles.loadingText}>Wachten op live data van de bronnen</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Safe Zone</h1>
          <p style={styles.subtitle}>Live veiligheidsupdates op kaart</p>
        </div>
        <div style={styles.statusBadge}>API: {apiStatus}</div>
      </div>

      <div style={styles.zoneComposer}>
        <button
          style={{
            ...styles.zoneBtn,
            ...(selectedStatus === "high"
              ? styles.zoneBtnHighActive
              : styles.zoneBtnHigh),
          }}
          onClick={() => {
            setSelectedStatus("high");
            setSelectedReason("");
            setPlacingMode(false);
          }}
        >
          Gevaar
        </button>
        <button
          style={{
            ...styles.zoneBtn,
            ...(selectedStatus === "medium"
              ? styles.zoneBtnMediumActive
              : styles.zoneBtnMedium),
          }}
          onClick={() => {
            setSelectedStatus("medium");
            setSelectedReason("");
            setPlacingMode(false);
          }}
        >
          Let op
        </button>
        <button
          style={{
            ...styles.zoneBtn,
            ...(selectedStatus === "low"
              ? styles.zoneBtnLowActive
              : styles.zoneBtnLow),
          }}
          onClick={() => {
            setSelectedStatus("low");
            setSelectedReason("");
            setPlacingMode(false);
          }}
        >
          Veilig
        </button>

        <select
          value={selectedReason}
          onChange={(e) => setSelectedReason(e.target.value)}
          disabled={!selectedStatus}
          style={{
            ...styles.reasonSelect,
            minWidth: isMobile ? "100%" : styles.reasonSelect.minWidth,
          }}
        >
          <option value="">Kies reden...</option>
          {reasonOptions.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>

        <button
          style={styles.placeBtn}
          disabled={!selectedStatus || !selectedReason}
          onClick={() => setPlacingMode((prev) => !prev)}
        >
          {placingMode ? "Plaatsing annuleren" : "Plaats op kaart"}
        </button>
      </div>

      {placingMode ? (
        <div style={styles.hintBar}>
          Klik op de kaart om zone te plaatsen:{" "}
          <strong>{selectedReason}</strong>
        </div>
      ) : null}

      {zoneError ? <div style={styles.errorInline}>{zoneError}</div> : null}

      <div
        style={{
          ...styles.layout,
          gridTemplateColumns: isMobile
            ? "1fr"
            : styles.layout.gridTemplateColumns,
        }}
      >
        <div
          style={{
            ...styles.mapCard,
            minHeight: isMobile ? "44vh" : styles.mapCard.minHeight,
          }}
        >
          <div
            ref={mapContainerRef}
            style={{
              ...styles.mapContainer,
              height: isMobile ? "44vh" : styles.mapContainer.height,
            }}
          />
        </div>

        <div
          style={{
            ...styles.feedCard,
            minHeight: isMobile ? "42vh" : styles.feedCard.minHeight,
            maxHeight: isMobile ? "52vh" : styles.feedCard.maxHeight,
          }}
        >
          <div style={styles.feedHeader}>
            Incident Feed ({sortedIncidents.length})
          </div>
          <div style={styles.feedList}>
            {sortedIncidents.map((incident) => (
              <div
                key={incident.id}
                style={{
                  ...styles.feedItem,
                  borderLeftColor:
                    incident.validationStatus === "unverified"
                      ? COLORS.unverified
                      : incident.status === "high"
                        ? COLORS.high
                        : incident.status === "medium"
                          ? COLORS.medium
                          : COLORS.low,
                  ...(incident.validationStatus === "unverified"
                    ? styles.feedItemUnverified
                    : null),
                }}
              >
                <div style={styles.feedItemTitle}>{incident.title}</div>
                <div style={styles.feedMeta}>
                  {incident.region} | {incident.source} |{" "}
                  {formatRelativeTime(incident.time)}
                </div>
                <div style={styles.feedMeta}>
                  {incident.validationStatus === "unverified"
                    ? "Wacht op verificatie"
                    : `Advice: ${incident.advice}`}
                </div>
                {incident.userCreated ? (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => deleteZone(incident.id)}
                  >
                    Verwijder zone
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div style={styles.feedLegend}>
            <span style={styles.legendTitle}>Legenda:</span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: COLORS.high }} />{" "}
              Onveilig
            </span>
            <span style={styles.legendItem}>
              <span
                style={{ ...styles.legendDot, background: COLORS.medium }}
              />{" "}
              Gemiddeld
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: COLORS.low }} />{" "}
              Veilig
            </span>
            <span style={styles.legendItem}>
              <span
                style={{ ...styles.legendDot, background: COLORS.unverified }}
              />{" "}
              Wacht op verificatie
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background:
      "radial-gradient(900px 420px at 15% -15%, rgba(29,78,216,0.18), transparent 70%), radial-gradient(900px 500px at 100% 0%, rgba(127,29,29,0.25), transparent 60%), #060a14",
    color: COLORS.text,
    padding: "20px 22px",
    boxSizing: "border-box",
    fontFamily: "'Manrope', system-ui, sans-serif",
  },
  centerPage: {
    minHeight: "100vh",
    width: "100%",
    background: COLORS.page,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.text,
    fontFamily: "'Manrope', system-ui, sans-serif",
  },
  loaderRing: {
    width: 66,
    height: 66,
    borderRadius: "50%",
    border: "3px solid rgba(59,130,246,0.3)",
    borderTopColor: COLORS.high,
    animation: "sz-spin 0.9s linear infinite",
  },
  loadingTitle: { marginTop: 18, marginBottom: 6, fontSize: 24 },
  loadingText: { margin: 0, color: COLORS.textDim },
  errorCard: {
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: "20px 22px",
    textAlign: "center",
  },
  errorTitle: { margin: 0, fontSize: 20 },
  errorText: { marginTop: 8, color: COLORS.textDim },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  title: { margin: 0, fontSize: 34, lineHeight: 1 },
  subtitle: { margin: "6px 0 0", color: COLORS.textDim, fontSize: 13 },
  statusBadge: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.feedCard,
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    color: COLORS.textDim,
    whiteSpace: "nowrap",
  },
  zoneComposer: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  zoneBtn: {
    border: "1px solid transparent",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
  },
  zoneBtnHigh: {
    background: "rgba(239,68,68,0.3)",
    borderColor: "rgba(239,68,68,0.5)",
  },
  zoneBtnMedium: {
    background: "rgba(245,158,11,0.25)",
    borderColor: "rgba(245,158,11,0.45)",
  },
  zoneBtnLow: {
    background: "rgba(34,197,94,0.22)",
    borderColor: "rgba(34,197,94,0.45)",
  },
  zoneBtnHighActive: { background: COLORS.high, borderColor: COLORS.high },
  zoneBtnMediumActive: {
    background: COLORS.medium,
    borderColor: COLORS.medium,
  },
  zoneBtnLowActive: { background: COLORS.low, borderColor: COLORS.low },
  reasonSelect: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.feedCard,
    color: COLORS.text,
    borderRadius: 8,
    padding: "8px 10px",
    minWidth: 250,
  },
  placeBtn: {
    border: "none",
    background: "linear-gradient(180deg,#3b82f6,#2563eb)",
    color: "white",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  hintBar: {
    background: "rgba(59,130,246,0.14)",
    border: "1px solid rgba(59,130,246,0.3)",
    color: "#bfdbfe",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
    marginBottom: 10,
  },
  errorInline: {
    marginBottom: 10,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(127,29,29,0.35)",
    color: "#fecaca",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
  },
  layout: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 },
  mapCard: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    overflow: "hidden",
    background: COLORS.mapCard,
    minHeight: "72vh",
    boxShadow: "0 12px 36px rgba(2,6,20,0.4)",
  },
  mapContainer: { width: "100%", height: "72vh" },
  feedCard: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    background: COLORS.feedCard,
    minHeight: "72vh",
    maxHeight: "72vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 12px 36px rgba(2,6,20,0.38)",
  },
  feedHeader: {
    padding: "12px 14px",
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 14,
    fontWeight: 700,
  },
  feedList: {
    flex: 1,
    overflowY: "auto",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  feedItem: {
    background: "rgba(15,23,42,0.82)",
    border: `1px solid ${COLORS.border}`,
    borderLeft: "3px solid",
    borderRadius: 8,
    padding: "10px 10px 9px",
  },
  feedItemUnverified: {
    background: "rgba(51,65,85,0.23)",
    borderStyle: "dashed",
  },
  feedItemTitle: { fontSize: 13, fontWeight: 700, marginBottom: 5 },
  feedMeta: { color: COLORS.textDim, fontSize: 11, marginTop: 3 },
  deleteBtn: {
    marginTop: 7,
    border: "none",
    background: COLORS.high,
    color: "white",
    borderRadius: 6,
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  feedLegend: {
    borderTop: `1px solid ${COLORS.border}`,
    background: "#0b1220",
    padding: "10px 12px",
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  legendTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  legendItem: {
    color: COLORS.textDim,
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
};

const adminStyles = {
  // Login
  loginPage: {
    minHeight: "100vh",
    width: "100%",
    background:
      "radial-gradient(900px 420px at 15% -15%, rgba(29,78,216,0.12), transparent 70%), #060a14",
    color: COLORS.text,
    fontFamily: "'Manrope', system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box",
  },
  loginCard: {
    width: "100%",
    maxWidth: 420,
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: "36px 28px",
    textAlign: "center",
  },
  loginLogo: { fontSize: 44, marginBottom: 14 },
  loginTitle: { margin: "0 0 6px", fontSize: 26, fontWeight: 700 },
  loginSub: { margin: "0 0 24px", color: COLORS.textDim, fontSize: 13 },
  label: {
    display: "block",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.textDim,
    marginBottom: 5,
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  input: {
    width: "100%",
    border: `1px solid ${COLORS.border}`,
    background: COLORS.mapCard,
    color: COLORS.text,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
  },
  primaryBtn: {
    border: "none",
    background: "linear-gradient(180deg,#3b82f6,#1d4ed8)",
    color: "white",
    borderRadius: 8,
    padding: "11px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  // Dashboard page
  page: {
    minHeight: "100vh",
    width: "100%",
    background:
      "radial-gradient(900px 420px at 15% -15%, rgba(29,78,216,0.12), transparent 70%), #060a14",
    color: COLORS.text,
    fontFamily: "'Manrope', system-ui, sans-serif",
    padding: "24px 28px",
    boxSizing: "border-box",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  pageTitle: { margin: 0, fontSize: 28, fontWeight: 700 },
  pageSub: { margin: "4px 0 0", color: COLORS.textDim, fontSize: 13 },
  headerActions: { display: "flex", gap: 8, alignItems: "center" },
  refreshBtn: {
    border: "1px solid rgba(59,130,246,0.4)",
    background: "rgba(59,130,246,0.12)",
    color: "#93c5fd",
    borderRadius: 8,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  ghostBtn: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.mapCard,
    color: COLORS.textDim,
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 13,
  },
  // Toasts
  toastStack: {
    position: "fixed",
    bottom: 20,
    right: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 10000,
    pointerEvents: "none",
  },
  toast: {
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    animation: "sz-fadein 0.2s ease",
  },
  toastSuccess: {
    background: "rgba(21,128,61,0.95)",
    border: "1px solid rgba(34,197,94,0.5)",
    color: "#dcfce7",
  },
  toastError: {
    background: "rgba(153,27,27,0.95)",
    border: "1px solid rgba(239,68,68,0.5)",
    color: "#fee2e2",
  },
  // Confirm dialog
  confirmBox: {
    width: "100%",
    maxWidth: 400,
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: "24px 20px",
  },
  confirmMsg: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.5,
    marginBottom: 20,
    color: COLORS.text,
  },
  confirmActions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
  },
  // Stats row
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: "14px 16px",
  },
  statValue: { fontSize: 28, fontWeight: 700, lineHeight: 1 },
  statLabel: { color: COLORS.textDim, fontSize: 12, marginTop: 5 },
  statLive: {
    borderColor: "rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.07)",
  },
  statMock: {
    borderColor: "rgba(245,158,11,0.35)",
    background: "rgba(245,158,11,0.07)",
  },
  // Health bar
  healthBar: {
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 14,
    fontSize: 12,
    color: COLORS.textDim,
  },
  healthItem: { display: "flex", alignItems: "center", gap: 6 },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-block",
  },
  // Errors / loading
  errorBox: {
    marginBottom: 12,
    border: "1px solid rgba(239,68,68,0.4)",
    background: "rgba(127,29,29,0.3)",
    color: "#fecaca",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
  },
  loadingMsg: { color: COLORS.textDim, fontSize: 13, marginBottom: 12 },
  // Tabs
  tabs: {
    display: "flex",
    gap: 2,
    borderBottom: `1px solid ${COLORS.border}`,
    marginBottom: 16,
  },
  tab: {
    border: "none",
    background: "transparent",
    color: COLORS.textDim,
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    borderBottom: "2px solid transparent",
    marginBottom: -1,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  },
  tabActive: {
    color: COLORS.text,
    borderBottomColor: "#3b82f6",
  },
  tabBadge: {
    background: "#3b82f6",
    color: "white",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 6px",
  },
  // Zone grid
  zoneGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 12,
  },
  emptyState: {
    gridColumn: "1 / -1",
    border: `1px dashed ${COLORS.border}`,
    borderRadius: 12,
    padding: "36px 20px",
    textAlign: "center",
    color: COLORS.textDim,
    fontSize: 14,
  },
  emptyIcon: { fontSize: 30, marginBottom: 10 },
  // Confidence bar
  confRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  confLabel: {
    fontSize: 11,
    color: COLORS.textDim,
    minWidth: 60,
  },
  confTrack: {
    display: "flex",
    gap: 3,
  },
  confDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  // Zone card
  zoneCard: {
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  zoneCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  zoneTime: { color: COLORS.textDim, fontSize: 11 },
  zoneTitle: { fontSize: 14, fontWeight: 700, lineHeight: 1.4 },
  zoneMeta: {
    color: COLORS.textDim,
    fontSize: 12,
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  zoneCoords: {
    color: COLORS.textDim,
    fontSize: 11,
    fontFamily: "monospace",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  viewMapBtn: {
    border: "none",
    background: "rgba(59,130,246,0.15)",
    color: "#93c5fd",
    borderRadius: 5,
    padding: "3px 9px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  zoneActions: { display: "flex", gap: 8, marginTop: 2 },
  acceptBtn: {
    flex: 1,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.12)",
    color: COLORS.low,
    borderRadius: 7,
    padding: "8px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  rejectBtn: {
    flex: 1,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.12)",
    color: COLORS.high,
    borderRadius: 7,
    padding: "8px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  deleteBtn: {
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.1)",
    color: COLORS.high,
    borderRadius: 7,
    padding: "8px 14px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  // Map modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalBox: {
    width: "100%",
    maxWidth: 580,
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    padding: "14px 16px",
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  modalTitle: { fontSize: 15, fontWeight: 700, lineHeight: 1.4 },
  modalSub: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 3,
    fontFamily: "monospace",
  },
  modalClose: {
    border: "none",
    background: "rgba(255,255,255,0.06)",
    color: COLORS.text,
    borderRadius: 6,
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 14,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalMap: { width: "100%", height: 320 },
  modalNoMap: {
    height: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.textDim,
    fontSize: 13,
  },
};
