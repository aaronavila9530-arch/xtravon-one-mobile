import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, EmptyState, Kpi, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function InformesScreen() {
  const [loading, setLoading] = useState(false);
  const [operaciones, setOperaciones] = useState([]);
  const [informe, setInforme] = useState(null);

  async function loadOperaciones() {
    setLoading(true);
    try {
      const data = await api.getOperaciones();
      setOperaciones(data.data || []);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadInforme(id) {
    setLoading(true);
    try {
      setInforme(await api.getInformeOperacion(id));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  const kpis = informe?.kpis || {};

  return (
    <Screen title="Informes" subtitle="Resumen por buque" right={<Button label="Buscar" icon="search-outline" onPress={loadOperaciones} />}>
      {loading && <Loading />}
      {!loading && operaciones.length === 0 && <EmptyState title="Sin operaciones" subtitle="Presione Buscar para cargar buques." />}
      <ScrollView>
        {operaciones.map((op) => (
          <Card key={op.id}>
            <Text style={{ fontWeight: "900", color: COLORS.text, fontSize: 16 }}>{op.nombre_buque}</Text>
            <Row label="Codigo" value={op.codigo_operacion} />
            <Row label="Inicio" value={op.fecha_inicio} />
            <Row label="Estado" value={op.estado} />
            <View style={{ marginTop: 10 }}>
              <Button label="Ver informe" icon="document-text-outline" tone="info" onPress={() => loadInforme(op.id)} />
            </View>
          </Card>
        ))}

        {!!informe && (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Kpi label="Guias" value={kpis.total_guias} />
              <Kpi label="Retirado KG" value={Number(kpis.retirado_kg || 0).toLocaleString()} tone="info" />
              <Kpi label="Pendientes" value={kpis.pendientes} tone="warning" />
              <Kpi label="Alertas" value={kpis.alertas} tone="danger" />
            </View>
            <Card>
              <Text style={{ fontWeight: "900", color: COLORS.text, marginBottom: 8 }}>Cuota vs retiro</Text>
              {(informe.cuotas_vs_retiro || []).map((row, idx) => (
                <Row
                  key={`${row.cliente}-${row.producto}-${idx}`}
                  label={`${row.cliente} / ${row.producto}`}
                  value={`${Number(row.retirado_kg || 0).toLocaleString()} / ${Number(row.cuota_kg || 0).toLocaleString()} KG`}
                />
              ))}
            </Card>
            <Card>
              <Text style={{ fontWeight: "900", color: COLORS.text, marginBottom: 8 }}>Alertas</Text>
              {(informe.alertas || []).map((alerta, idx) => (
                <Row key={idx} label={alerta.tipo} value={alerta.mensaje} />
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
