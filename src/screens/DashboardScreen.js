import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, DistributionChart, EmptyState, Kpi, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

const emptyFilters = {
  empresa: "",
  bodega: "",
  guia: "",
  producto: "",
  chofer: "",
  placa: "",
  estado: "",
  etapa_qr: ""
};

const filterLabels = {
  empresa: "Empresa",
  bodega: "Bodega",
  guia: "Guia",
  producto: "Producto",
  chofer: "Chofer",
  placa: "Placa",
  estado: "Estado",
  etapa_qr: "Etapa QR"
};

const optionMap = {
  empresa: "empresas",
  bodega: "bodegas",
  guia: "guias",
  producto: "productos",
  chofer: "choferes",
  placa: "placas",
  estado: "estados",
  etapa_qr: "etapas_qr"
};

const manualFilterKeys = ["guia", "chofer", "placa", "estado", "etapa_qr"];

const bodegaColors = {
  1: COLORS.teal,
  2: COLORS.info,
  3: COLORS.accentLight,
  4: COLORS.success,
  5: COLORS.accent
};

export default function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operaciones, setOperaciones] = useState([]);
  const [selectedOperacion, setSelectedOperacion] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [filterData, setFilterData] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [data, setData] = useState(null);
  const [controlPlan, setControlPlan] = useState(null);
  const [controlPlanLoading, setControlPlanLoading] = useState(false);
  const [saludOperativa, setSaludOperativa] = useState(null);
  const [saludOperativaLoading, setSaludOperativaLoading] = useState(false);
  const [spc, setSpc] = useState(null);
  const [spcLoading, setSpcLoading] = useState(false);
  const [bloqueosInteligentes, setBloqueosInteligentes] = useState(null);
  const [bloqueosLoading, setBloqueosLoading] = useState(false);
  const [excepcionesOperativas, setExcepcionesOperativas] = useState(null);
  const [excepcionesLoading, setExcepcionesLoading] = useState(false);
  const [auditoriaSenior, setAuditoriaSenior] = useState(null);
  const [auditoriaSeniorLoading, setAuditoriaSeniorLoading] = useState(false);
  const [cierreGuiado, setCierreGuiado] = useState(null);
  const [cierreGuiadoLoading, setCierreGuiadoLoading] = useState(false);
  const [modoOffline, setModoOffline] = useState(null);
  const [modoOfflineLoading, setModoOfflineLoading] = useState(false);
  const [productividad, setProductividad] = useState(null);
  const [productividadLoading, setProductividadLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const params = useMemo(() => cleanParams(filters), [filters]);
  const opcionesCompletas = useMemo(() => mergeOpciones(filterData?.opciones || {}, data), [filterData, data]);
  const kpis = data?.kpis || {};
  const graficos = data?.graficos || {};
  const bodegas = data?.bodegas || [];
  const clientes = data?.clientes || [];
  const alertas = data?.alertas || [];
  const plan = data?.plan_viajes || {};

  async function loadOperaciones() {
    setOperationsLoading(true);
    try {
      let response = await api.getOperaciones();
      let rows = Array.isArray(response?.data) ? response.data : [];
      if (!rows.length) {
        const activa = await api.getOperacionActiva().catch(() => null);
        rows = activa?.id ? [activa] : [];
      }
      setOperaciones(rows);
      if (!selectedOperacion && rows.length) {
        const abierta = rows.find((op) => op.estado === "ABIERTA") || rows[0];
        selectOperacion(abierta);
      }
    } catch (error) {
      const activa = await api.getOperacionActiva().catch(() => null);
      if (activa?.id) {
        setOperaciones([activa]);
        selectOperacion(activa);
        setData(null);
      } else {
        setData({ error: error.message });
      }
    } finally {
      setOperationsLoading(false);
    }
  }

  async function loadFiltersForOperation(operacionId, silent = false) {
    if (!operacionId) return;
    setFiltersLoading(true);
    try {
      const response = await api.getReporteBuqueFiltros(operacionId);
      setFilterData(response);
      applyDateHints(response?.opciones || {});
    } catch (error) {
      if (!silent) setFilterData({ error: error.message });
    } finally {
      setFiltersLoading(false);
    }
  }

  async function loadFilters() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Primero presione Buscar operacion y seleccione un buque.");
      return;
    }
    await loadFiltersForOperation(selectedOperacion.id);
  }

  async function loadReport(options = {}) {
    const silent = Boolean(options.silent);
    if (!selectedOperacion?.id) {
      if (!silent) Alert.alert("Operacion requerida", "Seleccione una operacion antes de generar datos.");
      return;
    }
    if (!silent) setLoading(true);
    try {
      const [response, filtros] = await Promise.all([
        api.getReporteBuque(selectedOperacion.id, params),
        api.getReporteBuqueFiltros(selectedOperacion.id).catch(() => null)
      ]);
      if (filtros?.opciones) {
        setFilterData(filtros);
      }
      setData(response);
      setHasGenerated(true);
    } catch (error) {
      setData({ error: error.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function selectOperacion(op) {
    setSelectedOperacion(op);
    setData(null);
    setFilters(emptyFilters);
    setFilterData(null);
    setControlPlan(null);
    setSaludOperativa(null);
    setSpc(null);
    setBloqueosInteligentes(null);
    setExcepcionesOperativas(null);
    setAuditoriaSenior(null);
    setCierreGuiado(null);
    setModoOffline(null);
    setProductividad(null);
    setHasGenerated(false);
    if (op?.id) {
      loadFiltersForOperation(op.id, true);
    }
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setFilterData(null);
    setData(null);
    setControlPlan(null);
    setSaludOperativa(null);
    setSpc(null);
    setBloqueosInteligentes(null);
    setExcepcionesOperativas(null);
    setAuditoriaSenior(null);
    setCierreGuiado(null);
    setModoOffline(null);
    setProductividad(null);
    setHasGenerated(false);
  }

  function clearVisualFilters() {
    setFilters(emptyFilters);
  }

  useEffect(() => {
    if (!hasGenerated || !selectedOperacion?.id) return undefined;
    const timer = setTimeout(() => {
      loadReport({ silent: true });
    }, 700);
    return () => clearTimeout(timer);
  }, [filters]);

  function applyDateHints(opciones) {
    if (!opciones) return;
  }

  function exportReport(formato) {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de exportar.");
      return;
    }
    Linking.openURL(api.reporteBuqueDownloadUrl(selectedOperacion.id, formato, params));
  }

  async function loadControlPlan() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de consultar el control plan.");
      return;
    }
    setControlPlanLoading(true);
    try {
      const response = await api.getControlPlanOperacion(selectedOperacion.id);
      setControlPlan(response);
    } catch (error) {
      setControlPlan({ error: error.message });
    } finally {
      setControlPlanLoading(false);
    }
  }

  async function loadSaludOperativa() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de consultar salud operativa.");
      return;
    }
    setSaludOperativaLoading(true);
    try {
      const response = await api.getSaludOperativaOperacion(selectedOperacion.id);
      setSaludOperativa(response);
    } catch (error) {
      setSaludOperativa({ error: error.message });
    } finally {
      setSaludOperativaLoading(false);
    }
  }

  async function loadSpc() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de consultar SPC.");
      return;
    }
    setSpcLoading(true);
    try {
      const response = await api.getSpcOperacion(selectedOperacion.id);
      setSpc(response);
    } catch (error) {
      setSpc({ error: error.message });
    } finally {
      setSpcLoading(false);
    }
  }

  async function loadBloqueosInteligentes() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de consultar bloqueos inteligentes.");
      return;
    }
    setBloqueosLoading(true);
    try {
      const response = await api.getBloqueosInteligentesOperacion(selectedOperacion.id);
      setBloqueosInteligentes(response);
    } catch (error) {
      setBloqueosInteligentes({ error: error.message });
    } finally {
      setBloqueosLoading(false);
    }
  }

  async function loadExcepcionesOperativas() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de consultar excepciones.");
      return;
    }
    setExcepcionesLoading(true);
    try {
      const response = await api.getExcepcionesOperacion(selectedOperacion.id);
      setExcepcionesOperativas(response);
    } catch (error) {
      setExcepcionesOperativas({ error: error.message });
    } finally {
      setExcepcionesLoading(false);
    }
  }

  async function loadAuditoriaSenior() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de consultar auditoria senior.");
      return;
    }
    setAuditoriaSeniorLoading(true);
    try {
      const response = await api.getAuditoriaSeniorOperacion(selectedOperacion.id);
      setAuditoriaSenior(response);
    } catch (error) {
      setAuditoriaSenior({ error: error.message });
    } finally {
      setAuditoriaSeniorLoading(false);
    }
  }

  async function loadCierreGuiado() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de evaluar cierre guiado.");
      return;
    }
    setCierreGuiadoLoading(true);
    try {
      const response = await api.getCierreGuiadoOperacion(selectedOperacion.id);
      setCierreGuiado(response);
    } catch (error) {
      setCierreGuiado({ error: error.message });
    } finally {
      setCierreGuiadoLoading(false);
    }
  }

  async function loadModoOffline() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de evaluar modo offline.");
      return;
    }
    setModoOfflineLoading(true);
    try {
      const response = await api.getModoOfflineOperacion(selectedOperacion.id);
      setModoOffline(response);
    } catch (error) {
      setModoOffline({ error: error.message });
    } finally {
      setModoOfflineLoading(false);
    }
  }

  async function loadProductividad() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de calcular productividad.");
      return;
    }
    setProductividadLoading(true);
    try {
      const response = await api.getProductividadOperacion(selectedOperacion.id);
      setProductividad(response);
    } catch (error) {
      setProductividad({ error: error.message });
    } finally {
      setProductividadLoading(false);
    }
  }

  async function ejecutarCierreGuiado() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de cerrar.");
      return;
    }
    const evaluacion = cierreGuiado || (await api.getCierreGuiadoOperacion(selectedOperacion.id));
    if (!evaluacion?.puede_cerrar) {
      setCierreGuiado(evaluacion);
      Alert.alert("Cierre bloqueado", "Revise el checklist. Hay bloqueos antes del cierre.");
      return;
    }
    Alert.alert(
      "Confirmar cierre",
      evaluacion.requiere_confirmacion
        ? "Hay observaciones no criticas. Desea cerrar con confirmacion gerencial?"
        : "Desea cerrar la operacion con cierre operativo guiado?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar",
          style: "destructive",
          onPress: async () => {
            setCierreGuiadoLoading(true);
            try {
              const response = await api.ejecutarCierreGuiadoOperacion(selectedOperacion.id, {
                usuario: "mobile",
                comentario: "Cierre ejecutado desde app movil.",
                forzar: Boolean(evaluacion.requiere_confirmacion)
              });
              setCierreGuiado(response?.evaluacion || null);
              Alert.alert("Cierre guiado", response?.mensaje || "Operacion cerrada correctamente.");
              loadOperaciones();
            } catch (error) {
              Alert.alert("Cierre guiado", error.message);
            } finally {
              setCierreGuiadoLoading(false);
            }
          }
        }
      ]
    );
  }

  async function generarExcepcionesOperativas() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de generar excepciones.");
      return;
    }
    setExcepcionesLoading(true);
    try {
      const response = await api.generarExcepcionesDesdeBloqueos(selectedOperacion.id);
      const refreshed = await api.getExcepcionesOperacion(selectedOperacion.id);
      setExcepcionesOperativas(refreshed);
      Alert.alert("Excepciones", response?.mensaje || "Excepciones generadas.");
    } catch (error) {
      setExcepcionesOperativas({ error: error.message });
    } finally {
      setExcepcionesLoading(false);
    }
  }

  async function cerrarExcepcionMobile(id) {
    setExcepcionesLoading(true);
    try {
      await api.cerrarExcepcionOperativa(id, "Cerrada desde app movil.");
      const refreshed = await api.getExcepcionesOperacion(selectedOperacion.id);
      setExcepcionesOperativas(refreshed);
    } catch (error) {
      Alert.alert("Excepcion", error.message);
    } finally {
      setExcepcionesLoading(false);
    }
  }

  return (
    <Screen
      title="Centro Ejecutivo"
      subtitle="Control gerencial por buque: bodegas, cuotas, descargado, alertas, KPIs y graficos."
      horizontal={false}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <Card>
          <Text style={styles.sectionTitle}>Operacion y filtros dinamicos</Text>
          <View style={styles.actions}>
            <Button label="Buscar operacion" icon="boat-outline" tone="accent" onPress={loadOperaciones} />
            <Button label="Generar datos" icon="bar-chart-outline" tone="info" onPress={loadReport} />
          </View>

          {operationsLoading && <Loading label="Buscando operaciones..." />}
          <OperationSelector operaciones={operaciones} selected={selectedOperacion} onSelect={selectOperacion} />

          {!!selectedOperacion && (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedText}>
                Datos generados para {selectedOperacion.nombre_buque || "operacion seleccionada"}.
              </Text>
              <Text style={styles.selectedMeta}>
                Inicio {selectedOperacion.fecha_inicio || "-"} | Estado {selectedOperacion.estado || "-"}
              </Text>
            </View>
          )}

          {filtersLoading && <Loading label="Cargando filtros dinamicos..." />}
          {!!filterData?.error && <Text style={styles.errorText}>{filterData.error}</Text>}
          <View style={styles.filterGrid}>
            {manualFilterKeys.map((key) => (
              <FilterCombo
                key={key}
                name={key}
                label={filterLabels[key]}
                value={filters[key]}
                options={opcionesCompletas?.[optionMap[key]] || []}
                editable
                active={activeFilter === key}
                onFocus={() => setActiveFilter(key)}
                onBlur={() => setTimeout(() => setActiveFilter((current) => (current === key ? null : current)), 180)}
                onChange={(value) => updateFilter(key, value)}
                onSelect={(value) => {
                  updateFilter(key, value);
                  setActiveFilter(null);
                }}
              />
            ))}
          </View>
        </Card>

        <View style={styles.exportRow}>
          <Button label="Exportar PDF" icon="document-text-outline" tone="info" onPress={() => exportReport("pdf")} />
          <Button label="Exportar Excel" icon="grid-outline" tone="info" onPress={() => exportReport("excel")} />
          <Button label="Exportar Word" icon="document-outline" tone="info" onPress={() => exportReport("word")} />
        </View>

        {loading && <Loading label="Generando centro ejecutivo..." />}
        {!loading && !data && (
          <EmptyState
            title="Centro Ejecutivo listo"
            subtitle="Presione Buscar operacion, seleccione un buque y luego Generar datos. No se consulta el backend automaticamente."
          />
        )}
        {!loading && data?.error && <EmptyState title="No se pudo cargar" subtitle={data.error} icon="alert-circle-outline" />}

        {controlPlanLoading && <Loading label="Evaluando control plan..." />}
        <ControlPlanPanel data={controlPlan} />
        {saludOperativaLoading && <Loading label="Calculando salud operativa..." />}
        <SaludOperativaPanel data={saludOperativa} />
        {spcLoading && <Loading label="Calculando SPC..." />}
        <SpcPanel data={spc} />
        {bloqueosLoading && <Loading label="Evaluando bloqueos inteligentes..." />}
        <BloqueosInteligentesPanel data={bloqueosInteligentes} />
        {excepcionesLoading && <Loading label="Cargando excepciones..." />}
        <ExcepcionesOperativasPanel data={excepcionesOperativas} onClose={cerrarExcepcionMobile} />
        {auditoriaSeniorLoading && <Loading label="Ejecutando auditoria senior..." />}
        <AuditoriaSeniorPanel data={auditoriaSenior} />
        {cierreGuiadoLoading && <Loading label="Validando cierre guiado..." />}
        <CierreGuiadoPanel data={cierreGuiado} onClose={ejecutarCierreGuiado} />
        {modoOfflineLoading && <Loading label="Evaluando modo offline..." />}
        <ModoOfflinePanel data={modoOffline} />
        {productividadLoading && <Loading label="Calculando productividad..." />}
        <ProductividadPanel data={productividad} />

        {!loading && data && !data.error && (
          <>
            <KpiGrid kpis={kpis} />
            <ShipProgress
              bodegas={bodegas}
              onSelect={(numero) => updateFilter("bodega", String(numero))}
              onClear={clearVisualFilters}
            />
            <ExecutiveReading operacion={data.operacion || selectedOperacion || {}} kpis={kpis} alertas={alertas} plan={plan} />

            <PlanPanel plan={plan} />

            <MetricBarChart
              title="Descargado por bodega (MT)"
              data={orderedBodegaChart(graficos.avance_bodegas)}
              labelKey="bodega"
              valueKey="retirado_mt"
              bodega
              onSelect={(item) => updateFilter("bodega", String(bodegaNumber(item.bodega || item.bodega_numero)))}
              onClear={clearVisualFilters}
            />
            <MetricBarChart
              title="Pendiente por bodega (MT)"
              data={orderedBodegaChart(graficos.faltante_bodegas)}
              labelKey="bodega"
              valueKey="faltante_mt"
              bodega
              onSelect={(item) => updateFilter("bodega", String(bodegaNumber(item.bodega || item.bodega_numero)))}
              onClear={clearVisualFilters}
            />
            <DistributionChart title="Estado descarga" data={graficos.estado_descarga || []} labelKey="estado" valueKey="valor" />
            <MetricBarChart
              title="Descargado por cliente (MT)"
              data={graficos.retiro_por_cliente || []}
              labelKey="cliente"
              valueKey="retirado_mt"
              onSelect={(item) => updateFilter("empresa", item.cliente || item.empresa || "")}
              onClear={clearVisualFilters}
            />
            <MetricBarChart
              title="Descargado por producto (MT)"
              data={graficos.retiro_por_producto || []}
              labelKey="producto"
              valueKey="retirado_mt"
              onSelect={(item) => updateFilter("producto", item.producto || "")}
              onClear={clearVisualFilters}
            />
            <DistributionChart title="Estado de guias" data={graficos.estado_guias || []} labelKey="estado" valueKey="valor" />
            <MetricLine title="Tendencia diaria descargado (MT)" data={graficos.tendencia_fecha || []} labelKey="fecha" valueKey="retirado_mt" />
            <MetricBarChart title="Duracion por camion (min)" data={graficos.duracion_por_camion || []} labelKey="camion" valueKey="duracion_min" />
            <MetricBarChart
              title="Avance por bodega (%)"
              data={orderedBodegaChart(graficos.avance_bodegas)}
              labelKey="bodega"
              valueKey="avance_pct"
              bodega
              onSelect={(item) => updateFilter("bodega", String(bodegaNumber(item.bodega || item.bodega_numero)))}
              onClear={clearVisualFilters}
            />

            <CuotasTable
              rows={clientes}
              onSelect={(row) => {
                if (row.empresa) updateFilter("empresa", row.empresa);
                if (row.producto) updateFilter("producto", row.producto);
                if (row.bodega_numero) updateFilter("bodega", String(row.bodega_numero));
              }}
            />
            <AlertasTable rows={alertas} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function OperationSelector({ operaciones, selected, onSelect }) {
  if (!operaciones.length) {
    return (
      <Text style={styles.helperText}>
        Presione Buscar operacion para llenar el selector. La app no consulta datos automaticamente.
      </Text>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.operationScroll}>
      {operaciones.map((op) => {
        const isSelected = Number(selected?.id) === Number(op.id);
        return (
          <Text
            key={op.id}
            onPress={() => onSelect(op)}
            style={[styles.operationChip, isSelected && styles.operationChipSelected]}
          >
            {op.id} | {op.nombre_buque} | {op.fecha_inicio} | {op.estado}
          </Text>
        );
      })}
    </ScrollView>
  );
}

function FilterCombo({ name, label, value, options, active, onFocus, onBlur, onChange, onSelect }) {
  const typed = String(value || "").toLowerCase();
  const cleanOptions = [...new Set((options || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const filteredOptions = cleanOptions
    .filter((item) => !typed || item.toLowerCase().includes(typed))
    .slice(0, 18);

  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={`Filtrar ${label}`}
        placeholderTextColor={COLORS.auxiliary}
        autoCapitalize="none"
        style={styles.input}
      />
      {active && (
        <View style={styles.comboPanel}>
          <Text onPress={() => onSelect("")} style={[styles.comboOption, !value && styles.comboOptionSelected]}>
            (Todos)
          </Text>
          {filteredOptions.map((item) => (
            <Text
              key={`${name}-${item}`}
              onPress={() => onSelect(item)}
              style={[styles.comboOption, String(value || "") === item && styles.comboOptionSelected]}
              numberOfLines={1}
            >
              {item}
            </Text>
          ))}
          {!filteredOptions.length && <Text style={styles.comboEmpty}>Sin coincidencias</Text>}
        </View>
      )}
    </View>
  );
}

function KpiGrid({ kpis }) {
  const cards = [
    ["Guias", formatInt(kpis.total_guias), "accent"],
    ["Completas", formatInt(kpis.completas), "success"],
    ["Pendientes", formatInt(kpis.pendientes), "warning"],
    ["Capacidad MT", formatNumber(kpis.capacidad_mt), "info"],
    ["Descargado MT", formatNumber(kpis.retirado_mt), "success"],
    ["Pendiente descarga MT", formatNumber(kpis.faltante_mt), "warning"],
    ["Avance", `${formatNumber(kpis.avance_descarga_pct)}%`, "accent"],
    ["Duracion prom.", `${formatNumber(kpis.duracion_promedio_min)} min`, "accent"],
    ["Prom. MT/camion", formatNumber(kpis.promedio_mt_camion), "info"],
    ["Viajes sugeridos", formatInt(kpis.viajes_estimados_necesarios), "warning"]
  ];

  return (
    <View style={styles.kpiGrid}>
      {cards.map(([label, value, tone]) => (
        <Kpi key={label} label={label} value={value} tone={tone} />
      ))}
    </View>
  );
}

function ShipProgress({ bodegas, onSelect, onClear }) {
  const source = Array.isArray(bodegas) ? bodegas : [];
  const ordered = [5, 4, 3, 2, 1].map((numero) => {
    const row = source.find((item) => Number(item.bodega_numero) === numero) || { bodega_numero: numero };
    const capacidad = Number(row.capacidad_mt || 0);
    const retirado = Number(row.retirado_mt || 0);
    const faltante = Number(row.faltante_mt ?? Math.max(capacidad - retirado, 0));
    const pendientePct = capacidad ? (faltante / capacidad) * 100 : 0;
    const avancePct = Number(row.avance_pct || 0);
    return { numero, capacidad, retirado, faltante, pendientePct, avancePct };
  });

  return (
    <Pressable onPress={onClear}>
      <Card>
      <Text style={styles.sectionTitle}>Progreso visual por bodega</Text>
      <Text style={styles.shipHint}>Cada bodega se vacia conforme peso lleno - peso vacio se descuenta contra su capacidad MT.</Text>
      <View style={styles.shipBody}>
        {ordered.map((item) => (
          <Pressable
            key={item.numero}
            style={[styles.hold, { backgroundColor: bodegaColors[item.numero] || COLORS.accent }]}
            onPress={(event) => {
              event?.stopPropagation?.();
              onSelect?.(item.numero);
            }}
          >
            <Text style={styles.holdTitle}>B{item.numero}</Text>
            <Text style={styles.holdText}>{formatNumber(item.faltante)}/{formatNumber(item.capacidad)}</Text>
            <Text style={styles.holdText}>Pend. {formatNumber(item.pendientePct)}%</Text>
            <Text style={styles.holdText}>Desc. {formatNumber(item.avancePct)}%</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.shipDownloadedRow}>
        {ordered.map((item) => (
          <Text key={item.numero} style={styles.shipDownloaded}>B{item.numero}: {formatNumber(item.retirado)} MT</Text>
        ))}
      </View>
      </Card>
    </Pressable>
  );
}

function ExecutiveReading({ operacion, kpis, alertas, plan }) {
  const riesgo = alertas?.length ? "ALTO" : "CONTROLADO";
  return (
    <Card style={styles.readingCard}>
      <Text style={styles.sectionTitle}>Lectura ejecutiva</Text>
      <Text style={styles.readingText}>Buque: {operacion.nombre_buque || "-"}</Text>
      <Text style={styles.readingText}>Estado: {operacion.estado || "-"}</Text>
      <Text style={styles.readingText}>Guias: {formatInt(kpis.total_guias)} | Completas: {formatInt(kpis.completas)}</Text>
      <Text style={styles.readingText}>Descargado: {formatNumber(kpis.retirado_mt)} MT</Text>
      <Text style={styles.readingText}>Pendiente de descarga: {formatNumber(kpis.faltante_mt)} MT</Text>
      <Text style={styles.readingText}>Avance: {formatNumber(kpis.avance_descarga_pct)}% | Riesgo: {riesgo}</Text>
      <Text style={[styles.readingText, styles.planText]}>Plan viajes: {plan?.mensaje || "Sin estimacion disponible."}</Text>
    </Card>
  );
}

function PlanPanel({ plan }) {
  if (!plan?.mensaje) {
    return null;
  }
  const tone = plan.estado === "BALANCEADO" ? COLORS.success : plan.estado === "FALTAN_VIAJES" ? COLORS.danger : COLORS.warning;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Plan inteligente de viajes</Text>
      <Text style={styles.helperText}>{plan.mensaje}</Text>
      <Row label="Promedio MT/camion" value={formatNumber(plan.promedio_mt_camion)} />
      <Row label="Viajes estimados" value={formatInt(plan.viajes_estimados_necesarios)} />
      <Row label="Viajes disponibles" value={formatInt(plan.viajes_disponibles_aprobados)} />
    </Card>
  );
}

function ControlPlanPanel({ data }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Control plan no disponible" subtitle={data.error} icon="shield-outline" />;
  }
  const resumen = data.resumen || {};
  const controles = data.controles || [];
  const tone = resumen.estado_general === "CONTROLADO" ? COLORS.success : resumen.estado_general === "CRITICO" ? COLORS.danger : COLORS.warning;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Control Plan Operativo</Text>
      <View style={styles.controlSummary}>
        <Row label="Estado general" value={resumen.estado_general || "-"} />
        <Row label="Score" value={`${formatNumber(resumen.score)}%`} />
        <Row label="OK / Advertencia / Critico" value={`${formatInt(resumen.ok)} / ${formatInt(resumen.advertencia)} / ${formatInt(resumen.critico)}`} />
      </View>
      {controles.map((item) => (
        <View key={item.codigo} style={styles.controlItem}>
          <Text style={styles.controlTitle}>{item.codigo} | {item.proceso} | {item.estado}</Text>
          <Text style={styles.controlText}>CTQ: {item.ctq}</Text>
          <Text style={styles.controlText}>Metrica: {item.metrica}</Text>
          <Text style={styles.controlText}>Valor: {item.valor}</Text>
          <Text style={styles.controlText}>Responsable: {item.responsable}</Text>
          <Text style={styles.controlAction}>Reaccion: {item.reaccion}</Text>
        </View>
      ))}
    </Card>
  );
}

function SaludOperativaPanel({ data }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Salud operativa no disponible" subtitle={data.error} icon="pulse-outline" />;
  }
  const resumen = data.resumen || {};
  const dimensiones = data.dimensiones || [];
  const tone = resumen.estado_general === "CONTROLADO" ? COLORS.success : resumen.estado_general === "CRITICO" ? COLORS.danger : COLORS.warning;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Dashboard de Salud Operativa</Text>
      <View style={styles.healthSummary}>
        <Text style={[styles.healthScore, { color: tone }]}>{formatNumber(resumen.score_global)}%</Text>
        <Text style={styles.healthState}>{resumen.estado_general || "-"}</Text>
        <Text style={styles.helperText}>
          Guias {formatInt(resumen.total_guias)} | Completas {formatInt(resumen.completas)} | Pendientes {formatInt(resumen.pendientes)}
        </Text>
        <Text style={styles.helperText}>
          Bloqueadores {formatInt(resumen.bloqueadores)} | Advertencias {formatInt(resumen.advertencias)} | SOF {formatInt(resumen.sof_total)}
        </Text>
      </View>
      {dimensiones.map((item) => {
        const itemTone = item.estado === "CONTROLADO" ? COLORS.success : item.estado === "CRITICO" ? COLORS.danger : COLORS.warning;
        return (
          <View key={item.codigo} style={[styles.healthItem, { borderLeftColor: itemTone }]}>
            <Text style={styles.healthTitle}>{item.codigo} | {item.nombre}</Text>
            <Text style={[styles.healthStatus, { color: itemTone }]}>{item.estado} | {formatNumber(item.score)}%</Text>
            <Text style={styles.controlText}>Valor: {item.valor}</Text>
            <Text style={styles.controlText}>{item.detalle}</Text>
            <Text style={styles.controlAction}>Accion: {item.accion}</Text>
          </View>
        );
      })}
    </Card>
  );
}

function SpcPanel({ data }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="SPC no disponible" subtitle={data.error} icon="analytics-outline" />;
  }
  const resumen = data.resumen || {};
  const metricas = data.metricas || [];
  const recomendaciones = data.recomendaciones || [];
  const tone = resumen.estado_general === "CONTROLADO" ? COLORS.success : resumen.estado_general === "FUERA_CONTROL" ? COLORS.danger : COLORS.warning;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>SPC / Control Estadistico</Text>
      <View style={styles.healthSummary}>
        <Text style={[styles.healthScore, { color: tone }]}>{resumen.estado_general || "-"}</Text>
        <Text style={styles.helperText}>
          Senales {formatInt(resumen.senales)} | Fuera control {formatInt(resumen.fuera_control)}
        </Text>
        <Text style={styles.helperText}>
          Peso prom. {formatNumber(resumen.peso_promedio_mt)} MT | Duracion prom. {formatNumber(resumen.duracion_promedio_min)} min
        </Text>
        <Text style={styles.helperText}>
          Productividad prom. {formatNumber(resumen.productividad_promedio_mt_dia)} MT/dia
        </Text>
      </View>
      {metricas.map((item) => {
        const itemTone = item.estado === "CONTROLADO" ? COLORS.success : item.estado === "FUERA_CONTROL" ? COLORS.danger : item.estado === "SIN_DATOS" ? COLORS.muted : COLORS.warning;
        return (
          <View key={item.codigo} style={[styles.healthItem, { borderLeftColor: itemTone }]}>
            <Text style={styles.healthTitle}>{item.codigo} | {item.nombre}</Text>
            <Text style={[styles.healthStatus, { color: itemTone }]}>{item.estado} | N {formatInt(item.n)} | Senales {formatInt(item.senales_count)}</Text>
            <Text style={styles.controlText}>Promedio: {formatNumber(item.promedio)} {item.unidad}</Text>
            <Text style={styles.controlText}>LCL/UCL: {formatNumber(item.lcl)} / {formatNumber(item.ucl)} | Sigma {formatNumber(item.sigma)}</Text>
            <Text style={styles.controlAction}>Accion: {item.recomendacion}</Text>
            {(item.senales || []).slice(0, 3).map((signal, index) => (
              <Text key={`${item.codigo}-signal-${index}`} style={styles.alertText}>
                {signal.tipo}: {signal.label} | {formatNumber(signal.valor)} {item.unidad}
              </Text>
            ))}
          </View>
        );
      })}
      {!!recomendaciones.length && (
        <View style={styles.controlItem}>
          <Text style={styles.controlTitle}>Recomendaciones</Text>
          {recomendaciones.slice(0, 5).map((item, index) => (
            <Text key={`${item.codigo}-${index}`} style={styles.controlText}>
              {item.metrica}: {item.accion}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

function BloqueosInteligentesPanel({ data }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Bloqueos no disponibles" subtitle={data.error} icon="lock-closed-outline" />;
  }
  const resumen = data.resumen || {};
  const bloqueos = data.bloqueos || [];
  const recomendaciones = data.recomendaciones || [];
  const tone = resumen.estado_general === "CONTROLADO" ? COLORS.success : resumen.estado_general === "BLOQUEAR" ? COLORS.danger : COLORS.warning;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Bloqueos Inteligentes</Text>
      <View style={styles.healthSummary}>
        <Text style={[styles.healthScore, { color: tone }]}>{resumen.estado_general || "-"}</Text>
        <Text style={styles.helperText}>
          Evaluadas {formatInt(resumen.total_evaluados)} | Bloqueos {formatInt(resumen.bloqueos)} | Advertencias {formatInt(resumen.advertencias)}
        </Text>
        <Text style={styles.helperText}>
          Guias afectadas {formatInt(resumen.guias_afectadas)} | Choferes {formatInt(resumen.choferes_afectados)} | Placas {formatInt(resumen.placas_afectadas)}
        </Text>
      </View>
      {!bloqueos.length && <Text style={styles.chartEmpty}>No hay bloqueos inteligentes detectados.</Text>}
      {bloqueos.slice(0, 25).map((item, index) => {
        const itemTone = item.severidad === "BLOQUEO" ? COLORS.danger : item.severidad === "ADVERTENCIA" ? COLORS.warning : COLORS.info;
        return (
          <View key={`${item.codigo}-${item.base_operacion_id}-${index}`} style={[styles.healthItem, { borderLeftColor: itemTone }]}>
            <Text style={styles.healthTitle}>{item.codigo} | {item.tipo} | {item.severidad}</Text>
            <Text style={[styles.healthStatus, { color: itemTone }]}>Guia {item.guia || "-"} | {item.empresa || "-"} | {item.producto || "-"}</Text>
            <Text style={styles.controlText}>{item.chofer || "-"} | {item.placa || "-"} | {item.estado_asignacion || item.estado || "-"}</Text>
            <Text style={styles.controlText}>{item.motivo}</Text>
            <Text style={styles.controlAction}>Accion: {item.accion}</Text>
          </View>
        );
      })}
      {!!recomendaciones.length && (
        <View style={styles.controlItem}>
          <Text style={styles.controlTitle}>Recomendaciones</Text>
          {recomendaciones.map((item, index) => (
            <Text key={`bloqueo-rec-${index}`} style={styles.controlText}>{item}</Text>
          ))}
        </View>
      )}
    </Card>
  );
}

function ExcepcionesOperativasPanel({ data, onClose }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Excepciones no disponibles" subtitle={data.error} icon="warning-outline" />;
  }
  const resumen = data.resumen || {};
  const rows = data.data || [];
  const tone = resumen.criticas_altas ? COLORS.danger : resumen.abiertas ? COLORS.warning : COLORS.success;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Gestion de Excepciones</Text>
      <View style={styles.healthSummary}>
        <Text style={[styles.healthScore, { color: tone }]}>{formatInt(resumen.total)} casos</Text>
        <Text style={styles.helperText}>
          Abiertas {formatInt(resumen.abiertas)} | En revision {formatInt(resumen.en_revision)} | Cerradas {formatInt(resumen.cerradas)}
        </Text>
        <Text style={styles.helperText}>Criticas/altas {formatInt(resumen.criticas_altas)}</Text>
      </View>
      {!rows.length && <Text style={styles.chartEmpty}>No hay excepciones operativas registradas.</Text>}
      {rows.slice(0, 30).map((item) => {
        const itemTone = ["CRITICA", "ALTA"].includes(String(item.severidad || "").toUpperCase())
          ? COLORS.danger
          : item.estado === "CERRADA"
            ? COLORS.success
            : COLORS.warning;
        return (
          <View key={`excepcion-${item.id}`} style={[styles.healthItem, { borderLeftColor: itemTone }]}>
            <Text style={styles.healthTitle}>#{item.id} | {item.severidad} | {item.estado}</Text>
            <Text style={[styles.healthStatus, { color: itemTone }]}>{item.tipo} | Guia {item.guia || "-"}</Text>
            <Text style={styles.controlText}>{item.empresa || "-"} | {item.producto || "-"} | {item.chofer || "-"}</Text>
            <Text style={styles.controlText}>{item.titulo}</Text>
            <Text style={styles.controlAction}>Accion: {item.accion_recomendada || "-"}</Text>
            {String(item.estado || "").toUpperCase() !== "CERRADA" && (
              <Button label="Cerrar caso" icon="checkmark-circle-outline" tone="success" onPress={() => onClose?.(item.id)} />
            )}
          </View>
        );
      })}
    </Card>
  );
}

function AuditoriaSeniorPanel({ data }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Auditoria senior no disponible" subtitle={data.error} icon="ribbon-outline" />;
  }
  const kpis = data.kpis || {};
  const hallazgos = data.hallazgos || [];
  const prioridades = data.prioridades || [];
  const tone = data.nivel === "CONTROLADO" ? COLORS.success : data.nivel === "CRITICO" ? COLORS.danger : COLORS.warning;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Auditoria Senior</Text>
      <View style={styles.healthSummary}>
        <Text style={[styles.healthScore, { color: tone }]}>{data.nivel || "-"}</Text>
        <Text style={styles.helperText}>Score senior {formatNumber(data.score_general)}%</Text>
        <Text style={styles.helperText}>
          Hallazgos {formatInt(kpis.hallazgos)} | Criticos {formatInt(kpis.criticos)} | Altos {formatInt(kpis.altos)} | Medios {formatInt(kpis.medios)}
        </Text>
        <Text style={styles.controlText}>{data.resumen}</Text>
      </View>
      {!!prioridades.length && (
        <View style={styles.controlItem}>
          <Text style={styles.controlTitle}>Prioridades senior</Text>
          {prioridades.slice(0, 5).map((item, index) => (
            <Text key={`aud-pr-${index}`} style={styles.controlText}>
              {item.dimension}: {item.titulo}. Accion: {item.accion}
            </Text>
          ))}
        </View>
      )}
      {!hallazgos.length && <Text style={styles.chartEmpty}>Sin hallazgos senior relevantes.</Text>}
      {hallazgos.slice(0, 30).map((item, index) => {
        const itemTone = ["CRITICA", "BLOQUEO", "ALTA"].includes(String(item.severidad || "").toUpperCase())
          ? COLORS.danger
          : String(item.severidad || "").toUpperCase() === "MEDIA"
            ? COLORS.warning
            : COLORS.info;
        return (
          <View key={`${item.codigo}-${index}`} style={[styles.healthItem, { borderLeftColor: itemTone }]}>
            <Text style={styles.healthTitle}>{item.codigo} | {item.dimension} | {item.severidad}</Text>
            <Text style={[styles.healthStatus, { color: itemTone }]}>{item.estado} | {item.titulo}</Text>
            <Text style={styles.controlText}>Evidencia: {item.evidencia}</Text>
            <Text style={styles.controlText}>Riesgo: {item.riesgo}</Text>
            <Text style={styles.controlAction}>Accion: {item.accion}</Text>
            <Text style={styles.controlText}>Responsable: {item.responsable}</Text>
          </View>
        );
      })}
    </Card>
  );
}

