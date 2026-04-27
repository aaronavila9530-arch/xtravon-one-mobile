import React, { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function AprobacionesScreen({ session }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [comentario, setComentario] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.getAprobacionesPendientes();
      setItems(data.data || []);
      setSelected({});
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cargarTemplate() {
    setLoading(true);
    try {
      const data = await api.cargarAprobacionesTemplate();
      Alert.alert("Carga completada", `Insertados: ${data.insertados}\nOmitidos: ${data.omitidos}`);
      await load();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function aplicar(accion) {
    const ids = Object.keys(selected).map((id) => Number(id));
    if (!ids.length) {
      Alert.alert("Seleccione registros", "Marque al menos una guia.");
      return;
    }
    try {
      if (accion === "APPROVED") {
        await api.aprobar(ids, comentario, session?.nombre);
      } else {
        await api.rechazar(ids, comentario, session?.nombre);
      }
      setComentario("");
      await load();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  }

  function toggle(id) {
    setSelected((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  return (
    <Screen title="Aprobaciones" subtitle="Documentos pendientes" right={<Button label="Ver" icon="list-outline" onPress={load} />} minWidth={560}>
      <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", gap: 8, minWidth: 540 }}>
          <Button label="Cargar template" icon="cloud-upload-outline" onPress={cargarTemplate} />
          <Button label="Aprobar" icon="checkmark-outline" tone="success" onPress={() => aplicar("APPROVED")} />
          <Button label="Rechazar" icon="close-outline" tone="danger" onPress={() => aplicar("REJECTED")} />
        </View>
      </ScrollView>

      <TextInput
        placeholder="Comentario de aprobacion/rechazo"
        value={comentario}
        onChangeText={setComentario}
        style={{ backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 7, padding: 12, marginBottom: 10 }}
      />

      {loading && <Loading />}
      {!loading && items.length === 0 && <EmptyState title="Sin pendientes" subtitle="Presione Ver para consultar pendientes." />}
      <ScrollView>
        {items.map((item) => (
          <Card key={item.id} style={{ borderColor: selected[item.id] ? COLORS.success : COLORS.border }}>
            <Text onPress={() => toggle(item.id)} style={{ fontWeight: "900", color: selected[item.id] ? COLORS.success : COLORS.text }}>
              {selected[item.id] ? "[X]" : "[ ]"} Guia {item.guia}
            </Text>
            <Row label="Cliente" value={item.empresa} />
            <Row label="Buque" value={item.buque} />
            <Row label="Producto" value={item.producto} />
            <Row label="Placa" value={item.placa} />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
