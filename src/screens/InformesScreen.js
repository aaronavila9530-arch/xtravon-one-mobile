import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "../api/client";
import { BarChart, Button, Card, DistributionChart, EmptyState, Kpi, LineChart, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

const REPORT_TYPES = [
  { key: "ejecutivo", label: "Resumen ejecutivo" },
  { key: "sof", label: "SOF" },
  { key: "cuotas", label: "Cuotas vs descargado" },
  { key: "bodegas", label: "Descarga por bodega" },
  { key: "alertas", label: "Alertas operativas" },
  { key: "productividad", label: "Productividad por camion" },
  { key: "documental", label: "Diferencias documentales" }
];

const FORMATS = [
  { key: "pdf", label: "PDF" },
  { key: "excel", label: "Excel" },
  { key: "word", label: "Word" },
  { key: "csv", label: "CSV" }
];

export default function InformesScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [operaciones, setOperaciones] = useState([]);
  const [selectedOperacionId, setSelectedOperacionId] = useState(null);
  const [tipoReporte, setTipoReporte] = useState("ejecutivo");
  const [formato, setFormato] = useState("pdf");
  const [informe, setInforme] = useState(null);
  const [clienteInforme, setClienteInforme] = useState("");
  const [numeroInforme, setNumeroInforme] = useState("");
  const [textoInforme, setTextoInforme] = useState("");
  const [filterOptions, setFilterOptions] = useState({});
  const [filters, setFilters] = useState({
    empresa: "",
    guia: "",
    producto: "",
    chofer: "",
    placa: "",
    bodega_numero: "",
    estado: "",
    etapa_qr: "",
    fecha_desde: "",
    fecha_hasta: ""
  });

  const selectedOperacion = useMemo(
    () => operaciones.find((item) => Number(item.id) === Number(selectedOperacionId)),
    [operaciones, selectedOperacionId]
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

  async function loadOperaciones() {
    try {
      await runWithLoading("Buscando operaciones...", async () => {
        const data = await api.getOperaciones();
        const rows = Array.isArray(data?.data) ? data.data : [];
        setOperaciones(rows);
        if (!selectedOperacionId && rows.length > 0) {
          setSelectedOperacionId(rows[0].id);
        }
      });
    } catch (error) {
      Alert.alert("Informes", error.message);
    }
  }

  async function loadFiltros() {
    if (!selectedOperacionId) {
      Alert.alert("Sin operacion", "Seleccione una operacion para cargar filtros.");
      return;
    }
    try {
      await runWithLoading("Cargando filtros del informe...", async () => {
        const data = await api.getReporteBuqueFiltros(selectedOperacionId);
        setFilterOptions(data?.opciones || {});
      });
    } catch (error) {
      Alert.alert("Filtros informes", error.message);
    }
  }

  function cleanReportParams(extra = {}) {
    const params = { tipo_reporte: tipoReporte, ...extra };
    Object.entries(filters).forEach(([key, value]) => {
      const clean = String(value || "").trim();
      if (clean) params[key] = clean;
    });
    return params;
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setInforme(null);
  }

  function clearFilters() {
    setFilters({
      empresa: "",
      guia: "",
      producto: "",
      chofer: "",
      placa: "",
      bodega_numero: "",
      estado: "",
      etapa_qr: "",
      fecha_desde: "",
      fecha_hasta: ""
    });
    setInforme(null);
  }

  async function loadInforme() {
    if (!selectedOperacionId) {
      Alert.alert("Sin operacion", "Seleccione una operacion para visualizar el informe.");
      return;
    }

    try {
      await runWithLoading("Generando vista del informe...", async () => {
        const data = await api.getReporteBuque(selectedOperacionId, cleanReportParams());
        setInforme(data);
        setTextoInforme(buildLectura(data, tipoReporte));
      });
    } catch (error) {
      Alert.alert("Informes", error.message);
    }
  }

  async function mejorarTextoIa() {
    if (!selectedOperacionId) {
      Alert.alert("Sin operacion", "Seleccione una operacion para usar P.O.R.T.I.A.");
      return;
    }

    try {
      await runWithLoading("P.O.R.T.I.A esta mejorando el texto...", async () => {
        const prompt = [
          "Mejora este texto para un informe ejecutivo portuario.",
          `Tipo de informe: ${selectedReportLabel()}.`,
          `Cliente: ${clienteInforme || "No indicado"}.`,
          `Numero de informe: ${numeroInforme || "No indicado"}.`,
          "Mantener tono profesional, claro y accionable.",
          "",
          textoInforme || buildLectura(informe, tipoReporte)
        ].join("\n");
        const data = await api.maritimeChat({
          pregunta: prompt,
          operacion_id: selectedOperacionId,
          modo: "Ejecutivo",
          buscar_web: false,
          pantalla: "Informes",
          copiloto: true,
          respuesta_breve: false,
          contexto: {
            tipo_reporte: selectedReportLabel(),
            cliente: clienteInforme || "",
            numero_informe: numeroInforme || ""
          }
        });
        setTextoInforme(data?.text || data?.respuesta || String(data || ""));
      });
    } catch (error) {
      Alert.alert("P.O.R.T.I.A", error.message);
    }
  }

  async function descargarInforme() {
    if (!selectedOperacionId) {
      Alert.alert("Sin operacion", "Seleccione una operacion para descargar el informe.");
      return;
    }
    try {
      await runWithLoading(`Descargando ${formato.toUpperCase()}...`, async () => {
        const params = cleanReportParams();
        const url = api.reporteBuqueDownloadUrl(selectedOperacionId, formato, params);
        const extension = formato === "excel" ? "xlsx" : formato === "word" ? "docx" : formato;
        const mime = mimeForFormat(formato);
        const safeName = `${selectedOperacion?.nombre_buque || "informe"}_${tipoReporte}`.replace(/[^a-z0-9_-]+/gi, "_");
        const uri = `${FileSystem.documentDirectory}${safeName}.${extension}`;
        const result = await FileSystem.downloadAsync(url, uri);
        await abrirArchivo(result.uri, mime);
      });
    } catch (error) {
      Alert.alert("Descargar informe", error.message || "No se pudo descargar el informe.");
    }
  }

  function selectedReportLabel() {
    return REPORT_TYPES.find((item) => item.key === tipoReporte)?.label || "Resumen ejecutivo";
  }

  return (
    <Screen title="Informes" subtitle="Visualizacion y descarga por buque, tipo de reporte y formato." minWidth={430} horizontal={false}>
      <ScrollView>
        <Card>
          <Text style={styles.sectionTitle}>Operaciones</Text>
          <View style={styles.actions}>
            <Button label="Buscar informes" icon="search-outline" onPress={loadOperaciones} />
            <Button label="Cargar filtros" icon="filter-outline" tone="info" onPress={loadFiltros} disabled={!selectedOperacionId} />
            <Button label="Ver informe" icon="analytics-outline" tone="info" onPress={loadInforme} />
            <Button label="Descargar" icon="download-outline" tone="info" onPress={descargarInforme} />
          </View>
          {loading && <Loading label={loadingLabel || "Procesando..."} />}
          {!loading && operaciones.length === 0 && <EmptyState title="Sin operaciones" subtitle="Presione Buscar informes para cargar operaciones." />}
          {operaciones.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 10 }}>
              <View style={styles.operationList}>
                {operaciones.map((op) => {
                  const selected = Number(op.id) === Number(selectedOperacionId);
                  return (
                    <Pressable
                      key={op.id}
                      style={[styles.operationChip, selected && styles.operationChipSelected]}
                      onPress={() => {
                        setSelectedOperacionId(op.id);
                        setInforme(null);
                      }}
                    >
                      <Text style={[styles.operationChipText, selected && styles.operationChipTextSelected]}>
                        {op.id} | {op.nombre_buque || "SIN BUQUE"} | {formatDate(op.fecha_inicio)} | {op.estado || ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Filtros del informe</Text>
          <View style={styles.formGrid}>
            <FilterInput label="Empresa" value={filters.empresa} onChangeText={(value) => updateFilter("empresa", value)} options={filterOptions.empresas} />
            <FilterInput label="Guia" value={filters.guia} onChangeText={(value) => updateFilter("guia", value)} options={filterOptions.guias} />
            <FilterInput label="Producto" value={filters.producto} onChangeText={(value) => updateFilter("producto", value)} options={filterOptions.productos} />
            <FilterInput label="Chofer" value={filters.chofer} onChangeText={(value) => updateFilter("chofer", value)} options={filterOptions.choferes} />
            <FilterInput label="Placa" value={filters.placa} onChangeText={(value) => updateFilter("placa", value)} options={filterOptions.placas} />
            <FilterInput label="Bodega" value={filters.bodega_numero} onChangeText={(value) => updateFilter("bodega_numero", value)} options={filterOptions.bodegas} keyboardType="numeric" />
            <FilterInput label="Estado" value={filters.estado} onChangeText={(value) => updateFilter("estado", value)} options={filterOptions.estados} />
            <FilterInput label="Etapa QR" value={filters.etapa_qr} onChangeText={(value) => updateFilter("etapa_qr", value)} options={filterOptions.etapas_qr} />
            <FilterInput label="Desde YYYY-MM-DD" value={filters.fecha_desde} onChangeText={(value) => updateFilter("fecha_desde", value)} />
            <FilterInput label="Hasta YYYY-MM-DD" value={filters.fecha_hasta} onChangeText={(value) => updateFilter("fecha_hasta", value)} />
          </View>
          <View style={styles.actions}>
            <Button label="Generar datos filtrados" icon="analytics-outline" tone="accent" onPress={loadInforme} disabled={!selectedOperacionId} />
            <Button label="Limpiar filtros" icon="close-outline" onPress={clearFilters} />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Tipo de informe</Text>
          <View style={styles.chipWrap}>
            {REPORT_TYPES.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.selectorChip, tipoReporte === item.key && styles.selectorChipActive]}
                onPress={() => {
                  setTipoReporte(item.key);
                  setInforme(null);
                }}
              >
                <Text style={[styles.selectorText, tipoReporte === item.key && styles.selectorTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Formato de descarga</Text>
          <View style={styles.chipWrap}>
            {FORMATS.map((item) => (
              <Pressable key={item.key} style={[styles.formatChip, formato === item.key && styles.selectorChipActive]} onPress={() => setFormato(item.key)}>
                <Text style={[styles.selectorText, formato === item.key && styles.selectorTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Datos del informe</Text>
          <View style={styles.formGrid}>
            <View style={styles.inputBox}>
              <Text style={styles.label}>Cliente</Text>
              <TextInput value={clienteInforme} onChangeText={setClienteInforme} style={styles.input} placeholder="Cliente del informe" placeholderTextColor={COLORS.auxiliary} />
            </View>
            <View style={styles.inputBox}>
              <Text style={styles.label}>Numero de informe</Text>
              <TextInput value={numeroInforme} onChangeText={setNumeroInforme} style={styles.input} placeholder="Numero / consecutivo" placeholderTextColor={COLORS.auxiliary} />
            </View>
          </View>
          <Text style={styles.label}>Texto ejecutivo editable</Text>
          <TextInput
            value={textoInforme}
            onChangeText={setTextoInforme}
            multiline
            style={[styles.input, styles.textArea]}
            placeholder="Presione Ver informe para generar una lectura base o escriba un texto para que P.O.R.T.I.A lo mejore."
            placeholderTextColor={COLORS.auxiliary}
          />
          <Button label="Mejorar texto con P.O.R.T.I.A" icon="sparkles-outline" tone="teal" onPress={mejorarTextoIa} />
        </Card>

        {!!selectedOperacion && (
          <Card>
            <Text style={styles.sectionTitle}>Operacion seleccionada</Text>
            <Row label="Buque" value={selectedOperacion.nombre_buque} />
            <Row label="Codigo" value={selectedOperacion.codigo_operacion} />
            <Row label="Inicio" value={formatDate(selectedOperacion.fecha_inicio)} />
            <Row label="Estado" value={selectedOperacion.estado} />
          </Card>
        )}

        {!!informe && <InformeDetalle informe={informe} tipoReporte={tipoReporte} />}
      </ScrollView>
    </Screen>
  );
}

function FilterInput({ label, value, onChangeText, options = [], keyboardType }) {
  const normalized = (options || []).map((item) => String(item || "")).filter(Boolean);
  const query = String(value || "").trim().toLowerCase();
  const suggestions = query
    ? normalized.filter((item) => item.toLowerCase().includes(query)).slice(0, 8)
    : normalized.slice(0, 8);
  return (
    <View style={styles.inputBox}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholder={label}
        placeholderTextColor={COLORS.auxiliary}
        keyboardType={keyboardType || "default"}
      />
      {suggestions.length > 0 && (
        <View style={styles.suggestionWrap}>
          {suggestions.map((item) => (
            <Pressable key={item} style={styles.suggestionChip} onPress={() => onChangeText(item)}>
              <Text style={styles.suggestionText} numberOfLines={1}>{item}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function InformeDetalle({ informe, tipoReporte }) {
  const kpis = kpisForType(informe, tipoReporte);
  const graficos = informe?.graficos || {};
  const sections = sectionsForType(informe, tipoReporte);

  return (
    <>
      <View style={styles.kpiGrid}>
        {kpis.map((item, index) => (
          <Kpi key={`${item.label}-${index}`} label={item.label} value={formatNumber(item.value)} tone={item.tone || "accent"} />
        ))}
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Lectura del informe</Text>
        <Text style={styles.reading}>{buildLectura(informe, tipoReporte)}</Text>
      </Card>

      <View style={styles.chartGrid}>
        {tipoReporte === "sof" && (
          <>
            <BarChart title="Horas por subcategoria" data={informe.sof || []} labelKey="subcategoria" valueKey="horas" />
            <DistributionChart title="Eventos por tipo" data={informe.sof || []} labelKey="tipo" valueKey="eventos" />
          </>
        )}
        {tipoReporte === "cuotas" && (
          <>
            <BarChart title="Descargado por cliente" data={informe.clientes || []} labelKey="empresa" valueKey="retirado_mt" />
            <BarChart title="Pendiente por cliente" data={informe.clientes || []} labelKey="empresa" valueKey="faltante_mt" color={COLORS.warning} />
            <BarChart title="Avance por cliente" data={informe.clientes || []} labelKey="empresa" valueKey="avance_pct" color={COLORS.info} />
          </>
        )}
        {tipoReporte === "bodegas" && (
          <>
            <BarChart title="Descargado por bodega" data={graficos.avance_bodegas || []} labelKey="bodega" valueKey="retirado_mt" />
            <BarChart title="Pendiente por bodega" data={graficos.faltante_bodegas || []} labelKey="bodega" valueKey="faltante_mt" color={COLORS.warning} />
            <DistributionChart title="Estado descarga" data={graficos.estado_descarga || []} labelKey="estado" valueKey="valor" />
          </>
        )}
        {tipoReporte === "alertas" && (
          <>
            <GenericCountChart title="Alertas por tipo" data={informe.alertas || []} field="tipo" />
            <GenericCountChart title="Alertas por severidad" data={informe.alertas || []} field="severidad" distribution />
            <BarChart title="Horas demora SOF" data={(informe.sof || []).filter((row) => row.tipo === "DEMORA")} labelKey="subcategoria" valueKey="horas" color={COLORS.warning} />
          </>
        )}
        {tipoReporte === "productividad" && (
          <>
            <BarChart title="Duracion por camion" data={graficos.duracion_por_camion || []} labelKey="camion" valueKey="duracion_min" />
            <LineChart title="Tendencia diaria MT" data={graficos.tendencia_fecha || []} labelKey="fecha" valueKey="retirado_mt" />
            <BarChart title="Descargado por producto" data={graficos.retiro_por_producto || []} labelKey="producto" valueKey="retirado_mt" />
          </>
        )}
        {tipoReporte === "documental" && (
          <>
            <BarChart title="Guias por estado" data={informe.documental || []} labelKey="estado" valueKey="guias" />
            <DistributionChart title="Guias por etapa QR" data={informe.documental || []} labelKey="etapa_qr" valueKey="guias" />
          </>
        )}
        {tipoReporte === "ejecutivo" && (
          <>
            <BarChart title="Descargado por bodega" data={graficos.avance_bodegas || []} labelKey="bodega" valueKey="retirado_mt" />
            <DistributionChart title="Estado descarga" data={graficos.estado_descarga || []} labelKey="estado" valueKey="valor" />
            <LineChart title="Tendencia diaria" data={graficos.tendencia_fecha || []} labelKey="fecha" valueKey="retirado_mt" />
            <BarChart title="Descargado por producto" data={graficos.retiro_por_producto || []} labelKey="producto" valueKey="retirado_mt" />
          </>
        )}
      </View>

      {sections.map((section) => (
        <ReportTable key={section.title} title={section.title} headers={section.headers} rows={section.rows} />
      ))}
    </>
  );
}

function GenericCountChart({ title, data, field, distribution = false }) {
  const grouped = Object.values((data || []).reduce((acc, item) => {
    const label = item[field] || "SIN DATO";
    acc[label] = acc[label] || { label, valor: 0 };
    acc[label].valor += 1;
    return acc;
  }, {}));
  if (distribution) {
    return <DistributionChart title={title} data={grouped} labelKey="label" valueKey="valor" />;
  }
  return <BarChart title={title} data={grouped} labelKey="label" valueKey="valor" />;
}

function ReportTable({ title, headers, rows }) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.tableHeader}>
            {headers.map((header) => <Text key={header} style={styles.th}>{header}</Text>)}
          </View>
          {(rows || []).slice(0, 80).map((row, index) => (
            <View key={index} style={styles.tableRow}>
              {row.map((value, colIndex) => <Text key={`${index}-${colIndex}`} style={styles.td} numberOfLines={2}>{formatAny(value)}</Text>)}
            </View>
          ))}
          {(!rows || rows.length === 0) && <Text style={styles.emptyTable}>Sin datos para mostrar</Text>}
          {rows?.length > 80 && <Text style={styles.emptyTable}>Mostrando 80 de {rows.length.toLocaleString()} registros. La descarga incluye el detalle completo.</Text>}
        </View>
      </ScrollView>
    </Card>
  );
}

function kpisForType(data, tipo) {
  const kpis = data?.kpis || {};
  const resumen = data?.resumen || {};
  const sof = data?.sof || [];
  const clientes = data?.clientes || [];
  const bodegas = data?.bodegas || [];
  const alertas = data?.alertas || [];
  const documental = data?.documental || [];
  const graficos = data?.graficos || {};

  if (tipo === "sof") {
    return [
      { label: "Eventos SOF", value: sumBy(sof, "eventos") },
      { label: "Horas SOF", value: sumBy(sof, "horas"), tone: "info" },
      { label: "Horas demora", value: sumBy(sof.filter((row) => row.tipo === "DEMORA"), "horas"), tone: "warning" },
      { label: "Categorias", value: new Set(sof.map((row) => row.tipo).filter(Boolean)).size, tone: "success" }
    ];
  }
  if (tipo === "cuotas") {
    return [
      { label: "Cuota MT", value: sumBy(clientes, "cuota_mt") },
      { label: "Descargado MT", value: sumBy(clientes, "retirado_mt"), tone: "info" },
      { label: "Pendiente MT", value: sumBy(clientes, "faltante_mt"), tone: "warning" },
      { label: "Sobrecuotas", value: clientes.filter((row) => Number(row.retirado_mt || 0) > Number(row.cuota_mt || 0) && Number(row.cuota_mt || 0) > 0).length, tone: "danger" }
    ];
  }
  if (tipo === "bodegas") {
    return [
      { label: "Bodegas", value: bodegas.length },
      { label: "Capacidad MT", value: resumen.capacidad_mt, tone: "info" },
      { label: "Descargado MT", value: resumen.retirado_mt, tone: "success" },
      { label: "Pendiente MT", value: resumen.faltante_mt, tone: "warning" }
    ];
  }
  if (tipo === "alertas") {
    return [
      { label: "Alertas", value: alertas.length, tone: "danger" },
      { label: "Altas", value: alertas.filter((row) => row.severidad === "ALTA").length, tone: "danger" },
      { label: "Eventos demora", value: sumBy(sof.filter((row) => row.tipo === "DEMORA"), "eventos"), tone: "warning" },
      { label: "Horas demora", value: sumBy(sof.filter((row) => row.tipo === "DEMORA"), "horas"), tone: "warning" }
    ];
  }
  if (tipo === "productividad") {
    const duraciones = graficos.duracion_por_camion || [];
    return [
      { label: "Viajes", value: kpis.total_guias },
      { label: "Completos", value: kpis.completas, tone: "success" },
      { label: "Duracion prom.", value: avgBy(duraciones, "duracion_min"), tone: "info" },
      { label: "MT/viaje", value: Number(kpis.completas || 0) ? Number(kpis.retirado_mt || 0) / Number(kpis.completas || 1) : 0, tone: "warning" }
    ];
  }
  if (tipo === "documental") {
    const total = sumBy(documental, "guias");
    const aprobadas = sumBy(documental.filter((row) => row.aprobada), "guias");
    return [
      { label: "Guias", value: total },
      { label: "Aprobadas", value: aprobadas, tone: "success" },
      { label: "Pendientes", value: total - aprobadas, tone: "warning" },
      { label: "Estados", value: new Set(documental.map((row) => row.estado).filter(Boolean)).size, tone: "info" }
    ];
  }
  return [
    { label: "Capacidad MT", value: kpis.capacidad_mt },
    { label: "Descargado MT", value: kpis.retirado_mt, tone: "success" },
    { label: "Pendiente MT", value: kpis.faltante_mt, tone: "warning" },
    { label: "Avance %", value: kpis.avance_descarga_pct, tone: "info" }
  ];
}

function sectionsForType(data, tipo) {
  const resumenRows = [
    ["Buque", data?.operacion?.nombre_buque],
    ["Producto", data?.operacion?.producto],
    ["Estado", data?.operacion?.estado],
    ["Capacidad MT", data?.resumen?.capacidad_mt],
    ["Descargado MT", data?.resumen?.retirado_mt],
    ["Pendiente de descarga MT", data?.resumen?.faltante_mt],
    ["Avance %", data?.resumen?.avance_pct]
  ];

  if (tipo === "sof") {
    return [
      { title: "SOF por categoria", headers: ["Tipo", "Subcategoria", "Bodega", "Eventos", "Horas", "Desde", "Hasta"], rows: (data.sof || []).map((row) => [row.tipo, row.subcategoria, row.bodega_numero, row.eventos, row.horas, row.fecha_desde, row.fecha_hasta]) },
      { title: "Detalle SOF del buque", headers: ["Fecha", "Hora", "Tipo", "Subcategoria", "Bodega", "Guia", "Cliente", "Producto", "Placa", "Horas", "Evento", "Comentario", "Usuario"], rows: (data.sof_detalle || []).map((row) => [row.fecha_larga, row.rango_hora, row.tipo, row.subcategoria, row.bodega_numero, row.guia, row.cliente, row.producto, row.placa, row.horas, row.evento, row.comentario, row.creado_por]) }
    ];
  }
  if (tipo === "cuotas") {
    return [
      { title: "Cuotas vs descargado", headers: ["Cliente", "Producto", "Bodega", "Cuota MT", "Descargado MT", "Pendiente MT", "Avance %", "Guias"], rows: (data.clientes || []).map((row) => [row.empresa, row.producto, row.bodega_numero, row.cuota_mt, row.retirado_mt, row.faltante_mt, row.avance_pct, row.guias]) }
    ];
  }
  if (tipo === "bodegas") {
    return [
      { title: "Descarga por bodega", headers: ["Bodega", "Capacidad MT", "Descargado MT", "Pendiente MT", "Avance %", "Guias"], rows: (data.bodegas || []).map((row) => [row.bodega_numero, row.capacidad_mt, row.retirado_mt, row.faltante_mt, row.avance_pct, row.guias]) }
    ];
  }
  if (tipo === "alertas") {
    return [
      { title: "Alertas operativas", headers: ["Severidad", "Tipo", "Mensaje"], rows: (data.alertas || []).map((row) => [row.severidad, row.tipo, row.mensaje]) },
      { title: "SOF con horas relevantes", headers: ["Tipo", "Subcategoria", "Bodega", "Eventos", "Horas"], rows: (data.sof || []).filter((row) => Number(row.horas || 0) >= 1).map((row) => [row.tipo, row.subcategoria, row.bodega_numero, row.eventos, row.horas]) }
    ];
  }
  if (tipo === "productividad") {
    return [
      { title: "Duracion por camion", headers: ["Camion", "Guia", "Placa", "Duracion min"], rows: (data.graficos?.duracion_por_camion || []).map((row) => [row.camion, row.guia, row.placa, row.duracion_min]) },
      { title: "Tendencia diaria", headers: ["Fecha", "Guias", "Descargado MT"], rows: (data.graficos?.tendencia_fecha || []).map((row) => [row.fecha, row.guias, row.retirado_mt]) },
      { title: "Producto", headers: ["Producto", "Guias", "Descargado MT"], rows: (data.graficos?.retiro_por_producto || []).map((row) => [row.producto, row.guias, row.retirado_mt]) }
    ];
  }
  if (tipo === "documental") {
    return [
      { title: "Estado documental", headers: ["Estado", "Etapa QR", "Aprobada", "Guias"], rows: (data.documental || []).map((row) => [row.estado, row.etapa_qr, row.aprobada ? "SI" : "NO", row.guias]) },
      { title: "Alertas documentales", headers: ["Severidad", "Tipo", "Mensaje"], rows: (data.alertas || []).filter((row) => String(row.tipo || "").includes("GUIA") || String(row.tipo || "").includes("DOCUMENT")).map((row) => [row.severidad, row.tipo, row.mensaje]) }
    ];
  }
  return [
    { title: "Resumen ejecutivo", headers: ["Indicador", "Valor"], rows: resumenRows },
    { title: "Bodegas", headers: ["Bodega", "Capacidad MT", "Descargado MT", "Pendiente MT", "Avance %", "Guias"], rows: (data.bodegas || []).map((row) => [row.bodega_numero, row.capacidad_mt, row.retirado_mt, row.faltante_mt, row.avance_pct, row.guias]) },
    { title: "Cuotas vs descargado", headers: ["Cliente", "Producto", "Bodega", "Cuota MT", "Descargado MT", "Pendiente MT", "Avance %", "Guias"], rows: (data.clientes || []).map((row) => [row.empresa, row.producto, row.bodega_numero, row.cuota_mt, row.retirado_mt, row.faltante_mt, row.avance_pct, row.guias]) },
    { title: "Alertas", headers: ["Severidad", "Tipo", "Mensaje"], rows: (data.alertas || []).map((row) => [row.severidad, row.tipo, row.mensaje]) }
  ];
}

function buildLectura(data, tipo) {
  if (!data) return "";
  const kpis = data.kpis || {};
  const resumen = data.resumen || {};
  const alertas = data.alertas || [];
  const sof = data.sof || [];
  const clientes = data.clientes || [];
  const bodegas = data.bodegas || [];
  const avance = Number(kpis.avance_descarga_pct || resumen.avance_pct || 0);
  const pendiente = Number(kpis.faltante_mt || resumen.faltante_mt || 0);
  const descargado = Number(kpis.retirado_mt || resumen.retirado_mt || 0);
  const riesgo = alertas.some((row) => row.severidad === "ALTA") ? "ALTO" : alertas.length ? "MEDIO" : "CONTROLADO";
  const base = `Lectura ejecutiva: avance ${formatNumber(avance)}%, descargado ${formatNumber(descargado)} MT y pendiente de descarga ${formatNumber(pendiente)} MT. Riesgo operativo aparente: ${riesgo}.`;
  if (tipo === "sof") return `${base} El SOF registra ${formatNumber(sumBy(sof, "eventos"))} eventos y ${formatNumber(sumBy(sof, "horas"))} horas acumuladas.`;
  if (tipo === "cuotas") {
    const cliente = maxBy(clientes, "faltante_mt");
    return `${base} El cliente con mayor pendiente aparente es ${cliente?.empresa || "N/D"} con ${formatNumber(cliente?.faltante_mt)} MT pendientes.`;
  }
  if (tipo === "bodegas") {
    const bodega = maxBy(bodegas, "faltante_mt");
    return `${base} La bodega con mayor pendiente aparente es B${bodega?.bodega_numero || "N/D"} con ${formatNumber(bodega?.faltante_mt)} MT pendientes.`;
  }
  if (tipo === "alertas") return `${base} Se registran ${alertas.length} alertas; priorizar severidad alta, QR, pesos, cuotas y demoras.`;
  if (tipo === "productividad") return `${base} Revisar duracion promedio por camion, tendencia diaria y MT/viaje para detectar cuellos de botella.`;
  if (tipo === "documental") return `${base} El foco documental debe estar en guias pendientes, etapas QR inconsistentes, aprobaciones y rechazos.`;
  return `${base} Priorizar bodegas con pendiente alto, clientes contra cuota, alertas activas y productividad diaria.`;
}

function sumBy(rows, key) {
  return (rows || []).reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

function avgBy(rows, key) {
  if (!rows?.length) return 0;
  return sumBy(rows, key) / rows.length;
}

function maxBy(rows, key) {
  return (rows || []).reduce((best, row) => Number(row?.[key] || 0) > Number(best?.[key] || 0) ? row : best, null);
}

function formatDate(value) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 10);
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAny(value) {
  if (typeof value === "number") return formatNumber(value);
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function mimeForFormat(format) {
  if (format === "excel") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (format === "word") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (format === "csv") return "text/csv";
  return "application/pdf";
}

async function abrirArchivo(uri, mimeType) {
  try {
    if (Platform.OS === "android") {
      const IntentLauncher = require("expo-intent-launcher");
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: mimeType,
        flags: 1
      });
      return;
    }
  } catch (_error) {
    // Fallback to native share sheet below.
  }
  try {
    const Sharing = require("expo-sharing");
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: "Abrir informe" });
    }
  } catch (_error) {
    Alert.alert("Archivo listo", uri);
  }
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  operationList: {
    flexDirection: "row",
    gap: 10
  },
  operationChip: {
    minWidth: 260,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated,
    borderRadius: 8,
    padding: 12
  },
  operationChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent
  },
  operationChipText: {
    color: COLORS.text,
    fontWeight: "800"
  },
  operationChipTextSelected: {
    color: COLORS.bg
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorChip: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  selectorChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  selectorText: {
    color: COLORS.text,
    fontWeight: "900"
  },
  selectorTextActive: {
    color: COLORS.bg
  },
  formatChip: {
    width: 100,
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  inputBox: {
    flex: 1,
    minWidth: 260
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 6
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
  textArea: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -4,
    marginBottom: 10
  },
  suggestionChip: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 160
  },
  suggestionText: {
    color: COLORS.text,
    fontWeight: "800"
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  reading: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 21
  },
  chartGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.accent
  },
  th: {
    width: 160,
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
  td: {
    width: 160,
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    textAlign: "center"
  },
  emptyTable: {
    color: COLORS.muted,
    fontWeight: "800",
    padding: 12
  }
});