function CierreGuiadoPanel({ data, onClose }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Cierre guiado no disponible" subtitle={data.error} icon="checkmark-done-outline" />;
  }
  const kpis = data.kpis || {};
  const checklist = data.checklist || [];
  const tone = data.nivel === "LISTO"
    ? COLORS.success
    : data.puede_cerrar
      ? COLORS.warning
      : COLORS.danger;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Cierre Operativo Guiado</Text>
      <View style={styles.healthSummary}>
        <Text style={[styles.healthScore, { color: tone }]}>{data.nivel || "-"}</Text>
        <Text style={styles.controlText}>{data.resumen}</Text>
        <Text style={styles.helperText}>
          OK {formatInt(kpis.checks_ok)} | Pendientes {formatInt(kpis.checks_pendientes)} | Bloqueos {formatInt(kpis.checks_bloqueados)}
        </Text>
        <Text style={styles.helperText}>
          Guias {formatInt(kpis.guias_total)} | Completas {formatInt(kpis.guias_completas)} | En proceso {formatInt(kpis.guias_en_proceso)}
        </Text>
      </View>
      {checklist.map((item, index) => {
        const itemTone = item.estado === "OK" ? COLORS.success : item.estado === "BLOQUEO" ? COLORS.danger : COLORS.warning;
        return (
          <View key={`${item.codigo}-${index}`} style={[styles.healthItem, { borderLeftColor: itemTone }]}>
            <Text style={styles.healthTitle}>{item.codigo} | {item.categoria}</Text>
            <Text style={[styles.healthStatus, { color: itemTone }]}>{item.estado} | {item.control}</Text>
            <Text style={styles.controlText}>{item.evidencia}</Text>
            <Text style={styles.controlAction}>Accion: {item.accion}</Text>
            <Text style={styles.controlText}>Responsable: {item.responsable}</Text>
          </View>
        );
      })}
      {data.puede_cerrar && (
        <Button
          label={data.requiere_confirmacion ? "Cerrar con observaciones" : "Ejecutar cierre"}
          icon="flag-outline"
          tone={data.requiere_confirmacion ? "warning" : "success"}
          onPress={onClose}
        />
      )}
    </Card>
  );
}

