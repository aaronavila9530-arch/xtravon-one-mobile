import React, { useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function ClienteScreen({ session }) {
  const [loading, setLoading] = useState(false);
  const [operacion, setOperacion] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const activa = await api.getOperacionActiva();
      if (!activa.operacion) {
        setOperacion(null);
        Alert.alert("Sin operacion", "No hay operacion abierta.");
        return;
      }
      setOperacion(await api.getOperacionDetalle(activa.operacion.id));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Portal Cliente" subtitle="Cuotas, retiros e informes" right={<Button label="Cargar" icon="refresh-outline" onPress={load} />}>
      {loading && <Loading />}
      {!loading && !operacion && <EmptyState title="Sin informacion" subtitle="Presione Cargar para consultar operacion activa." />}
      {!!operacion && (
        <ScrollView>
          <Card>
            <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "900" }}>{operacion.operacion?.nombre_buque}</Text>
            <Row label="Cliente" value={session?.nombre} />
            <Row label="Estado" value={operacion.operacion?.estado} />
            <Row label="Guias" value={String(operacion.resumen?.total_registros || 0)} />
            <Row label="Peso cargado" value={String(operacion.resumen?.peso_cargado || 0)} />
          </Card>
          {(operacion.cuotas || []).map((cuota) => (
            <Card key={cuota.id}>
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>{cuota.cliente}</Text>
              <Row label="Cuota" value={`${cuota.cuota} ${cuota.unidad}`} />
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
