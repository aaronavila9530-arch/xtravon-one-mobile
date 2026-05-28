import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { COLORS } from "../config";

const emptyFilters = { guia: "", empresa: "", producto: "", chofer: "", placa: "" };
const filterMap = {
  guia: "guias",
  empresa: "empresas",
  producto: "productos",
  chofer: "choferes",
  placa: "placas"
};

export default function AprobacionesScreen({ session }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [comentario, setComentario] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [filterOptions, setFilterOptions] = useState({});
  const [activeFilter, setActiveFilter] = useState(null);
  const [accion, setAccion] = useState("APPROVED");

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);

  function paramsFromFilters() {
    return Object.fromEntries(
      Object.entries(filters).filter(([, value]) => String(value || "").trim())
    );
  }

  async function loadFilters() {
    setLoading(true);
    try {
      const data = await api.getAprobacionesFiltros(paramsFromFilters());
      setFilterOptions(data?.opciones || {});
    } catch (error) {
      Alert.alert("Error filtros", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.getAprobacionesPendientes(paramsFromFilters());
      const rows = data.data || [];
      setItems(rows);
      setSelected({});
      if (data?.opciones) setFilterOptions(data.opciones);
      else setFilterOptions(optionsFromRows(rows));
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
      Alert.alert("Carga completada", `Insertados: ${data.insertados || 0}\nOmitidos: ${data.omitidos || 0}`);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function aplicar(accionReal = accion) {
    if (accionReal === "SELECT_ALL") {
      seleccionarTodo();
      return;
    }
    if (accionReal === "CLEAR_ALL") {
      desmarcarTodo();
      return;
    }

    const ids = Object.keys(selected).map((id) => Number(id));
    if (!ids.length) {
      Alert.alert("Seleccione registros", "Marque al menos una guia.");
      return;
    }
    try {
      if (accionReal === "APPROVED") {
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

  function seleccionarTodo() {
    const next = {};
    items.forEach((item) => {
      if (item?.id) next[item.id] = true;
    });
    setSelected(next);
  }

  function desmarcarTodo() {
    setSelected({});
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setFilterOptions({});
  }

  return (
    <Screen
      title="Aprobaciones"
      subtitle="Cargue registros extraordinarios y apruebe o rechace antes de activar QR."
      right={<Button label="Buscar" icon="search-outline" onPress={load} />}
      minWidth={360}
      horizontal={false}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator>
        <Card>
          <Text style={styles.sectionTitle}>Filtros dinamicos</Text>
          <View style={styles.filterGrid}>
            {Object.keys(emptyFilters).map((key) => (
              <FilterInput
                key={key}
                label={labelForKey(key)}
                value={filters[key]}
                options={filterOptions?.[filterMap[key]] || []}
                active={activeFilter === key}
                onFocus={() => setActiveFilter(key)}
                onBlur={() => setTimeout(() => setActiveFilter((current) => (current === key ? null : current)), 160)}
                onChangeText={(value) => updateFilter(key, value)}
                onSelect={(value) => {
                  updateFilter(key, value);
                  setActiveFilter(null);
                }}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <Button label="Cargar filtros" icon="options-outline" tone="info" onPress={loadFilters} disabled={loading} />
            <Button label="Buscar pendientes" icon="list-outline" onPress={load} disabled={loading} />
            <Button label="Limpiar" icon="refresh-outline" tone="info" onPress={clearFilters} />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Acciones</Text>
          <View style={styles.actions}>
            <Button label="Abrir template" icon="document-outline" tone="info" onPress={cargarTemplate} disabled={loading} />
            <ActionChip label="Aprobar" value="APPROVED" active={accion === "APPROVED"} onPress={setAccion} />
            <ActionChip label="Rechazar" value="REJECTED" active={accion === "REJECTED"} onPress={setAccion} />
            <ActionChip label="Seleccionar todo" value="SELECT_ALL" active={accion === "SELECT_ALL"} onPress={setAccion} />
            <ActionChip label="Desmarcar todo" value="CLEAR_ALL" active={accion === "CLEAR_ALL"} onPress={setAccion} />
            <Button label="Aplicar accion" icon="checkmark-done-outline" onPress={() => aplicar()} disabled={loading} />
          </View>
          <Text style={styles.helper}>Seleccionadas: {selectedCount}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Comentario para la accion</Text>
          <TextInput
            placeholder="Comentario de aprobacion/rechazo"
            placeholderTextColor={COLORS.auxiliary}
            value={comentario}
            onChangeText={setComentario}
            style={styles.input}
          />
        </Card>

        {loading && <Loading />}
        {!loading && items.length === 0 && (
          <EmptyState title="Sin pendientes" subtitle="Presione Buscar pendientes para consultar registros PENDING." />
        )}

        {items.map((item) => (
          <Card key={item.id} style={{ borderColor: selected[item.id] ? COLORS.success : COLORS.border }}>
            <Pressable onPress={() => toggle(item.id)} style={styles.cardHeader}>
              <Text style={[styles.check, selected[item.id] && styles.checkOn]}>
                {selected[item.id] ? "[X]" : "[ ]"}
              </Text>
              <Text style={styles.guia}>Guia {item.guia || "-"}</Text>
              <Text style={styles.status}>{item.aprobacion_estado || item.status || "PENDING"}</Text>
            </Pressable>
            <Row label="Cliente" value={item.empresa} />
            <Row label="Buque" value={item.buque} />
            <Row label="Fecha" value={item.fecha} />
            <Row label="Producto" value={item.producto} />
            <Row label="Chofer" value={item.chofer} />
            <Row label="Placa" value={item.placa} />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function FilterInput({ label, value, options = [], active, onFocus, onBlur, onChangeText, onSelect }) {
  const cleanOptions = [...new Set((options || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const typed = String(value || "").trim().toLowerCase();
  const filtered = cleanOptions
    .filter((item) => !typed || item.toLowerCase().includes(typed))
    .slice(0, 10);

  return (
    <View style={styles.filterBox}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        style={styles.input}
        placeholder={`Filtrar ${label}`}
        placeholderTextColor={COLORS.auxiliary}
      />
      {active && (
        <View style={styles.suggestions}>
          <Pressable style={styles.suggestion} onPress={() => onSelect("")}>
            <Text style={styles.suggestionText}>(Todos)</Text>
          </Pressable>
          {filtered.map((item) => (
            <Pressable key={`${label}-${item}`} style={styles.suggestion} onPress={() => onSelect(item)}>
              <Text style={styles.suggestionText} numberOfLines={1}>{item}</Text>
            </Pressable>
          ))}
          {!filtered.length && <Text style={styles.emptySuggestion}>Sin coincidencias</Text>}
        </View>
      )}
    </View>
  );
}

function ActionChip({ label, value, active, onPress }) {
  return (
    <Pressable onPress={() => onPress(value)} style={[styles.actionChip, active && styles.actionChipActive]}>
      <Text style={[styles.actionText, active && styles.actionTextActive]}>{label}</Text>
    </Pressable>
  );
}

function labelForKey(key) {
  return {
    guia: "Guia",
    empresa: "Empresa",
    producto: "Producto",
    chofer: "Chofer",
    placa: "Placa"
  }[key] || key;
}

function optionsFromRows(rows) {
  const opciones = { guias: [], empresas: [], productos: [], choferes: [], placas: [] };
  (rows || []).forEach((row) => {
    if (row.guia) opciones.guias.push(row.guia);
    if (row.empresa) opciones.empresas.push(row.empresa);
    if (row.producto) opciones.productos.push(row.producto);
    if (row.chofer) opciones.choferes.push(row.chofer);
    if (row.placa) opciones.placas.push(row.placa);
  });
  Object.keys(opciones).forEach((key) => {
    opciones[key] = [...new Set(opciones[key].map((item) => String(item)))].sort();
  });
  return opciones;
}

const styles = {
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 10,
    fontSize: 17
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    zIndex: 10
  },
  filterBox: {
    minWidth: 150,
    flex: 1,
    zIndex: 20
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 5
  },
  input: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    padding: 11,
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 8
  },
  suggestions: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    overflow: "hidden",
    marginBottom: 8
  },
  suggestion: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1
  },
  suggestionText: {
    color: COLORS.text,
    fontWeight: "800"
  },
  emptySuggestion: {
    color: COLORS.muted,
    fontWeight: "800",
    padding: 10
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  helper: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 10
  },
  actionChip: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  actionChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  actionText: {
    color: COLORS.text,
    fontWeight: "900"
  },
  actionTextActive: {
    color: COLORS.bg
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  check: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16
  },
  checkOn: {
    color: COLORS.success
  },
  guia: {
    color: COLORS.text,
    fontWeight: "900",
    flex: 1,
    fontSize: 16
  },
  status: {
    color: COLORS.accent,
    fontWeight: "900"
  }
};