function ModoOfflinePanel({ data }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Modo offline no disponible" subtitle={data.error} icon="cloud-offline-outline" />;
  }
  const kpis = data.kpis || {};
  const checklist = data.checklist || [];
  const tone = data.estado === "LISTO_OFFLINE"
    ? COLORS.success
    : data.estado === "LISTO_CON_OBSERVACIONES"
      ? COLORS.warning
      : COLORS.danger;
  return (
    <Card style={{ borderColor: tone }}>
      <Text style={[styles.sectionTitle, { color: tone }]}>Modo Offline Blindado</Text>
      <View style={styles.healthSummary}>
        <Text style={[styles.healthScore, { color: tone }]}>{data.estado || "-"}</Text>
        <Text style={styles.controlText}>{data.resumen}</Text>
        <Text style={styles.helperText}>
          Cache {formatInt(kpis.guias_cacheadas)}/{formatInt(kpis.guias_total)} | Cobertura {formatNumber(kpis.cobertura_cache_pct)}%
        </Text>
        <Text style={styles.helperText}>
          QR activos {formatInt(kpis.qr_activos)} | En proceso {formatInt(kpis.en_proceso)} | SOF {formatInt(kpis.sof_total)}
        </Text>
      </View>
      {checklist.map((item, index) => {
        const itemTone = item.estado === "OK" ? COLORS.success : item.estado === "BLOQUEO" ? COLORS.danger : COLORS.warning;
        return (
          <View key={`${item.codigo}-${index}`} style={[styles.healthItem, { borderLeftColor: itemTone }]}>
            <Text style={styles.healthTitle}>{item.codigo} | {item.categoria}</Text>
            <Text style={[styles.healthStatus, { color: itemTone }]}>{item.estado} | {item.control}</Text>
            <Text style={styles.controlText}>{item.evidencia}</Text>
            <Text style={styles.controlAction}>Accion: {item.accion}</Text>
            <Text style={styles.controlText}>Responsable: {item.responsable}</Text>
          </View>
        );
      })}
      {(data.reglas || []).map((regla, index) => (
        <Text key={`offline-regla-${index}`} style={styles.controlText}>- {regla}</Text>
      ))}
    </Card>
  );
}

