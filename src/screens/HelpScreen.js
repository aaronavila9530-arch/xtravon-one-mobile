import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button, Card, EmptyState, Screen } from "../components/ui";
import { COLORS } from "../config";
import { HELP_SECTIONS, answerHelpQuestion, searchHelpManual } from "../content/helpManual";

const VIEW_OPTIONS = ["Guia paso a paso", "FAQ del tema", "Flujo visual", "Manual completo"];

const FAQ_ITEMS = [
  {
    question: "Como abro una operacion de buque?",
    keywords: ["abrir", "operacion", "buque", "bodega"],
    answer: [
      "Entre a Operaciones Buque.",
      "Complete buque, fecha, productos, bodegas y particiones si aplica.",
      "Revise la silueta y presione Abrir operacion."
    ]
  },
  {
    question: "Cuando uso Aprobaciones?",
    keywords: ["aprobaciones", "pending", "extraordinaria", "aprobar"],
    answer: [
      "Solo para guias extraordinarias cargadas despues de la carga inicial.",
      "La carga inicial queda aprobada automaticamente.",
      "Las extraordinarias quedan PENDING hasta aprobar o rechazar."
    ]
  },
  {
    question: "Como funciona el QR del chofer?",
    keywords: ["qr", "chofer", "viaje", "continuar"],
    answer: [
      "El chofer ve solo un QR activo por ciclo.",
      "Cuando completa los escaneos, el QR se archiva.",
      "Si tiene otra guia asignada, se pregunta si continua antes de mostrar el siguiente QR."
    ]
  },
  {
    question: "Que hago si no hay conexion en patio?",
    keywords: ["offline", "conexion", "handheld", "sincronizar"],
    answer: [
      "El operador puede seguir escaneando desde handheld.",
      "La lectura queda guardada en memoria local.",
      "Cuando vuelve internet, la app sincroniza automaticamente."
    ]
  },
  {
    question: "Como registro un SOF?",
    keywords: ["sof", "evento", "demora", "statement"],
    answer: [
      "Entre a SOF.",
      "La operacion abierta se carga por defecto.",
      "Complete fecha, hora desde/hasta, categoria, subcategoria y evento."
    ]
  }
];

function relatedFaq(section) {
  const haystack = `${section.title} ${(section.keywords || []).join(" ")}`.toLowerCase();
  return FAQ_ITEMS.filter((item) => item.keywords.some((keyword) => haystack.includes(keyword))).slice(0, 3);
}

