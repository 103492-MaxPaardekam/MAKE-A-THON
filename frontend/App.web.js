import React, { useCallback, useEffect, useMemo, useState } from "react";

const PALETTE = {
  paper: "#f3f3f5",
  ink: "#1e2230",
  muted: "#7d8598",
  navy: "#101728",
  navySoft: "#1d293d",
  navyLine: "#31455f",
  sidebar: "#f7f8fb",
  panel: "#ffffff",
  alert: "#ea3d38",
  amber: "#c9894e",
  info: "#182339",
  border: "#d9dde7",
};

const API_BASE_URLS = [
  process.env.EXPO_PUBLIC_API_BASE_URL,
  process.env.REACT_APP_API_BASE_URL,
  "http://localhost:3001",
  "http://127.0.0.1:3001",
].filter(Boolean);

const FONT_DISPLAY =
  "'Baskerville Old Face', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
const FONT_UI = "'Arial Narrow', Arial, Helvetica, sans-serif";

const NAV_ITEMS = ["MAP", "INCIDENT FEED", "SAFE LOCATIONS", "ALERTS"];
const LEFT_MENU = ["MAP", "INCIDENT FEED", "SAFE LOCATIONS", "ALERTS"];
const FALLBACK_SIGNALS = [
  {
    id: "fallback-1",
    title: "Water Level Critical in Sector 4 Canal System",
    region: "Sector 4",
    source: "NDS",
    validationStatus: "verified",
    status: "high",
    time: new Date().toISOString(),
  },
  {
    id: "fallback-2",
    title: "Rolling Power Outage: Utrecht North District",
    region: "Utrecht North District",
    source: "Police",
    validationStatus: "pending",
    status: "high",
    time: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: "fallback-3",
    title: "Emergency Shelter Capacity Reached: Hall 7",
    region: "Hall 7",
    source: "Red Cross",
    validationStatus: "verified",
    status: "low",
    time: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: "fallback-4",
    title: "Signal Interference Detected in Coastal Zone",
    region: "Coastal Zone",
    source: "Telecom",
    validationStatus: "active",
    status: "high",
    time: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
];

function formatFeedTime(iso) {
  const stamp = Date.parse(iso || "");
  if (Number.isNaN(stamp)) return "14:22:05";
  const date = new Date(stamp);
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

function deriveTag(signal) {
  if (signal?.status === "high") return { label: "URGENT", color: PALETTE.alert };
  if (signal?.status === "medium")
    return { label: "ALERT", color: PALETTE.amber };
  return { label: "INFO", color: PALETTE.info };
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

function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [zones, setZones] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadPendingZones = useCallback(
    async (header = authHeader) => {
      if (!header) return;
      setLoading(true);
      setError("");
      try {
        const payload = await fetchFromApi("/api/zones/unverified", {
          headers: { Authorization: header },
        });
        setZones(payload?.zones || []);
      } catch (e) {
        setError(e?.message || "Kon zones niet laden");
      } finally {
        setLoading(false);
      }
    },
    [authHeader],
  );

  useEffect(() => {
    const stored = localStorage.getItem("safezone-admin-auth") || "";
    if (stored) {
      setAuthHeader(stored);
      loadPendingZones(stored);
    }
  }, [loadPendingZones]);

  async function handleLogin(event) {
    event.preventDefault();
    const header = buildBasicAuth(username, password);
    localStorage.setItem("safezone-admin-auth", header);
    setAuthHeader(header);
    await loadPendingZones(header);
  }

  async function verifyZone(zoneId) {
    await fetchFromApi(`/api/zones/${zoneId}/verify`, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });
    await loadPendingZones();
  }

  async function rejectZone(zoneId) {
    await fetchFromApi(`/api/zones/${zoneId}`, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });
    await loadPendingZones();
  }

  if (!authHeader) {
    return (
      <div style={adminStyles.page}>
        <div style={adminStyles.card}>
          <h1 style={adminStyles.title}>Crisis Signal Admin</h1>
          <p style={adminStyles.subtitle}>Login to review pending zone reports</p>
          <form onSubmit={handleLogin} style={adminStyles.form}>
            <input
              style={adminStyles.input}
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <input
              style={adminStyles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button style={adminStyles.primaryBtn} type="submit">
              Sign In
            </button>
          </form>
          {error ? <div style={adminStyles.error}>{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={adminStyles.page}>
      <div style={adminStyles.headerRow}>
        <h1 style={adminStyles.title}>Pending Zone Verification</h1>
        <button
          style={adminStyles.ghostBtn}
          onClick={() => {
            localStorage.removeItem("safezone-admin-auth");
            setAuthHeader("");
            setZones([]);
          }}
        >
          Logout
        </button>
      </div>

      {loading ? <div style={adminStyles.loading}>Loading...</div> : null}
      {error ? <div style={adminStyles.error}>{error}</div> : null}

      <div style={adminStyles.list}>
        {zones.length === 0 ? (
          <div style={adminStyles.empty}>No unverified zones</div>
        ) : (
          zones.map((zone) => (
            <div key={zone.id} style={adminStyles.item}>
              <div style={adminStyles.itemTitle}>{zone.title}</div>
              <div style={adminStyles.itemMeta}>{zone.region}</div>
              <div style={adminStyles.itemMeta}>
                {zone.coordinates?.lat?.toFixed?.(4)},{" "}
                {zone.coordinates?.lng?.toFixed?.(4)}
              </div>
              <div style={adminStyles.actions}>
                <button
                  style={adminStyles.acceptBtn}
                  onClick={() => verifyZone(zone.id)}
                >
                  Verify
                </button>
                <button
                  style={adminStyles.rejectBtn}
                  onClick={() => rejectZone(zone.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function buildMapPoints(incidents) {
  const withCoords = incidents.filter(
    (item) =>
      Number.isFinite(item?.coordinates?.lat) && Number.isFinite(item?.coordinates?.lng),
  );

  if (withCoords.length >= 2) {
    const lats = withCoords.map((item) => item.coordinates.lat);
    const lngs = withCoords.map((item) => item.coordinates.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return withCoords.slice(0, 6).map((item, index) => {
      const xRatio =
        maxLng === minLng ? 0.45 + index * 0.08 : (item.coordinates.lng - minLng) / (maxLng - minLng);
      const yRatio =
        maxLat === minLat ? 0.28 + index * 0.12 : 1 - (item.coordinates.lat - minLat) / (maxLat - minLat);

      return {
        id: item.id,
        left: `${16 + xRatio * 60}%`,
        top: `${12 + yRatio * 70}%`,
      };
    });
  }

  return [
    { id: "point-a", left: "33%", top: "28%" },
    { id: "point-b", left: "67%", top: "49%" },
    { id: "point-c", left: "46%", top: "73%" },
  ];
}

export default function AppWeb() {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  if (pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  const [incidents, setIncidents] = useState(FALLBACK_SIGNALS);
  const [statusLine, setStatusLine] = useState("LIVE VERIFICATION STREAM");
  const [refreshTick, setRefreshTick] = useState(45);
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1220 : false,
  );

  const loadIncidents = useCallback(async () => {
    try {
      const payload = await fetchFromApi("/api/incidents");
      const nextIncidents = Array.isArray(payload?.incidents) && payload.incidents.length > 0
        ? payload.incidents
        : FALLBACK_SIGNALS;

      setIncidents(nextIncidents);
      setStatusLine(
        payload?.cacheMeta?.mode === "live-multi-source"
          ? "LIVE VERIFICATION STREAM"
          : "DEGRADED SIGNAL STREAM",
      );
      setRefreshTick(45);
    } catch {
      setIncidents(FALLBACK_SIGNALS);
      setStatusLine("OFFLINE FALLBACK STREAM");
    }
  }, []);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      html, body, #root { min-height: 100%; width: 100%; }
      body {
        margin: 0;
        background: #dfe3ea;
        color: ${PALETTE.ink};
        font-family: ${FONT_UI};
      }
      * { box-sizing: border-box; }
      @keyframes pulseDot {
        0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(234,61,56,0.55); }
        70% { transform: translate(-50%, -50%) scale(1.08); box-shadow: 0 0 0 14px rgba(234,61,56,0); }
        100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(234,61,56,0); }
      }
      @keyframes tickerMove {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
    };
  }, []);

  useEffect(() => {
    loadIncidents();
    const timer = setInterval(loadIncidents, 45000);
    return () => clearInterval(timer);
  }, [loadIncidents]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTick((prev) => (prev > 0 ? prev - 1 : 45));
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

  const mapPoints = useMemo(() => buildMapPoints(feedItems), [feedItems]);
  const highlightSignal = feedItems[0] || FALLBACK_SIGNALS[0];
  const statusWord =
    highlightSignal?.status === "high"
      ? "ELEVATED - AMBER"
      : highlightSignal?.status === "medium"
        ? "WATCH - AMBER"
        : "STABLE - INFO";

  const tickerText = `WIND SPEED 45MPH  •  BRIDGE A-12 CLOSED  •  SECTOR 7 MONITORING ACTIVE  •  NEXT SIGNAL REFRESH ${String(
    refreshTick,
  ).padStart(2, "0")}S  •  `;

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.shell,
          gridTemplateColumns: isNarrow ? "1fr" : "136px minmax(0, 1fr) 270px",
          gridTemplateRows: isNarrow ? "74px auto auto auto" : "50px minmax(0, 1fr)",
        }}
      >
        <header style={styles.topbar}>
          <div style={styles.brand}>CRISIS SIGNAL</div>
          <nav style={styles.topnav}>
            {NAV_ITEMS.map((item, index) => (
              <div
                key={item}
                style={{
                  ...styles.topnavItem,
                  ...(index === 0 ? styles.topnavItemActive : null),
                }}
              >
                {item}
              </div>
            ))}
          </nav>
          <div style={styles.topIcons}>
            <div style={styles.iconGlyph}>⌂</div>
            <div style={styles.iconGlyph}>◉</div>
          </div>
        </header>

        <aside style={styles.sidebar}>
          <div style={styles.sidebarStatus}>
            <div style={styles.sidebarKicker}>OPERATIONAL STATUS</div>
            <div style={styles.sidebarLabel}>REGION:</div>
            <div style={styles.sidebarValue}>SECTOR 7</div>
          </div>

          <div style={styles.sideNav}>
            {LEFT_MENU.map((item, index) => (
              <div
                key={item}
                style={{
                  ...styles.sideNavItem,
                  ...(index === 0 ? styles.sideNavItemActive : null),
                }}
              >
                <span style={styles.sideNavBullet}>{index === 0 ? "◼" : "◈"}</span>
                {item}
              </div>
            ))}
          </div>

          <div style={styles.sidebarBottom}>
            <div style={styles.signalCard}>
              <div style={styles.signalCardDot} />
              <div style={styles.signalCardTitle}>{statusWord}</div>
              <div style={styles.signalCardText}>
                Increased regional activity. Avoid {highlightSignal?.region || "Sector 4"}.
              </div>
            </div>

            <button style={styles.emergencyButton}>INITIATE EMERGENCY SIGNAL</button>
          </div>
        </aside>

        <main style={styles.mapStage}>
          <div style={styles.mapBackground}>
            <div style={styles.mapGlow} />
            <div style={styles.mapTexture} />
            <div style={styles.mapRoads} />
            <div style={styles.mapCenterRing} />
            <div style={styles.mapHud}>LAT: 52.3676° N&nbsp;&nbsp;LON: 4.9041° E&nbsp;&nbsp;ALT: 2M</div>
            {mapPoints.map((point) => (
              <div
                key={point.id}
                style={{
                  ...styles.mapPoint,
                  left: point.left,
                  top: point.top,
                }}
              />
            ))}
          </div>
        </main>

        <section style={styles.feedPanel}>
          <div style={styles.feedPanelHeader}>
            <div style={styles.feedTitle}>Latest Signals</div>
            <div style={styles.feedSubtitle}>{statusLine}</div>
          </div>
          <div style={styles.feedList}>
            {feedItems.map((item) => {
              const tag = deriveTag(item);
              return (
                <div key={item.id} style={styles.feedItem}>
                  <div style={styles.feedMetaRow}>
                    <div
                      style={{
                        ...styles.feedTag,
                        background: tag.color,
                      }}
                    >
                      {tag.label}
                    </div>
                    <div style={styles.feedClock}>{formatFeedTime(item.time)}</div>
                  </div>
                  <div style={styles.feedHeadline}>{item.title}</div>
                  <div style={styles.feedSourceRow}>
                    <span>SOURCE: {String(item.source || "NDS").toUpperCase()}</span>
                    <span>{String(item.validationStatus || "verified").toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div style={styles.ticker}>
          <div style={styles.tickerTrack}>
            <span>{tickerText}</span>
            <span>{tickerText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "0",
    background: "linear-gradient(180deg, #d7dbe3 0%, #cfd5de 100%)",
  },
  shell: {
    minHeight: "100vh",
    display: "grid",
    width: "100%",
    background: "#e6e9ef",
  },
  topbar: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "220px 1fr 88px",
    alignItems: "center",
    background: "#fbfbfc",
    borderBottom: `1px solid ${PALETTE.border}`,
    padding: "0 18px",
    height: 50,
    boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset",
    zIndex: 2,
  },
  brand: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "#2a3143",
  },
  topnav: {
    display: "flex",
    justifyContent: "center",
    gap: 34,
    alignItems: "center",
    fontFamily: FONT_DISPLAY,
    fontSize: 11,
    fontWeight: 700,
    color: "#8d94a7",
  },
  topnavItem: {
    position: "relative",
    paddingTop: 4,
    cursor: "default",
  },
  topnavItemActive: {
    color: PALETTE.alert,
    textDecoration: "underline",
    textUnderlineOffset: 5,
    textDecorationThickness: 2,
  },
  topIcons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 16,
    color: "#2e3548",
    fontSize: 16,
  },
  iconGlyph: {
    width: 18,
    textAlign: "center",
  },
  sidebar: {
    display: "grid",
    gridTemplateRows: "93px 1fr auto",
    background: PALETTE.sidebar,
    borderRight: `1px solid ${PALETTE.border}`,
    minHeight: 0,
  },
  sidebarStatus: {
    padding: "15px 14px",
    borderBottom: `1px solid ${PALETTE.border}`,
  },
  sidebarKicker: {
    fontFamily: FONT_UI,
    fontSize: 8,
    letterSpacing: "0.18em",
    color: "#aab1c0",
    fontWeight: 700,
  },
  sidebarLabel: {
    marginTop: 10,
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: 700,
    color: "#60697e",
  },
  sidebarValue: {
    marginTop: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: 700,
    color: "#30384b",
  },
  sideNav: {
    paddingTop: 2,
  },
  sideNavItem: {
    height: 38,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 13px",
    fontFamily: FONT_UI,
    fontSize: 10,
    letterSpacing: "0.12em",
    color: "#7f8798",
    fontWeight: 700,
    borderBottom: `1px solid #edf0f5`,
  },
  sideNavItemActive: {
    background: "#182339",
    color: "#ffffff",
  },
  sideNavBullet: {
    fontSize: 9,
    width: 10,
    textAlign: "center",
  },
  sidebarBottom: {
    padding: "10px 10px 12px",
    display: "grid",
    gap: 12,
  },
  signalCard: {
    background: "#e7ebf3",
    border: `1px solid #dfe4ed`,
    minHeight: 63,
    padding: "10px 10px 8px",
    position: "relative",
  },
  signalCardDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: PALETTE.alert,
    position: "absolute",
    left: 10,
    top: 12,
  },
  signalCardTitle: {
    marginLeft: 14,
    fontFamily: FONT_UI,
    fontSize: 9,
    letterSpacing: "0.18em",
    fontWeight: 700,
    color: PALETTE.alert,
  },
  signalCardText: {
    marginTop: 8,
    fontFamily: FONT_UI,
    fontSize: 11,
    lineHeight: 1.35,
    color: "#6e7486",
    fontWeight: 700,
  },
  emergencyButton: {
    height: 44,
    border: "none",
    background: PALETTE.alert,
    color: "#ffffff",
    fontFamily: FONT_UI,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    cursor: "pointer",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.2) inset",
  },
  mapStage: {
    position: "relative",
    minHeight: 0,
    overflow: "hidden",
    background: "#243142",
  },
  mapBackground: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 640,
    background:
      "radial-gradient(circle at 42% 52%, rgba(127,240,226,0.12), transparent 18%), linear-gradient(180deg, #293444 0%, #202a38 100%)",
    overflow: "hidden",
  },
  mapGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 50% 48%, rgba(122,241,232,0.12), rgba(122,241,232,0.02) 28%, transparent 52%)",
  },
  mapTexture: {
    position: "absolute",
    inset: 0,
    opacity: 0.34,
    backgroundImage:
      "repeating-linear-gradient(90deg, rgba(126,234,224,0.08) 0, rgba(126,234,224,0.08) 1px, transparent 1px, transparent 42px), repeating-linear-gradient(0deg, rgba(126,234,224,0.06) 0, rgba(126,234,224,0.06) 1px, transparent 1px, transparent 35px)",
  },
  mapRoads: {
    position: "absolute",
    inset: 0,
    opacity: 0.5,
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'%3E%3Cg fill='none' stroke='%2380d9d0' stroke-opacity='0.32' stroke-width='2'%3E%3Cpath d='M32 820C110 665 188 568 254 498s140-114 222-131c79-17 166 0 239 54 77 57 135 145 153 238'/%3E%3Cpath d='M128 70c92 57 168 143 198 244 33 111 19 221-22 313-33 74-87 145-161 206'/%3E%3Cpath d='M870 154c-118 33-206 95-272 165-90 95-149 212-191 358'/%3E%3Cpath d='M184 862c53-74 108-140 165-197 53-54 123-113 208-156 116-58 233-82 343-88'/%3E%3Cpath d='M270 0c7 115 7 234 28 341 11 61 34 132 83 201 50 70 118 121 179 156'/%3E%3Cpath d='M0 283c91 18 182 33 266 85 99 62 181 166 214 294'/%3E%3Cpath d='M334 507c17-52 59-99 115-123 57-24 125-24 181 0 72 31 128 93 151 167'/%3E%3Cpath d='M302 525c26-77 88-143 167-171 71-26 151-19 216 18 68 39 119 108 136 187'/%3E%3C/g%3E%3Cg fill='none' stroke='%2380d9d0' stroke-opacity='0.15' stroke-width='1'%3E%3Cpath d='M95 108l665 675'/%3E%3Cpath d='M115 700l615-530'/%3E%3Cpath d='M456 42l-24 814'/%3E%3Cpath d='M49 445l804 17'/%3E%3C/g%3E%3C/svg%3E\")",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  mapCenterRing: {
    position: "absolute",
    left: "48%",
    top: "50%",
    width: 170,
    height: 170,
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    border: "2px solid rgba(144,240,232,0.33)",
    boxShadow:
      "0 0 0 18px rgba(144,240,232,0.07), 0 0 0 52px rgba(144,240,232,0.03)",
  },
  mapPoint: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "3px solid rgba(255,214,214,0.9)",
    background: PALETTE.alert,
    transform: "translate(-50%, -50%)",
    animation: "pulseDot 2.4s ease-out infinite",
  },
  mapHud: {
    position: "absolute",
    left: 16,
    bottom: 14,
    background: "rgba(7,11,18,0.82)",
    color: "#f4f5f7",
    borderLeft: `4px solid ${PALETTE.alert}`,
    padding: "9px 11px 8px",
    fontFamily: FONT_UI,
    fontSize: 11,
    letterSpacing: "0.08em",
    fontWeight: 700,
  },
  feedPanel: {
    background: PALETTE.panel,
    borderLeft: `1px solid ${PALETTE.border}`,
    display: "grid",
    gridTemplateRows: "74px 1fr",
    minHeight: 0,
  },
  feedPanelHeader: {
    background: "#050507",
    color: "#ffffff",
    padding: "14px 16px 10px",
  },
  feedTitle: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "italic",
    fontSize: 18,
    fontWeight: 700,
  },
  feedSubtitle: {
    marginTop: 3,
    fontFamily: FONT_UI,
    fontSize: 9,
    letterSpacing: "0.18em",
    color: "#c9d0db",
    fontWeight: 700,
  },
  feedList: {
    overflow: "auto",
    background: "#ffffff",
  },
  feedItem: {
    padding: "15px 16px 16px",
    borderBottom: `1px solid #eef1f6`,
  },
  feedMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  feedTag: {
    height: 16,
    minWidth: 44,
    padding: "0 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontFamily: FONT_UI,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: "0.12em",
  },
  feedClock: {
    fontFamily: FONT_UI,
    fontSize: 10,
    color: "#bec5d2",
    fontWeight: 700,
  },
  feedHeadline: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    lineHeight: 1.2,
    color: "#272d3f",
    fontWeight: 700,
  },
  feedSourceRow: {
    marginTop: 13,
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
    fontFamily: FONT_UI,
    fontSize: 9,
    letterSpacing: "0.12em",
    color: "#a5adbb",
    fontWeight: 700,
  },
  ticker: {
    gridColumn: "1 / -1",
    height: 20,
    background: "#06080e",
    color: "#f5f6f8",
    overflow: "hidden",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  tickerTrack: {
    display: "inline-flex",
    whiteSpace: "nowrap",
    gap: 36,
    paddingLeft: 18,
    fontFamily: FONT_UI,
    fontSize: 10,
    lineHeight: "20px",
    letterSpacing: "0.18em",
    fontWeight: 700,
    animation: "tickerMove 18s linear infinite",
  },
};

const adminStyles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #eef1f6 0%, #dfe4ed 100%)",
    padding: 24,
    fontFamily: FONT_UI,
    color: PALETTE.ink,
  },
  card: {
    maxWidth: 420,
    margin: "10vh auto 0",
    background: "#ffffff",
    border: `1px solid ${PALETTE.border}`,
    padding: 24,
    boxShadow: "0 18px 50px rgba(16,23,40,0.08)",
  },
  headerRow: {
    maxWidth: 980,
    margin: "0 auto 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontFamily: FONT_DISPLAY,
    fontSize: 30,
    color: "#262d40",
  },
  subtitle: {
    marginTop: 8,
    color: "#6b7386",
    fontSize: 13,
  },
  form: {
    display: "grid",
    gap: 12,
    marginTop: 18,
  },
  input: {
    height: 42,
    padding: "0 12px",
    border: `1px solid ${PALETTE.border}`,
    fontSize: 14,
  },
  primaryBtn: {
    height: 42,
    border: "none",
    background: PALETTE.alert,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostBtn: {
    height: 38,
    padding: "0 14px",
    border: `1px solid ${PALETTE.border}`,
    background: "#fff",
    cursor: "pointer",
  },
  loading: {
    maxWidth: 980,
    margin: "0 auto 12px",
  },
  error: {
    marginTop: 14,
    color: "#b91c1c",
    fontSize: 13,
  },
  list: {
    maxWidth: 980,
    margin: "0 auto",
    display: "grid",
    gap: 12,
  },
  empty: {
    background: "#fff",
    padding: 18,
    border: `1px solid ${PALETTE.border}`,
  },
  item: {
    background: "#fff",
    border: `1px solid ${PALETTE.border}`,
    padding: 18,
  },
  itemTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
  },
  itemMeta: {
    color: "#6e7688",
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    display: "flex",
    gap: 10,
    marginTop: 14,
  },
  acceptBtn: {
    height: 36,
    padding: "0 14px",
    border: "none",
    background: "#1f7a42",
    color: "#fff",
    cursor: "pointer",
  },
  rejectBtn: {
    height: 36,
    padding: "0 14px",
    border: "none",
    background: PALETTE.alert,
    color: "#fff",
    cursor: "pointer",
  },
};
