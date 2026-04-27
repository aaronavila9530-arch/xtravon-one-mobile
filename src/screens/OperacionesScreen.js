import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function OperacionesScreen() {
  const [loading, setLoading] = useState(false);
  const [operaciones, setOperaciones] = useState([]);
  const [detalle, setDetalle] = useState(null);

  async function load() {
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

  async function openDetalle(id) {
    setLoading(true);
    try {
      setDetalle(await api.getOperacionDetalle(id));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cerrar(id) {
    try {
      await api.cerrarOperacion(id);
      await load();
      Alert.alert("Operacion cerrada", "La operacion fue archivada.");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  }

  return (
    <Screen title="Operaciones de Buque" subtitle="Abra, consulte y archive operaciones" right={<Button label="Buscar" icon="search-outline" onPress={load} />}>
      {loading && <Loading />}
      {!loading && operaciones.length === 0 && <EmptyState title="Sin operaciones" subtitle="Presione Buscar para cargar operaciones." />}
      <ScrollView>
        {operaciones.map((op) => (
          <Card key={op.id}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: COLORS.text }}>{op.nombre_buque}</Text>
            <Row label="Codigo" value={op.codigo_operacion} />
            <Row label="Inicio" value={op.fecha_inicio} />
            <Row label="Producto" value={op.producto} />
            <Row label="Estado" value={op.estado} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button label="Detalle" icon="eye-outline" tone="info" onPress={() => openDetalle(op.id)} />
              {op.estado === "ABIERTA" && <Button label="Cerrar" icon="archive-outline" tone="danger" onPress={() => cerrar(op.id)} />}
            </View>
          </Card>
        ))}

        {!!detalle && (
          <Card>
            <Text style={{ fontWeight: "900", fontSize: 16, color: COLORS.text }}>Cuotas</Text>
            {(detalle.cuotas || []).map((cuota) => (
              <Row key={cuota.id} label={cuota.cliente} value={`${cuota.cuota} ${cuota.unidad}`} />
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