function ProductividadPanel({ data }) {
  if (!data) {
    return null;
  }
  if (data.error) {
    return <EmptyState title="Productividad no disponible" subtitle={data.error} icon="speedometer-outline" />;
  }
  const resumen = data.resumen || {};
  const ranking = data.ranking || {};
  const mejor = ranking.mejor_chofer || {};
  const cuello = ranking.cuello_botella || {};
  return (
    <>
      <Card>
        <Text style={[styles.sectionTitle, { color: COLORS.info }]}>Vista de Productividad</Text>
        <View style={styles.productivitySummary}>
          <Row label="Descargado" value={`${formatNumber(resumen.descargado_mt)} MT`} />
          <Row label="Productividad" value={`${formatNumber(resumen.mt_por_hora)} MT/h`} />
          <Row label="Promedio por viaje" value={`${formatNumber(resumen.peso_promedio_mt)} MT`} />
          <Row label="Duracion promedio" value={`${formatNumber(resumen.duracion_prom_min)} min`} />
          <Row label="Mejor rendimiento" value={mejor.nombre || "-"} />
          <Row label="Cuello de botella" value={cuello.nombre || "-"} />
        </View>
      </Card>
      <MetricBarChart title="Productividad por chofer (MT/h)" data={data.por_chofer || []} labelKey="nombre" valueKey="mt_por_hora" />
      <MetricBarChart title="Descargado por chofer (MT)" data={data.por_chofer || []} labelKey="nombre" valueKey="descargado_mt" />
      <MetricBarChart title="Descargado por cliente (MT)" data={data.por_cliente || []} labelKey="nombre" valueKey="descargado_mt" />
      <MetricBarChart title="Descargado por producto (MT)" data={data.por_producto || []} labelKey="nombre" valueKey="descargado_mt" />
      <MetricBarChart title="Duracion promedio por placa (min)" data={data.por_placa || []} labelKey="nombre" valueKey="duracion_prom_min" />
      <MetricLine title="Tendencia diaria productividad (MT)" data={data.tendencia_diaria || []} labelKey="fecha" valueKey="descargado_mt" />
      {!!(data.recomendaciones || []).length && (
        <Card>
          <Text style={styles.controlTitle}>Recomendaciones</Text>
          {(data.recomendaciones || []).slice(0, 6).map((item, index) => (
            <Text key={`prod-rec-${index}`} style={styles.controlText}>- {item}</Text>
          ))}
        </Card>
      )}
    </>
  );
}

