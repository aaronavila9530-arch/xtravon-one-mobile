import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../config";

export function Screen({ title, subtitle, children, right, minWidth = 430 }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalContent}
      >
        <View style={[styles.screenContent, { minWidth }]}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Kpi({ label, value, tone = "accent" }) {
  const color = COLORS[tone] || COLORS.accent;
  return (
    <Card style={styles.kpi}>
      <View style={[styles.kpiBar, { backgroundColor: color }]} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value ?? "0"}</Text>
    </Card>
  );
}

export function Button({ label, icon, tone = "accent", onPress, disabled }) {
  const backgroundColor = disabled ? "#888888" : (COLORS[tone] || COLORS.accent);
  return (
    <Pressable style={[styles.button, { backgroundColor }]} onPress={onPress} disabled={disabled}>
      {!!icon && <Ionicons name={icon} size={18} color={COLORS.white} />}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, subtitle, icon = "file-tray-outline" }) {
  return (
    <Card style={styles.empty}>
      <Ionicons name={icon} size={34} color={COLORS.accent} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </Card>
  );
}

export function Loading({ label = "Cargando..." }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={COLORS.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "-"}</Text>
    </View>
  );
}

export function BarChart({ title, data = [], labelKey, valueKey, color = COLORS.accent }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <Card>
      <Text style={styles.chartTitle}>{title}</Text>
      {data.length === 0 && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
      {data.slice(0, 8).map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const width = `${Math.max((value / max) * 100, 2)}%`;
        return (
          <View key={`${item[labelKey]}-${index}`} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>{item[labelKey] || "SIN DATO"}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width, backgroundColor: color }]} />
            </View>
            <Text style={styles.barValue}>{formatNumber(value)}</Text>
          </View>
        );
      })}
    </Card>
  );
}

export function LineChart({ title, data = [], labelKey, valueKey }) {
  const values = data.slice(0, 12).map((item) => Number(item[valueKey] || 0));
  const max = Math.max(...values, 1);
  const points = values.map((value) => `${Math.round((value / max) * 100)}%`);

  return (
    <Card>
      <Text style={styles.chartTitle}>{title}</Text>
      {data.length === 0 && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
      {data.length > 0 && (
        <>
          <View style={styles.sparkline}>
            {points.map((height, index) => (
              <View key={index} style={styles.sparkColumn}>
                <View style={[styles.sparkBar, { height }]} />
              </View>
            ))}
          </View>
          <View style={styles.lineLabels}>
            <Text style={styles.lineLabel}>{String(data[0]?.[labelKey] || "").slice(0, 10)}</Text>
            <Text style={styles.lineLabel}>{String(data[data.length - 1]?.[labelKey] || "").slice(0, 10)}</Text>
          </View>
        </>
      )}
    </Card>
  );
}

export function DistributionChart({ title, data = [], labelKey, valueKey }) {
  const total = data.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0) || 1;
  return (
    <Card>
      <Text style={styles.chartTitle}>{title}</Text>
      {data.length === 0 && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
      {data.slice(0, 6).map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const pct = (value / total) * 100;
        return (
          <View key={`${item[labelKey]}-${index}`} style={styles.distRow}>
            <View style={[styles.distDot, { backgroundColor: chartPalette[index % chartPalette.length] }]} />
            <Text style={styles.distLabel} numberOfLines={1}>{item[labelKey] || "SIN DATO"}</Text>
            <Text style={styles.distValue}>{formatNumber(value)} ({pct.toFixed(1)}%)</Text>
          </View>
        );
      })}
    </Card>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

const chartPalette = [COLORS.accent, COLORS.success, COLORS.warning, COLORS.info, COLORS.danger, COLORS.accentLight];

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 14
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12
  },
  horizontalScroll: {
    flex: 1
  },
  horizontalContent: {
    flexGrow: 1
  },
  screenContent: {
    flex: 1,
    width: "100%"
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text
  },
  subtitle: {
    marginTop: 3,
    color: COLORS.muted,
    fontWeight: "600"
  },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10
  },
  kpi: {
    flex: 1,
    minWidth: "47%",
    overflow: "hidden"
  },
  kpiBar: {
    height: 5,
    marginHorizontal: -14,
    marginTop: -14,
    marginBottom: 12
  },
  kpiLabel: {
    color: COLORS.muted,
    fontWeight: "800"
  },
  kpiValue: {
    marginTop: 8,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 25
  },
  button: {
    minHeight: 44,
    borderRadius: 7,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: "900"
  },
  empty: {
    alignItems: "center",
    paddingVertical: 26
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text
  },
  emptySubtitle: {
    marginTop: 4,
    textAlign: "center",
    color: COLORS.muted
  },
  loading: {
    padding: 20,
    alignItems: "center"
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.muted,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border
  },
  rowLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    flex: 1
  },
  rowValue: {
    color: COLORS.text,
    fontWeight: "700",
    flex: 1.2,
    textAlign: "right"
  },
  chartTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 12
  },
  chartEmpty: {
    color: COLORS.muted,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 22
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 9
  },
  barLabel: {
    width: 105,
    color: COLORS.text,
    fontWeight: "700"
  },
  barTrack: {
    flex: 1,
    height: 18,
    backgroundColor: "#E5E1D7",
    borderRadius: 4,
    overflow: "hidden"
  },
  barFill: {
    height: "100%"
  },
  barValue: {
    width: 58,
    textAlign: "right",
    color: COLORS.muted,
    fontWeight: "900"
  },
  sparkline: {
    height: 145,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    paddingTop: 8,
    paddingHorizontal: 4
  },
  sparkColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end"
  },
  sparkBar: {
    minHeight: 3,
    backgroundColor: COLORS.info,
    borderRadius: 4
  },
  lineLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  lineLabel: {
    color: COLORS.muted,
    fontWeight: "700"
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  distDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  distLabel: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800"
  },
  distValue: {
    color: COLORS.muted,
    fontWeight: "900"
  }
});
