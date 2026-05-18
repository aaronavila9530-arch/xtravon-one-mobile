import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

const TABLE_COLUMNS = [
  ["id", "ID", 54],
  ["guia", "Guia", 88],
  ["numero_embarque", "Embarque", 112],
  ["bodega_numero", "Bodega", 82],
  ["empresa", "Empresa", 150],
  ["buque", "Buque", 150],
  ["fecha", "Fecha", 112],
  ["producto", "Producto", 130],
  ["chofer", "Chofer", 150],
  ["placa", "Placa", 96],
  ["estado", "Estado", 112],
  ["lecturas", "Lecturas", 92],
  ["etapa_qr", "Etapa QR", 138],
  ["numero_tolva", "Tolva", 90],
  ["qr_bloqueado", "Bloqueado", 104]
];

const PAGE_SIZE = 40;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [boleta, setBoleta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [manualId, setManualId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [boletas, setBoletas] = useState([]);
  const [operacionActiva, setOperacionActiva] = useState(null);
  const [operacionConsultada, setOperacionConsultada] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrError, setQrError] = useState("");
  const [numeroTolva, setNumeroTolva] = useState("");
  const [crearIssueLog, setCrearIssueLog] = useState(false);
  const [comentarioIssueLog, setComentarioIssueLog] = useState("");
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(boletas.length / PAGE_SIZE));
  const visibleBoletas = useMemo(
    () => boletas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [boletas, page]
  );

  const selectedBoleta = useMemo(
    () => boletas.find((item) => Number(item.id) === Number(selectedId)) || boleta,
    [boletas, selectedId, boleta]
  );

  async function runWithLoading(label, task) {
    setLoading(true);
    setLoadingLabel(label);
    try {
      return await task();
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function buscarOperacionActiva() {
    try {
      await runWithLoading("Consultando operacion activa...", async () => {
        const data = await api.getOperacionActiva();
        setOperacionActiva(data);
        setOperacionConsultada(true);
      });
    } catch (error) {
      setOperacionActiva(null);
      setOperacionConsultada(true);
      Alert.alert("Operacion activa", error.message || "No hay operacion abierta.");
    }
  }

  async function abrirTemplate() {
    const url = api.templateBoletasUrl();
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Template", "No se pudo abrir el enlace del template.");
      return;
    }
    Linking.openURL(url);
  }

  async function cargarExcel() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel"
        ],
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Excel", "No se pudo leer el archivo seleccionado.");
        return;
      }

      await runWithLoading("Cargando datos en la base. Por favor espere...", async () => {
        const localResponse = await fetch(asset.uri);
        const blob = await localResponse.blob();
        const data = await api.cargarExcelBoletasArchivo(blob);
        Alert.alert(
          "Excel cargado",
          `Archivo cargado en base_operaciones_camiones.\n\nInsertados: ${data.insertados || 0}\nOmitidos: ${data.omitidos || 0}\n\nPresione Cargar Tabla para consultar la base.`
        );
      });
    } catch (error) {
      Alert.alert("Cargando Excel", error.message);
    }
  }

  async function cargarTabla() {
    try {
      await runWithLoading("Consultando boletas en la base...", async () => {
        const data = await api.getBoletas();
        setBoletas(Array.isArray(data) ? data : []);
        setBoleta(null);
        setSelectedId(null);
        setPage(0);
      });
    } catch (error) {
      Alert.alert("Cargar Tabla", error.message);
    }
  }

  async function generarQr() {
    try {
      await runWithLoading("Generando codigos QR...", async () => {
        const data = await api.generarQrBoletas();
        Alert.alert(
          "QR generados",
          `QR generados correctamente.\n\nTotal backend: ${data.total_generados || 0}`
        );
      });
    } catch (error) {
      Alert.alert("Generar QR", error.message);
    }
  }

  async function exportarExcel() {
    const url = api.exportarBoletasExcelUrl();
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Exportar Excel", "No se pudo abrir el archivo exportado.");
      return;
    }
    Linking.openURL(url);
  }

  async function loadBoleta(id, token = "") {
    if (!id) return;
    setLoading(true);
    setLoadingLabel("Consultando guia...");
    setQrError("");
    try {
      const data = token ? await api.validarQr(id, token) : await api.getBoleta(id);
      setBoleta(data);
      setSelectedId(data?.id || id);
      setQrToken(token);
      setNumeroTolva(data?.numero_tolva || "");
      setComentarioIssueLog(data?.comentario_issue_log || "");
    } catch (error) {
      setBoleta(null);
      setQrError(error.message || "QR no valido");
      Alert.alert("QR no valido", error.message || "Ese QR no es valido.");
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function onBarcodeScanned({ data }) {
    if (scanned) return;
    setScanned(true);
    const raw = String(data);
    const match = raw.match(/qr\/(\d+)/);
    if (match) {
      let token = "";
      try {
        const url = new URL(raw);
        token = url.searchParams.get("token") || url.searchParams.get("hash") || "";
      } catch (_error) {
        token = "";
      }
      loadBoleta(match[1], token);
    } else {
      setQrError("Ese QR no pertenece a XTRAVON ONE / GRAIN CONTROL.");
      Alert.alert("QR no valido", "Ese QR no pertenece a XTRAVON ONE / GRAIN CONTROL.");
    }
  }

  async function guardarTercerEscaneo() {
    if (!boleta?.id) return;
    if (!qrToken) {
      Alert.alert("QR requerido", "Escanee el QR original para validar el tercer escaneo.");
      return;
    }
    if (!numeroTolva.trim()) {
      Alert.alert("Tolva requerida", "Indique el numero de tolva.");
      return;
    }
    setLoading(true);
    setLoadingLabel("Guardando escaneo...");
    try {
      const result = await api.tercerEscaneo(boleta.id, {
        token: qrToken,
        numero_tolva: numeroTolva.trim(),
        crear_issue_log: crearIssueLog,
        comentario_issue_log: comentarioIssueLog.trim()
      });
      setBoleta(result.registro);
      Alert.alert("Escaneo registrado", result.mensaje || "Guia cerrada correctamente.");
    } catch (error) {
      Alert.alert("No se pudo registrar", error.message);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function verGuiaSeleccionada() {
    if (!selectedBoleta) {
      Alert.alert("Sin seleccion", "Seleccione una guia en la tabla o busque por ID.");
      return;
    }

    Alert.alert(
      `Detalle guia ${selectedBoleta.guia || ""}`,
      [
        `ID: ${selectedBoleta.id || ""}`,
        `Embarque: ${selectedBoleta.numero_embarque || ""}`,
        `Bodega: ${selectedBoleta.bodega_numero || ""}`,
        `Empresa: ${selectedBoleta.empresa || ""}`,
        `Buque: ${selectedBoleta.buque || ""}`,
        `Fecha: ${formatDate(selectedBoleta.fecha)}`,
        `Producto: ${selectedBoleta.producto || ""}`,
        `Chofer: ${selectedBoleta.chofer || ""}`,
        `Placa: ${selectedBoleta.placa || ""}`,
        `Estado: ${selectedBoleta.estado || ""}`,
        `Lecturas: ${selectedBoleta.lecturas ?? ""}`,
        `Etapa QR: ${selectedBoleta.etapa_qr || ""}`,
        `Tolva: ${selectedBoleta.numero_tolva || ""}`,
        `Bloqueado: ${selectedBoleta.qr_bloqueado ? "SI" : "NO"}`
      ].join("\n")
    );
  }

  return (
    <Screen
      title="Carga de Boletas"
      subtitle="Carga el Excel a la base de datos, consulta la tabla, genera QR puros y opera el lector QR."
      minWidth={1180}
    >
      <ScrollView>
        <Card>
          <View style={styles.operationHeader}>
            <Text style={styles.operationText}>
              {operacionActiva
                ? `Operacion activa: ${operacionActiva.codigo_operacion || ""} | ${operacionActiva.nombre_buque || ""} | ${formatDate(operacionActiva.fecha_inicio)}`
                : operacionConsultada
                  ? "Operacion activa: no hay operacion abierta."
                  : "Operacion activa: presione Buscar operacion activa para consultar."}
            </Text>
            <Button label="Buscar operacion activa" icon="search-outline" tone="info" onPress={buscarOperacionActiva} />
          </View>
        </Card>

        <Card>
          <View style={styles.actions}>
            <Button label="Abrir Template" icon="open-outline" tone="info" onPress={abrirTemplate} />
            <Button label="Cargar Excel" icon="cloud-upload-outline" onPress={cargarExcel} />
            <Button label="Cargar Tabla" icon="table-outline" tone="info" onPress={cargarTabla} />
            <Button label="Generar QR" icon="qr-code-outline" onPress={generarQr} />
            <Button label="Ver" icon="eye-outline" tone="info" onPress={verGuiaSeleccionada} />
            <Button label="Exportar Excel" icon="download-outline" tone="info" onPress={exportarExcel} />
          </View>
        </Card>

        {loading && <Loading label={loadingLabel || "Procesando..."} />}

        <Card>
          <Text style={styles.sectionTitle}>Boletas en base_operaciones_camiones</Text>
          {boletas.length === 0 ? (
            <EmptyState title="Tabla sin cargar" subtitle="Presione Cargar Tabla para consultar la base." />
          ) : (
            <>
              <View style={styles.pagination}>
                <Button label="Anterior" icon="chevron-back-outline" tone="info" disabled={page <= 0} onPress={() => setPage((value) => Math.max(value - 1, 0))} />
                <Text style={styles.paginationText}>
                  Pagina {page + 1} de {totalPages} | {boletas.length.toLocaleString()} registros
                </Text>
                <Button label="Siguiente" icon="chevron-forward-outline" tone="info" disabled={page + 1 >= totalPages} onPress={() => setPage((value) => Math.min(value + 1, totalPages - 1))} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tableHeader}>
                    {TABLE_COLUMNS.map(([key, label, width]) => (
                      <Text key={key} style={[styles.th, { width }]}>{label}</Text>
                    ))}
                  </View>
                  {visibleBoletas.map((item) => {
                    const selected = Number(item.id) === Number(selectedId);
                    return (
                      <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setBoleta(item); }} style={[styles.tableRow, selected && styles.tableRowSelected]}>
                        {TABLE_COLUMNS.map(([key, _label, width]) => (
                          <Text key={key} style={[styles.td, { width }]} numberOfLines={1}>
                            {formatCell(item, key)}
                          </Text>
                        ))}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Lector QR operativo</Text>
          {!permission?.granted && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.helper}>Permiso de camara requerido.</Text>
              <Button label="Activar camara" icon="camera-outline" onPress={requestPermission} />
            </View>
          )}

          {permission?.granted && (
            <Card style={{ height: 260, overflow: "hidden", marginTop: 10 }}>
              <CameraView
                style={{ flex: 1 }}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
              />
            </Card>
          )}

          <View style={styles.manualSearch}>
            <TextInput
              placeholder="ID de guia manual"
              placeholderTextColor={COLORS.auxiliary}
              value={manualId}
              onChangeText={setManualId}
              keyboardType="numeric"
              style={styles.input}
            />
            <Button label="Buscar guia" icon="search-outline" onPress={() => loadBoleta(manualId)} />
          </View>
        </Card>

        {!!qrError && (
          <Card style={{ borderColor: COLORS.danger, borderWidth: 2 }}>
            <Text style={{ color: COLORS.danger, fontWeight: "900" }}>{qrError}</Text>
          </Card>
        )}

        {!!boleta && (
          <Card>
            <Text style={styles.sectionTitle}>Guia {boleta.guia}</Text>
            <View style={styles.detailGrid}>
              <Row label="Cliente" value={boleta.empresa} />
              <Row label="Buque" value={boleta.buque} />
              <Row label="Embarque" value={boleta.numero_embarque || ""} />
              <Row label="Bodega" value={boleta.bodega_numero || ""} />
              <Row label="Producto" value={boleta.producto} />
              <Row label="Chofer" value={boleta.chofer} />
              <Row label="Placa" value={boleta.placa} />
              <Row label="Estado" value={boleta.estado} />
              <Row label="Lecturas" value={String(boleta.lecturas)} />
              <Row label="Etapa QR" value={boleta.etapa_qr} />
              <Row label="Peso vacio" value={formatNumber(boleta.peso_vacio)} />
              <Row label="Peso lleno" value={formatNumber(boleta.peso_lleno)} />
              <Row label="Tolva" value={boleta.numero_tolva || ""} />
            </View>

            {Number(boleta.lecturas || 0) >= 3 && (
              <Card style={{ backgroundColor: COLORS.elevated, borderColor: COLORS.warning }}>
                <Text style={{ color: COLORS.warning, fontWeight: "900" }}>Esta guia ya cumplio la cantidad de escaneos.</Text>
              </Card>
            )}
            {Number(boleta.lecturas || 0) === 2 && (
              <Card>
                <Text style={styles.sectionTitle}>Tercer escaneo</Text>
                <TextInput
                  placeholder="Numero de tolva"
                  placeholderTextColor={COLORS.auxiliary}
                  value={numeroTolva}
                  onChangeText={setNumeroTolva}
                  style={styles.input}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.helper}>Agregar comentario a SOF</Text>
                  <Switch value={crearIssueLog} onValueChange={setCrearIssueLog} />
                </View>
                <TextInput
                  placeholder="Comentario SOF"
                  placeholderTextColor={COLORS.auxiliary}
                  value={comentarioIssueLog}
                  onChangeText={setComentarioIssueLog}
                  multiline
                  style={[styles.input, { minHeight: 90 }]}
                />
                <Button label="Guardar tercer escaneo" icon="checkmark-circle-outline" onPress={guardarTercerEscaneo} />
              </Card>
            )}
            <Button label="Escanear otra" icon="refresh-outline" tone="info" onPress={() => { setScanned(false); setBoleta(null); setQrToken(""); setQrError(""); }} />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function formatDate(value) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 19);
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number === 0) return "";
  return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCell(item, key) {
  if (key === "fecha") return formatDate(item[key]);
  if (key === "qr_bloqueado") return item[key] ? "SI" : "NO";
  return item[key] ?? "";
}

const styles = StyleSheet.create({
  operationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  operationText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12
  },
  helper: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 10
  },
  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    padding: 12,
    marginBottom: 10
  },
  manualSearch: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.accent
  },
  th: {
    color: COLORS.bg,
    fontWeight: "900",
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: "center"
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: COLORS.bg
  },
  tableRowSelected: {
    backgroundColor: COLORS.elevated
  },
  td: {
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    textAlign: "center"
  },
  detailGrid: {
    gap: 2
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10
  },
  paginationText: {
    color: COLORS.text,
    fontWeight: "900",
    flex: 1,
    textAlign: "center"
  }
});