function FlowVisual({ section, mode }) {
  const blocks = mode === "indice"
    ? [
        ["1", "Ingreso", "Rol y acceso"],
        ["2", "Operacion", "Buque y cuotas"],
        ["3", "Guias", "Despacho y QR"],
        ["4", "Campo", "Escaneos y SOF"],
        ["5", "Control", "KPIs e informes"]
      ]
    : (section?.steps || []).slice(0, 4).map((step, index) => [String(index + 1), step.slice(0, 24), step.slice(24, 58)]);

  const colors = [COLORS.accent, COLORS.info, COLORS.success, COLORS.warning, COLORS.danger];

  return (
    <Card>
      <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900", marginBottom: 12 }}>
        {mode === "indice" ? "Mapa ejecutivo del sistema" : `Flujo visual: ${section.title.replace(/^\d+\.\s*/, "")}`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ flexDirection: "row", gap: 10, paddingBottom: 4 }}>
          {blocks.map(([num, title, subtitle], index) => (
            <View
              key={`${num}-${title}`}
              style={{
                width: 170,
                minHeight: 86,
                borderWidth: 1,
                borderColor: colors[index % colors.length],
                backgroundColor: COLORS.bg,
                padding: 12
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors[index % colors.length],
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: "900" }}>{num}</Text>
                </View>
                <Text style={{ color: COLORS.text, fontWeight: "900", flex: 1 }}>{title}</Text>
              </View>
              <Text style={{ color: COLORS.muted, marginTop: 8, lineHeight: 18 }}>{subtitle}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}

function SelectorRow({ label, value, options, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: COLORS.text, fontWeight: "900", marginBottom: 6 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bg,
          padding: 12
        }}
      >
        <Text style={{ color: COLORS.text, fontWeight: "800" }}>{value}</Text>
      </Pressable>
      {open && (
        <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card }}>
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                onSelect(option);
                setOpen(false);
              }}
              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
            >
              <Text style={{ color: COLORS.text, fontWeight: option === value ? "900" : "700" }}>{option}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HelpScreen() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(null);
  const [topicId, setTopicId] = useState(HELP_SECTIONS[0]?.id);
  const [view, setView] = useState("Guia paso a paso");
  const selected = HELP_SECTIONS.find((section) => section.id === topicId) || HELP_SECTIONS[0];
  const results = useMemo(() => searchHelpManual(query), [query]);
  const topicOptions = HELP_SECTIONS.map((section) => section.title);

  function selectTopic(title) {
    const found = HELP_SECTIONS.find((section) => section.title === title);
    if (found) {
      setTopicId(found.id);
      setAnswer(null);
    }
  }

  function askManual() {
    setAnswer(answerHelpQuestion(query));
  }

  function clear() {
    setQuery("");
    setAnswer(null);
  }

  function renderContent() {
    if (answer) {
      return (
        <Card>
          <Text style={{ color: COLORS.accent, fontSize: 18, fontWeight: "900", marginBottom: 8 }}>{answer.title}</Text>
          <Text style={{ color: COLORS.text, lineHeight: 22, fontWeight: "700" }}>{answer.text}</Text>
        </Card>
      );
    }

    if (view === "Manual completo") {
      return (
        <>
          {results.length === 0 && <EmptyState title="Sin resultados" subtitle="Cambie la busqueda o presione Limpiar." />}
          {results.map((section) => <SectionCard key={section.id} section={section} />)}
        </>
      );
    }

    if (view === "FAQ del tema") {
      const items = relatedFaq(selected);
      return (
        <Card>
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900", marginBottom: 10 }}>FAQ del tema</Text>
          {(items.length ? items : FAQ_ITEMS).map((item) => (
            <View key={item.question} style={{ marginBottom: 14 }}>
              <Text style={{ color: COLORS.accent, fontWeight: "900", marginBottom: 5 }}>{item.question}</Text>
              {item.answer.map((line, index) => (
                <Text key={`${item.question}-${index}`} style={{ color: COLORS.text, lineHeight: 20 }}>
                  {index + 1}. {line}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      );
    }

    if (view === "Flujo visual") {
      return <SectionCard section={selected} compact />;
    }

    return <SectionCard section={selected} />;
  }

  return (
    <Screen
      title="Ayuda / Q&A"
      subtitle="Manual operativo paso a paso. Responde desde la guia de uso, no desde P.O.R.T.I.A."
      horizontal={false}
    >
      <ScrollView showsVerticalScrollIndicator>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Image source={require("../../assets/XTRAVON_seal_round_transparent.png")} style={{ width: 54, height: 54 }} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}>Centro de ayuda operativo</Text>
              <Text style={{ color: COLORS.muted, fontWeight: "700", marginTop: 3 }}>
                Seleccione un tema, cambie la vista o pregunte al manual.
              </Text>
            </View>
          </View>

          <SelectorRow label="Tema" value={selected.title} options={topicOptions} onSelect={selectTopic} />
          <SelectorRow label="Vista" value={view} options={VIEW_OPTIONS} onSelect={(value) => { setView(value); setAnswer(null); }} />

          <Text style={{ color: COLORS.text, fontWeight: "900", marginBottom: 6 }}>Pregunta rapida</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ej: como abrir un buque, aprobar guias, escanear offline..."
            placeholderTextColor={COLORS.auxiliary}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.bg,
              color: COLORS.text,
              minHeight: 48,
              paddingHorizontal: 10,
              marginBottom: 10
            }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ minWidth: 150, flex: 1 }}>
              <Button label="Buscar en ayuda" icon="help-circle-outline" onPress={askManual} />
            </View>
            <View style={{ minWidth: 110 }}>
              <Button label="Limpiar" icon="close-outline" tone="accent" onPress={clear} />
            </View>
          </View>
        </Card>

        <FlowVisual section={selected} mode={view === "Manual completo" ? "indice" : "tema"} />
        {renderContent()}

        <Card>
          <Text style={{ color: COLORS.text, fontWeight: "900", marginBottom: 8 }}>Orden operativo recomendado</Text>
          {[
            "Centro Ejecutivo",
            "Informes",
            "Despacho de Viajes",
            "Operaciones Buque",
            "Carga de Boletas",
            "Aprobaciones",
            "SOF",
            "Historial de Buques",
            "P.O.R.T.I.A",
            "Roles y Permisos",
            "Ayuda / Q&A"
          ].map((name, index) => (
            <Text key={name} style={{ color: COLORS.muted, lineHeight: 21 }}>
              {index + 1}. {name}
            </Text>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function SectionCard({ section, compact = false }) {
  return (
    <Card>
      <Text style={{ color: COLORS.accent, fontSize: 17, fontWeight: "900", marginBottom: 8 }}>{section.title}</Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bg,
          borderRadius: 8,
          padding: 12,
          marginBottom: 10
        }}
      >
        <Text style={{ color: COLORS.info, fontWeight: "900", marginBottom: 6 }}>Referencia visual: {section.image}</Text>
        <Text style={{ color: COLORS.muted, fontWeight: "700", lineHeight: 19 }}>
          Compare este flujo contra la pantalla real del sistema durante capacitacion.
        </Text>
      </View>
      <Text style={{ color: COLORS.text, fontWeight: "900", marginBottom: 6 }}>Pasos</Text>
      {(compact ? section.steps.slice(0, 5) : section.steps).map((step, index) => (
        <Text key={`${section.id}-step-${index}`} style={{ color: COLORS.text, lineHeight: 21, marginBottom: 4 }}>
          {index + 1}. {step}
        </Text>
      ))}
      <Text style={{ color: COLORS.text, fontWeight: "900", marginTop: 8, marginBottom: 6 }}>Validaciones</Text>
      {section.notes.map((note, index) => (
        <Text key={`${section.id}-note-${index}`} style={{ color: COLORS.muted, lineHeight: 20, marginBottom: 4 }}>
          - {note}
        </Text>
      ))}
    </Card>
  );
}