function MetricBarChart({ title, data = [], labelKey, valueKey, bodega = false, onSelect, onClear }) {
  const source = Array.isArray(data) ? data : [];
  const rows = source.slice(0, 10);
  const max = Math.max(...rows.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <Pressable onPress={onClear}>
      <Card>
        <Text style={styles.chartTitle}>{title}</Text>
        {!rows.length && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
        {rows.map((item, index) => {
          const value = Number(item[valueKey] || 0);
          const pct = Math.max((value / max) * 100, 3);
          const numero = bodegaNumber(item[labelKey] || item.bodega_numero);
          const color = bodega ? (bodegaColors[numero] || COLORS.accent) : COLORS.accent;
          const RowComponent = onSelect ? Pressable : View;
          return (
            <RowComponent
              key={`${item[labelKey]}-${index}`}
              style={styles.metricRow}
              onPress={(event) => {
                event?.stopPropagation?.();
                onSelect?.(item);
              }}
            >
              <Text style={styles.metricLabel} numberOfLines={1}>{item[labelKey] || "SIN DATO"}</Text>
              <View style={styles.metricTrack}>
                <View style={[styles.metricFill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.metricValue}>{formatNumber(value)}</Text>
            </RowComponent>
          );
        })}
      </Card>
    </Pressable>
  );
}

function MetricLine({ title, data = [], labelKey, valueKey }) {
  const source = Array.isArray(data) ? data : [];
  const rows = source.slice(0, 12);
  const max = Math.max(...rows.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <Card>
      <Text style={styles.chartTitle}>{title}</Text>
      {!rows.length && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
      {!!rows.length && (
        <>
          <View style={styles.sparkline}>
            {rows.map((item, index) => (
              <View key={`${item[labelKey]}-${index}`} style={styles.sparkColumn}>
                <Text style={styles.sparkValue}>{compactNumber(item[valueKey])}</Text>
                <View style={[styles.sparkBar, { height: `${Math.max((Number(item[valueKey] || 0) / max) * 100, 3)}%` }]} />
              </View>
            ))}
          </View>
          <View style={styles.lineLabels}>
            <Text style={styles.lineLabel}>{String(rows[0]?.[labelKey] || "").slice(0, 10)}</Text>
            <Text style={styles.lineLabel}>{String(rows[rows.length - 1]?.[labelKey] || "").slice(0, 10)}</Text>
          </View>
        </>
      )}
    </Card>
  );
}

function CuotasTable({ rows = [], onSelect }) {
  const source = Array.isArray(rows) ? rows : [];
  return (
    <Card>
      <Text style={styles.sectionTitle}>Cuota vs descargado real</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <TableHeader columns={["Cliente", "Producto", "Bodega", "Cuota MT", "Descargado MT", "Pendiente MT", "Avance %"]} />
          {source.slice(0, 30).map((row, index) => (
            <Pressable key={`${row.empresa}-${row.producto}-${index}`} style={styles.tableRow} onPress={() => onSelect?.(row)}>
              <Cell value={row.empresa} width={145} />
              <Cell value={row.producto} width={130} />
              <Cell value={row.bodega_numero || "-"} width={80} />
              <Cell value={formatNumber(row.cuota_mt)} width={120} />
              <Cell value={formatNumber(row.retirado_mt)} width={130} />
              <Cell value={formatNumber(row.faltante_mt)} width={130} />
              <Cell value={`${formatNumber(row.avance_pct)}%`} width={105} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {!source.length && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
    </Card>
  );
}

function AlertasTable({ rows = [] }) {
  const source = Array.isArray(rows) ? rows : [];
  return (
    <Card>
      <Text style={styles.sectionTitle}>Alertas operativas</Text>
      {!source.length && <Text style={styles.chartEmpty}>Sin alertas operativas</Text>}
      {source.slice(0, 20).map((row, index) => (
        <View key={`${row.tipo}-${index}`} style={styles.alertRow}>
          <Text style={styles.alertType}>{row.severidad || "-"} | {row.tipo || "-"}</Text>
          <Text style={styles.alertText}>{row.mensaje || "-"}</Text>
        </View>
      ))}
    </Card>
  );
}

function TableHeader({ columns }) {
  return (
    <View style={[styles.tableRow, styles.tableHeader]}>
      {columns.map((column, index) => (
        <Cell key={column} value={column} width={[145, 130, 80, 120, 130, 130, 105][index]} header />
      ))}
    </View>
  );
}

function Cell({ value, width, header }) {
  return <Text style={[styles.tableCell, { width }, header && styles.tableCellHeader]} numberOfLines={2}>{value}</Text>;
}

function cleanParams(filters) {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    const clean = String(value || "").trim();
    if (clean) {
      if (key === "bodega") {
        params.bodega_numero = clean;
      } else {
        params[key] = clean;
      }
    }
  });
  return params;
}

function mergeOpciones(opciones, data) {
  const merged = {
    empresas: [...(opciones?.empresas || [])],
    bodegas: [...(opciones?.bodegas || [])],
    guias: [...(opciones?.guias || [])],
    productos: [...(opciones?.productos || [])],
    choferes: [...(opciones?.choferes || [])],
    placas: [...(opciones?.placas || [])],
    estados: [...(opciones?.estados || [])],
    etapas_qr: [...(opciones?.etapas_qr || [])]
  };

  const push = (key, value) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    if (!Array.isArray(merged[key])) {
      merged[key] = [];
    }
    merged[key].push(text);
  };

  const scanRows = (rows = []) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      push("empresas", row.empresa || row.cliente);
      push("bodegas", row.bodega_numero || row.bodega);
      push("guias", row.guia);
      push("productos", row.producto);
      push("choferes", row.chofer);
      push("placas", row.placa);
      push("estados", row.estado);
      push("etapas_qr", row.etapa_qr);
    });
  };

  if (data && !data.error) {
    scanRows(data.detalle || []);
    scanRows(data.clientes || []);
    scanRows(data.cuotas_vs_descargado || []);
    scanRows(data.cuotas_vs_retiro || []);
    scanRows(data.boletas || []);

    const graficos = data.graficos || {};
    scanRows(graficos.retiro_por_cliente || []);
    scanRows(graficos.retiro_por_producto || []);
    scanRows(graficos.avance_bodegas || []);
    scanRows(graficos.faltante_bodegas || []);
    scanRows(graficos.viajes_por_cliente || []);
    scanRows(graficos.viajes_por_producto || []);
    scanRows(graficos.duracion_por_camion || []);
    scanRows(graficos.estado_guias || []);
  }

  Object.keys(merged).forEach((key) => {
    merged[key] = [...new Set(merged[key].filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));
  });

  return merged;
}

function orderedBodegaChart(rows = []) {
  return [...rows].sort((a, b) => Number(bodegaNumber(b.bodega || b.bodega_numero)) - Number(bodegaNumber(a.bodega || a.bodega_numero)));
}

function bodegaNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatInt(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
}

function compactNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1
  });
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 10
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  exportRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  operationScroll: {
    marginBottom: 12
  },
  operationChip: {
    color: COLORS.text,
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 7,
    overflow: "hidden",
    fontWeight: "900"
  },
  operationChipSelected: {
    color: COLORS.bg,
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  selectedBox: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 7,
    padding: 10,
    marginBottom: 12
  },
  selectedText: {
    color: COLORS.text,
    fontWeight: "900"
  },
  selectedMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    overflow: "visible",
    zIndex: 10
  },
  filterField: {
    minWidth: 145,
    flex: 1,
    zIndex: 20
  },
  filterLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 4
  },
  input: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    padding: 10,
    color: COLORS.text,
    fontWeight: "800"
  },
  comboPanel: {
    marginTop: 4,
    maxHeight: 210,
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    overflow: "hidden",
    zIndex: 50
  },
  comboOption: {
    color: COLORS.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    fontWeight: "800"
  },
  comboOptionSelected: {
    backgroundColor: COLORS.accent,
    color: COLORS.bg
  },
  comboEmpty: {
    color: COLORS.muted,
    padding: 10,
    fontWeight: "800"
  },
  controlSummary: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  controlItem: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: COLORS.bg
  },
  controlTitle: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 5
  },
  controlText: {
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 3
  },
  controlAction: {
    color: COLORS.accent,
    fontWeight: "900",
    marginTop: 4
  },
  healthSummary: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10
  },
  healthScore: {
    fontSize: 34,
    fontWeight: "900"
  },
  healthState: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
    marginTop: 2
  },
  healthItem: {
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: COLORS.bg
  },
  healthTitle: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 4
  },
  healthStatus: {
    fontWeight: "900",
    marginBottom: 5
  },
  helperText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 6
  },
  errorText: {
    color: COLORS.danger,
    fontWeight: "900",
    marginTop: 10
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  shipHint: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center"
  },
  shipBody: {
    borderColor: COLORS.accent,
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch"
  },
  hold: {
    flex: 1,
    minHeight: 96,
    borderRadius: 6,
    padding: 8,
    justifyContent: "center"
  },
  holdTitle: {
    color: COLORS.bg,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 15
  },
  holdText: {
    color: COLORS.bg,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 11,
    marginTop: 2
  },
  shipDownloadedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  shipDownloaded: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 11
  },
  readingCard: {
    borderColor: COLORS.danger
  },
  readingText: {
    color: COLORS.danger,
    fontWeight: "900",
    marginBottom: 4
  },
  planText: {
    marginTop: 10
  },
  chartTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 12
  },
  chartEmpty: {
    color: COLORS.muted,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 18
  },
  metricRow: {
    marginBottom: 12
  },
  metricLabel: {
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 5
  },
  metricTrack: {
    height: 22,
    backgroundColor: COLORS.elevated,
    borderRadius: 5,
    overflow: "hidden"
  },
  metricFill: {
    height: "100%"
  },
  metricValue: {
    color: COLORS.muted,
    fontWeight: "900",
    marginTop: 4,
    textAlign: "right"
  },
  sparkline: {
    height: 155,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    paddingTop: 8
  },
  sparkColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center"
  },
  sparkValue: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4
  },
  sparkBar: {
    width: "80%",
    minHeight: 4,
    backgroundColor: COLORS.info,
    borderRadius: 4
  },
  lineLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  lineLabel: {
    color: COLORS.muted,
    fontWeight: "800"
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border
  },
  tableHeader: {
    backgroundColor: COLORS.accent
  },
  tableCell: {
    color: COLORS.text,
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontWeight: "800"
  },
  tableCellHeader: {
    color: COLORS.bg,
    fontWeight: "900"
  },
  alertRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingVertical: 9
  },
  alertType: {
    color: COLORS.warning,
    fontWeight: "900"
  },
  alertText: {
    color: COLORS.text,
    fontWeight: "700",
    marginTop: 4
  }
});
