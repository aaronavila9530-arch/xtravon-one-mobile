import React, { useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "../api/client";
import { Button, Card, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

const SOF_QUEUE_FILE = `${FileSystem.documentDirectory || ""}xtravon_sof_offline_queue.json`;
const SOF_QUEUE_BACKUP_FILE = `${FileSystem.documentDirectory || ""}xtravon_sof_offline_queue.bak.json`;
const SOF_CACHE_FILE = `${FileSystem.documentDirectory || ""}xtravon_sof_cache.json`;
const SOF_CACHE_BACKUP_FILE = `${FileSystem.documentDirectory || ""}xtravon_sof_cache.bak.json`;
const SOF_SYNC_BATCH_SIZE = 25;

const TIPOS = ["OPERATIVO", "DEMORA", "INCIDENTE", "DOCUMENTAL", "SEGURIDAD", "PESO", "QR", "OTROS"];

export default function StatementScreen({ session }) {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [operacion, setOperacion] = useState(null);
  const [guias, setGuias] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [historial, setHistorial] = useState([]);
  const [selectedGuiaId, setSelectedGuiaId] = useState("");
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const syncTimerRef = useRef(null);
  const syncInFlightRef = useRef(false);

  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    hora_desde: horaActual(),
    hora_hasta: horaActual(),
    tipo: "OPERATIVO",
    subcategoria: "",
    bodega_numero: "",
    evento: ""
  });

  const [filters, setFilters] = useState({
    operacion_id: "",
    guia: "",
    cliente: "",
    producto: "",
    tipo: "",
    subcategoria: "",
    bodega_numero: "",
    fecha_desde: "",
    fecha_hasta: ""
  });

  const isOperator = esOperadorPatio(session);
  const canSeeHistory = !isOperator;
  const selectedGuia = guias.find((item) => String(item.base_operacion_id || item.id) === String(selectedGuiaId));

  useEffect(() => {
    let active = true;
    Promise.all([cargarCacheSof(), cargarColaSof()]).then(([cache, queue]) => {
      if (!active) return;
      if (cache?.operacion) setOperacion(cache.operacion);
      if (Array.isArray(cache?.guias)) setGuias(cache.guias);
      setOfflineQueue(queue);
      if (queue.length) setSyncMessage(`${queue.length} evento(s) SOF pendiente(s) por sincronizar.`);
    });
    return () => {
      active = false;
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (!offlineQueue.length) return;
    syncTimerRef.current = setInterval(() => sincronizarSofOffline(false), 15000);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [offlineQueue.length]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && offlineQueue.length > 0) {
        sincronizarSofOffline(false);
      }
    });
    return () => sub.remove();
  }, [offlineQueue.length]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

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

  async function cargarCacheSof() {
    const leer = async (path) => {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return {};
      const raw = await FileSystem.readAsStringAsync(path);
      return JSON.parse(raw || "{}");
    };
    try {
      return await leer(SOF_CACHE_FILE);
    } catch (_error) {
      try {
        return await leer(SOF_CACHE_BACKUP_FILE);
      } catch (_backupError) {
        return {};
      }
    }
  }

  async function guardarCacheSof(cache) {
    const payload = JSON.stringify(cache || {});
    const tempFile = `${SOF_CACHE_FILE}.tmp`;
    await FileSystem.writeAsStringAsync(SOF_CACHE_BACKUP_FILE, payload);
    await FileSystem.writeAsStringAsync(tempFile, payload);
    await FileSystem.deleteAsync(SOF_CACHE_FILE, { idempotent: true });
    await FileSystem.moveAsync({ from: tempFile, to: SOF_CACHE_FILE });
  }

  async function cargarColaSof() {
    const leer = async (path) => {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return [];
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    };
    try {
      return await leer(SOF_QUEUE_FILE);
    } catch (_error) {
      try {
        return await leer(SOF_QUEUE_BACKUP_FILE);
      } catch (_backupError) {
        return [];
      }
    }
  }

  async function guardarColaSof(items) {
    const payload = JSON.stringify(items || []);
    const tempFile = `${SOF_QUEUE_FILE}.tmp`;
    await FileSystem.writeAsStringAsync(SOF_QUEUE_BACKUP_FILE, payload);
    await FileSystem.writeAsStringAsync(tempFile, payload);
    await FileSystem.deleteAsync(SOF_QUEUE_FILE, { idempotent: true });
    await FileSystem.moveAsync({ from: tempFile, to: SOF_QUEUE_FILE });
  }

  function esErrorReintentable(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      !error?.status ||
      Number(error.status) >= 500 ||
      message.includes("network request failed") ||
      message.includes("failed to fetch") ||
      message.includes("timeout") ||
      message.includes("application failed to respond")
    );
  }

  async function sincronizarOperacion() {
    await runWithLoading("Sincronizando operación para SOF...", async () => {
      const activa = await api.getOperacionActiva();
      if (!activa?.id) {
        Alert.alert("Sin operación", "No hay operación activa para sincronizar.");
        return;
      }
      const filtros = await api.getIssueFiltros({ operacion_id: activa.id });
      const opciones = filtros?.opciones || {};
      const nextGuias = opciones.guias || opciones.base_operaciones_actuales || [];
      const nextOperacion = {
        id: activa.id,
        buque: activa.nombre_buque || activa.buque || opciones.operacion_activa?.buque,
        codigo_operacion: activa.codigo_operacion,
        fecha_inicio: activa.fecha_inicio,
        estado: activa.estado
      };
      setOperacion(nextOperacion);
      setGuias(nextGuias);
      setFilterOptions(opciones);
      setFilters((current) => ({ ...current, operacion_id: String(activa.id || "") }));
      await guardarCacheSof({
        operacion: nextOperacion,
        guias: nextGuias,
        actualizado_en: new Date().toISOString()
      });
      Alert.alert("SOF offline listo", `Operación sincronizada con ${nextGuias.length} guía(s) en memoria.`);
    });
  }

  function limpiarFiltros() {
    setFilters({
      operacion_id: operacion?.id ? String(operacion.id) : "",
      guia: "",
      cliente: "",
      producto: "",
      tipo: "",
      subcategoria: "",
      bodega_numero: "",
      fecha_desde: "",
      fecha_hasta: ""
    });
  }

  function paramsFiltros(extra = {}) {
    const params = { ...filters, ...extra };
    if (!params.operacion_id && operacion?.id) {
      params.operacion_id = String(operacion.id);
    }
    Object.keys(params).forEach((key) => {
      if (params[key] === "" || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });
    return params;
  }

  async function cargarFiltrosSof() {
    await runWithLoading("Cargando filtros SOF...", async () => {
      const data = await api.getIssueFiltros(paramsFiltros());
      const opciones = data?.opciones || {};
      setFilterOptions(opciones);

      const activa = opciones.operacion_activa || opciones.operacion_seleccionada;
      if (activa && !operacion) {
        setOperacion({
          id: activa.id,
          buque: activa.buque || activa.nombre_buque,
          codigo_operacion: activa.codigo_operacion,
          fecha_inicio: activa.fecha_inicio,
          estado: activa.estado
        });
      }
      if (activa && !filters.operacion_id) {
        updateFilter("operacion_id", String(activa.id || ""));
      }

      const nextGuias = opciones.guias || opciones.base_operaciones_actuales || [];
      if (nextGuias.length) setGuias(nextGuias);
    });
  }

  async function cargarHistorialSof() {
    await runWithLoading("Buscando historial SOF...", async () => {
      const data = await api.getIssueLog(paramsFiltros({ limit: 500 }));
      setHistorial(Array.isArray(data?.data) ? data.data : []);
    });
  }

  async function eliminarEvento(id) {
    Alert.alert("Eliminar SOF", "Desea eliminar este evento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await runWithLoading("Eliminando SOF...", async () => api.eliminarIssueLog(id));
            setHistorial((current) => current.filter((item) => String(item.id) !== String(id)));
          } catch (error) {
            Alert.alert("Error SOF", error.message);
          }
        }
      }
    ]);
  }

  async function descargarReporteSof(formato) {
    const operacionId = filters.operacion_id || operacion?.id;
    if (!operacionId) {
      Alert.alert("Operacion requerida", "Cargue filtros o sincronice una operacion antes de exportar SOF.");
      return;
    }

    await runWithLoading(`Exportando SOF ${String(formato).toUpperCase()}...`, async () => {
      const ext = formato === "excel" ? "xlsx" : formato;
      const mime = formato === "excel"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : formato === "pdf"
          ? "application/pdf"
          : "application/octet-stream";
      const uri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}SOF_${operacionId}.${ext}`;
      const url = api.reporteBuqueDownloadUrl(operacionId, formato, { tipo: "sof" });
      const result = await FileSystem.downloadAsync(url, uri);
      await abrirArchivo(result.uri, mime);
    });
  }

  function buildPayload() {
    if (!operacion?.id) {
      throw new Error("Presione Sincronizar operación antes de agregar SOF.");
    }
    if (!form.fecha || !form.hora_desde || !form.hora_hasta || !form.evento.trim()) {
      throw new Error("Indique fecha, hora desde, hora hasta y detalle del evento.");
    }
    return {
      operacion_id: Number(operacion.id),
      base_operacion_id: selectedGuiaId ? Number(selectedGuiaId) : null,
      fecha: form.fecha,
      hora_desde: form.hora_desde,
      hora_hasta: form.hora_hasta,
      tipo: form.tipo || "OPERATIVO",
      subcategoria: form.subcategoria || null,
      bodega_numero: form.bodega_numero ? Number(form.bodega_numero) : null,
      evento: form.evento.trim(),
      comentario: "",
      creado_por: session?.nombre || session?.usuario || "handheld"
    };
  }

  async function guardarEvento() {
    let payload;
    try {
      payload = buildPayload();
    } catch (error) {
      Alert.alert("Dato requerido", error.message);
      return;
    }

    setLoading(true);
    setLoadingLabel("Guardando SOF...");
    try {
      await api.crearIssueLog(payload);
      limpiarDespuesDeGuardar();
      Alert.alert("SOF guardado", "Evento enviado correctamente.");
    } catch (error) {
      if (!esErrorReintentable(error)) {
        Alert.alert("Error", error.message);
        return;
      }
      const current = await cargarColaSof();
      const next = [
        ...current,
        {
          client_event_id: `sof-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          payload,
          dispositivo: `xtravon-${session?.rol || "handheld"}`,
          capturado_en: new Date().toISOString(),
          creado_en_local: new Date().toISOString(),
          intentos: 0,
          ultimo_error: "",
          estado_local: "PENDIENTE"
        }
      ];
      setOfflineQueue(next);
      await guardarColaSof(next);
      setSyncMessage(`${next.length} evento(s) SOF pendiente(s). Se enviarán automáticamente al volver la red.`);
      limpiarDespuesDeGuardar();
      Alert.alert("Guardado offline", "El SOF quedó guardado en el dispositivo y se enviará al volver la conexión.");
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function limpiarDespuesDeGuardar() {
    setForm((current) => ({
      ...current,
      hora_desde: horaActual(),
      hora_hasta: horaActual(),
      subcategoria: "",
      bodega_numero: "",
      evento: ""
    }));
  }

  async function sincronizarSofOffline(mostrarResultado = true) {
    if (syncInFlightRef.current) return;
    const cola = await cargarColaSof();
    if (!cola.length) {
      setOfflineQueue([]);
      setSyncMessage("No hay SOF pendientes.");
      if (mostrarResultado) Alert.alert("Sincronización SOF", "No hay eventos pendientes.");
      return;
    }

    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      const lote = cola.slice(0, SOF_SYNC_BATCH_SIZE);
      const data = await api.sincronizarSofEventos(lote);
      const resultados = Array.isArray(data.resultados) ? data.resultados : [];
      const removibles = new Set(
        resultados
          .filter((item) => ["PROCESADO", "DUPLICADO", "ERROR_VALIDACION"].includes(item.estado))
          .map((item) => item.client_event_id)
      );
      const pendientes = cola.filter((item) => !removibles.has(item.client_event_id));
      setOfflineQueue(pendientes);
      await guardarColaSof(pendientes);
      const mensaje = `SOF enviados: ${data.procesados || 0} | Duplicados: ${data.duplicados || 0} | Errores: ${data.errores || 0} | Pendientes: ${pendientes.length}`;
      setSyncMessage(mensaje);
      if (mostrarResultado) Alert.alert("Sincronización SOF", mensaje);
    } catch (error) {
      const next = cola.map((item, idx) => idx < SOF_SYNC_BATCH_SIZE
        ? {
            ...item,
            intentos: Number(item.intentos || 0) + 1,
            ultimo_error: error.message,
            ultimo_intento_en: new Date().toISOString(),
            estado_local: "PENDIENTE_REINTENTO"
          }
        : item
      );
      setOfflineQueue(next);
      await guardarColaSof(next);
      setSyncMessage(`SOF pendiente por red/backend. Reintento automático cada 15 segundos. ${error.message}`);
      if (mostrarResultado) Alert.alert("Sin red", "No se pudo sincronizar. Se reintentará automáticamente.");
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }

  return (
    <Screen
      title="SOF"
      subtitle="Captura operativa offline"
      right={<Button label="Sincronizar" icon="sync-outline" onPress={sincronizarOperacion} />}
      minWidth={300}
      horizontal={false}
    >
      {loading && <Loading label={loadingLabel || "Procesando..."} />}

      <ScrollView contentContainerStyle={styles.screenBody}>
        <Card>
          <Text style={styles.title}>Agregar evento SOF</Text>
          {operacion ? (
            <>
              <Row label="Operación" value={`${operacion.buque || "-"} | ${operacion.estado || "-"}`} />
              <Row label="Guías en memoria" value={guias.length} />
            </>
          ) : (
            <Text style={styles.helper}>Presione Sincronizar operación una vez con conexión para trabajar offline.</Text>
          )}
          {!!syncMessage && <Text style={styles.syncText}>{syncMessage}</Text>}
          <View style={styles.actions}>
            <Button label="Sincronizar operación" icon="download-outline" tone="info" onPress={sincronizarOperacion} />
            <Button label="Enviar pendientes" icon="cloud-upload-outline" tone="info" onPress={() => sincronizarSofOffline(true)} disabled={syncing || offlineQueue.length === 0} />
          </View>
        </Card>

        <Card>
          <Text style={styles.label}>Guía relacionada opcional</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
            <Text style={[styles.chip, !selectedGuiaId && styles.chipActive]} onPress={() => setSelectedGuiaId("")}>Sin guía</Text>
            {guias.map((item) => {
              const id = item.base_operacion_id || item.id;
              return (
                <Text
                  key={`${id}-${item.guia}`}
                  style={[styles.chip, String(selectedGuiaId) === String(id) && styles.chipActive]}
                  onPress={() => setSelectedGuiaId(String(id))}
                >
                  {item.guia || "SIN GUIA"} | {item.cliente || item.empresa || "-"} | {item.producto || "-"}
                </Text>
              );
            })}
          </ScrollView>
          {!!selectedGuia && (
            <View style={styles.guiaBox}>
              <Row label="Cliente" value={selectedGuia.cliente || selectedGuia.empresa} />
              <Row label="Producto" value={selectedGuia.producto} />
              <Row label="Placa" value={selectedGuia.placa} />
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Fecha</Text>
              <TextInput style={styles.input} value={form.fecha} onChangeText={(value) => update("fecha", value)} placeholder="YYYY-MM-DD" />
              <Text style={styles.helper}>{fechaLarga(form.fecha)}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Desde</Text>
              <TextInput style={styles.input} value={form.hora_desde} onChangeText={(value) => update("hora_desde", value)} placeholder="HH:MM" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Hasta</Text>
              <TextInput style={styles.input} value={form.hora_hasta} onChangeText={(value) => update("hora_hasta", value)} placeholder="HH:MM" />
            </View>
          </View>

          <Text style={styles.label}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
            {TIPOS.map((tipo) => (
              <Text key={tipo} style={[styles.chip, form.tipo === tipo && styles.chipActive]} onPress={() => update("tipo", tipo)}>
                {tipo}
              </Text>
            ))}
          </ScrollView>

          <Text style={styles.label}>Subcategoría</Text>
          <TextInput style={styles.input} value={form.subcategoria} onChangeText={(value) => update("subcategoria", value)} placeholder="Ej: Fallo de grúa, clima, camiones" />

          <Text style={styles.label}>Bodega</Text>
          <TextInput style={styles.input} value={form.bodega_numero} onChangeText={(value) => update("bodega_numero", value)} placeholder="1 a 5" keyboardType="numeric" />

          <Text style={styles.label}>Evento</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.evento}
            onChangeText={(value) => update("evento", value)}
            placeholder="Detalle del statement of facts"
            multiline
          />

          <Button label="Guardar SOF" icon="save-outline" onPress={guardarEvento} />
        </Card>

        {canSeeHistory && (
          <Card>
            <Text style={styles.title}>Filtros e historial SOF</Text>
            <Text style={styles.helper}>Cargue filtros y busque historial solo cuando lo necesite.</Text>

            <Text style={styles.label}>Operacion</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
              <Text style={[styles.chip, !filters.operacion_id && styles.chipActive]} onPress={() => updateFilter("operacion_id", "")}>Activa</Text>
              {(filterOptions.operaciones || []).map((item) => (
                <Text
                  key={`op-${item.id}`}
                  style={[styles.chip, String(filters.operacion_id) === String(item.id) && styles.chipActive]}
                  onPress={() => updateFilter("operacion_id", String(item.id))}
                >
                  {item.buque || item.nombre_buque || "Operacion"} | {item.fecha_inicio || "-"} | {item.estado || "-"}
                </Text>
              ))}
            </ScrollView>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Guia</Text>
                <TextInput style={styles.input} value={filters.guia} onChangeText={(value) => updateFilter("guia", value)} placeholder="Buscar guia" placeholderTextColor={COLORS.auxiliary} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Cliente</Text>
                <TextInput style={styles.input} value={filters.cliente} onChangeText={(value) => updateFilter("cliente", value)} placeholder="Cliente / empresa" placeholderTextColor={COLORS.auxiliary} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Producto</Text>
                <TextInput style={styles.input} value={filters.producto} onChangeText={(value) => updateFilter("producto", value)} placeholder="Producto" placeholderTextColor={COLORS.auxiliary} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Bodega</Text>
                <TextInput style={styles.input} value={filters.bodega_numero} onChangeText={(value) => updateFilter("bodega_numero", value)} placeholder="1 a 5" placeholderTextColor={COLORS.auxiliary} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Desde</Text>
                <TextInput style={styles.input} value={filters.fecha_desde} onChangeText={(value) => updateFilter("fecha_desde", value)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.auxiliary} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Hasta</Text>
                <TextInput style={styles.input} value={filters.fecha_hasta} onChangeText={(value) => updateFilter("fecha_hasta", value)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.auxiliary} />
              </View>
            </View>

            <Text style={styles.label}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
              <Text style={[styles.chip, !filters.tipo && styles.chipActive]} onPress={() => updateFilter("tipo", "")}>Todos</Text>
              {normalizarOpciones([...(filterOptions.tipos || []), ...(filterOptions.tipos_catalogo || TIPOS)]).map((tipo) => (
                <Text key={`ft-${tipo}`} style={[styles.chip, filters.tipo === tipo && styles.chipActive]} onPress={() => updateFilter("tipo", tipo)}>
                  {tipo}
                </Text>
              ))}
            </ScrollView>

            <Text style={styles.label}>Subcategoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
              <Text style={[styles.chip, !filters.subcategoria && styles.chipActive]} onPress={() => updateFilter("subcategoria", "")}>Todas</Text>
              {normalizarOpciones(filterOptions.subcategorias || []).map((item) => (
                <Text key={`fs-${item}`} style={[styles.chip, filters.subcategoria === item && styles.chipActive]} onPress={() => updateFilter("subcategoria", item)}>
                  {item}
                </Text>
              ))}
            </ScrollView>

            <View style={styles.actions}>
              <Button label="Cargar filtros" icon="options-outline" tone="info" onPress={cargarFiltrosSof} />
              <Button label="Buscar historial" icon="search-outline" onPress={cargarHistorialSof} />
              <Button label="Limpiar" icon="close-outline" tone="info" onPress={limpiarFiltros} />
              <Button label="PDF" icon="document-outline" tone="info" onPress={() => descargarReporteSof("pdf")} />
              <Button label="Excel" icon="grid-outline" tone="info" onPress={() => descargarReporteSof("excel")} />
            </View>
          </Card>
        )}

        {canSeeHistory && (
          <Card>
            <Text style={styles.title}>Historial Statement of Facts</Text>
            {historial.length === 0 ? (
              <Text style={styles.helper}>Presione Buscar historial para visualizar eventos.</Text>
            ) : (
              historial.map((item) => (
                <View key={`sof-${item.id}`} style={styles.eventCard}>
                  <Text style={styles.eventTitle}>{item.fecha_larga_es || item.fecha_larga || item.fecha || "-"} | {item.rango_hora || `${item.hora_desde || item.hora || "-"} - ${item.hora_hasta || item.hora || "-"}`}</Text>
                  <Text style={styles.eventMeta}>{item.tipo || "OPERATIVO"}{item.subcategoria ? ` | ${item.subcategoria}` : ""}{item.bodega_numero ? ` | Bodega ${item.bodega_numero}` : ""}</Text>
                  <Text style={styles.eventMeta}>{item.guia || "Sin guia"} | {item.cliente || "-"} | {item.producto || "-"}</Text>
                  <Text style={styles.eventText}>{item.evento}</Text>
                  <View style={styles.actions}>
                    <Button label="Eliminar" icon="trash-outline" tone="danger" onPress={() => eliminarEvento(item.id)} />
                  </View>
                </View>
              ))
            )}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

async function abrirArchivo(uri, mimeType) {
  if (Platform.OS === "android") {
    try {
      const IntentLauncher = require("expo-intent-launcher");
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: mimeType,
        flags: 1
      });
      return;
    } catch (_error) {
      // Si Android no encuentra una app compatible, se ofrece compartir/guardar.
    }
  }
  try {
    const Sharing = require("expo-sharing");
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType });
      return;
    }
    Alert.alert("Archivo generado", uri);
  } catch (_error) {
    Alert.alert("Archivo generado", uri);
  }
}

