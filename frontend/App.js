import React, { useMemo } from "react";
import {
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from "react-native";

const mockIncidents = [
  {
    id: "inc-1",
    title: "Air raid alert - Kyiv downtown",
    region: "Kyiv",
    confidenceScore: 5,
    status: "high",
    advice: "gevaar",
    source: "Air Alert Ukraine",
    time: "Now",
  },
  {
    id: "inc-2",
    title: "Movement restrictions in eastern district",
    region: "Kyiv",
    confidenceScore: 4,
    status: "medium",
    advice: "let op",
    source: "State Emergency Service",
    time: "12 min ago",
  },
  {
    id: "inc-3",
    title: "Safe shelter capacity updated",
    region: "Kyiv",
    confidenceScore: 4,
    status: "low",
    advice: "veilig",
    source: "ReliefWeb",
    time: "23 min ago",
  },
];

function scoreColor(score) {
  if (score >= 5) return "#dc2626";
  if (score >= 4) return "#ea580c";
  if (score >= 3) return "#f59e0b";
  if (score >= 2) return "#84cc16";
  return "#22c55e";
}

export default function App() {
  const isDemoMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("mode") === "demo";
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Safe Zone</Text>
        <Text style={styles.subtitle}>Live safety updates for civilians</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Incident Feed</Text>
          <Text style={styles.badge}>Kyiv</Text>
        </View>

        <FlatList
          data={mockIncidents}
          keyExtractor={(item) => item.id}
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

        {isDemoMode ? (
          <Pressable style={styles.demoButton}>
            <Text style={styles.demoButtonText}>Trigger demo update</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footerNote}>
          Next build step: map layer + real source adapter.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 24,
    paddingTop: 40,
  },
  header: {
    width: "100%",
    maxWidth: 880,
    marginBottom: 16,
  },
  card: {
    width: "100%",
    maxWidth: 880,
    backgroundColor: "#111a2b",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#25324a",
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
  },
  badge: {
    color: "#c7d2fe",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  incidentItem: {
    paddingVertical: 12,
  },
  incidentTitle: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 12,
    flexShrink: 1,
  },
  incidentMeta: {
    color: "#94a3b8",
    marginTop: 4,
    fontSize: 13,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  separator: {
    height: 1,
    backgroundColor: "#1f2a40",
  },
  demoButton: {
    marginTop: 16,
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  demoButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  footerNote: {
    marginTop: 14,
    color: "#93c5fd",
    fontSize: 12,
  },
});
