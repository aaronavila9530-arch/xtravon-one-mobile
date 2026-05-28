import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, EmptyState, Kpi, Loading, Screen } from "../components/ui";
import { COLORS } from "../config";

const FILTER_KEYS = [
  ["guia", "Guia"],
  ["empresa", "Cliente"],
  ["producto", "Producto"],
  ["chofer", "Chofer"],
  ["placa", "Placa"]
];

export default function DespachoScreen({ session }) {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [data, setData] = useState(null);
  const [opciones, setOpciones] = useState({});
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState(null);
  const [selectedKind, setSelectedKind] = useState("");
  const [chofer, setChofer] = useState("");
  const [placa, setPlaca] = useState("");
  const [destino, setDestino] = useState("");
  const [canal, setCanal] = useState("WHATSAPP");
  const [openFilter, setOpenFilter] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);

  const operacionId = data?.operacion?.id;
  const plan = data?.plan_viajes || {};
  const opcionesCompletas = useMemo(() => mergeOpciones(opciones, data), [opciones, data]);

  const kpis = useMemo(() => ([
    ["Solicitudes", data?.solicitudes_pendientes?.length || 0, "danger"],
    ["Pendientes reasignar", data?.pendientes_reasignacion?.length || 0, "warning"],
    ["Asignadas", data?.guias_asignadas?.length || 0, "info"],
    ["Ingreso puerto", data?.primer_escaneo?.length || 0, "accent"],
    ["Ingreso tolva", data?.segundo_escaneo?.length || 0, "teal"],
    ["Completadas", data?.completadas?.length || 0, "success"]
  ]), [data]);

  async function run(label, task) {
    setLoading(true);
    setLoadingLabel(label);
    try {
      return await task();
    } catch (error) {
      Alert.alert("Despacho de Viajes", error.message);
      return null;
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function buscarOperacion() {
    await run("Buscando operacion activa...", async () => {
      let resumen = null;
      try {
        resumen = await api.getDespachoResumen();
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        const activa = await api.getOperacionActiva();
        if (!activa?.id) {
          throw error;
        }
        resumen = await api.getDespachoResumen({ operacion_id: activa.id });
      }
      setData(resumen);
      setSelected(null);
      setSelectedKind("");
      const params = resumen?.operacion?.id ? { operacion_id: resumen.operacion.id } : {};
      try {
        const filtros = await api.getDespachoFiltros(params);
        setOpciones(filtros?.opciones || {});
      } catch (_error) {
        setOpciones({});
      }
    });
  }

  async function cargarFiltros() {
    await run("Cargando filtros...", async () => {
      const params = operacionId ? { operacion_id: operacionId } : {};
      const filtros = await api.getDespachoFiltros(params);
      setOpciones(filtros?.opciones || {});
    });
  }

  async function aplicarFiltros() {
    await run("Aplicando filtros...", async () => {
      let params = cleanParams({ operacion_id: operacionId, ...filters });
      if (!params.operacion_id) {
        const activa = await api.getOperacionActiva().catch(() => null);
        params = cleanParams({ operacion_id: activa?.id, ...filters });
      }
      const resumen = await api.getDespachoResumen(params);
      setData(resumen);
      setSelected(null);
      setSelectedKind("");
    });
  }

  function limpiarFiltros() {
    setFilters({});
    setOpenFilter(null);
  }

  function aplicarFilaFormulario(row, kind) {
    setSelected(row);
    setSelectedKind(kind);
    const nextChofer = row?.chofer || row?.chofer_asignado || row?.chofer_previo || "";
    const nextPlaca = row?.placa || row?.placa_asignada || row?.placa_previa || "";
    if (nextChofer) setChofer(nextChofer);
    if (nextPlaca) setPlaca(nextPlaca);
    setFilters((current) => ({
      ...current,
      guia: row?.guia || current.guia || "",
      empresa: row?.empresa || row?.empresa_previa || current.empresa || "",
      producto: row?.producto || row?.producto_previo || current.producto || ""
    }));
  }

  async function asignarGuia(rowOverride = selected, kindOverride = selectedKind) {
    if (!operacionId) {
      Alert.alert("Sin operacion", "Primero busque la operacion activa.");
      return;
    }
    const targetChofer = (chofer || rowOverride?.chofer || rowOverride?.chofer_asignado || rowOverride?.chofer_previo || "").trim();
    const targetPlaca = (placa || rowOverride?.placa || rowOverride?.placa_asignada || rowOverride?.placa_previa || "").trim();
    if (!targetChofer || !targetPlaca) {
      Alert.alert("Dato requerido", "Indique chofer y placa.");
      return;
    }
    await run("Asignando guia...", async () => {
      const response = await api.asignarDespacho({
        operacion_id: operacionId,
        base_operacion_id: kindOverride === "guia" ? rowOverride?.id : null,
        solicitud_id: kindOverride === "solicitud" ? rowOverride?.id : null,
        chofer: targetChofer,
        placa: targetPlaca,
        empresa: filters.empresa || rowOverride?.empresa_previa || rowOverride?.empresa || null,
        producto: filters.producto || rowOverride?.producto_previo || rowOverride?.producto || null,
        canal_entrega: canal,
        destinatario: destino || null,
        creado_por: session?.nombre || "APP SUPERVISOR"
      });
      await aplicarFiltros();
      Alert.alert("Despacho", response?.mensaje || "Guia asignada y QR habilitado.");
    });
  }

  async function liberarSeleccion(rowOverride = selected, kindOverride = selectedKind) {
    if (!rowOverride?.id || kindOverride === "solicitud") {
      Alert.alert("Seleccione guia", "Seleccione una guia asignada, en puerto o pendiente de reasignacion.");
      return;
    }
    await run("Liberando guia...", async () => {
      await api.liberarDespacho([rowOverride.id], "Liberada desde app.", session?.nombre || "APP SUPERVISOR");
      await aplicarFiltros();
    });
  }

  async function cancelarSeleccion(rowOverride = selected, kindOverride = selectedKind) {
    if (!rowOverride?.id || kindOverride === "solicitud") {
      Alert.alert("Seleccione guia", "Seleccione una guia asignada, en puerto o pendiente de reasignacion.");
      return;
    }
    await run("Cancelando guia...", async () => {
      await api.cancelarDespacho([rowOverride.id], "Cancelada desde app.", session?.nombre || "APP SUPERVISOR");
      await aplicarFiltros();
    });
  }

  async function rechazarSolicitud(rowOverride = selected, kindOverride = selectedKind) {
    if (kindOverride !== "solicitud" || !rowOverride?.id) {
      Alert.alert("Seleccione solicitud", "Seleccione una solicitud de nuevo viaje.");
      return;
    }
    await run("Rechazando solicitud...", async () => {
      await api.rechazarSolicitudDespacho(rowOverride.id, "Solicitud rechazada desde app.", session?.nombre || "APP SUPERVISOR");
      await aplicarFiltros();
    });
  }

  async function bloquearChoferPlaca(rowOverride = null) {
    const targetChofer = (rowOverride?.chofer || rowOverride?.chofer_asignado || chofer || "").trim();
    const targetPlaca = (rowOverride?.placa || rowOverride?.placa_asignada || placa || "").trim();
    if (!targetChofer && !targetPlaca) {
      Alert.alert("Dato requerido", "Indique chofer o placa para bloquear.");
      return;
    }
    await run("Registrando bloqueo...", async () => {
      await api.bloquearDespacho({
        operacion_id: operacionId || null,
        chofer: targetChofer || null,
        placa: targetPlaca || null,
        motivo: "Bloqueo desde app supervisor.",
        creado_por: session?.nombre || "APP SUPERVISOR"
      });
      await aplicarFiltros();
    });
  }

  async function enviarQrSeleccion(rowOverride = selected, kindOverride = selectedKind) {
    if (!rowOverride?.id || kindOverride === "solicitud") {
      Alert.alert("Seleccione guia", "Seleccione una guia asignada o pendiente para enviar su QR.");
      return;
    }
    await run("Preparando QR...", async () => {
      const payload = {
        operacion_id: operacionId || null,
        ids: [rowOverride.id],
        canal,
        formato: "jpg"
      };
      if (canal === "WHATSAPP" && destino.trim()) payload.whatsapp_destino = destino.trim();
      if (canal === "CORREO" && destino.trim()) payload.email_destino = destino.trim();
      const response = await api.entregarQrBoletas(payload);
      const entregas = response?.entregas || [];
      const links = entregas.map((item) => item.link).filter(Boolean);
      Alert.alert(
        "Entrega QR",
        links.length
          ? `QR preparado. Entregas: ${entregas.length}. Link listo para envio.`
          : `QR preparado. Entregas: ${entregas.length}.`
      );
    });
  }

  function selectRow(row, kind) {
    setOpenFilter(null);
    aplicarFilaFormulario(row, kind);
  }

  function showRowMenu(row, kind) {
    setOpenFilter(null);
    aplicarFilaFormulario(row, kind);
    setActionMenu({ row, kind });
  }

  function actionOptions(menu = actionMenu) {
    if (!menu?.row) return [];
    const { row, kind } = menu;
    if (kind === "solicitud") {
      return [
        { label: "Aprobar / asignar guia", action: () => asignarGuia(row, kind) },
        { label: "Rechazar solicitud", danger: true, action: () => rechazarSolicitud(row, kind) },
        { label: "Bloquear chofer/placa", danger: true, action: () => bloquearChoferPlaca(row) }
      ];
    }
    return [
      { label: "Asignar / activar", action: () => asignarGuia(row, kind) },
      { label: "Enviar QR", action: () => enviarQrSeleccion(row, kind) },
      { label: "Liberar guia", action: () => liberarSeleccion(row, kind) },
      { label: "Cancelar guia", danger: true, action: () => cancelarSeleccion(row, kind) },
      { label: "Bloquear chofer/placa", danger: true, action: () => bloquearChoferPlaca(row) }
    ];
  }

  function runActionMenu(option) {
    const fn = option?.action;
    setActionMenu(null);
    if (fn) {
      setTimeout(fn, 60);
    }
  }

  return (
    <Screen
      title="Despacho de Viajes"
      subtitle="Asignacion controlada, solicitudes, trazabilidad y QR activo."
      horizontal={false}
    >
      <ScrollView keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => setOpenFilter(null)}>
        <Card>
          <View style={styles.actions}>
            <Button label="Buscar operacion activa" icon="search-outline" onPress={buscarOperacion} />
            <Button label="Cargar filtros" icon="options-outline" tone="info" onPress={cargarFiltros} disabled={!data} />
            <Button label="Aplicar filtros" icon="filter-outline" tone="accent" onPress={aplicarFiltros} disabled={!data} />
            <Button label="Limpiar" icon="close-outline" tone="info" onPress={limpiarFiltros} />
          </View>
          {loading && <Loading label={loadingLabel || "Procesando..."} />}
          {!loading && !data && <EmptyState title="Sin tablero" subtitle="Presione Buscar operacion activa. La app no consulta despacho automaticamente." />}
          {!!data?.operacion && (
            <View style={styles.operationBox}>
              <Text style={styles.operationText}>
                {data.operacion.codigo_operacion} | {data.operacion.nombre_buque} | {data.operacion.estado}
              </Text>
            </View>
          )}
        </Card>

        {!!data && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>Filtros</Text>
              <View style={styles.filterGrid}>
                {FILTER_KEYS.map(([key, label]) => (
                  <FilterBox
                    key={key}
                    label={label}
                    value={filters[key] || ""}
                    options={optionsForKey(opcionesCompletas, key)}
                    open={openFilter === key}
                    onToggle={(nextOpen) => setOpenFilter(nextOpen ? key : null)}
                    onChange={(value) => setFilters((current) => ({ ...current, [key]: value }))}
                  />
                ))}
              </View>
            </Card>

            <View style={styles.kpiGrid}>
              {kpis.map(([label, value, tone]) => (
                <Kpi key={label} label={label} value={formatNumber(value, 0)} tone={tone} />
              ))}
            </View>

            <Card>
              <Text style={styles.planText}>
                Promedio real por camion {formatNumber(plan.promedio_camion_mt)} MT. Pendiente {formatNumber(plan.pendiente_mt)} MT:
                {" "}se estiman {formatNumber(plan.viajes_estimados, 0)} viajes. Delta guias: {formatNumber(plan.delta_guias, 0)}.
              </Text>
              {(data.alertas || []).map((alerta, index) => (
                <Text key={index} style={styles.alertText}>{alerta.nivel}: {alerta.mensaje}</Text>
              ))}
            </Card>

            <BoardTable title="Solicitudes de nuevo viaje" rows={data.solicitudes_pendientes || []} kind="solicitud" onSelect={selectRow} onLongPress={showRowMenu} />
            <BoardTable title="Pendientes de reasignar" rows={data.pendientes_reasignacion || []} kind="guia" onSelect={selectRow} onLongPress={showRowMenu} />
            <BoardTable title="Guias asignadas" rows={data.guias_asignadas || []} kind="guia" onSelect={selectRow} onLongPress={showRowMenu} />
            <BoardTable title="Primer escaneo / ingreso puerto" rows={data.primer_escaneo || []} kind="guia" onSelect={selectRow} onLongPress={showRowMenu} />
            <BoardTable title="Segundo escaneo / tolva" rows={data.segundo_escaneo || []} kind="guia" onSelect={selectRow} onLongPress={showRowMenu} />
            <BoardTable title="Tercer escaneo / ciclo completado" rows={data.completadas || []} kind="guia" onSelect={selectRow} onLongPress={showRowMenu} />
            <SmallList title="Choferes disponibles" rows={data.choferes_disponibles || []} fields={["chofer", "placa", "estado"]} />
            <SmallList title="Bloqueos activos" rows={data.bloqueos || []} fields={["chofer", "placa", "motivo"]} />
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!actionMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenu(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActionMenu(null)}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <Text style={styles.actionTitle}>
              {actionMenu?.kind === "solicitud"
                ? "Solicitud de viaje"
                : `Guia ${actionMenu?.row?.guia || actionMenu?.row?.id || ""}`}
            </Text>
            <Text style={styles.actionSubtitle}>Seleccione una accion operativa.</Text>
            {actionOptions().map((option) => (
              <Pressable
                key={option.label}
                style={[styles.actionMenuButton, option.danger && styles.actionMenuButtonDanger]}
                onPress={() => runActionMenu(option)}
              >
                <Text style={[styles.actionMenuButtonText, option.danger && styles.actionMenuButtonDangerText]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.actionMenuButton} onPress={() => setActionMenu(null)}>
              <Text style={styles.actionMenuButtonText}>Salir</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function FilterBox({ label, value, options, open, onToggle, onChange }) {
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = options.filter((item) => String(item).toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  return (
    <View style={styles.filterBox}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.comboWrap}>
        <TextInput
          value={query}
          onFocus={() => onToggle(true)}
          onChangeText={(text) => {
            setQuery(text);
            onChange(text);
            onToggle(true);
          }}
          style={[styles.input, styles.comboInput]}
          placeholder="Escriba o seleccione"
          placeholderTextColor={COLORS.auxiliary}
        />
        <Pressable style={styles.comboArrow} onPress={() => onToggle(!open)}>
          <Text style={styles.comboArrowText}>{open ? "▲" : "▼"}</Text>
        </Pressable>
      </View>
      {open && (
        <View style={styles.optionList}>
          <Pressable onPress={() => { setQuery(""); onChange(""); onToggle(false); }} style={styles.optionRow}>
            <Text style={styles.optionText}>Todos</Text>
          </Pressable>
          {filtered.map((item) => (
            <Pressable key={String(item)} onPress={() => { setQuery(String(item)); onChange(String(item)); onToggle(false); }} style={styles.optionRow}>
              <Text style={styles.optionText}>{String(item)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => onToggle(false)} style={[styles.optionRow, styles.optionCloseRow]}>
            <Text style={styles.optionCloseText}>Cancelar / salir</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function BoardTable({ title, rows, kind, onSelect, onLongPress }) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}: {rows.length}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Sin registros.</Text>
      ) : (
        <View style={styles.mobileTable}>
          {rows.slice(0, 60).map((row, index) => (
            <Pressable
              key={`${title}-${row.id}-${index}`}
              style={styles.mobileRow}
              onPress={() => onSelect(row, kind)}
              onLongPress={() => onLongPress?.(row, kind)}
              delayLongPress={450}
            >
              <View style={styles.mobileRowHeader}>
                <Text style={styles.mobileGuide}>{row.guia || `ID ${row.id || ""}`}</Text>
                <Text style={styles.mobileStatus}>{row.estado_asignacion || row.estado || "PENDIENTE"}</Text>
              </View>
              <Text style={styles.mobileMain} numberOfLines={1}>
                {row.empresa || row.empresa_previa || "Sin cliente"} | {row.producto || row.producto_previo || "Sin producto"}
              </Text>
              <Text style={styles.mobileMeta} numberOfLines={1}>
                {row.chofer || row.chofer_asignado || "Sin chofer"} | {row.placa || row.placa_asignada || "Sin placa"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

function SmallList({ title, rows, fields }) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}: {rows.length}</Text>
      {rows.slice(0, 30).map((row, index) => (
        <View key={`${title}-${index}`} style={styles.smallRow}>
          {fields.map((field) => <Text key={field} style={styles.smallCell}>{row[field] || "-"}</Text>)}
        </View>
      ))}
      {rows.length === 0 && <Text style={styles.emptyText}>Sin registros.</Text>}
    </Card>
  );
}

function optionsForKey(opciones, key) {
  const map = {
    guia: "guias",
    empresa: "empresas",
    producto: "productos",
    chofer: "choferes",
    placa: "placas"
  };
  return (opciones?.[map[key]] || []).filter((item) => item !== null && item !== undefined && item !== "");
}

function mergeOpciones(opciones, data) {
  const merged = {
    guias: [...(opciones?.guias || [])],
    empresas: [...(opciones?.empresas || [])],
    productos: [...(opciones?.productos || [])],
    choferes: [...(opciones?.choferes || [])],
    placas: [...(opciones?.placas || [])]
  };

  const grupos = [
    data?.solicitudes_pendientes,
    data?.pendientes_reasignacion,
    data?.guias_asignadas,
    data?.primer_escaneo,
    data?.segundo_escaneo,
    data?.completadas,
    data?.choferes_disponibles
  ];

  for (const rows of grupos) {
    for (const row of rows || []) {
      addUnique(merged.guias, row.guia);
      addUnique(merged.empresas, row.empresa || row.empresa_previa);
      addUnique(merged.productos, row.producto || row.producto_previo);
      addUnique(merged.choferes, row.chofer || row.chofer_asignado || row.chofer_previo);
      addUnique(merged.placas, row.placa || row.placa_asignada || row.placa_previa);
    }
  }

  return Object.fromEntries(Object.entries(merged).map(([key, values]) => [
    key,
    [...new Set(values.filter((item) => item !== null && item !== undefined && String(item).trim() !== "").map(String))]
      .sort((a, b) => a.localeCompare(b))
  ]));
}

function addUnique(list, value) {
  if (value !== null && value !== undefined && String(value).trim() !== "") {
    list.push(String(value));
  }
}

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== ""));
}

function formatNumber(value, decimals = 2) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center"
  },
  operationBox: {
    marginTop: 12,
    backgroundColor: COLORS.elevated,
    borderRadius: 8,
    padding: 12
  },
  operationText: {
    color: COLORS.text,
    fontWeight: "900"
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 10
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  filterBox: {
    width: "100%"
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 6
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontWeight: "800"
  },
  comboWrap: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  comboInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0
  },
  comboArrow: {
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: COLORS.border,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    minWidth: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  comboArrowText: {
    color: COLORS.accent,
    fontWeight: "900"
  },
  optionList: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: COLORS.bg
  },
  optionRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border
  },
  optionText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12
  },
  optionCloseRow: {
    backgroundColor: COLORS.elevated
  },
  optionCloseText: {
    color: COLORS.accent,
    fontWeight: "900",
    fontSize: 12
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  inputBox: {
    flex: 1,
    minWidth: "100%"
  },
  canalChip: {
    backgroundColor: COLORS.elevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 7
  },
  canalChipActive: {
    backgroundColor: COLORS.accent
  },
  canalText: {
    color: COLORS.text,
    fontWeight: "900"
  },
  canalTextActive: {
    color: COLORS.bg
  },
  selectedText: {
    marginTop: 10,
    color: COLORS.muted,
    fontWeight: "800"
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10
  },
  planText: {
    color: COLORS.text,
    fontWeight: "900",
    lineHeight: 22
  },
  alertText: {
    marginTop: 8,
    color: COLORS.danger,
    fontWeight: "900"
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "800",
    paddingVertical: 12
  },
  mobileTable: {
    gap: 8
  },
  mobileRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 10
  },
  mobileRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  mobileGuide: {
    color: COLORS.text,
    fontWeight: "900",
    flex: 1
  },
  mobileStatus: {
    color: COLORS.accent,
    fontWeight: "900",
    maxWidth: "45%",
    textAlign: "right"
  },
  mobileMain: {
    marginTop: 5,
    color: COLORS.text,
    fontWeight: "800"
  },
  mobileMeta: {
    marginTop: 3,
    color: COLORS.muted,
    fontWeight: "800"
  },
  smallRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border
  },
  smallCell: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    padding: 22
  },
  actionSheet: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    gap: 9
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  actionSubtitle: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 4
  },
  actionMenuButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: COLORS.elevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  actionMenuButtonDanger: {
    borderWidth: 1,
    borderColor: COLORS.danger
  },
  actionMenuButtonText: {
    color: COLORS.text,
    fontWeight: "900"
  },
  actionMenuButtonDangerText: {
    color: COLORS.danger
  }
});
