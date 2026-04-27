import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { BarChart, Button, DistributionChart, EmptyState, Kpi, LineChart, Loading, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setData(await api.getDashboard());
    } catch (error) {
      setData({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  const kpis = data?.kpis || {};
  const graficos = data?.graficos || {};

  return (
    <Screen
      title="Dashboard"
      subtitle="KPIs y graficos operativos bajo demanda"
      right={<Button label="Cargar" icon="refresh-outline" onPress={load} />}
      minWidth={520}
    >
      {loading && <Loading />}
      {!loading && !data && <EmptyState title="Sin data cargada" subtitle="Presione Cargar para consultar el backend." />}
      {!loading && data?.error && <EmptyState title="No se pudo cargar" subtitle={data.error} icon="alert-circle-outline" />}
      {!loading && data && !data.error && (
        <ScrollView>
          <View style={styles.grid}>
            <Kpi label="Viajes" value={kpis.total_viajes} />
            <Kpi label="Completos" value={kpis.viajes_completos} tone="success" />
            <Kpi label="Pendientes" value={kpis.viajes_pendientes} tone="warning" />
            <Kpi label="QR bloqueados" value={kpis.qr_bloqueados} tone="danger" />
          </View>

          <BarChart
            title="Viajes por producto"
            data={graficos.barras_viajes_por_producto || []}
            labelKey="producto"
            valueKey="viajes"
            color={COLORS.accent}
          />

          <BarChart
            title="Peso por producto"
            data={graficos.barras_peso_por_producto || []}
            labelKey="producto"
            valueKey="peso_cargado"
            color={COLORS.success}
          />

          <LineChart
            title="Tendencia por fecha"
            data={graficos.lineal_tendencia_por_fecha || []}
            labelKey="fecha"
            valueKey="viajes"
          />

          <DistributionChart
            title="Estado operativo"
            data={graficos.circular_estado_operativo || []}
            labelKey="estado"
            valueKey="viajes"
          />

          <DistributionChart
            title="Estado de escaneos"
            data={graficos.circular_estado_escaneos || []}
            labelKey="etapa"
            valueKey="viajes"
          />

          <BarChart
            title="Viajes por cliente"
            data={graficos.barras_viajes_por_cliente || []}
            labelKey="cliente"
            valueKey="viajes"
            color={COLORS.info}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  }
});
