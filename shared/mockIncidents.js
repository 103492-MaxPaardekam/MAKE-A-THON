// Mock incidents for demo mode and testing
// These match the incident contract in shared/incident-contract.json

export const mockIncidents = [
  {
    title: "Air raid alert - Kyiv downtown",
    region: "Kyiv",
    coordinates: {
      lat: 50.4501,
      lng: 30.5234,
    },
    time: new Date().toISOString(),
    source: "air-alert-ukraine",
    confidenceScore: 5,
    validationStatus: "verified",
    status: "high",
    advice: "gevaar",
  },
  {
    title: "Explosions reported - Eastern suburbs",
    region: "Kyiv",
    coordinates: {
      lat: 50.4256,
      lng: 30.6432,
    },
    time: new Date(Date.now() - 600000).toISOString(),
    source: "air-alert-ukraine",
    confidenceScore: 5,
    validationStatus: "verified",
    status: "high",
    advice: "gevaar",
  },
  {
    title: "Humanitarian corridor open - Red Cross",
    region: "Kyiv",
    coordinates: {
      lat: 50.4012,
      lng: 30.5498,
    },
    time: new Date(Date.now() - 1800000).toISOString(),
    source: "reliefweb",
    confidenceScore: 4,
    validationStatus: "verified",
    status: "low",
    advice: "veilig",
  },
];

export const mockDemoUpdate = {
  title: "Emergency update - New alert",
  region: "Kyiv",
  coordinates: {
    lat: 50.3925,
    lng: 30.6812,
  },
  time: new Date().toISOString(),
  source: "air-alert-ukraine",
  confidenceScore: 5,
  validationStatus: "verified",
  status: "high",
  advice: "gevaar",
};
