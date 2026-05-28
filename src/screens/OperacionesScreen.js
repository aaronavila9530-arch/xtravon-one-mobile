import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

const EMPTY_BODEGAS = [
  { capacidad: "", particiones: [] },
  { capacidad: "", particiones: [] },
  { capacidad: "", particiones: [] },
  { capacidad: "", particiones: [] },
  { capacidad: "", particiones: [] }
];

const EMPTY_CUOTA = { cliente: "", cuota: "", unidad: "KG" };
const BODEGA_COLORS = [COLORS.teal, COLORS.info, COLORS.accentLight, COLORS.success, COLORS.accent];

export default function OperacionesScreen({ initialMode = "crear" }) {
  const [loading, setLoading] = useState(false);
  const [operaciones, setOperaciones] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [reporte, setReporte] = useState(null);
  const [mode, setMode] = useState(initialMode);
  const [selectedOperacionId, setSelectedOperacionId] = useState(null);

  const [buque, setBuque] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [productos, setProductos] = useState([""]);
  const [bodegas, setBodegas] = useState(cloneBodegas());
  const [cuotasIniciales, setCuotasIniciales] = useState([]);
  const [cuotaInicialForm, setCuotaInicialForm] = useState({ ...EMPTY_CUOTA });

  const [cuotaRows, setCuotaRows] = useState([{ ...EMPTY_CUOTA }]);
  const [cuotasActivas, setCuotasActivas] = useState([]);
  const [cuotaEditId, setCuotaEditId] = useState(null);

  const selectedOperacion = useMemo(
    () => operaciones.find((op) => Number(op.id) === Number(selectedOperacionId)) || null,
    [operaciones, selectedOperacionId]
  );
  const historialOnly = initialMode === "historial";

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getOperaciones();
      const rows = data.data || [];
      setOperaciones(rows);
      if (!selectedOperacionId && rows.length) {
        const abierta = rows.find((op) => op.estado === "ABIERTA") || rows[0];
        setSelectedOperacionId(abierta.id);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function openDetalle(id) {
    setLoading(true);
    try {
      const [data, reporteData] = await Promise.all([
        api.getOperacionDetalle(id),
        api.getReporteBuque(id).catch(() => null)
      ]);
      setDetalle(data);
      setReporte(reporteData);
      setSelectedOperacionId(id);
      setMode("historial");
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

  async function reabrir(id) {
    try {
      await api.reabrirOperacion(id);
      await load();
      Alert.alert("Operacion reabierta", "La operacion quedo activa.");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  }

  function updateProducto(index, value) {
    setProductos((current) => current.map((item, idx) => (idx === index ? value : item)));
  }

  function agregarProducto() {
    if (productos.length >= 5) {
      Alert.alert("Limite", "Puede agregar hasta 5 productos.");
      return;
    }
    setProductos((current) => [...current, ""]);
  }

  function quitarProducto() {
    setProductos((current) => (current.length <= 1 ? [""] : current.slice(0, -1)));
  }

  function updateBodega(index, value) {
    setBodegas((current) => current.map((item, idx) => (idx === index ? { ...item, capacidad: value } : item)));
  }

  function agregarParticionBodega(index) {
    setBodegas((current) => current.map((item, idx) => {
      if (idx !== index) {
        return item;
      }
      if ((item.particiones || []).length >= 3) {
        Alert.alert("Limite", "Puede agregar hasta 3 particiones por bodega.");
        return item;
      }
      return { ...item, particiones: [...(item.particiones || []), ""] };
    }));
  }

  function quitarParticionBodega(index) {
    setBodegas((current) => current.map((item, idx) => (
      idx === index ? { ...item, particiones: (item.particiones || []).slice(0, -1) } : item
    )));
  }

  function updateParticionBodega(bodegaIndex, particionIndex, value) {
    setBodegas((current) => current.map((item, idx) => {
      if (idx !== bodegaIndex) {
        return item;
      }
      return {
        ...item,
        particiones: (item.particiones || []).map((part, pidx) => (pidx === particionIndex ? value : part))
      };
    }));
  }

  function agregarCuotaInicial() {
    const nueva = limpiarCuota(cuotaInicialForm);
    if (!nueva) {
      Alert.alert("Dato requerido", "Indique cliente y cuota.");
      return;
    }
    setCuotasIniciales((current) => [...current, nueva]);
    setCuotaInicialForm({ ...EMPTY_CUOTA });
  }

  function quitarCuotaInicial(index) {
    setCuotasIniciales((current) => current.filter((_item, idx) => idx !== index));
  }

  async function abrirOperacion() {
    const cleanProductos = productos.map((item) => item.trim()).filter(Boolean);
    if (!buque.trim()) {
      Alert.alert("Dato requerido", "Indique el nombre del buque.");
      return;
    }
    if (!fechaInicio.trim()) {
      Alert.alert("Dato requerido", "Indique fecha inicio YYYY-MM-DD.");
      return;
    }
    if (!cleanProductos.length) {
      Alert.alert("Dato requerido", "Agregue al menos un producto.");
      return;
    }

    const bodegasPayload = bodegas.map((item, index) => ({
      bodega_numero: index + 1,
      capacidad_mt: toNumber(item.capacidad),
      particiones: (item.particiones || [])
        .map((valor) => toNumber(valor))
        .filter((valor) => valor > 0)
        .map((valor) => ({ capacidad_mt: valor }))
    }));

    if (!bodegasPayload.some((item) => item.capacidad_mt > 0)) {
      Alert.alert("Dato requerido", "Indique al menos una capacidad por bodega.");
      return;
    }

    setLoading(true);
    try {
      await api.crearOperacion({
        nombre_buque: buque.trim(),
        fecha_inicio: fechaInicio.trim(),
        producto: cleanProductos.join(" / "),
        cerrar_operaciones_abiertas: true,
        cuotas: cuotasIniciales,
        bodegas: bodegasPayload
      });
      limpiarFormularioOperacion();
      Alert.alert("Operacion abierta", "La operacion fue creada correctamente.");
      await load();
      setMode("historial");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  function limpiarFormularioOperacion() {
    setBuque("");
    setFechaInicio("");
    setProductos([""]);
    setBodegas(cloneBodegas());
    setCuotasIniciales([]);
    setCuotaInicialForm({ ...EMPTY_CUOTA });
  }

  function agregarLineaCuota() {
    setCuotaRows((current) => [...current, { ...EMPTY_CUOTA }]);
  }

  function quitarLineaCuota(index) {
    setCuotaRows((current) => (current.length <= 1 ? [{ ...EMPTY_CUOTA }] : current.filter((_item, idx) => idx !== index)));
  }

  function updateCuotaRow(index, field, value) {
    setCuotaRows((current) => current.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  }

  async function crearCuotas() {
    if (!selectedOperacionId) {
      Alert.alert("Sin operacion", "Seleccione una operacion para asignar cuotas.");
      return;
    }
    const rows = cuotaRows.map(limpiarCuota).filter(Boolean);
    if (!rows.length) {
      Alert.alert("Dato requerido", "Agregue al menos una cuota valida.");
      return;
    }

    setLoading(true);
    try {
      for (const row of rows) {
        await api.crearCuotaOperacion({ ...row, operacion_id: selectedOperacionId });
      }
      setCuotaRows([{ ...EMPTY_CUOTA }]);
      await cargarCuotasActivas();
      Alert.alert("Cuotas creadas", "Las cuotas fueron vinculadas a la operacion seleccionada.");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cargarCuotasActivas() {
    if (!selectedOperacionId) {
      Alert.alert("Sin operacion", "Seleccione una operacion.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.getCuotasOperacion(selectedOperacionId);
      setCuotasActivas(data.data || []);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  function editarCuota(cuota) {
    setCuotaEditId(cuota.id);
    setCuotaRows([{
      cliente: cuota.cliente || "",
      cuota: String(cuota.cuota ?? ""),
      unidad: cuota.unidad || "KG"
    }]);
  }

  async function guardarEdicionCuota() {
    if (!cuotaEditId) {
      Alert.alert("Sin seleccion", "Seleccione una cuota para editar.");
      return;
    }
    const row = limpiarCuota(cuotaRows[0]);
    if (!row) {
      Alert.alert("Dato requerido", "Indique cliente y cuota.");
      return;
    }
    setLoading(true);
    try {
      await api.actualizarCuotaOperacion(cuotaEditId, row);
      setCuotaEditId(null);
      setCuotaRows([{ ...EMPTY_CUOTA }]);
      await cargarCuotasActivas();
      Alert.alert("Cuota actualizada", "La cuota fue actualizada correctamente.");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function eliminarCuota(id) {
    setLoading(true);
    try {
      await api.eliminarCuotaOperacion(id);
      await cargarCuotasActivas();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function descargarReporteHistorial(formato) {
    if (!detalle?.id) {
      Alert.alert("Sin operacion", "Seleccione una operacion del historial.");
      return;
    }
    setLoading(true);
    try {
      const extension = formato === "excel" ? "xlsx" : formato;
      const mimeType = formato === "excel"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
      const url = api.reporteBuqueDownloadUrl(detalle.id, formato);
      const fileUri = `${FileSystem.cacheDirectory}XTRAVON_historial_operacion_${detalle.id}.${extension}`;
      const result = await FileSystem.downloadAsync(url, fileUri);
      if (!result?.uri) {
        throw new Error("No se pudo descargar el reporte.");
      }

      if (Platform.OS === "android") {
        try {
          const IntentLauncher = require("expo-intent-launcher");
          const contentUri = await FileSystem.getContentUriAsync(result.uri);
          await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
            data: contentUri,
            type: mimeType,
            flags: 1
          });
          return;
        } catch (_openError) {
          // Respaldo: abrir selector nativo si no hay app directa para el formato.
        }
      }

      const Sharing = require("expo-sharing");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: `Abrir reporte ${formato.toUpperCase()}` });
        return;
      }
      await Linking.openURL(result.uri);
    } catch (error) {
      Alert.alert("Exportar historial", error.message || "No se pudo abrir el reporte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title={historialOnly ? "Historial de Buques" : "Operaciones de Buque"}
      subtitle={historialOnly ? "Consulte operaciones abiertas/cerradas, cierre o reabra operaciones y revise el detalle operativo." : "Apertura, bodegas, particiones, cuotas e historial"}
      right={<Button label={historialOnly ? "Buscar operaciones" : "Buscar"} icon="search-outline" onPress={load} />}
      horizontal={false}
    >
      {!historialOnly && (
        <View style={styles.tabs}>
          <Button label="Abrir operacion" icon="add-circle-outline" tone={mode === "crear" ? "accent" : "info"} onPress={() => setMode("crear")} />
          <Button label="Cuotas" icon="wallet-outline" tone={mode === "cuotas" ? "accent" : "info"} onPress={() => setMode("cuotas")} />
          <Button label="Historial" icon="list-outline" tone={mode === "historial" ? "accent" : "info"} onPress={() => setMode("historial")} />
        </View>
      )}

      {loading && <Loading />}
      <ScrollView>
        {mode === "crear" && (
          <Card>
            <Text style={styles.sectionTitle}>Nueva operacion</Text>
            <Field label="Buque" value={buque} onChangeText={setBuque} placeholder="MV Great 61" />
            <Field label="Fecha inicio" value={fechaInicio} onChangeText={setFechaInicio} placeholder="YYYY-MM-DD" />

            <Text style={styles.blockTitle}>Productos</Text>
            {productos.map((producto, index) => (
              <Field key={index} label={`Producto ${index + 1}`} value={producto} onChangeText={(value) => updateProducto(index, value)} placeholder="Maiz / DDGS / Frijol de Soya" />
            ))}
            <View style={styles.rowActions}>
              <Button label="+" icon="add-outline" onPress={agregarProducto} />
              <Button label="-" icon="remove-outline" tone="danger" onPress={quitarProducto} />
            </View>

            <Text style={styles.blockTitle}>Capacidad por bodega (MT)</Text>
            <ShipPreview bodegas={bodegas} />
            {bodegas.map((item, index) => (
              <Card key={`bodega-${index}`} style={styles.bodegaCard}>
                <Field label={`Bodega ${index + 1}`} value={item.capacidad} onChangeText={(value) => updateBodega(index, value)} placeholder="0.00" keyboardType="numeric" />
                {(item.particiones || []).map((particion, pidx) => (
                  <Field
                    key={`bodega-${index}-part-${pidx}`}
                    label={`Particion ${pidx + 1} MT`}
                    value={particion}
                    onChangeText={(value) => updateParticionBodega(index, pidx, value)}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                ))}
                <View style={styles.rowActions}>
                  <Button label="+" icon="add-outline" onPress={() => agregarParticionBodega(index)} />
                  <Button label="-" icon="remove-outline" tone="danger" onPress={() => quitarParticionBodega(index)} />
                </View>
              </Card>
            ))}

            <Text style={styles.blockTitle}>Cuotas iniciales por cliente</Text>
            <QuotaFields value={cuotaInicialForm} onChange={setCuotaInicialForm} />
            <Button label="Agregar cuota inicial" icon="add-outline" tone="success" onPress={agregarCuotaInicial} />
            {cuotasIniciales.map((item, index) => (
              <Card key={`${item.cliente}-${index}`} style={styles.compactCard}>
                <Row label={item.cliente} value={`${formatNumber(item.cuota)} ${item.unidad}`} />
                <Button label="Eliminar" icon="trash-outline" tone="danger" onPress={() => quitarCuotaInicial(index)} />
              </Card>
            ))}

            <View style={styles.finalActions}>
              <Button label="Abrir operacion" icon="boat-outline" onPress={abrirOperacion} />
              <Button label="Limpiar" icon="refresh-outline" tone="info" onPress={limpiarFormularioOperacion} />
            </View>
          </Card>
        )}

        {mode === "cuotas" && (
          <Card>
            <Text style={styles.sectionTitle}>Cuotas por operacion</Text>
            <Button label="Cargar operaciones" icon="download-outline" tone="info" onPress={load} />
            <OperationSelector operaciones={operaciones} selectedId={selectedOperacionId} onSelect={setSelectedOperacionId} />
            {!!selectedOperacion && <Row label="Operacion seleccionada" value={`${selectedOperacion.nombre_buque} | ${selectedOperacion.fecha_inicio} | ${selectedOperacion.estado}`} />}

            <Text style={styles.blockTitle}>{cuotaEditId ? "Editar cuota" : "Nuevas cuotas"}</Text>
            {cuotaRows.map((row, index) => (
              <Card key={`cuota-row-${index}`} style={styles.compactCard}>
                <QuotaFields value={row} onChange={(next) => updateCuotaRow(index, "replace", next)} index={index} setField={updateCuotaRow} />
                {!cuotaEditId && <Button label="Quitar linea" icon="remove-outline" tone="danger" onPress={() => quitarLineaCuota(index)} />}
              </Card>
            ))}
            <View style={styles.rowActions}>
              {!cuotaEditId && <Button label="+" icon="add-outline" onPress={agregarLineaCuota} />}
              {!cuotaEditId && <Button label="Crear cuotas" icon="save-outline" tone="success" onPress={crearCuotas} />}
              {!!cuotaEditId && <Button label="Guardar edicion" icon="save-outline" tone="success" onPress={guardarEdicionCuota} />}
              {!!cuotaEditId && <Button label="Cancelar" icon="close-outline" tone="info" onPress={() => { setCuotaEditId(null); setCuotaRows([{ ...EMPTY_CUOTA }]); }} />}
              <Button label="Cargar cuotas" icon="list-outline" tone="info" onPress={cargarCuotasActivas} />
            </View>

            {cuotasActivas.map((item) => (
              <Card key={item.id} style={styles.compactCard}>
                <Row label={item.cliente} value={`${formatNumber(item.cuota)} ${item.unidad}`} />
                {!!item.producto && <Row label="Producto" value={item.producto} />}
                <View style={styles.rowActions}>
                  <Button label="Editar" icon="create-outline" tone="info" onPress={() => editarCuota(item)} />
                  <Button label="Eliminar" icon="trash-outline" tone="danger" onPress={() => eliminarCuota(item.id)} />
                </View>
              </Card>
            ))}
          </Card>
        )}

        {mode === "historial" && !loading && operaciones.length === 0 && <EmptyState title="Sin operaciones" subtitle="Presione Buscar para cargar operaciones." />}
        {mode === "historial" && operaciones.map((op) => (
          <Card key={op.id}>
            <Text style={styles.sectionTitle}>{op.nombre_buque}</Text>
            <Row label="Codigo" value={op.codigo_operacion} />
            <Row label="Inicio" value={op.fecha_inicio} />
            <Row label="Cierre" value={op.fecha_cierre || "-"} />
            <Row label="Producto" value={op.producto} />
            <Row label="Estado" value={op.estado} />
            <View style={styles.rowActions}>
              <Button label="Detalle" icon="eye-outline" tone="info" onPress={() => openDetalle(op.id)} />
              <Button label="Ver cuotas" icon="pie-chart-outline" tone="info" onPress={() => openDetalle(op.id)} />
              {op.estado === "ABIERTA" && <Button label="Cerrar" icon="archive-outline" tone="danger" onPress={() => cerrar(op.id)} />}
              {op.estado !== "ABIERTA" && <Button label="Reabrir" icon="refresh-outline" tone="success" onPress={() => reabrir(op.id)} />}
            </View>
          </Card>
        ))}

        {mode === "historial" && !!detalle && (
          <Card>
            <Text style={styles.sectionTitle}>Detalle de operacion</Text>
            <ShipDetail detalle={detalle} />
            <ReporteResumen reporte={reporte} />
            <View style={styles.rowActions}>
              <Button label="Exportar PDF" icon="document-text-outline" tone="info" onPress={() => descargarReporteHistorial("pdf")} />
              <Button label="Exportar Excel" icon="grid-outline" tone="info" onPress={() => descargarReporteHistorial("excel")} />
            </View>
            <Text style={styles.blockTitle}>Cuotas</Text>
            {(detalle.cuotas || []).map((cuota) => (
              <Row key={cuota.id} label={cuota.cliente} value={`${formatNumber(cuota.cuota)} ${cuota.unidad}`} />
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function OperationSelector({ operaciones, selectedId, onSelect }) {
  if (!operaciones.length) {
    return <EmptyState title="Sin operaciones cargadas" subtitle="Use Cargar operaciones o Buscar." icon="boat-outline" />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginVertical: 10 }}>
      {operaciones.map((op) => (
        <View key={op.id} style={{ marginRight: 8 }}>
          <Button
            label={`${op.id} | ${op.nombre_buque} | ${op.estado}`}
            tone={Number(selectedId) === Number(op.id) ? "accent" : "info"}
            onPress={() => onSelect(op.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function ShipPreview({ bodegas }) {
  const visualOrder = [4, 3, 2, 1, 0];
  return (
    <View style={styles.shipShell}>
      {visualOrder.map((sourceIndex) => {
        const bodega = bodegas[sourceIndex] || {};
        const numero = sourceIndex + 1;
        const cap = toNumber(bodega.capacidad);
        const parts = (bodega.particiones || []).map(toNumber).filter((value) => value > 0);
        const totalParts = parts.reduce((sum, value) => sum + value, 0);
        return (
          <View key={`ship-${numero}`} style={styles.shipHold}>
            <Text style={styles.shipHoldTitle}>B{numero}</Text>
            <View style={styles.partitionTrack}>
              {parts.length > 0 ? (
                parts.map((part, pidx) => {
                  const height = `${Math.max(Math.min((part / Math.max(cap || totalParts, 1)) * 100, 100), 6)}%`;
                  return (
                    <View
                      key={`ship-${sourceIndex}-${pidx}`}
                      style={[
                        styles.partitionSegment,
                        {
                          height,
                          width: "100%",
                          backgroundColor: BODEGA_COLORS[sourceIndex % BODEGA_COLORS.length],
                          borderTopWidth: pidx < parts.length - 1 ? 3 : 0
                        }
                      ]}
                    />
                  );
                })
              ) : (
                <View style={[styles.partitionSegment, { height: cap > 0 ? "100%" : "0%", width: "100%", backgroundColor: BODEGA_COLORS[sourceIndex % BODEGA_COLORS.length] }]} />
              )}
            </View>
            <Text style={styles.shipHoldText}>{formatNumber(parts.length ? totalParts : cap)} / {formatNumber(cap)} MT</Text>
            {!!parts.length && <Text style={styles.shipHoldSub}>{parts.length} particion(es)</Text>}
          </View>
        );
      })}
    </View>
  );
}

function ShipDetail({ detalle }) {
  const bodegas = detalle.bodegas || [];
  const particiones = detalle.bodega_particiones || [];
  return (
    <View>
      <View style={styles.shipShell}>
        {[5, 4, 3, 2, 1].map((numero) => {
          const bodega = bodegas.find((item) => Number(item.bodega_numero) === numero) || {};
          const cap = Number(bodega.capacidad_mt || 0);
          const parts = particiones.filter((item) => Number(item.bodega_numero) === numero);
          const totalParts = parts.reduce((sum, item) => sum + Number(item.capacidad_mt || 0), 0);
          return (
            <View key={`detail-bodega-${numero}`} style={styles.shipHold}>
              <Text style={styles.shipHoldTitle}>B{numero}</Text>
              <View style={styles.partitionTrack}>
                {parts.length > 0 ? parts.map((part, pidx) => (
                  <View
                    key={part.id || `${numero}-${pidx}`}
                    style={[
                      styles.partitionSegment,
                      {
                        height: `${Math.max(Math.min((Number(part.capacidad_mt || 0) / Math.max(cap || totalParts, 1)) * 100, 100), 6)}%`,
                        width: "100%",
                        backgroundColor: BODEGA_COLORS[(numero - 1) % BODEGA_COLORS.length],
                        borderTopWidth: pidx < parts.length - 1 ? 3 : 0
                      }
                    ]}
                  />
                )) : (
                  <View style={[styles.partitionSegment, { height: cap > 0 ? "100%" : "0%", width: "100%", backgroundColor: BODEGA_COLORS[(numero - 1) % BODEGA_COLORS.length] }]} />
                )}
              </View>
              <Text style={styles.shipHoldText}>{formatNumber(parts.length ? totalParts : cap)} / {formatNumber(cap)} MT</Text>
            </View>
          );
        })}
      </View>
      {(detalle.bodega_particiones || []).map((part) => (
        <Row key={part.id} label={`B${part.bodega_numero} ${part.cliente || ""}`} value={`${formatNumber(part.capacidad_mt)} MT ${part.producto || ""}`} />
      ))}
      <Row label="Guias" value={formatNumber(detalle.resumen?.total_registros)} />
      <Row label="Completas" value={formatNumber(detalle.resumen?.completos)} />
      <Row label="Pendientes" value={formatNumber(detalle.resumen?.pendientes)} />
      <Row label="Descargado" value={`${formatNumber(detalle.resumen?.peso_cargado)} MT`} />
    </View>
  );
}

function ReporteResumen({ reporte }) {
  const kpis = reporte?.kpis || reporte?.resumen || {};
  const clientes = reporte?.clientes || reporte?.cuotas_vs_descargado || reporte?.cuotas_vs_retiro || [];
  const descargado = kpis.descargado_mt ?? kpis.peso_cargado_total ?? kpis.peso_cargado ?? reporte?.descargado_mt;
  const pendiente = kpis.pendiente_mt ?? kpis.pendiente_descarga_mt ?? reporte?.pendiente_mt;
  const avance = kpis.avance_pct ?? kpis.avance_operativo_pct ?? reporte?.avance_pct;

  if (!reporte && !Object.keys(kpis).length && !clientes.length) {
    return null;
  }

  return (
    <Card style={styles.compactCard}>
      <Text style={styles.blockTitle}>Lectura operativa</Text>
      <View style={styles.kpiGrid}>
        <MiniKpi label="Descargado MT" value={formatNumber(descargado)} />
        <MiniKpi label="Pendiente MT" value={formatNumber(pendiente)} />
        <MiniKpi label="Avance" value={`${formatNumber(avance)}%`} />
      </View>
      {!!clientes.length && (
        <>
          <Text style={styles.blockTitle}>Cuotas vs descargado</Text>
          {clientes.slice(0, 8).map((item, index) => (
            <Row
              key={`${item.cliente || item.empresa || index}-${item.producto || ""}`}
              label={`${item.cliente || item.empresa || "Cliente"}${item.producto ? ` | ${item.producto}` : ""}`}
              value={`Cuota ${formatNumber(item.cuota_mt ?? item.cuota ?? item.cuota_kg)} | Desc. ${formatNumber(item.descargado_mt ?? item.retirado_mt ?? item.descargado_kg)}`}
            />
          ))}
        </>
      )}
    </Card>
  );
}

function MiniKpi({ label, value }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function QuotaFields({ value, onChange, index, setField }) {
  const update = (field, nextValue) => {
    if (setField && typeof index === "number") {
      setField(index, field, nextValue);
      return;
    }
    onChange({ ...value, [field]: nextValue });
  };

  return (
    <View>
      <Field label="Cliente" value={value.cliente} onChangeText={(next) => update("cliente", next)} placeholder="Cliente" />
      <Field label="Cuota" value={String(value.cuota || "")} onChangeText={(next) => update("cuota", next)} placeholder="0.00" keyboardType="numeric" />
      <Field label="Unidad" value={value.unidad || "KG"} onChangeText={(next) => update("unidad", next)} placeholder="KG / LB / MT" />
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.auxiliary}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function cloneBodegas() {
  return EMPTY_BODEGAS.map((item) => ({ ...item, particiones: [...item.particiones] }));
}

function toNumber(value) {
  const number = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function limpiarCuota(value) {
  const cliente = String(value?.cliente || "").trim();
  const cuota = toNumber(value?.cuota);
  const unidad = String(value?.unidad || "KG").trim() || "KG";
  if (!cliente || cuota <= 0) {
    return null;
  }
  return { cliente, cuota, unidad };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap"
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 17,
    color: COLORS.text,
    marginBottom: 10
  },
  blockTitle: {
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 7,
    fontSize: 15
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    flexWrap: "wrap"
  },
  finalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap"
  },
  compactCard: {
    marginTop: 8,
    marginBottom: 0
  },
  bodegaCard: {
    marginBottom: 8
  },
  field: {
    marginBottom: 9
  },
  fieldLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 4
  },
  input: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    padding: 11,
    color: COLORS.text,
    fontWeight: "800"
  },
  shipShell: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderColor: COLORS.accent,
    borderWidth: 2,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: COLORS.bg
  },
  shipHold: {
    flex: 1,
    minWidth: 118,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    padding: 8
  },
  shipHoldTitle: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6
  },
  partitionTrack: {
    height: 46,
    flexDirection: "column-reverse",
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    overflow: "hidden"
  },
  partitionSegment: {
    borderTopColor: COLORS.text
  },
  shipHoldText: {
    marginTop: 6,
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
    fontSize: 12
  },
  shipHoldSub: {
    color: COLORS.muted,
    fontWeight: "800",
    textAlign: "center",
    fontSize: 11
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  kpiBox: {
    flex: 1,
    minWidth: 118,
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10
  },
  kpiLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginBottom: 5
  },
  kpiValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17
  }
});
