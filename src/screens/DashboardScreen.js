import React, { useMemo, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, DistributionChart, EmptyState, Kpi, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

const emptyFilters = {
  empresa: "",
  guia: "",
  producto: "",
  chofer: "",
  placa: ""
};

const filterLabels = {
  empresa: "Empresa",
  guia: "Guia",
  producto: "Producto",
  chofer: "Chofer",
  placa: "Placa"
};

const optionMap = {
  empresa: "empresas",
  guia: "guias",
  producto: "productos",
  chofer: "choferes",
  placa: "placas"
};

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

  async function loadFilters() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Primero presione Buscar operacion y seleccione un buque.");
      return;
    }
    setFiltersLoading(true);
    try {
      const response = await api.getReporteBuqueFiltros(selectedOperacion.id);
      setFilterData(response);
      applyDateHints(response?.opciones || {});
    } catch (error) {
      setFilterData({ error: error.message });
    } finally {
      setFiltersLoading(false);
    }
  }

  async function loadReport() {
    if (!selectedOperacion?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion antes de generar datos.");
      return;
    }
    setLoading(true);
    try {
      const [response, filtros] = await Promise.all([
        api.getReporteBuque(selectedOperacion.id, params),
        api.getReporteBuqueFiltros(selectedOperacion.id).catch(() => null)
      ]);
      if (filtros?.opciones) {
        setFilterData(filtros);
      }
      setData(response);
    } catch (error) {
      setData({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  function selectOperacion(op) {
    setSelectedOperacion(op);
    setData(null);
    setFilters(emptyFilters);
    setFilterData(null);
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setFilterData(null);
    setData(null);
  }

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
            <Button label="Cargar filtros" icon="options-outline" tone="info" onPress={loadFilters} />
            <Button label="Limpiar" icon="refresh-outline" tone="danger" onPress={clearFilters} />
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
            {Object.keys(emptyFilters).map((key) => (
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

        {!loading && data && !data.error && (
          <>
            <KpiGrid kpis={kpis} />
            <ShipProgress bodegas={bodegas} />
            <ExecutiveReading operacion={data.operacion || selectedOperacion || {}} kpis={kpis} alertas={alertas} plan={plan} />

            <PlanPanel plan={plan} />

            <MetricBarChart title="Descargado por bodega (MT)" data={orderedBodegaChart(graficos.avance_bodegas)} labelKey="bodega" valueKey="retirado_mt" bodega />
            <MetricBarChart title="Pendiente por bodega (MT)" data={orderedBodegaChart(graficos.faltante_bodegas)} labelKey="bodega" valueKey="faltante_mt" bodega />
            <DistributionChart title="Estado descarga" data={graficos.estado_descarga || []} labelKey="estado" valueKey="valor" />
            <MetricBarChart title="Descargado por cliente (MT)" data={graficos.retiro_por_cliente || []} labelKey="cliente" valueKey="retirado_mt" />
            <MetricBarChart title="Descargado por producto (MT)" data={graficos.retiro_por_producto || []} labelKey="producto" valueKey="retirado_mt" />
            <DistributionChart title="Estado de guias" data={graficos.estado_guias || []} labelKey="estado" valueKey="valor" />
            <MetricLine title="Tendencia diaria descargado (MT)" data={graficos.tendencia_fecha || []} labelKey="fecha" valueKey="retirado_mt" />
            <MetricBarChart title="Duracion por camion (min)" data={graficos.duracion_por_camion || []} labelKey="camion" valueKey="duracion_min" />
            <MetricBarChart title="Avance por bodega (%)" data={orderedBodegaChart(graficos.avance_bodegas)} labelKey="bodega" valueKey="avance_pct" bodega />

            <CuotasTable rows={clientes} />
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

function ShipProgress({ bodegas }) {
  const ordered = [5, 4, 3, 2, 1].map((numero) => {
    const row = (bodegas || []).find((item) => Number(item.bodega_numero) === numero) || { bodega_numero: numero };
    const capacidad = Number(row.capacidad_mt || 0);
    const retirado = Number(row.retirado_mt || 0);
    const faltante = Number(row.faltante_mt ?? Math.max(capacidad - retirado, 0));
    const pendientePct = capacidad ? (faltante / capacidad) * 100 : 0;
    const avancePct = Number(row.avance_pct || 0);
    return { numero, capacidad, retirado, faltante, pendientePct, avancePct };
  });

  return (
    <Card>
      <Text style={styles.sectionTitle}>Progreso visual por bodega</Text>
      <Text style={styles.shipHint}>Cada bodega se vacia conforme peso lleno - peso vacio se descuenta contra su capacidad MT.</Text>
      <View style={styles.shipBody}>
        {ordered.map((item) => (
          <View key={item.numero} style={[styles.hold, { backgroundColor: bodegaColors[item.numero] || COLORS.accent }]}>
            <Text style={styles.holdTitle}>B{item.numero}</Text>
            <Text style={styles.holdText}>{formatNumber(item.faltante)}/{formatNumber(item.capacidad)}</Text>
            <Text style={styles.holdText}>Pend. {formatNumber(item.pendientePct)}%</Text>
            <Text style={styles.holdText}>Desc. {formatNumber(item.avancePct)}%</Text>
          </View>
        ))}
      </View>
      <View style={styles.shipDownloadedRow}>
        {ordered.map((item) => (
          <Text key={item.numero} style={styles.shipDownloaded}>B{item.numero}: {formatNumber(item.retirado)} MT</Text>
        ))}
      </View>
    </Card>
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

function MetricBarChart({ title, data = [], labelKey, valueKey, bodega = false }) {
  const rows = data.slice(0, 10);
  const max = Math.max(...rows.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <Card>
      <Text style={styles.chartTitle}>{title}</Text>
      {!rows.length && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
      {rows.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const pct = Math.max((value / max) * 100, 3);
        const numero = bodegaNumber(item[labelKey] || item.bodega_numero);
        const color = bodega ? (bodegaColors[numero] || COLORS.accent) : COLORS.accent;
        return (
          <View key={`${item[labelKey]}-${index}`} style={styles.metricRow}>
            <Text style={styles.metricLabel} numberOfLines={1}>{item[labelKey] || "SIN DATO"}</Text>
            <View style={styles.metricTrack}>
              <View style={[styles.metricFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.metricValue}>{formatNumber(value)}</Text>
          </View>
        );
      })}
    </Card>
  );
}

function MetricLine({ title, data = [], labelKey, valueKey }) {
  const rows = data.slice(0, 12);
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

function CuotasTable({ rows = [] }) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>Cuota vs descargado real</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <TableHeader columns={["Cliente", "Producto", "Bodega", "Cuota MT", "Descargado MT", "Pendiente MT", "Avance %"]} />
          {rows.slice(0, 30).map((row, index) => (
            <View key={`${row.empresa}-${row.producto}-${index}`} style={styles.tableRow}>
              <Cell value={row.empresa} width={145} />
              <Cell value={row.producto} width={130} />
              <Cell value={row.bodega_numero || "-"} width={80} />
              <Cell value={formatNumber(row.cuota_mt)} width={120} />
              <Cell value={formatNumber(row.retirado_mt)} width={130} />
              <Cell value={formatNumber(row.faltante_mt)} width={130} />
              <Cell value={`${formatNumber(row.avance_pct)}%`} width={105} />
            </View>
          ))}
        </View>
      </ScrollView>
      {!rows.length && <Text style={styles.chartEmpty}>Sin datos para mostrar</Text>}
    </Card>
  );
}

function AlertasTable({ rows = [] }) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>Alertas operativas</Text>
      {!rows.length && <Text style={styles.chartEmpty}>Sin alertas operativas</Text>}
      {rows.slice(0, 20).map((row, index) => (
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
      params[key] = clean;
    }
  });
  return params;
}

function mergeOpciones(opciones, data) {
  const merged = {
    empresas: [...(opciones?.empresas || [])],
    guias: [...(opciones?.guias || [])],
    productos: [...(opciones?.productos || [])],
    choferes: [...(opciones?.choferes || [])],
    placas: [...(opciones?.placas || [])]
  };

  const push = (key, value) => {
    const text = String(value ?? "").trim();
    if (text) merged[key].push(text);
  };

  const scanRows = (rows = []) => {
    rows.forEach((row) => {
      push("empresas", row.empresa || row.cliente);
      push("guias", row.guia);
      push("productos", row.producto);
      push("choferes", row.chofer);
      push("placas", row.placa);
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
