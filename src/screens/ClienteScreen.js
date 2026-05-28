import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { BarChart, Button, Card, DistributionChart, EmptyState, Kpi, LineChart, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function ClienteScreen({ session }) {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [operaciones, setOperaciones] = useState([]);
  const [selectedOperacionId, setSelectedOperacionId] = useState(null);
  const [operacion, setOperacion] = useState(null);
  const [informe, setInforme] = useState(null);

  const selectedOperacion = useMemo(
    () => operaciones.find((item) => Number(item.id) === Number(selectedOperacionId)),
    [operaciones, selectedOperacionId]
  );

  async function run(label, task) {
    setLoading(true);
    setLoadingLabel(label);
    try {
      return await task();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function cargarOperaciones() {
    await run("Buscando operaciones...", async () => {
      const rows = await api.getOperaciones();
      const data = Array.isArray(rows?.data) ? rows.data : [];
      setOperaciones(data);
      if (!selectedOperacionId && data.length > 0) {
        setSelectedOperacionId(data[0].id);
      }
    });
  }

  async function verInformeCliente() {
    if (!selectedOperacionId) {
      Alert.alert("Sin operacion", "Seleccione una operacion.");
      return;
    }
    await run("Generando vista cliente...", async () => {
      const [detalle, reporte] = await Promise.all([
        api.getOperacionDetalle(selectedOperacionId),
        api.getReporteBuque(selectedOperacionId, { tipo_reporte: "cuotas" })
      ]);
      setOperacion(detalle);
      setInforme(reporte);
    });
  }

  return (
    <Screen
      title="Portal Cliente"
      subtitle="Cuotas, descargado, pendientes e informes visuales."
      minWidth={980}
    >
      <ScrollView>
        <Card>
          <View style={styles.actions}>
            <Button label="Buscar operaciones" icon="search-outline" onPress={cargarOperaciones} />
            <Button label="Ver informe cliente" icon="analytics-outline" tone="info" onPress={verInformeCliente} />
          </View>
          {loading && <Loading label={loadingLabel || "Procesando..."} />}
          {!loading && operaciones.length === 0 && (
            <EmptyState title="Sin informacion" subtitle="Presione Buscar operaciones. El portal no consulta datos automaticamente." />
          )}
          {operaciones.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={styles.operationList}>
                {operaciones.map((op) => {
                  const selected = Number(op.id) === Number(selectedOperacionId);
                  return (
                    <Pressable
                      key={op.id}
                      style={[styles.operationChip, selected && styles.operationChipSelected]}
                      onPress={() => {
                        setSelectedOperacionId(op.id);
                        setOperacion(null);
                        setInforme(null);
                      }}
                    >
                      <Text style={[styles.operationChipText, selected && styles.operationChipTextSelected]}>
                        {op.nombre_buque || "SIN BUQUE"} | {op.estado || ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </Card>

        {!!selectedOperacion && (
          <Card>
            <Text style={styles.sectionTitle}>Operacion seleccionada</Text>
            <Row label="Buque" value={selectedOperacion.nombre_buque} />
            <Row label="Inicio" value={formatDate(selectedOperacion.fecha_inicio)} />
            <Row label="Estado" value={selectedOperacion.estado} />
            <Row label="Cliente" value={session?.nombre} />
          </Card>
        )}

        {!!operacion && (
          <>
            <View style={styles.kpiGrid}>
              <Kpi label="Guias" value={formatNumber(operacion.resumen?.total_registros, 0)} />
              <Kpi label="Descargado MT" value={formatNumber(informe?.resumen?.retirado_mt || operacion.resumen?.peso_cargado)} tone="info" />
              <Kpi label="Pendiente MT" value={formatNumber(informe?.resumen?.faltante_mt)} tone="warning" />
              <Kpi label="Avance" value={`${formatNumber(informe?.resumen?.avance_pct)}%`} tone="success" />
            </View>

            <View style={styles.chartGrid}>
              <BarChart title="Cuota vs descargado por cliente" data={informe?.clientes || []} labelKey="empresa" valueKey="retirado_mt" />
              <BarChart title="Pendiente por cliente" data={informe?.clientes || []} labelKey="empresa" valueKey="faltante_mt" color={COLORS.warning} />
              <BarChart title="Descargado por producto" data={informe?.graficos?.retiro_por_producto || []} labelKey="producto" valueKey="retirado_mt" />
              <BarChart title="Descargado por bodega" data={informe?.graficos?.avance_bodegas || []} labelKey="bodega" valueKey="retirado_mt" color={COLORS.teal} />
              <DistributionChart title="Estado de descarga" data={informe?.graficos?.estado_descarga || []} labelKey="estado" valueKey="valor" />
              <LineChart title="Tendencia diaria" data={informe?.graficos?.tendencia_fecha || []} labelKey="fecha" valueKey="retirado_mt" />
            </View>

            {(operacion.cuotas || []).map((cuota) => (
              <Card key={cuota.id}>
                <Text style={styles.sectionTitle}>{cuota.cliente}</Text>
                <Row label="Cuota" value={`${formatNumber(cuota.cuota)} ${cuota.unidad}`} />
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function formatNumber(value, decimals = 2) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "-";
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  operationList: {
    flexDirection: "row",
    gap: 8
  },
  operationChip: {
    backgroundColor: COLORS.elevated,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8
  },
  operationChipSelected: {
    backgroundColor: COLORS.accent
  },
  operationChipText: {
    color: COLORS.text,
    fontWeight: "900"
  },
  operationChipTextSelected: {
    color: COLORS.bg
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10
  },
  chartGrid: {
    gap: 10
  }
});
