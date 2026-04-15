import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

const mockIncidents = [
  {
    id: "inc-1",
    title: "Air raid alert - Kyiv downtown",
    region: "Kyiv",
    coordinates: { latitude: 50.4501, longitude: 30.5234 },
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
    coordinates: { latitude: 50.4256, longitude: 30.6432 },
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
    coordinates: { latitude: 50.4012, longitude: 30.5498 },
    source: "ReliefWeb",
    confidenceScore: 4,
    validationStatus: "verified",
    status: "low",
    advice: "veilig",
    time: "23 min ago",
  },
];

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:3001";

function scoreColor(score) {
  if (score >= 5) return "#ef4444";
  if (score >= 4) return "#f97316";
  if (score >= 3) return "#f59e0b";
  if (score >= 2) return "#84cc16";
  return "#22c55e";
}

function markerColorFromStatus(status) {
  if (status === "high") return "red";
  if (status === "medium") return "orange";
  return "green";
}

export default function App() {
  const mapRef = useRef(null);
  const [incidents, setIncidents] = useState(mockIncidents);
  const [apiStatus, setApiStatus] = useState("loading");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const isDemoMode = useMemo(() => {
    const search =
      typeof globalThis !== "undefined" && globalThis.location
        ? globalThis.location.search || ""
        : "";
    return new URLSearchParams(search).get("mode") === "demo";
  }, []);

  useEffect(() => {
    async function loadIncidents() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/incidents`);
        if (!response.ok) throw new Error(`API ${response.status}`);
        const payload = await response.json();
        if (Array.isArray(payload?.incidents) && payload.incidents.length > 0) {
          setIncidents(payload.incidents);
          setApiStatus(payload?.cacheMeta?.mode || "live");
          return;
        }
        setApiStatus("fallback-mock");
      } catch (error) {
        setApiStatus("fallback-mock");
      }
    }

    loadIncidents();
    const timer = setInterval(loadIncidents, 30000);
    return () => clearInterval(timer);
  }, []);

  async function triggerDemoUpdate() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/demo/trigger-update`, {
        method: "POST",
      });

      if (!response.ok) throw new Error(`Demo API ${response.status}`);
      const payload = await response.json();
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
          coordinates: { latitude: 50.3925, longitude: 30.6812 },
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

  if (isMapFullscreen) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fullscreenMapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: 50.4501,
              longitude: 30.5234,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }}
          >
            {incidents.map((incident) => {
              if (!incident.coordinates) return null;
              return (
                <Marker
                  key={incident.id}
                  coordinate={{
                    latitude: incident.coordinates.latitude,
                    longitude: incident.coordinates.longitude,
                  }}
                  pinColor={markerColorFromStatus(incident.status)}
                  title={incident.title}
                  description={`${incident.region} | ${incident.source}`}
                />
              );
            })}
          </MapView>
          <Pressable
            style={styles.closeButton}
            onPress={() => setIsMapFullscreen(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Safe Zone</Text>
        <Text style={styles.subtitle}>Live safety updates for civilians</Text>
      </View>

      <Pressable
        style={styles.mapContainer}
        onPress={() => setIsMapFullscreen(true)}
      >
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 50.4501,
            longitude: 30.5234,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          }}
        >
          {incidents.map((incident) => {
            if (!incident.coordinates) return null;
            return (
              <Marker
                key={incident.id}
                coordinate={{
                  latitude: incident.coordinates.latitude,
                  longitude: incident.coordinates.longitude,
                }}
                pinColor={markerColorFromStatus(incident.status)}
                title={incident.title}
                description={`${incident.region} | ${incident.source}`}
              />
            );
          })}
        </MapView>
      </Pressable>

      <View style={styles.feedCard}>
        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>Incident Feed</Text>
          <Text style={styles.apiStatusBadge}>{apiStatus}</Text>
          {isDemoMode ? (
            <Pressable style={styles.demoButton} onPress={triggerDemoUpdate}>
              <Text style={styles.demoButtonText}>Demo</Text>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.incidentItem}>
              <View style={styles.rowBetween}>
                <Text style={styles.incidentTitle}>{item.title}</Text>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: scoreColor(item.confidenceScore),
                    },
                  ]}
                />
              </View>
              <Text style={styles.incidentMeta}>
                {item.region} | {item.source} | {item.time}
              </Text>
              <Text style={styles.incidentMeta}>
                Confidence: {item.confidenceScore}/5 | Advice: {item.advice}
              </Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 2,
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 4,
  },
  mapContainer: {
    flex: 0.35,
    borderRadius: 8,
    overflow: "hidden",
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#25324a",
  },
  map: {
    flex: 1,
  },
  feedCard: {
    flex: 0.65,
    backgroundColor: "#111a2b",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#25324a",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2a40",
  },
  feedTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  apiStatusBadge: {
    color: "#c7d2fe",
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  incidentItem: {
    paddingVertical: 8,
  },
  incidentTitle: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
    flex: 1,
  },
  incidentMeta: {
    color: "#94a3b8",
    marginTop: 3,
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "#1f2a40",
  },
  demoButton: {
    backgroundColor: "#dc2626",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  demoButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  fullscreenMapWrapper: {
    flex: 1,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
});
