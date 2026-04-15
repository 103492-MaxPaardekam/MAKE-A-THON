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

  async function handleLogin(e) {
    e.preventDefault();
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
          <h1 style={adminStyles.title}>Safe Zone Admin</h1>
          <p style={adminStyles.subtitle}>Inloggen om zones te modereren</p>
          <form onSubmit={handleLogin} style={adminStyles.form}>
            <input
              style={adminStyles.input}
              placeholder="Gebruikersnaam"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              style={adminStyles.input}
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button style={adminStyles.primaryBtn} type="submit">
              Inloggen
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
        <h1 style={adminStyles.title}>Ongeverifieerde zones</h1>
        <button
          style={adminStyles.ghostBtn}
          onClick={() => {
            localStorage.removeItem("safezone-admin-auth");
            setAuthHeader("");
            setZones([]);
          }}
        >
          Uitloggen
        </button>
      </div>

      {loading ? <div style={adminStyles.loading}>Laden...</div> : null}
      {error ? <div style={adminStyles.error}>{error}</div> : null}

      <div style={adminStyles.list}>
        {zones.length === 0 ? (
          <div style={adminStyles.empty}>Geen ongeverifieerde zones</div>
        ) : (
          zones.map((zone) => (
            <div key={zone.id} style={adminStyles.item}>
              <div style={adminStyles.itemTitle}>{zone.title}</div>
              <div style={adminStyles.itemMeta}>
                {zone.region} | {formatRelativeTime(zone.time)}
              </div>
              <div style={adminStyles.itemMeta}>
                Reden: {zone.reason || "-"}
              </div>
              <div style={adminStyles.itemMeta}>
                Locatie: {zone.coordinates?.lat?.toFixed?.(4)},{" "}
                {zone.coordinates?.lng?.toFixed?.(4)}
              </div>
              <div style={adminStyles.actions}>
                <button
                  style={adminStyles.acceptBtn}
                  onClick={() => verifyZone(zone.id)}
                >
                  Accepteren
                </button>
                <button
                  style={adminStyles.rejectBtn}
                  onClick={() => rejectZone(zone.id)}
                >
                  Afwijzen
                </button>
              </div>
            </div>
          ))
        )}
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
    if (!mapRef.current || !mapContainerRef.current) return;
    const map = mapRef.current;
    const container = mapContainerRef.current;

    if (placingMode && selectedStatus && selectedReason) {
      container.style.cursor = "crosshair";

      const handleClick = async (event) => {
        // Prevent popup-open clicks on the zone-delete button inside popups
        if (event.target && event.target.tagName === "BUTTON") return;

        const rect = container.getBoundingClientRect();
        const point = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const lngLat = map.unproject(point);

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
          setPlacingMode(false);
          setSelectedStatus("");
          setSelectedReason("");
          setZoneError("");
          await loadIncidents();
        } catch (e) {
          setZoneError(e?.message || "Kon zone niet aanmaken");
        }
      };

      container.addEventListener("click", handleClick);
      return () => {
        container.removeEventListener("click", handleClick);
        container.style.cursor = "";
      };
    }

    container.style.cursor = "";
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
  page: {
    minHeight: "100vh",
    background: COLORS.page,
    color: COLORS.text,
    fontFamily: "'Manrope', system-ui, sans-serif",
    padding: 20,
    boxSizing: "border-box",
  },
  card: {
    maxWidth: 500,
    margin: "80px auto 0",
    background: COLORS.feedCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 20,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { margin: 0, fontSize: 28 },
  subtitle: { marginTop: 8, color: COLORS.textDim, fontSize: 13 },
  form: { display: "flex", flexDirection: "column", gap: 8, marginTop: 14 },
  input: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.mapCard,
    color: COLORS.text,
    borderRadius: 8,
    padding: "9px 10px",
  },
  primaryBtn: {
    border: "none",
    background: "linear-gradient(180deg,#3b82f6,#1d4ed8)",
    color: "white",
    borderRadius: 8,
    padding: "9px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostBtn: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.mapCard,
    color: COLORS.textDim,
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
  },
  loading: { color: COLORS.textDim, marginBottom: 10 },
  error: {
    marginTop: 10,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(127,29,29,0.35)",
    color: "#fecaca",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
  },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  empty: {
    border: `1px dashed ${COLORS.border}`,
    borderRadius: 10,
    padding: 14,
    color: COLORS.textDim,
  },
  item: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    background: COLORS.feedCard,
    padding: 12,
  },
  itemTitle: { fontSize: 14, fontWeight: 700, marginBottom: 5 },
  itemMeta: { color: COLORS.textDim, fontSize: 12, marginBottom: 3 },
  actions: { display: "flex", gap: 8, marginTop: 8 },
  acceptBtn: {
    border: "none",
    background: COLORS.low,
    color: "#06230f",
    borderRadius: 7,
    padding: "7px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  rejectBtn: {
    border: "none",
    background: COLORS.high,
    color: "#fff",
    borderRadius: 7,
    padding: "7px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
