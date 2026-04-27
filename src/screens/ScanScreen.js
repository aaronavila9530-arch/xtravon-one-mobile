import React, { useState } from "react";
import { Alert, ScrollView, Text, TextInput } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [boleta, setBoleta] = useState(null);
  const [manualId, setManualId] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadBoleta(id) {
    if (!id) return;
    setLoading(true);
    try {
      setBoleta(await api.getBoleta(id));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  function onBarcodeScanned({ data }) {
    if (scanned) return;
    setScanned(true);
    const match = String(data).match(/qr\/(\d+)/);
    if (match) {
      loadBoleta(match[1]);
    } else {
      Alert.alert("QR leido", data);
    }
  }

  return (
    <Screen title="Escaneo QR" subtitle="Trazabilidad de ingreso/salida">
      {!permission?.granted && (
        <Card>
          <Text style={{ color: COLORS.text, fontWeight: "800", marginBottom: 10 }}>Permiso de camara requerido.</Text>
          <Button label="Activar camara" icon="camera-outline" onPress={requestPermission} />
        </Card>
      )}

      {permission?.granted && (
        <Card style={{ height: 260, overflow: "hidden" }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
          />
        </Card>
      )}

      <Card>
        <TextInput
          placeholder="ID de guia manual"
          value={manualId}
          onChangeText={setManualId}
          keyboardType="numeric"
          style={{ backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 7, padding: 12, marginBottom: 10 }}
        />
        <Button label="Buscar guia" icon="search-outline" onPress={() => loadBoleta(manualId)} />
      </Card>

      {loading && <Loading />}
      {!loading && !boleta && <EmptyState title="Sin guia cargada" subtitle="Escanee un QR o busque por ID." />}
      {!!boleta && (
        <ScrollView>
          <Card>
            <Text style={{ fontWeight: "900", color: COLORS.text, fontSize: 16 }}>Guia {boleta.guia}</Text>
            <Row label="Cliente" value={boleta.empresa} />
            <Row label="Buque" value={boleta.buque} />
            <Row label="Producto" value={boleta.producto} />
            <Row label="Chofer" value={boleta.chofer} />
            <Row label="Placa" value={boleta.placa} />
            <Row label="Estado" value={boleta.estado} />
            <Row label="Lecturas" value={String(boleta.lecturas)} />
            <Row label="Peso vacio" value={boleta.peso_vacio ? String(boleta.peso_vacio) : ""} />
            <Row label="Peso lleno" value={boleta.peso_lleno ? String(boleta.peso_lleno) : ""} />
            <Button label="Escanear otra" icon="refresh-outline" tone="info" onPress={() => { setScanned(false); setBoleta(null); }} />
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}
