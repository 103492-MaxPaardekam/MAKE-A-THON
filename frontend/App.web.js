import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const PALETTE = {
  ink: "#1e2230",
  sidebar: "#f7f8fb",
  panel: "#ffffff",
  alert: "#ff2a23",
  amber: "#ff9f0a",
  info: "#182339",
  border: "#d9dde7",
};

const API_BASE_URLS = (() => {
  const browserHost =
    typeof window !== "undefined" && window.location?.hostname
      ? window.location.hostname
      : "";

  const candidates = [
    browserHost ? `http://${browserHost}:3001` : "",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
    process.env.EXPO_PUBLIC_API_BASE_URL,
    process.env.REACT_APP_API_BASE_URL,
  ].filter(Boolean);

  return [...new Set(candidates)];
})();

const FONT_DISPLAY =
  "'Baskerville Old Face', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
const FONT_UI = "'Arial Narrow', Arial, Helvetica, sans-serif";
const NAV_ITEMS = [""];

function formatFeedTime(iso) {
  const stamp = Date.parse(iso || "");
  if (Number.isNaN(stamp)) return "14:22:05";
  return new Date(stamp).toLocaleTimeString("en-GB", { hour12: false });
}

function deriveTag(signal) {
  if (signal?.status === "high") return { label: "URGENT", color: PALETTE.alert };
  if (signal?.status === "medium") return { label: "ALERT", color: PALETTE.amber };
  return { label: "INFO", color: PALETTE.info };
}

function markerColor(status) {
  if (status === "high") return PALETTE.alert;
  if (status === "medium") return PALETTE.amber;
  return "#00d48a";
}

function getIncidentsWithCoords(incidents) {
  return incidents.filter(
    (item) =>
      Number.isFinite(item?.coordinates?.lat) &&
      Number.isFinite(item?.coordinates?.lng),
  );
}

function getHudText(incidents) {
  const target = getIncidentsWithCoords(incidents)[0];
  if (!target) return "LAT: 52.3676° N  LON: 4.9041° E  ALT: 2M";
  const lat = Math.abs(target.coordinates.lat).toFixed(4);
  const lng = Math.abs(target.coordinates.lng).toFixed(4);
  return `LAT: ${lat}° ${target.coordinates.lat >= 0 ? "N" : "S"}  LON: ${lng}° ${target.coordinates.lng >= 0 ? "E" : "W"}  ALT: 2M`;
}