function normalizarOpciones(items) {
  return [...new Set((items || []).filter(Boolean).map((item) => String(item)))];
}

function esOperadorPatio(session) {
  const raw = `${session?.rol || ""} ${session?.role || ""} ${session?.perfil || ""} ${session?.tipo || ""}`.toUpperCase();
  return raw.includes("OPERADOR") && !raw.includes("SUPERVISOR") && !raw.includes("ADMIN");
}

function horaActual() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function fechaLarga(value) {
  const meses = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const parts = String(value || "").split("-");
  if (parts.length !== 3) return "-";
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return "-";
  return `${day} de ${meses[month]} de ${year}`;
}

const styles = StyleSheet.create({
  screenBody: {
    paddingBottom: 28
  },
  title: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 10
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 5
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    color: COLORS.text
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  multilineSmall: {
    minHeight: 76,
    textAlignVertical: "top"
  },
  helper: {
    color: COLORS.muted,
    fontWeight: "700",
    marginBottom: 10
  },
  syncText: {
    color: COLORS.accent,
    fontWeight: "900",
    marginBottom: 10
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  half: {
    flex: 1,
    minWidth: 130
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  chip: {
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 10,
    fontWeight: "800"
  },
  chipStrip: {
    paddingRight: 10
  },
  chipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
    color: COLORS.bg
  },
  guiaBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginBottom: 10
  },
  eventCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    padding: 12,
    marginBottom: 10
  },
  eventTitle: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 5
  },
  eventMeta: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 4
  },
  eventText: {
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 10
  }
});
