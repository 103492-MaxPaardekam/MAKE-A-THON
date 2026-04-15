// Shared configuration and constants

export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";
export const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

export const DEMO_MODE = process.env.ENABLE_DEMO_MODE === "true";

export const CONFIDENCE_LEVELS = {
  1: "Very Low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Very High",
};

export const VALIDATION_STATUS = {
  verified: "Geverifieerd",
  unverified: "Ongevalideerd",
  conflicting: "Tegenstrijdig",
  unknown: "Onbekend",
};

export const ADVICE_LABELS = {
  gevaar: "Vermijden",
  "let op": "Waakzaam",
  veilig: "Relatief veilig",
};

export const STATUS_LABELS = {
  low: "Laag risico",
  medium: "Middel risico",
  high: "Hoog risico",
};

export const DEFAULT_CENTER = {
  lat: 50.4501,
  lng: 30.5234,
};

export const DEFAULT_ZOOM = 12;

export const API_ENDPOINTS = {
  incidents: "/api/incidents",
  incident: (id) => `/api/incidents/${id}`,
  safeLocations: "/api/safe-locations",
  sources: "/api/sources",
  demoUpdate: "/api/demo/trigger-update",
};