async function fetchFromApi(path, options = {}) {
  let lastError = null;
  for (const base of API_BASE_URLS) {
    try {
      const response = await fetch(`${base}${path}`, options);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `API ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("API unavailable");
}

function buildBasicAuth(username, password) {
  if (!username || !password) return "";
  return `Basic ${btoa(`${username}:${password}`)}`;
}

const ADMIN_REASONS = {
  high: ["Luchtaanval", "Beschietingen", "Explosies", "Mijnenveld"],
  medium: ["Troepenbeweging", "Wegblokkade", "Beperkte toegang", "Onbekende dreiging"],
  low: ["Schuilplaats beschikbaar", "Hulppost", "Vrij doorgaan", "Rustig gebied"],
};

function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [zones, setZones] = useState([]);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [createForm, setCreateForm] = useState({ status: "medium", reason: "", lat: "", lng: "", region: "" });
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadData = useCallback(async (header = authHeader) => {
    if (!header) return;
    setLoading(true);
    setError("");
    try {
      const [zonesPayload, incidentsPayload, healthPayload] = await Promise.all([
        fetchFromApi("/api/zones/unverified", { headers: { Authorization: header } }),
        fetchFromApi("/api/incidents"),
        fetchFromApi("/api/health"),
      ]);
      const pending = zonesPayload?.zones || [];
      setZones(pending);
      const incidents = incidentsPayload?.incidents || [];
      setStats({
        total: incidents.length,
        high: incidents.filter((i) => i.status === "high").length,
        medium: incidents.filter((i) => i.status === "medium").length,
        low: incidents.filter((i) => i.status === "low").length,
        pending: pending.length,
      });
      setHealth(healthPayload);
    } catch (e) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    const stored = localStorage.getItem("safezone-admin-auth") || "";
    if (stored) {
      setAuthHeader(stored);
      loadData(stored);
    }
  }, [loadData]);

  useEffect(() => {
    if (!authHeader) return undefined;
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [authHeader, loadData]);

  async function handleLogin(event) {
    event.preventDefault();
    const header = buildBasicAuth(username, password);
    localStorage.setItem("safezone-admin-auth", header);
    setAuthHeader(header);
    await loadData(header);
  }

  function handleLogout() {
    localStorage.removeItem("safezone-admin-auth");
    setAuthHeader("");
    setZones([]);
    setStats(null);
    setHealth(null);
  }

  async function verifyZone(zoneId) {
    try {
      await fetchFromApi(`/api/zones/${zoneId}/verify`, {
        method: "PATCH",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      });
      await loadData();
    } catch (e) {
      setError(e?.message || "Failed to verify zone");
    }
  }

  async function rejectZone(zoneId) {
    try {
      await fetchFromApi(`/api/zones/${zoneId}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });
      await loadData();
    } catch (e) {
      setError(e?.message || "Failed to reject zone");
    }
  }

  async function saveZoneEdit(zoneId) {
    try {
      await fetchFromApi(`/api/zones/${zoneId}`, {
        method: "PATCH",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingZone.title, status: editingZone.status, reason: editingZone.reason }),
      });
      setEditingZone(null);
      await loadData();
    } catch (e) {
      setError(e?.message || "Failed to save edits");
    }
  }

  async function handleCreateZone(event) {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    const lat = parseFloat(createForm.lat);
    const lng = parseFloat(createForm.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setCreateError("Invalid coordinates");
      return;
    }
    try {
      await fetchFromApi("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: createForm.status, reason: createForm.reason, coordinates: { lat, lng }, region: createForm.region || "Custom zone" }),
      });
      setCreateSuccess("Zone created successfully");
      setCreateForm({ status: "medium", reason: "", lat: "", lng: "", region: "" });
      await loadData();
    } catch (e) {
      setCreateError(e?.message || "Failed to create zone");
    }
  }

  if (!authHeader) {
    return (
      <div style={{ ...adminStyles.page, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: isNarrow ? "40px 16px" : 0 }}>
        <div style={{ ...adminStyles.loginCard, margin: isNarrow ? 0 : "15vh auto 0", width: isNarrow ? "100%" : undefined, maxWidth: isNarrow ? "100%" : 380 }}>
          <div style={adminStyles.brandTitle}>CRISIS SIGNAL</div>
          <div style={adminStyles.brandSub}>ADMIN CONTROL</div>
          <form onSubmit={handleLogin} style={adminStyles.loginForm}>
            <input style={adminStyles.fieldInput} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input style={adminStyles.fieldInput} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button style={adminStyles.primaryBtn} type="submit">SIGN IN</button>
          </form>
          {error ? <div style={adminStyles.errorMsg}>{error}</div> : null}
        </div>
      </div>
    );
  }

  const NAV = [
    { id: "dashboard", label: "DASHBOARD" },
    { id: "queue", label: "ZONE QUEUE" },
    { id: "create", label: "CREATE ZONE" },
  ];

  function renderDashboard() {
    return (
      <div style={adminStyles.content}>
        <div style={adminStyles.sectionTitle}>DASHBOARD</div>
        {health ? (
          <div style={adminStyles.healthBar}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: health.ok ? "#23b26d" : PALETTE.alert, flexShrink: 0 }} />
            <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "#95a2b8", fontWeight: 700 }}>
              API {health.ok ? "ONLINE" : "OFFLINE"}&nbsp;·&nbsp;
              MongoDB {health.mongodbConnected ? "CONNECTED" : "DISCONNECTED"}&nbsp;·&nbsp;
              Uptime {Math.floor((health.uptimeSeconds || 0) / 60)}m
            </span>
          </div>
        ) : null}
        {stats ? (
          <div style={adminStyles.statGrid}>
            {[
              { value: stats.total, label: "TOTAL INCIDENTS", accent: "#7c8fad" },
              { value: stats.high, label: "HIGH DANGER", accent: PALETTE.alert },
              { value: stats.medium, label: "MEDIUM ALERT", accent: PALETTE.amber },
              { value: stats.low, label: "LOW / SAFE", accent: "#00d48a" },
              { value: stats.pending, label: "PENDING REVIEW", accent: "#7c8fad" },
            ].map((s) => (
              <div key={s.label} style={{ ...adminStyles.statCard, borderLeft: `3px solid ${s.accent}` }}>
                <div style={adminStyles.statValue}>{s.value}</div>
                <div style={adminStyles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#95a2b8", fontSize: 12 }}>Loading stats...</div>
        )}
      </div>
    );
  }

  function renderQueue() {
    return (
      <div style={adminStyles.content}>
        <div style={adminStyles.sectionTitle}>ZONE VERIFICATION QUEUE</div>
        {loading ? <div style={{ color: "#95a2b8", fontSize: 12, marginBottom: 12 }}>Loading...</div> : null}
        {error ? <div style={adminStyles.errorMsg}>{error}</div> : null}
        {zones.length === 0 ? (
          <div style={adminStyles.emptyState}>No pending zones to verify</div>
        ) : zones.map((zone) => {
          const isEditing = editingZone?.id === zone.id;
          const statusColor = zone.status === "high" ? PALETTE.alert : zone.status === "medium" ? PALETTE.amber : "#00d48a";
          return (
            <div key={zone.id} style={adminStyles.zoneCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ ...adminStyles.statusBadge, background: isEditing ? (editingZone.status === "high" ? PALETTE.alert : editingZone.status === "medium" ? PALETTE.amber : "#00d48a") : statusColor }}>
                  {(isEditing ? editingZone.status : zone.status).toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: "#95a2b8", letterSpacing: "0.08em", fontWeight: 700 }}>{formatFeedTime(zone.time)}</span>
              </div>
              {isEditing ? (
                <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                  <input style={adminStyles.fieldInput} value={editingZone.title} onChange={(e) => setEditingZone({ ...editingZone, title: e.target.value })} placeholder="Title" />
                  <select style={adminStyles.fieldInput} value={editingZone.status} onChange={(e) => setEditingZone({ ...editingZone, status: e.target.value, reason: ADMIN_REASONS[e.target.value]?.[0] || "" })}>
                    <option value="high">HIGH</option>
                    <option value="medium">MEDIUM</option>
                    <option value="low">LOW</option>
                  </select>
                  <select style={adminStyles.fieldInput} value={editingZone.reason} onChange={(e) => setEditingZone({ ...editingZone, reason: e.target.value })}>
                    {(ADMIN_REASONS[editingZone.status] || []).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: "#edf1f7" }}>{zone.title}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#95a2b8" }}>{zone.region} · {zone.coordinates?.lat?.toFixed?.(4)}, {zone.coordinates?.lng?.toFixed?.(4)}</div>
                  {zone.reason ? <div style={{ marginTop: 4, fontSize: 11, color: "#7c8fad", letterSpacing: "0.08em" }}>{zone.reason}</div> : null}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {isEditing ? (
                  <>
                    <button style={adminStyles.saveBtn} onClick={() => saveZoneEdit(zone.id)}>SAVE</button>
                    <button style={adminStyles.ghostBtn} onClick={() => setEditingZone(null)}>CANCEL</button>
                  </>
                ) : (
                  <button style={adminStyles.ghostBtn} onClick={() => setEditingZone({ id: zone.id, title: zone.title, status: zone.status, reason: zone.reason || "" })}>EDIT</button>
                )}
                <button style={adminStyles.verifyBtn} onClick={() => verifyZone(zone.id)}>VERIFY</button>
                <button style={adminStyles.rejectBtn} onClick={() => rejectZone(zone.id)}>REJECT</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderCreate() {
    return (
      <div style={adminStyles.content}>
        <div style={adminStyles.sectionTitle}>CREATE ZONE</div>
        <form onSubmit={handleCreateZone} style={{ display: "grid", gap: 16, maxWidth: 500 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={adminStyles.fieldLabel}>STATUS</label>
            <select style={adminStyles.fieldInput} value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value, reason: ADMIN_REASONS[e.target.value]?.[0] || "" })}>
              <option value="high">HIGH — DANGER</option>
              <option value="medium">MEDIUM — ALERT</option>
              <option value="low">LOW — SAFE</option>
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={adminStyles.fieldLabel}>REASON</label>
            <select style={adminStyles.fieldInput} value={createForm.reason} onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })} required>
              <option value="">Select reason...</option>
              {(ADMIN_REASONS[createForm.status] || []).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={adminStyles.fieldLabel}>REGION NAME</label>
            <input style={adminStyles.fieldInput} value={createForm.region} onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })} placeholder="e.g. Kyiv oblast" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={adminStyles.fieldLabel}>LATITUDE</label>
              <input style={adminStyles.fieldInput} value={createForm.lat} onChange={(e) => setCreateForm({ ...createForm, lat: e.target.value })} placeholder="e.g. 50.4501" required />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={adminStyles.fieldLabel}>LONGITUDE</label>
              <input style={adminStyles.fieldInput} value={createForm.lng} onChange={(e) => setCreateForm({ ...createForm, lng: e.target.value })} placeholder="e.g. 30.5234" required />
            </div>
          </div>
          {createError ? <div style={adminStyles.errorMsg}>{createError}</div> : null}
          {createSuccess ? <div style={{ color: "#23b26d", fontSize: 12 }}>{createSuccess}</div> : null}
          <button style={adminStyles.primaryBtn} type="submit">CREATE ZONE</button>
        </form>
      </div>
    );
  }

  const sectionContent = (
    <div style={{ ...adminStyles.main, padding: isNarrow ? "20px 16px" : "28px 32px" }}>
      {activeSection === "dashboard" && renderDashboard()}
      {activeSection === "queue" && renderQueue()}
      {activeSection === "create" && renderCreate()}
    </div>
  );

  if (isNarrow) {
    return (
      <div style={{ ...adminStyles.page, display: "grid", gridTemplateRows: "auto 1fr", height: "100vh", overflow: "hidden" }}>
        <div style={adminStyles.topBar}>
          <div style={adminStyles.topBarHead}>
            <div style={adminStyles.brandTitle}>CRISIS SIGNAL</div>
            <button style={{ ...adminStyles.ghostBtn, width: "auto", padding: "0 14px" }} onClick={handleLogout}>LOGOUT</button>
          </div>
          <div style={adminStyles.topBarNav}>
            {NAV.map((item) => (
              <div key={item.id} style={{ ...adminStyles.topNavItem, ...(activeSection === item.id ? adminStyles.topNavItemActive : {}) }} onClick={() => setActiveSection(item.id)}>
                {item.label}
                {item.id === "queue" && stats?.pending > 0 ? (
                  <span style={{ marginLeft: 6, background: PALETTE.alert, color: "#fff", borderRadius: 10, fontSize: 9, padding: "1px 6px", fontWeight: 700 }}>{stats.pending}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {sectionContent}
      </div>
    );
  }

  return (
    <div style={adminStyles.page}>
      <div style={adminStyles.shell}>
        <div style={adminStyles.sidebar}>
          <div style={adminStyles.sidebarTop}>
            <div style={adminStyles.brandTitle}>CRISIS SIGNAL</div>
            <div style={adminStyles.brandSub}>ADMIN CONTROL</div>
          </div>
          <nav style={{ padding: "8px 0" }}>
            {NAV.map((item) => (
              <div key={item.id} style={{ ...adminStyles.navItem, ...(activeSection === item.id ? adminStyles.navItemActive : {}) }} onClick={() => setActiveSection(item.id)}>
                <span style={{ fontSize: 9, width: 10 }}>{activeSection === item.id ? "◼" : "◈"}</span>
                {item.label}
                {item.id === "queue" && stats?.pending > 0 ? (
                  <span style={{ marginLeft: "auto", background: PALETTE.alert, color: "#fff", borderRadius: 10, fontSize: 9, padding: "1px 7px", fontWeight: 700 }}>{stats.pending}</span>
                ) : null}
              </div>
            ))}
          </nav>
          <div style={adminStyles.sidebarFooter}>
            <button style={adminStyles.ghostBtn} onClick={handleLogout}>LOGOUT</button>
          </div>
        </div>
        {sectionContent}
      </div>
    </div>
  );
}

export default function AppWeb() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  if (pathname.startsWith("/admin")) return <AdminPage />;

  const [incidents, setIncidents] = useState([]);
  const [statusLine, setStatusLine] = useState("LIVE VERIFICATION STREAM");
  const [refreshTick, setRefreshTick] = useState(30);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" ? window.innerWidth < 1220 : false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [is3DView, setIs3DView] = useState(true);
  const [familyMessageVisible, setFamilyMessageVisible] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const hasAutoFittedRef = useRef(false);
  const userMovedMapRef = useRef(false);
  const mapToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || process.env.REACT_APP_MAPBOX_TOKEN || "";

  const [isPlacingMarker, setIsPlacingMarker] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);
  const [placeStatus, setPlaceStatus] = useState("low");
  const [placeReason, setPlaceReason] = useState(ADMIN_REASONS.low[0]);
  const [placeSubmitting, setPlaceSubmitting] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const isPlacingMarkerRef = useRef(false);

  useEffect(() => {
    isPlacingMarkerRef.current = isPlacingMarker;
  }, [isPlacingMarker]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isPlacingMarker ? "crosshair" : "";
  }, [isPlacingMarker]);

  async function submitMarker() {
    setPlaceSubmitting(true);
    setPlaceError("");
    try {
      await fetchFromApi("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: placeStatus, reason: placeReason, coordinates: pendingCoords, region: "Custom zone" }),
      });
      setPendingCoords(null);
      setIsPlacingMarker(false);
      isPlacingMarkerRef.current = false;
      await loadIncidents();
    } catch (e) {
      setPlaceError(e.message || "Failed to submit marker");
    } finally {
      setPlaceSubmitting(false);
    }
  }

  const theme = useMemo(
    () =>
      isDarkMode
        ? {
          pageBg: "linear-gradient(180deg, #0a0f18 0%, #111827 100%)",
          shellBg: "#0f1724",
          topbarBg: "#111826",
          topbarBorder: "#243042",
          topbarText: "#edf1f7",
          navText: "#8e99ad",
          sidebarBg: "#0d1522",
          sidebarBorder: "#223044",
          panelBg: "#101926",
          panelText: "#f2f5f9",
          cardBg: "#121d2c",
          softText: "#95a2b8",
          feedItemBorder: "#1d2938",
          tickerBg: "#070a11",
          tickerText: "#f5f6f8",
          mapControlBg: "rgba(10, 16, 27, 0.84)",
          mapControlBorder: "rgba(255,255,255,0.18)",
          frameOverlay:
            "linear-gradient(180deg, rgba(6,10,18,0.02), rgba(6,10,18,0.18)), radial-gradient(circle at 50% 48%, rgba(122,241,232,0.08), transparent 40%)",
        }
        : {
          pageBg: "linear-gradient(180deg, #d7dbe3 0%, #cfd5de 100%)",
          shellBg: "#e6e9ef",
          topbarBg: "#fbfbfc",
          topbarBorder: "#d9dde7",
          topbarText: "#2a3143",
          navText: "#8d94a7",
          sidebarBg: "#f7f8fb",
          sidebarBorder: "#d9dde7",
          panelBg: "#ffffff",
          panelText: "#1f2638",
          cardBg: "#e7ebf3",
          softText: "#6e7486",
          feedItemBorder: "#eef1f6",
          tickerBg: "#06080e",
          tickerText: "#f5f6f8",
          mapControlBg: "rgba(10, 16, 27, 0.84)",
          mapControlBorder: "rgba(255,255,255,0.18)",
          frameOverlay:
            "linear-gradient(180deg, rgba(6,10,18,0.02), rgba(6,10,18,0.18)), radial-gradient(circle at 50% 48%, rgba(122,241,232,0.08), transparent 40%)",
        },
    [isDarkMode],
  );

  const loadIncidents = useCallback(async () => {
    setIsLoadingIncidents(true);
    try {
      const payload = await fetchFromApi("/api/incidents");
      const nextIncidents = Array.isArray(payload?.incidents) ? payload.incidents : [];
      setIncidents(nextIncidents);
      setStatusLine(
        payload?.cacheMeta?.mode === "live-multi-source"
          ? "LIVE VERIFICATION STREAM"
          : payload?.cacheMeta?.mode
            ? String(payload.cacheMeta.mode).replaceAll("-", " ").toUpperCase()
            : "LIVE API STREAM",
      );
      setRefreshTick(30);
    } catch {
      setIncidents([]);
      setStatusLine("API OFFLINE");
      setRefreshTick(30);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, []);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      html, body, #root { min-height: 100%; width: 100%; }
      body { margin: 0; background: ${isDarkMode ? "#0a0f18" : "#dfe3ea"}; color: ${theme.panelText}; font-family: ${FONT_UI}; }
      * { box-sizing: border-box; }
      .mapboxgl-popup-content { padding: 8px 10px !important; border-radius: 10px !important; box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18) !important; }
      .mapboxgl-popup-tip { border-top-color: white !important; }
      .mapboxgl-ctrl-group { border-radius: 0 !important; overflow: hidden; box-shadow: none !important; border: 1px solid rgba(255,255,255,0.08); }
      .mapboxgl-ctrl button { background: rgba(18, 25, 39, 0.88) !important; }
      .mapboxgl-ctrl button .mapboxgl-ctrl-icon { filter: invert(1); opacity: 0.9; }
      @keyframes tickerMove { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    `;
    document.head.appendChild(styleEl);
    return () => {
      if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
    };
  }, [isDarkMode, theme.panelText]);

  useEffect(() => {
    loadIncidents();
    const timer = setInterval(loadIncidents, 30000);
    return () => clearInterval(timer);
  }, [loadIncidents]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTick((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setIsNarrow(window.innerWidth < 1220);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const feedItems = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => Date.parse(b.time || "") - Date.parse(a.time || ""))
        .slice(0, 4),
    [incidents],
  );
  const incidentsWithCoords = useMemo(() => getIncidentsWithCoords(incidents), [incidents]);
  const highlightSignal = feedItems[0] || null;
  const hudText = useMemo(() => getHudText(feedItems), [feedItems]);
  const statusWord =
    !highlightSignal
      ? "NO LIVE API DATA"
      : highlightSignal?.status === "high"
        ? "ELEVATED - AMBER"
        : highlightSignal?.status === "medium"
          ? "WATCH - AMBER"
          : "STABLE - INFO";

  useEffect(() => {
    if (!familyMessageVisible) return undefined;
    const timeout = setTimeout(() => {
      setFamilyMessageVisible(false);
    }, 6000);
    return () => clearTimeout(timeout);
  }, [familyMessageVisible]);

  useEffect(() => {
    if (!mapToken || !mapContainerRef.current || mapRef.current) return undefined;
    mapboxgl.accessToken = mapToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
      center: [31.1656, 48.3794],
      zoom: 5.6,
      pitch: is3DView ? 58 : 0,
      bearing: is3DView ? -18 : 0,
      antialias: true,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("dragstart", () => {
      userMovedMapRef.current = true;
    });
    map.on("zoomstart", () => {
      userMovedMapRef.current = true;
    });
    map.on("rotatestart", () => {
      userMovedMapRef.current = true;
    });
    map.on("pitchstart", () => {
      userMovedMapRef.current = true;
    });
    map.on("click", (e) => {
      if (!isPlacingMarkerRef.current) return;
      const { lng, lat } = e.lngLat;
      setPendingCoords({ lat, lng });
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [mapToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11");
  }, [isDarkMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyScene = () => {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }

      if (is3DView) {
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.25 });
        map.easeTo({ pitch: 58, bearing: -18, duration: 700 });
        if (!map.getLayer("3d-buildings")) {
          map.addLayer({
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": isDarkMode ? "#38556e" : "#d7dde6",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": isDarkMode ? 0.72 : 0.82,
            },
          });
        }
      } else {
        if (map.getLayer("3d-buildings")) map.removeLayer("3d-buildings");
        map.setTerrain(null);
        map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      }
    };

    if (map.isStyleLoaded()) applyScene();
    else map.once("style.load", applyScene);
  }, [is3DView, isDarkMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      incidentsWithCoords.forEach((item) => {
        const el = document.createElement("div");
        const glowColor =
          item.status === "high"
            ? (isDarkMode ? "rgba(255,42,35,0.34)" : "rgba(255,42,35,0.22)")
            : item.status === "medium"
              ? (isDarkMode ? "rgba(255,159,10,0.30)" : "rgba(255,159,10,0.18)")
              : (isDarkMode ? "rgba(0,212,138,0.26)" : "rgba(0,212,138,0.16)");

        const isUnverified = item.userCreated && item.validationStatus !== "verified";

        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "999px";
        el.style.background = markerColor(item.status);
        const borderColor = item.status === "high" ? "#ff2a23" : item.status === "medium" ? "#ff9f0a" : "rgba(255,241,241,0.92)";
        el.style.border = isUnverified ? "2px dashed rgba(255,255,255,0.75)" : `3px solid ${borderColor}`;
        el.style.boxShadow = `0 0 0 6px ${glowColor}, 0 0 16px ${glowColor}`;
        el.style.opacity = isUnverified ? "0.72" : "1";

        const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(
          `<div style="min-width:220px;font-family:${FONT_UI};padding:2px 4px;">
            <div style="font-weight:700;font-size:14px;color:#1f2638;">${item.title}</div>
            ${isUnverified ? '<div style="margin-top:4px;font-size:9px;font-weight:700;letter-spacing:0.12em;color:#ff9f0a;">⚠ AWAITING VERIFICATION</div>' : ''}
            <div style="margin-top:6px;font-size:11px;color:#6f7789;">${String(item.region || "").toUpperCase()}</div>
            <div style="margin-top:8px;font-size:10px;color:#97a0b1;letter-spacing:.12em;">SOURCE: ${String(item.source || "NDS").toUpperCase()}</div>
          </div>`,
        );

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([item.coordinates.lng, item.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });

      if (!hasAutoFittedRef.current && !userMovedMapRef.current && incidentsWithCoords.length > 1) {
        const bounds = incidentsWithCoords.reduce(
          (acc, item) => acc.extend([item.coordinates.lng, item.coordinates.lat]),
          new mapboxgl.LngLatBounds(
            [incidentsWithCoords[0].coordinates.lng, incidentsWithCoords[0].coordinates.lat],
            [incidentsWithCoords[0].coordinates.lng, incidentsWithCoords[0].coordinates.lat],
          ),
        );
        map.fitBounds(bounds, { padding: 70, duration: 900, maxZoom: 12.5 });
        hasAutoFittedRef.current = true;
      } else if (!hasAutoFittedRef.current && !userMovedMapRef.current && incidentsWithCoords.length === 1) {
        map.easeTo({
          center: [incidentsWithCoords[0].coordinates.lng, incidentsWithCoords[0].coordinates.lat],
          zoom: 12.5,
          duration: 900,
        });
        hasAutoFittedRef.current = true;
      }
    };

    if (map.isStyleLoaded()) renderMarkers();
    else map.once("style.load", renderMarkers);
  }, [incidentsWithCoords, isDarkMode]);

  const tickerText = `WIND SPEED 45MPH  •  BRIDGE A-12 CLOSED  •  SECTOR 7 MONITORING ACTIVE  •  NEXT SIGNAL REFRESH ${String(refreshTick).padStart(2, "0")}S  •  `;

  return (
    <>
      <div style={{ ...styles.page, background: theme.pageBg, color: theme.panelText }}>
        <div
          style={{
            ...styles.shell,
            background: theme.shellBg,
            gridTemplateColumns: isNarrow ? "1fr" : "136px minmax(0, 1fr) 270px",
            gridTemplateRows: isNarrow ? "74px auto auto auto" : "50px minmax(0, 1fr)",
          }}
        >
          <header style={{ ...styles.topbar, background: theme.topbarBg, borderBottom: `1px solid ${theme.topbarBorder}` }}>
            <div style={{ ...styles.brand, color: theme.topbarText }}>CRISIS SIGNAL</div>
            <nav style={{ ...styles.topnav, color: theme.navText }}>
              {NAV_ITEMS.map((item, index) => (
                <div key={item} style={{ ...styles.topnavItem, ...(index === 0 ? styles.topnavItemActive : null) }}>
                  {item}
                </div>
              ))}
            </nav>
          </header>

          <aside style={{ ...styles.sidebar, background: theme.sidebarBg, borderRight: `1px solid ${theme.sidebarBorder}` }}>
            <div style={{ ...styles.sidebarStatus, borderBottom: `1px solid ${theme.sidebarBorder}` }}>
              <div style={styles.sidebarKicker}>OPERATIONAL STATUS</div>
              <div style={{ ...styles.sidebarLabel, color: theme.softText }}>REGION:</div>
              <div style={{ ...styles.sidebarValue, color: theme.panelText }}>SECTOR 7</div>
            </div>
            <div style={styles.sideNav}>
              {NAV_ITEMS.map((item, index) => (
                <div key={item} style={{ ...styles.sideNavItem, ...(index === 0 ? styles.sideNavItemActive : null) }}>
                  <span style={styles.sideNavBullet}>{index === 0 ? "◼" : "◈"}</span>
                  {item}
                </div>
              ))}
            </div>
            <div style={styles.sidebarBottom}>
              <div style={{ ...styles.signalCard, background: theme.cardBg, border: `1px solid ${theme.topbarBorder}` }}>
                <div style={styles.signalCardDot} />
                <div style={styles.signalCardTitle}>{statusWord}</div>
                <div style={{ ...styles.signalCardText, color: theme.softText }}>
                  {highlightSignal
                    ? `Increased regional activity. Avoid ${highlightSignal.region || "affected area"}.`
                    : "No live danger or safety signals are currently available from the API."}
                </div>
              </div>
              <button
                style={styles.emergencyButton}
                onClick={() => setFamilyMessageVisible(true)}
              >
                TELL FAMILY I AM SAFE
              </button>
              {familyMessageVisible ? (
                <div
                  style={{
                    ...styles.familyMessageCard,
                    background: theme.panelBg,
                    border: `1px solid ${theme.topbarBorder}`,
                    color: theme.panelText,
                  }}
                >
                  <div style={styles.familyMessageTitle}>DEMO MESSAGE SENT</div>
                  <div style={{ ...styles.familyMessageText, color: theme.softText }}>
                    Your family sees: "I am safe, my last known location is active,
                    and I will send another update soon."
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <main style={styles.mapStage}>
            <div style={styles.mapBackground}>
              {mapToken ? <div ref={mapContainerRef} style={styles.mapCanvas} /> : <div style={styles.mapMissing}>Mapbox token missing in frontend/.env</div>}
              <div style={{ ...styles.mapOverlayFrame, background: theme.frameOverlay }} />
              <div style={styles.mapControls}>
                <button style={{ ...styles.mapControlButton, ...(isDarkMode ? styles.mapControlButtonActive : null) }} onClick={() => setIsDarkMode((prev) => !prev)}>
                  {isDarkMode ? "DARK" : "LIGHT"}
                </button>
                <button style={{ ...styles.mapControlButton, ...(is3DView ? styles.mapControlButtonActive : null) }} onClick={() => setIs3DView((prev) => !prev)}>
                  {is3DView ? "3D ON" : "3D OFF"}
                </button>
                <button
                  style={{ ...styles.mapControlButton, ...(isPlacingMarker ? { borderColor: "rgba(255,159,10,0.7)", boxShadow: "inset 0 -2px 0 #ff9f0a", color: "#ff9f0a" } : null) }}
                  onClick={() => { setIsPlacingMarker((prev) => !prev); if (pendingCoords) setPendingCoords(null); setPlaceError(""); }}
                >
                  {isPlacingMarker ? "CANCEL" : "REPORT"}
                </button>
                <div style={styles.mapRefreshBadge}>REFRESH {String(refreshTick).padStart(2, "0")}S</div>
              </div>
              {isPlacingMarker && !pendingCoords && (
                <div style={{ position: "absolute", top: 64, left: 18, background: "rgba(255,159,10,0.92)", color: "#000", fontFamily: FONT_UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", padding: "7px 14px", zIndex: 3, pointerEvents: "none" }}>
                  CLICK MAP TO PLACE MARKER
                </div>
              )}
              <div style={styles.mapHud}>{hudText}</div>
            </div>
          </main>

          <section style={{ ...styles.feedPanel, background: theme.panelBg, borderLeft: `1px solid ${theme.sidebarBorder}` }}>
            <div style={styles.feedPanelHeader}>
              <div style={styles.feedTitle}>Latest Signals</div>
              <div style={styles.feedSubtitle}>{statusLine}</div>
            </div>
            <div style={{ ...styles.feedList, background: theme.panelBg }}>
              {isLoadingIncidents ? (
                <div style={{ ...styles.feedItem, borderBottom: `1px solid ${theme.feedItemBorder}`, color: theme.panelText }}>
                  <div style={{ ...styles.feedHeadline, color: theme.panelText }}>Loading live API incidents</div>
                  <div style={{ ...styles.feedSourceRow, color: theme.softText }}>
                    <span>Connecting to /api/incidents</span>
                  </div>
                </div>
              ) : feedItems.length === 0 ? (
                <div style={{ ...styles.feedItem, borderBottom: `1px solid ${theme.feedItemBorder}`, color: theme.panelText }}>
                  <div style={styles.feedHeadline}>No live API incidents</div>
                  <div style={{ ...styles.feedSourceRow, color: theme.softText }}>
                    <span>Waiting for `/api/incidents` data</span>
                  </div>
                </div>
              ) : feedItems.map((item) => {
                const tag = deriveTag(item);
                return (
                  <div key={item.id} style={{ ...styles.feedItem, borderBottom: `1px solid ${theme.feedItemBorder}` }}>
                    <div style={styles.feedMetaRow}>
                      <div style={{ ...styles.feedTag, background: tag.color }}>{tag.label}</div>
                      <div style={styles.feedClock}>{formatFeedTime(item.time)}</div>
                    </div>
                    <div style={{ ...styles.feedHeadline, color: theme.panelText }}>{item.title}</div>
                    <div style={{ ...styles.feedSourceRow, color: theme.softText }}>
                      <span>SOURCE: {String(item.source || "NDS").toUpperCase()}</span>
                      <span>{String(item.validationStatus || "verified").toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div style={{ ...styles.ticker, background: theme.tickerBg, color: theme.tickerText }}>
            <div style={{ ...styles.tickerTrack, color: theme.tickerText }}>
              <span>{tickerText}</span>
              <span>{tickerText}</span>
            </div>
          </div>
        </div>
      </div>

      {pendingCoords && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#0f1724", border: "1px solid #223044", padding: "28px 28px 24px", width: 360, fontFamily: FONT_UI }}>
            <div style={{ fontSize: 9, letterSpacing: "0.22em", color: "#95a2b8", fontWeight: 700, marginBottom: 20, borderBottom: "1px solid #1d2938", paddingBottom: 10 }}>REPORT MARKER</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.16em", color: "#95a2b8", fontWeight: 700, marginBottom: 8 }}>TYPE</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["low", "SAFE", "#00d48a"], ["medium", "ALERT", PALETTE.amber], ["high", "DANGER", PALETTE.alert]].map(([val, label, color]) => (
                  <button key={val} onClick={() => { setPlaceStatus(val); setPlaceReason(ADMIN_REASONS[val][0]); }}
                    style={{ flex: 1, height: 36, border: placeStatus === val ? "none" : "1px solid #223044", background: placeStatus === val ? color : "transparent", color: placeStatus === val ? "#fff" : "#8e99ad", fontFamily: FONT_UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.16em", color: "#95a2b8", fontWeight: 700, marginBottom: 8 }}>REASON</div>
              <select value={placeReason} onChange={(e) => setPlaceReason(e.target.value)}
                style={{ width: "100%", height: 40, padding: "0 12px", background: "#07111e", border: "1px solid #223044", color: "#edf1f7", fontSize: 12, fontFamily: FONT_UI }}>
                {ADMIN_REASONS[placeStatus].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20, fontSize: 10, color: "#4e5a6e", fontFamily: FONT_UI, letterSpacing: "0.1em" }}>
              LOC: {pendingCoords.lat.toFixed(4)}, {pendingCoords.lng.toFixed(4)}
            </div>

            {placeError && <div style={{ color: "#ff4444", fontSize: 11, marginBottom: 12 }}>{placeError}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setPendingCoords(null); setPlaceError(""); }}
                style={{ flex: 1, height: 40, border: "1px solid #223044", background: "transparent", color: "#8e99ad", fontFamily: FONT_UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>
                CANCEL
              </button>
              <button onClick={submitMarker} disabled={placeSubmitting}
                style={{ flex: 2, height: 40, border: "none", background: PALETTE.alert, color: "#fff", fontFamily: FONT_UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", cursor: "pointer", opacity: placeSubmitting ? 0.6 : 1 }}>
                {placeSubmitting ? "SUBMITTING..." : "SUBMIT REPORT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  page: { minHeight: "100vh", padding: "0", background: "linear-gradient(180deg, #d7dbe3 0%, #cfd5de 100%)" },
  shell: { minHeight: "100vh", display: "grid", width: "100%", background: "#e6e9ef" },
  topbar: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    alignItems: "center",
    background: "#fbfbfc",
    borderBottom: `1px solid ${PALETTE.border}`,
    padding: "0 18px",
    height: 50,
    boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset",
    zIndex: 2,
  },
  brand: { fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em", color: "#2a3143" },
  topnav: { display: "flex", justifyContent: "center", gap: 34, alignItems: "center", fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 700, color: "#8d94a7" },
  topnavItem: { position: "relative", paddingTop: 4, cursor: "default" },
  topnavItemActive: { color: PALETTE.alert, textDecoration: "underline", textUnderlineOffset: 5, textDecorationThickness: 2 },
  sidebar: { display: "grid", gridTemplateRows: "93px 1fr auto", background: PALETTE.sidebar, borderRight: `1px solid ${PALETTE.border}`, minHeight: 0 },
  sidebarStatus: { padding: "15px 14px", borderBottom: `1px solid ${PALETTE.border}` },
  sidebarKicker: { fontFamily: FONT_UI, fontSize: 8, letterSpacing: "0.18em", color: "#aab1c0", fontWeight: 700 },
  sidebarLabel: { marginTop: 10, fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 700, color: "#60697e" },
  sidebarValue: { marginTop: 1, fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: "#30384b" },
  sideNav: { paddingTop: 2 },
  sideNavItem: { height: 38, display: "flex", alignItems: "center", gap: 9, padding: "0 13px", fontFamily: FONT_UI, fontSize: 10, letterSpacing: "0.12em", color: "#7f8798", fontWeight: 700, borderBottom: "1px solid #edf0f5" },
  sideNavItemActive: { background: "#182339", color: "#ffffff" },
  sideNavBullet: { fontSize: 9, width: 10, textAlign: "center" },
  sidebarBottom: { padding: "10px 10px 12px", display: "grid", gap: 12 },
  signalCard: { background: "#e7ebf3", border: "1px solid #dfe4ed", minHeight: 63, padding: "10px 10px 8px", position: "relative" },
  signalCardDot: { width: 7, height: 7, borderRadius: "50%", background: PALETTE.alert, position: "absolute", left: 10, top: 12 },
  signalCardTitle: { marginLeft: 14, fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.18em", fontWeight: 700, color: PALETTE.alert },
  signalCardText: { marginTop: 8, fontFamily: FONT_UI, fontSize: 11, lineHeight: 1.35, color: "#6e7486", fontWeight: 700 },
  emergencyButton: { height: 44, border: "none", background: PALETTE.alert, color: "#ffffff", fontFamily: FONT_UI, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", cursor: "pointer", boxShadow: "0 0 0 1px rgba(255,255,255,0.2) inset" },
  familyMessageCard: { padding: "12px 12px 11px", boxShadow: "0 10px 24px rgba(0,0,0,0.14)" },
  familyMessageTitle: { fontFamily: FONT_UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#23b26d" },
  familyMessageText: { marginTop: 8, fontFamily: FONT_UI, fontSize: 12, lineHeight: 1.45, fontWeight: 700 },
  mapStage: { position: "relative", minHeight: 0, overflow: "hidden", background: "#243142" },
  mapBackground: { position: "relative", width: "100%", height: "100%", minHeight: 640, background: "linear-gradient(180deg, #293444 0%, #202a38 100%)", overflow: "hidden" },
  mapCanvas: { position: "absolute", inset: 0 },
  mapMissing: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "#1c2431", fontFamily: FONT_UI, letterSpacing: "0.08em" },
  mapOverlayFrame: { position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 0 1px rgba(134, 203, 200, 0.16)", background: "linear-gradient(180deg, rgba(6,10,18,0.02), rgba(6,10,18,0.18)), radial-gradient(circle at 50% 48%, rgba(122,241,232,0.08), transparent 40%)" },
  mapControls: { position: "absolute", top: 18, left: 18, display: "flex", gap: 10, zIndex: 2 },
  mapControlButton: { height: 34, padding: "0 14px", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(10, 16, 27, 0.78)", color: "#f6f7fb", fontFamily: FONT_UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", cursor: "pointer" },
  mapControlButtonActive: { borderColor: "rgba(234,61,56,0.5)", boxShadow: "inset 0 -2px 0 #ea3d38" },
  mapRefreshBadge: { height: 34, padding: "0 14px", display: "inline-flex", alignItems: "center", background: "rgba(10, 16, 27, 0.84)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", fontFamily: FONT_UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em" },
  mapHud: { position: "absolute", left: 16, bottom: 14, background: "rgba(7,11,18,0.82)", color: "#f4f5f7", borderLeft: `4px solid ${PALETTE.alert}`, padding: "9px 11px 8px", fontFamily: FONT_UI, fontSize: 11, letterSpacing: "0.08em", fontWeight: 700, zIndex: 2 },
  feedPanel: { background: PALETTE.panel, borderLeft: `1px solid ${PALETTE.border}`, display: "grid", gridTemplateRows: "74px 1fr", minHeight: 0 },
  feedPanelHeader: { background: "#050507", color: "#ffffff", padding: "14px 16px 10px" },
  feedTitle: { fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 18, fontWeight: 700 },
  feedSubtitle: { marginTop: 3, fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.18em", color: "#c9d0db", fontWeight: 700 },
  feedList: { overflow: "auto", background: "#ffffff" },
  feedItem: { padding: "15px 16px 16px", borderBottom: "1px solid #eef1f6" },
  feedMetaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  feedTag: { height: 16, minWidth: 44, padding: "0 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontFamily: FONT_UI, fontSize: 8, fontWeight: 700, letterSpacing: "0.12em" },
  feedClock: { fontFamily: FONT_UI, fontSize: 10, color: "#bec5d2", fontWeight: 700 },
  feedHeadline: { fontFamily: FONT_DISPLAY, fontSize: 17, lineHeight: 1.2, color: "#272d3f", fontWeight: 700 },
  feedSourceRow: { marginTop: 13, display: "flex", gap: 18, flexWrap: "wrap", fontFamily: FONT_UI, fontSize: 9, letterSpacing: "0.12em", color: "#a5adbb", fontWeight: 700 },
  ticker: { gridColumn: "1 / -1", height: 20, background: "#06080e", color: "#f5f6f8", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.08)" },
  tickerTrack: { display: "inline-flex", whiteSpace: "nowrap", gap: 36, paddingLeft: 18, fontFamily: FONT_UI, fontSize: 10, lineHeight: "20px", letterSpacing: "0.18em", fontWeight: 700, animation: "tickerMove 18s linear infinite" },
};

const adminStyles = {
  page: { height: "100vh", overflow: "hidden", background: "linear-gradient(180deg, #0a0f18 0%, #111827 100%)", fontFamily: FONT_UI, color: "#f2f5f9" },
  shell: { display: "grid", gridTemplateColumns: "220px 1fr", height: "100vh", overflow: "hidden" },
  sidebar: { background: "#0d1522", borderRight: "1px solid #223044", display: "grid", gridTemplateRows: "auto 1fr auto", height: "100vh", overflow: "hidden" },
  sidebarTop: { padding: "20px 16px 18px", borderBottom: "1px solid #223044" },
  brandTitle: { fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: "#edf1f7", letterSpacing: "-0.02em" },
  brandSub: { marginTop: 4, fontSize: 9, letterSpacing: "0.18em", color: "#95a2b8", fontWeight: 700 },
  navItem: { height: 42, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", fontSize: 10, letterSpacing: "0.12em", color: "#8e99ad", fontWeight: 700, cursor: "pointer", borderBottom: "1px solid #1a2535" },
  navItemActive: { background: "#182339", color: "#ffffff" },
  sidebarFooter: { padding: "14px 16px", borderTop: "1px solid #223044" },
  main: { padding: "28px 32px", overflow: "auto", height: "100vh" },
  content: { width: "100%" },
  sectionTitle: { fontSize: 9, letterSpacing: "0.22em", color: "#95a2b8", fontWeight: 700, marginBottom: 20, borderBottom: "1px solid #1d2938", paddingBottom: 10 },
  loginCard: { maxWidth: 380, margin: "15vh auto 0", background: "#0f1724", border: "1px solid #223044", padding: "32px 28px" },
  loginForm: { display: "grid", gap: 12, marginTop: 20 },
  fieldInput: { height: 40, padding: "0 12px", background: "#07111e", border: "1px solid #223044", color: "#edf1f7", fontSize: 13, fontFamily: FONT_UI },
  fieldLabel: { fontSize: 9, letterSpacing: "0.16em", color: "#95a2b8", fontWeight: 700 },
  primaryBtn: { height: 42, border: "none", background: PALETTE.alert, color: "#fff", fontFamily: FONT_UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", cursor: "pointer" },
  ghostBtn: { height: 32, padding: "0 12px", border: "1px solid #223044", background: "transparent", color: "#8e99ad", fontFamily: FONT_UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", width: "100%" },
  saveBtn: { height: 32, padding: "0 12px", border: "none", background: "#23b26d", color: "#fff", fontFamily: FONT_UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" },
  verifyBtn: { height: 32, padding: "0 12px", border: "none", background: "#1f7a42", color: "#fff", fontFamily: FONT_UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" },
  rejectBtn: { height: 32, padding: "0 12px", border: "none", background: PALETTE.alert, color: "#fff", fontFamily: FONT_UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" },
  errorMsg: { marginTop: 12, color: "#ff4444", fontSize: 12 },
  healthBar: { display: "flex", alignItems: "center", gap: 10, background: "#0f1724", border: "1px solid #1d2938", padding: "10px 14px", marginBottom: 20 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 },
  statCard: { background: "#0f1724", border: "1px solid #1d2938", padding: "18px 16px" },
  statValue: { fontSize: 36, fontWeight: 700, color: "#edf1f7", lineHeight: 1 },
  statLabel: { marginTop: 8, fontSize: 9, letterSpacing: "0.16em", color: "#95a2b8", fontWeight: 700 },
  emptyState: { background: "#0f1724", border: "1px solid #1d2938", padding: 20, color: "#95a2b8", fontSize: 13 },
  zoneCard: { background: "#0f1724", border: "1px solid #1d2938", padding: "16px 18px", marginBottom: 12 },
  statusBadge: { fontSize: 8, letterSpacing: "0.14em", fontWeight: 700, color: "#fff", padding: "3px 8px" },
  topBar: { background: "#0d1522", borderBottom: "1px solid #223044" },
  topBarHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1a2535" },
  topBarNav: { display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch" },
  topNavItem: { flexShrink: 0, padding: "0 18px", height: 40, display: "flex", alignItems: "center", gap: 6, fontSize: 10, letterSpacing: "0.12em", color: "#8e99ad", fontWeight: 700, cursor: "pointer", borderBottom: "2px solid transparent" },
  topNavItemActive: { color: "#ffffff", borderBottomColor: PALETTE.alert },
};
