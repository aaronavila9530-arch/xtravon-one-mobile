import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import * as Speech from "expo-speech";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { API_BASE, COLORS } from "../config";

const WAKE_PATTERNS = [
  "hey portia",
  "hey porti",
  "hey por ti a",
  "hey por tia",
  "hey por dia",
  "hey porshia",
  "hey porcha",
  "hey porcia",
  "hey porzia",
  "hey portsha",
  "hey p o r t i a",
  "hola portia",
  "hola porti",
  "hola por ti a",
  "hola por tia",
  "hola por dia",
  "hola porshia",
  "hola porcha",
  "hola porcia",
  "hola porzia",
  "hola portsha",
  "ola portia",
  "ola porti",
  "ola porshia",
  "ola porcha",
  "portia",
  "porti",
  "portii",
  "porthia",
  "portchia",
  "porshia",
  "porsia",
  "porsha",
  "porcha",
  "porchia",
  "porsche",
  "porshe",
  "porscha",
  "porsh",
  "portilla",
  "porti",
  "porcia",
  "porzia",
  "portsha",
  "portya",
  "pourtia",
  "por ti a",
  "por tia",
  "por dia",
  "oye portia",
  "oye porti",
  "oye por ti a",
  "oye por tia",
  "oye por dia",
  "oye p o r t i a",
  "oye porshia",
  "oye porcha",
  "oye porcia",
  "oye porzia",
  "oye portsha",
  "hello portia",
  "hello porshia",
  "hello porcha",
  "hi portia",
  "hi porshia",
  "are you there portia",
  "are you there porshia",
  "estas ahi portia",
  "estas ahi porshia",
  "estas ahi porcha",
  "estas alli portia",
  "portia estas ahi",
  "porshia estas ahi"
];

const WAKE_TARGETS = [
  "portia", "porshia", "porsha", "porcha", "porchia", "porcia", "porzia",
  "porsche", "porshe", "porscha", "portsha", "portchia", "portya", "pourtia",
  "porti", "portii", "portiiia", "porsia", "portya", "portea", "portea",
  "porshya", "porchya", "pordia", "portiya"
];

const WAKE_PREFIXES = ["hey", "ey", "e", "8", "hola", "ola", "oye", "hello", "hi"];
const PORTIA_ACKS = [
  "Si, le escucho.",
  "Adelante.",
  "Estoy lista.",
  "Le escucho.",
  "Digame.",
  "A la orden.",
  "Estoy aqui.",
  "Lista para ayudar.",
  "Puede hablar.",
  "Estoy atenta."
];

const DIRECT_WAKE_PHRASES = [
  "estas ahi portia",
  "estas ahi porshia",
  "estas ahi porcha",
  "estas alli portia",
  "portia estas ahi",
  "porshia estas ahi",
  "portia me escuchas",
  "porshia me escuchas",
  "portia puedes ayudarme",
  "porshia puedes ayudarme",
  "portia necesito ayuda",
  "porshia necesito ayuda",
  "are you there portia",
  "are you there porshia"
];

function similarity(a, b) {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (!longer.length) return 1;
  let matches = 0;
  const used = new Set();
  for (const ch of shorter) {
    const index = longer.split("").findIndex((candidate, idx) => candidate === ch && !used.has(idx));
    if (index >= 0) {
      used.add(index);
      matches += 1;
    }
  }
  return matches / longer.length;
}

function normalizeVoice(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function compactVoice(text) {
  return normalizeVoice(text).replace(/[^a-z0-9]/g, "");
}

function compactHasWake(text) {
  const compact = compactVoice(text);
  if (!compact) return false;
  const variants = [
    "portia", "porshia", "porsia", "porcia", "porzia", "porcha", "porchia",
    "portcha", "portchia", "portsha", "porsche", "porshe", "pordia",
    "portiya", "porti", "porta", "portea", "portya", "pordea", "pordia",
    "portiia", "portita", "porsita", "porchita"
  ];
  return variants.some((variant) => compact.includes(variant));
}

function portiaAck() {
  return PORTIA_ACKS[Math.floor(Math.random() * PORTIA_ACKS.length)];
}

function wakeNameEndIndex(tokens, start = 0) {
  if (!tokens.length) return -1;
  const token = tokens[start] || "";
  const next = tokens[start + 1] || "";
  const third = tokens[start + 2] || "";
  const fourth = tokens[start + 3] || "";
  if (WAKE_TARGETS.includes(token)) return start + 1;
  if (token.length >= 5 && WAKE_TARGETS.some((target) => similarity(token, target) >= 0.78)) return start + 1;
  if (token === "por" && ["tia", "ti", "dia", "tilla", "tiya", "chia", "sha", "shea", "sia", "cia"].includes(next)) return start + 2;
  if (token === "por" && next === "ti" && ["a", "ah"].includes(third)) return start + 3;
  if (token === "p" && `${next}${third}${fourth}`.startsWith("ort")) return Math.min(tokens.length, start + 6);
  return -1;
}

function cleanPortiaCommand(text) {
  const original = String(text || "").trim();
  const normalized = normalizeVoice(original);
  for (const pattern of WAKE_PATTERNS) {
    const cleanPattern = normalizeVoice(pattern);
    if (normalized === cleanPattern) return "";
    if (normalized.startsWith(`${cleanPattern} `)) {
      return original.split(/\s+/).slice(cleanPattern.split(" ").length).join(" ").trim();
    }
  }
  const normalizedTokens = normalized.replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
  const originalTokens = original.split(/\s+/).filter(Boolean);
  for (let index = 0; index < Math.min(normalizedTokens.length, 6); index += 1) {
    let searchIndex = index;
    if (WAKE_PREFIXES.includes(normalizedTokens[index])) {
      searchIndex = index + 1;
    }
    const end = wakeNameEndIndex(normalizedTokens, searchIndex);
    if (end > 0) {
      return originalTokens.slice(end).join(" ").trim();
    }
  }
  return original;
}

function hasWakeWord(text) {
  const normalized = normalizeVoice(text);
  if (compactHasWake(text) && (
    normalized.split(/\s+/).length <= 3 ||
    WAKE_PREFIXES.some((prefix) => normalized.startsWith(`${prefix} `))
  )) {
    return true;
  }
  if (DIRECT_WAKE_PHRASES.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `))) {
    return true;
  }
  const tokens = normalized.replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const containsName = (items) => items.some((token, index) => {
    return wakeNameEndIndex(items, index) > index;
  });
  if (tokens.length <= 2 && containsName(tokens)) {
    return true;
  }
  if (tokens.length >= 2 && WAKE_PREFIXES.includes(tokens[0]) && containsName(tokens.slice(1, 6))) {
    return true;
  }
  if (tokens.length >= 2 && WAKE_PREFIXES.includes(tokens[0]) && compactHasWake(tokens.slice(1, 6).join(" "))) return true;
  if (tokens[0] === "p" && tokens.slice(1, 6).join("") === "ortia") return true;
  if (containsName(tokens.slice(0, 2)) && ["estas ahi", "me escuchas", "necesito ayuda", "ayudame", "puedes ayudarme"].some((phrase) => normalized.includes(phrase))) {
    return true;
  }
  if (isSilenceCommand(text) && containsName(tokens)) return true;
  return false;
}

function isSilenceCommand(text) {
  const normalized = normalizeVoice(text);
  const phrases = [
    "detente",
    "stop",
    "mute",
    "quiet",
    "deja de hablar",
    "no hables",
    "deten la voz",
    "detener voz",
    "es todo",
    "eso es todo",
    "ya es todo",
    "es todo portia",
    "eso es todo portia",
    "gracias portia",
    "gracias porshia"
  ];
  if (phrases.some((command) => normalized.includes(command))) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const hasName = tokens.some((_token, index) => wakeNameEndIndex(tokens, index) > index);
  return tokens[0] === "para" && hasName;
}

function isDeactivateCommand(text) {
  const normalized = normalizeVoice(text);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const hasName = tokens.some((_token, index) => wakeNameEndIndex(tokens, index) > index);
  if (!hasName) return false;
  return ["desconectate", "desconectar", "desactivate", "desactivar", "apagate", "apagar escucha", "deja de escuchar", "no escuches", "pausa escucha"].some((command) => normalized.includes(command));
}

function isGreetingWake(text) {
  const normalized = normalizeVoice(text);
  return hasWakeWord(text) && ["estas ahi", "me escuchas", "puedes ayudarme", "necesito ayuda", "hola", "hello", "hi"].some((word) => normalized.includes(word));
}

function looksLikeQuestionOrCommand(text) {
  const normalized = normalizeVoice(text);
  if (!normalized) return false;
  const triggers = [
    "cual", "cuanto", "cuando", "donde", "como", "que", "quien",
    "clima", "riesgo", "riesgos", "buque", "barco", "bodega",
    "cliente", "cuota", "descarga", "descargado", "pendiente",
    "calado", "puerto", "mar", "ola", "oleaje", "viento",
    "terminar", "finalizar", "ubicacion", "posicion", "sof",
    "duracion", "demora", "demoras", "promedio", "viajes",
    "camiones", "placa", "chofer", "productividad", "lluvia",
    "marejada", "corriente", "marea", "capitania", "muelle",
    "tolva", "marchamo", "marchamos", "peso", "faltan"
  ];
  return triggers.some((trigger) => normalized.includes(trigger)) || normalized.split(/\s+/).length >= 7;
}

function buildOperationalPrompt(text) {
  const normalized = normalizeVoice(text);
  if (!normalized) return "";

  const hasAny = (items) => items.some((item) => normalized.includes(item));

  if (hasAny(["sala de control", "modo comando", "estado de mando", "control room", "jarvis", "gideon"])) {
    return "Dame una sala de control ejecutiva de la operacion activa: estado aparente, avance, acciones abiertas, notificaciones, cliente critico, bodega critica y proximos comandos.";
  }
  if (hasAny(["briefing", "estado general", "como vamos", "resumen operativo", "situacion actual"])) {
    return "Dame un briefing ejecutivo de la operacion activa: avance, clientes atrasados, bodegas criticas, SOF, riesgos, clima si aplica y proximas acciones recomendadas.";
  }
  if (hasAny(["riesgo", "riesgos", "alerta", "alertas"])) {
    return "Aparentemente, cuales son los riesgos principales de esta operacion hoy y que accion recomiendas?";
  }
  if (hasAny(["tiempo", "cuanto falta", "terminar", "finalizar", "cierre"])) {
    return "Cuanto falta para terminar la operacion, cual es el tiempo estimado de cierre y que podria atrasarla?";
  }
  if (hasAny(["viajes", "camiones", "promedio", "cuantos faltan", "cuantas guias"])) {
    return "Calcula el plan de viajes de la operacion: promedio real por camion, toneladas pendientes, viajes estimados, guias disponibles, faltantes o sobrantes y recomendacion para despacho.";
  }
  if (hasAny(["clima", "lluvia", "viento", "oleaje", "mar", "marejada", "marea", "corriente"])) {
    return text;
  }
  if (hasAny(["buque", "barco", "ubicacion", "posicion", "ais", "imo", "mmsi"])) {
    return text;
  }
  if (hasAny(["calado", "muelle", "puerto", "capitania", "terminal"])) {
    return text;
  }
  if (hasAny(["duracion", "demora", "demoras", "productividad", "tiempo por camion"])) {
    return "Analiza productividad y demoras: duracion promedio por camion, camiones lentos, eventos SOF asociados, tendencia diaria y acciones recomendadas.";
  }
  if (normalized.includes("cliente") && hasAny(["atrasado", "cuota", "pendiente", "descargado"])) {
    return "Que cliente va mas atrasado contra su cuota, cuanto ha descargado, cuanto tiene pendiente y que riesgo representa?";
  }
  if (normalized.includes("bodega") && hasAny(["critica", "atrasada", "requiere", "pendiente", "descarga"])) {
    return "Que bodega requiere mayor atencion, cuanto tiene pendiente de descarga y cual es la recomendacion operativa?";
  }
  if (hasAny(["sof", "statement", "sucesos", "eventos", "demoras"])) {
    return "Resume el SOF de la operacion: demoras, categorias, duraciones, eventos criticos y puntos para reclamo.";
  }
  return text;
}

function isExecutableCommand(text) {
  const normalized = normalizeVoice(text);
  const commands = [
    "sala de control",
    "modo comando",
    "estado de mando",
    "control room",
    "crear acciones",
    "crea acciones",
    "generar acciones",
    "genera acciones",
    "escalar criticas",
    "escala criticas",
    "escalar altas",
    "escala altas",
    "que es urgente",
    "que atiendo",
    "que hago primero"
  ];
  return commands.some((cmd) => normalized.includes(cmd));
}

function buildSpokenAnswer(text) {
  const clean = sanitizeAiText(text)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (clean.length <= 420) return clean;
  return `${clean.slice(0, 420).replace(/\s+\S*$/, "")}. Tengo mas detalle en pantalla si desea ampliar.`;
}

function sanitizeAiText(text) {
  let clean = String(text || "")
    .replace(/SenGn\s+PrOnOs\w*/gi, "Segun pronostico")
    .replace(/segÃƒÂºn/gi, "segun")
    .replace(/segÃºn/gi, "segun")
    .replace(/pronÃƒÂ³stico/gi, "pronostico")
    .replace(/pronÃ³stico/gi, "pronostico")
    .replace(/operaciÃƒÂ³n/gi, "operacion")
    .replace(/guÃƒÂ­a/gi, "guia")
    .replace(/ubicaciÃƒÂ³n/gi, "ubicacion")
    .replace(/informaciÃƒÂ³n/gi, "informacion")
    .replace(/^consulta p[úu]blica\s*$/gim, "")
    .replace(/^seg[uú]n b[uú]squeda p[úu]blica r[aá]pida.*$/gim, "")
    .replace(/^fuentes? consultadas?:.*$/gim, "")
    .replace(/^fuente comparativa adicional:.*$/gim, "")
    .replace(/^url:.*$/gim, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (/seg[uú]n pron[oó]stico/i.test(clean)) {
    clean = clean
      .replace(/(seg[uú]n pron[oó]stico[:,]?\s*)+/gi, "Segun pronostico: ")
      .replace(/(Segun pronostico:\s*)([\s\S]*?)(seg[uú]n pron[oó]stico[:,]?\s*)+/i, "$1$2")
      .trim();
  }

  return clean;
}
function getSpeechPayload(event) {
  const results = event?.results || [];
  const transcripts = results
    .map((item) => item?.transcript || item?.text || "")
    .filter(Boolean);
  const raw = transcripts.sort((a, b) => b.length - a.length)[0] || "";
  const isFinal = Boolean(
    event?.isFinal ||
    event?.final ||
    results.some((item) => item?.isFinal || item?.final)
  );
  return { raw, isFinal };
}

export default function AiScreen() {
  const [loading, setLoading] = useState(false);
  const [operaciones, setOperaciones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pregunta, setPregunta] = useState("");
  const [resultado, setResultado] = useState("");
  const [listening, setListening] = useState(false);
  const [readAnswer, setReadAnswer] = useState(true);
  const [mapUrl, setMapUrl] = useState("");
  const [hotwordEnabled, setHotwordEnabled] = useState(true);
  const [portiaState, setPortiaState] = useState("DORMIDA");
  const [analysisType, setAnalysisType] = useState("resumen");
  const [quickPromptIndex, setQuickPromptIndex] = useState(0);
  const manualListenRef = useRef(false);
  const awaitingCommandRef = useRef(false);
  const hotwordEnabledRef = useRef(false);
  const selectedRef = useRef(null);
  const readAnswerRef = useRef(true);
  const recognitionModeRef = useRef("idle");
  const restartTimerRef = useRef(null);
  const speechActiveRef = useRef(false);
  const lastTranscriptRef = useRef({ text: "", at: 0 });
  const lastWakeAtRef = useRef(0);
  const hotwordHeartbeatRef = useRef(null);
  const pendingVoiceCommandRef = useRef("");
  const commandListenFallbackRef = useRef(null);
  const commandCaptureTimeoutRef = useRef(null);
  const pendingWakeRef = useRef(null);
  const wakeReleaseTimeoutRef = useRef(null);
  const speechWatchdogRef = useRef(null);
  const commandStartDelayRef = useRef(null);
  const commandAutoSubmitRef = useRef(null);
  const portiaVoiceRef = useRef(null);
  const commandRetryRef = useRef(0);
  const conversationActiveRef = useRef(false);

  useSpeechRecognitionEvent("result", (event) => {
    const { raw, isFinal } = getSpeechPayload(event);
    const mode = recognitionModeRef.current;
    const normalizedRaw = normalizeVoice(raw);
    const now = Date.now();

    if (!normalizedRaw) return;

    if (mode === "hotword") {
      if (awaitingCommandRef.current && !speechActiveRef.current && !hasWakeWord(raw)) {
        pendingVoiceCommandRef.current = raw;
        if (commandAutoSubmitRef.current) {
          clearTimeout(commandAutoSubmitRef.current);
          commandAutoSubmitRef.current = null;
        }
        commandAutoSubmitRef.current = setTimeout(async () => {
          const captured = pendingVoiceCommandRef.current;
          if (!captured || !awaitingCommandRef.current) return;
          if (normalizeVoice(captured).length < 4) return;
          try {
            await ExpoSpeechRecognitionModule.stop();
          } catch (_error) {}
          setListening(false);
          recognitionModeRef.current = "idle";
          commandAutoSubmitRef.current = null;
          submitVoiceQuestion(captured);
        }, 1900);
        if (!isFinal) return;
        submitVoiceQuestion(raw);
        return;
      }
      if (!hasWakeWord(raw)) return;
      if (now - lastWakeAtRef.current < 2200) return;
      lastWakeAtRef.current = now;
      pendingWakeRef.current = { raw };
      setPortiaState("ACTIVA");
      setResultado("P.O.R.T.I.A: activando voz...");
      if (wakeReleaseTimeoutRef.current) {
        clearTimeout(wakeReleaseTimeoutRef.current);
      }
      wakeReleaseTimeoutRef.current = setTimeout(() => {
        const pendingWake = pendingWakeRef.current;
        if (!pendingWake) return;
        pendingWakeRef.current = null;
        wakeReleaseTimeoutRef.current = null;
        handleVoiceResult(pendingWake.raw, { fromHotword: true, micEnded: true });
      }, 1200);
      return;
    }

    if (mode === "command" || mode === "manual") {
      pendingVoiceCommandRef.current = raw;
      if (commandAutoSubmitRef.current) {
        clearTimeout(commandAutoSubmitRef.current);
        commandAutoSubmitRef.current = null;
      }
        commandAutoSubmitRef.current = setTimeout(async () => {
          const captured = pendingVoiceCommandRef.current;
          if (!captured || recognitionModeRef.current !== mode) return;
          if (normalizeVoice(captured).length < 4) return;
        try {
          await ExpoSpeechRecognitionModule.stop();
        } catch (_error) {}
          setListening(false);
          recognitionModeRef.current = "idle";
          commandAutoSubmitRef.current = null;
          submitVoiceQuestion(captured);
        }, mode === "manual" ? 1800 : 2200);
      if (!isFinal) {
        return;
      }
    }

    if (
      normalizedRaw &&
      normalizedRaw === lastTranscriptRef.current.text &&
      now - lastTranscriptRef.current.at < 2500
    ) {
      return;
    }
    lastTranscriptRef.current = { text: normalizedRaw, at: now };
    handleVoiceResult(raw);
  });

  useSpeechRecognitionEvent("error", (event) => {
    const mode = recognitionModeRef.current;
    setListening(false);
    recognitionModeRef.current = "idle";
    if (mode === "hotword" && awaitingCommandRef.current && conversationActiveRef.current) {
      if (commandRetryRef.current < 3) {
        commandRetryRef.current += 1;
        scheduleCommandListening(550);
        return;
      }
      awaitingCommandRef.current = false;
      commandRetryRef.current = 0;
      setResultado("P.O.R.T.I.A: No alcance a escuchar la pregunta. Diga Oye Portia e intente de nuevo.");
      restartHotwordListening();
      return;
    }
    if ((mode === "command" || mode === "manual") && awaitingCommandRef.current) {
      if (commandRetryRef.current < 3) {
        commandRetryRef.current += 1;
        scheduleCommandListening(450);
        return;
      }
      awaitingCommandRef.current = false;
      commandRetryRef.current = 0;
      setResultado("P.O.R.T.I.A: No alcance a escuchar la pregunta. Diga Oye Portia e intente de nuevo.");
      restartHotwordListening();
      return;
    }
    if (hotwordEnabledRef.current && !speechActiveRef.current) {
      restartHotwordListening();
    } else {
      Alert.alert("Voz no detectada", event.message || event.error || "No se pudo reconocer la voz.");
    }
  });

  useSpeechRecognitionEvent("end", () => {
    const endedMode = recognitionModeRef.current;
    const pendingCommand = pendingVoiceCommandRef.current;
    const pendingWake = pendingWakeRef.current;
    if (pendingWake) {
      pendingWakeRef.current = null;
      if (wakeReleaseTimeoutRef.current) {
        clearTimeout(wakeReleaseTimeoutRef.current);
        wakeReleaseTimeoutRef.current = null;
      }
    }
    if (commandCaptureTimeoutRef.current && (endedMode === "command" || endedMode === "manual")) {
      clearTimeout(commandCaptureTimeoutRef.current);
      commandCaptureTimeoutRef.current = null;
    }
    if (commandAutoSubmitRef.current && (endedMode === "command" || endedMode === "manual")) {
      clearTimeout(commandAutoSubmitRef.current);
      commandAutoSubmitRef.current = null;
    }
    setListening(false);
    recognitionModeRef.current = "idle";
    if (endedMode === "hotword" && awaitingCommandRef.current && pendingCommand && !hasWakeWord(pendingCommand)) {
      if (commandCaptureTimeoutRef.current) {
        clearTimeout(commandCaptureTimeoutRef.current);
        commandCaptureTimeoutRef.current = null;
      }
      if (commandAutoSubmitRef.current) {
        clearTimeout(commandAutoSubmitRef.current);
        commandAutoSubmitRef.current = null;
      }
      pendingVoiceCommandRef.current = "";
      submitVoiceQuestion(pendingCommand);
      return;
    }
    pendingVoiceCommandRef.current = "";
    if ((endedMode === "command" || endedMode === "manual") && pendingCommand) {
      submitVoiceQuestion(pendingCommand);
      return;
    }
    if (pendingWake) {
      handleVoiceResult(pendingWake.raw, { fromHotword: true, micEnded: true });
      return;
    }
    if (endedMode === "hotword" && awaitingCommandRef.current && conversationActiveRef.current && !speechActiveRef.current) {
      scheduleCommandListening(450);
      return;
    }
    if (endedMode === "hotword" && !awaitingCommandRef.current && !speechActiveRef.current) {
      restartHotwordListening();
    }
  });


  function handleVoiceResult(raw, options = {}) {
    if (commandListenFallbackRef.current) {
      clearTimeout(commandListenFallbackRef.current);
      commandListenFallbackRef.current = null;
    }
    if (commandCaptureTimeoutRef.current) {
      clearTimeout(commandCaptureTimeoutRef.current);
      commandCaptureTimeoutRef.current = null;
    }
    if (commandAutoSubmitRef.current) {
      clearTimeout(commandAutoSubmitRef.current);
      commandAutoSubmitRef.current = null;
    }
    const command = cleanPortiaCommand(raw);
    const detectedWakeWord = hasWakeWord(raw);
    const manual = manualListenRef.current;
    const awaitingCommand = awaitingCommandRef.current;

    manualListenRef.current = false;
    pendingVoiceCommandRef.current = "";
    setListening(false);
    recognitionModeRef.current = "idle";

    if (!raw) {
      restartHotwordListening();
      return;
    }

    if (!manual && !awaitingCommand && !detectedWakeWord && !options.fromHotword) {
      restartHotwordListening();
      return;
    }

    if (detectedWakeWord && isDeactivateCommand(raw)) {
      awaitingCommandRef.current = false;
      conversationActiveRef.current = false;
      hotwordEnabledRef.current = false;
      setHotwordEnabled(false);
      setPortiaState("PAUSADA");
      Speech.stop();
      setResultado("P.O.R.T.I.A: Escucha desactivada. Active la escucha para volver a usarla.");
      return;
    }

    if (detectedWakeWord && (isSilenceCommand(raw) || isSilenceCommand(command))) {
      awaitingCommandRef.current = false;
      conversationActiveRef.current = false;
      setPortiaState("DORMIDA");
      Speech.stop();
      setResultado("P.O.R.T.I.A en espera. Diga Hey Portia para reactivar.");
      restartHotwordListening();
      return;
    }

    if (detectedWakeWord) {
      conversationActiveRef.current = true;
      recognitionModeRef.current = "hotword";
      setListening(true);

      if (command && looksLikeQuestionOrCommand(command)) {
        const ack = portiaAck();
        awaitingCommandRef.current = false;
        conversationActiveRef.current = true;
        setPortiaState("PROCESANDO");
        setPregunta(command);
        setResultado(`P.O.R.T.I.A: ${ack}\n\nProcesando: ${command}`);
        speakPortia(ack, { delayMs: 120 });
        setTimeout(() => preguntar(command), 500);
        return;
      }

      const ack = portiaAck();
      if (isGreetingWake(raw)) {
        setPortiaState("ACTIVA");
        setResultado(`P.O.R.T.I.A: ${ack}`);
      } else {
        setPortiaState("ACTIVA");
        setResultado(`Escuche: ${raw}\n\nP.O.R.T.I.A: ${ack}`);
      }

      awaitingCommandRef.current = true;
      commandRetryRef.current = 0;

      speakPortia(ack, {
        delayMs: 120,
        forceCallbackAfterMs: 1800,
        onDone: () => armConversationListening(350),
        onStopped: () => armConversationListening(350),
        onError: () => armConversationListening(350)
      });
      if (commandListenFallbackRef.current) {
        clearTimeout(commandListenFallbackRef.current);
      }
      commandListenFallbackRef.current = setTimeout(() => {
        commandListenFallbackRef.current = null;
        if (awaitingCommandRef.current) {
          speechActiveRef.current = false;
          armConversationListening(350);
        }
      }, 3200);

      return;
    }

    const finalCommand = awaitingCommand ? raw : command;
    awaitingCommandRef.current = false;
    commandRetryRef.current = 0;

    if (!finalCommand) {
      setResultado(`Escuche: ${raw}\n\nNo pude captar una pregunta completa.`);
      restartHotwordListening();
      return;
    }

    submitVoiceQuestion(finalCommand);
  }

  function submitVoiceQuestion(text) {
    const finalQuestion = String(text || "").trim();
    if (!finalQuestion) return;
    if (commandAutoSubmitRef.current) {
      clearTimeout(commandAutoSubmitRef.current);
      commandAutoSubmitRef.current = null;
    }
    awaitingCommandRef.current = false;
    commandRetryRef.current = 0;
    pendingVoiceCommandRef.current = "";
    setPregunta(finalQuestion);
    setPortiaState("PROCESANDO");
    setResultado(`Pregunta: ${finalQuestion}\n\nP.O.R.T.I.A esta procesando la consulta...`);
    setTimeout(() => preguntar(finalQuestion), 80);
  }



  useEffect(() => {
    hotwordEnabledRef.current = hotwordEnabled;
  }, [hotwordEnabled]);

  useEffect(() => {
    let mounted = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!mounted || !Array.isArray(voices)) return;
        const scored = voices
          .filter((voice) => String(voice.language || "").toLowerCase().startsWith("es"))
          .map((voice) => {
            const name = `${voice.name || ""} ${voice.identifier || ""}`.toLowerCase();
            let score = 0;
            if (String(voice.language || "").toLowerCase().includes("mx")) score += 8;
            if (String(voice.language || "").toLowerCase().includes("us")) score += 6;
            if (String(voice.language || "").toLowerCase().includes("es")) score += 4;
            if (name.includes("female") || name.includes("mujer") || name.includes("monica") || name.includes("paulina") || name.includes("samantha")) score += 5;
            if (name.includes("enhanced") || name.includes("premium") || name.includes("network") || name.includes("google")) score += 4;
            return { voice, score };
          })
          .sort((a, b) => b.score - a.score);
        portiaVoiceRef.current = scored[0]?.voice?.identifier || null;
      })
      .catch(() => {
        portiaVoiceRef.current = null;
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    hotwordEnabledRef.current = true;
    const timer = setTimeout(() => {
      if (recognitionModeRef.current === "idle") {
        startHotwordListening();
      }
    }, 900);
    hotwordHeartbeatRef.current = setInterval(() => {
      if (
        hotwordEnabledRef.current &&
        !manualListenRef.current &&
        !awaitingCommandRef.current &&
        !speechActiveRef.current &&
        recognitionModeRef.current === "idle"
      ) {
        startHotwordListening();
      }
    }, 3500);
    return () => {
      clearTimeout(timer);
      if (hotwordHeartbeatRef.current) clearInterval(hotwordHeartbeatRef.current);
    };
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    readAnswerRef.current = readAnswer;
  }, [readAnswer]);

  useEffect(() => {
    return () => {
      clearRestartTimer();
      if (hotwordHeartbeatRef.current) clearInterval(hotwordHeartbeatRef.current);
      if (commandListenFallbackRef.current) clearTimeout(commandListenFallbackRef.current);
      if (commandCaptureTimeoutRef.current) clearTimeout(commandCaptureTimeoutRef.current);
      if (wakeReleaseTimeoutRef.current) clearTimeout(wakeReleaseTimeoutRef.current);
      if (speechWatchdogRef.current) clearTimeout(speechWatchdogRef.current);
      if (commandStartDelayRef.current) clearTimeout(commandStartDelayRef.current);
      if (commandAutoSubmitRef.current) clearTimeout(commandAutoSubmitRef.current);
      hotwordEnabledRef.current = false;
      awaitingCommandRef.current = false;
      conversationActiveRef.current = false;

      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_error) {}

      Speech.stop();
    };
  }, []);

  function continueConversationAfterAnswer() {
    if (!conversationActiveRef.current || !hotwordEnabledRef.current) {
      restartHotwordListening();
      return;
    }
    awaitingCommandRef.current = true;
    commandRetryRef.current = 0;
    setPortiaState("ACTIVA");
    scheduleCommandListening(1000);
  }

  function clearRestartTimer() {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function speakPortia(text, options = {}) {
    const spokenText = buildSpokenAnswer(text);
    if (!spokenText) {
      options.onError?.();
      return;
    }
    let finished = false;
    const finish = (callback) => {
      if (finished) return;
      finished = true;
      if (speechWatchdogRef.current) {
        clearTimeout(speechWatchdogRef.current);
        speechWatchdogRef.current = null;
      }
      speechActiveRef.current = false;
      callback?.();
      if (!awaitingCommandRef.current) {
        setPortiaState(hotwordEnabledRef.current ? "DORMIDA" : "PAUSADA");
      }
    };
    const languages = options.languages || ["es-MX", "es-US", "es-ES", undefined];
    const speakWithLanguage = (index = 0) => {
      const language = languages[index];
      try {
        Speech.speak(spokenText, {
          ...(language ? { language } : {}),
          rate: options.rate ?? 0.96,
          pitch: options.pitch ?? 1.0,
          onDone: () => finish(options.onDone),
          onStopped: () => finish(options.onStopped),
          onError: () => {
            if (index < languages.length - 1) {
              speakWithLanguage(index + 1);
            } else {
              finish(options.onError);
            }
          }
        });
      } catch (_error) {
        if (index < languages.length - 1) {
          speakWithLanguage(index + 1);
        } else {
          finish(options.onError);
        }
      }
    };

    Speech.stop();
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }
    speechActiveRef.current = true;
    setPortiaState("HABLANDO");
    if (options.forceCallbackAfterMs) {
      speechWatchdogRef.current = setTimeout(() => {
        speechWatchdogRef.current = null;
        finish(options.onDone || options.onStopped || options.onError);
      }, options.forceCallbackAfterMs);
    }
    setTimeout(() => {
      speakWithLanguage(0);
    }, options.delayMs ?? 180);
  }


  async function loadOperaciones() {
    setLoading(true);
    try {
      const data = await api.getOperaciones();
      const rows = data.data || [];
      setOperaciones(rows);
      const active = rows.find((item) => String(item.estado || "").toUpperCase() === "ABIERTA") || rows[0] || null;
      if (active) setSelected(active);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function generar(tipo) {
    if (!selected) {
      Alert.alert("Operacion requerida", "Seleccione una operacion.");
      return;
    }
    setLoading(true);
    try {
      const data = tipo === "sof"
        ? await api.getAiSof(selected.id)
        : tipo === "riesgos"
          ? await api.getAiRiesgos(selected.id)
          : tipo === "tiempo"
            ? await api.getAiTiempo(selected.id)
            : tipo === "briefing"
              ? await api.getAiBriefing(selected.id)
              : tipo === "sala"
                ? await api.getAiSalaControl(selected.id)
                : tipo === "timeline"
                  ? await api.getAiTimeline(selected.id)
                  : tipo === "memoria"
                    ? await api.getAiMemoria(selected.id)
                    : tipo === "plan"
                      ? await api.getAiPlanAccion(selected.id)
            : await api.getAiResumen(selected.id);
      const text = tipo === "timeline"
        ? renderTimeline(data)
        : tipo === "memoria"
          ? renderMemoria(data)
          : data.text || "";
      setResultado(text);
      if (readAnswerRef.current) {
        speakPortia(text.slice(0, 3500), {
          onDone: continueConversationAfterAnswer,
          onStopped: continueConversationAfterAnswer,
          onError: continueConversationAfterAnswer
        });
      } else {
        continueConversationAfterAnswer();
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  function generarSeleccionado() {
    generar(analysisType);
  }

  async function preguntar(textOverride) {
    const originalQuestion = String(textOverride ?? pregunta).trim();
    const finalQuestion = buildOperationalPrompt(originalQuestion);
    if (!finalQuestion) {
      Alert.alert("Pregunta requerida", "Escriba una pregunta sobre la operacion.");
      return;
    }
    const commandMode = isExecutableCommand(originalQuestion || finalQuestion);
    if (commandMode && !selectedRef.current?.id) {
      Alert.alert("Operacion requerida", "Seleccione una operacion para ejecutar comandos.");
      return;
    }
    setLoading(true);
    try {
      const data = commandMode
        ? await api.comandoPortia(selectedRef.current.id, originalQuestion || finalQuestion)
        : await api.maritimeChat({
          pregunta: finalQuestion,
          operacion_id: selectedRef.current?.id,
          modo: "Ejecutivo",
          buscar_web: true
        });
      const text = `Pregunta: ${originalQuestion || finalQuestion}\n\n${data.text || ""}`;
      setResultado(sanitizeAiText(text));
      const interactive = data.interactive_map_url ? `${apiBaseFromConfig()}${data.interactive_map_url}` : "";
      setMapUrl(interactive);
      if (readAnswerRef.current) {
        speakPortia(data.text || "", {
          onDone: continueConversationAfterAnswer,
          onStopped: continueConversationAfterAnswer,
          onError: continueConversationAfterAnswer
        });
      } else {
        continueConversationAfterAnswer();
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function crearAccionesDesdePlan() {
    if (!selected) {
      Alert.alert("Operacion requerida", "Seleccione una operacion.");
      return;
    }
    Alert.alert(
      "Crear acciones",
      "P.O.R.T.I.A creara tareas operativas abiertas desde el plan de accion. Desea continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Crear",
          onPress: async () => {
            setLoading(true);
            try {
              const data = await api.crearAccionesDesdePlan(selected.id);
              setResultado(data.text || `Acciones creadas: ${data.creadas || 0}`);
            } catch (error) {
              Alert.alert("Error", error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }

  async function cargarAccionesAbiertas() {
    if (!selected) {
      Alert.alert("Operacion requerida", "Seleccione una operacion.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.getAccionesAi(selected.id, "ABIERTA");
      const rows = data.data || [];
      const lines = [
        "Acciones operativas abiertas",
        "",
        `Total: ${rows.length}`,
        ""
      ];
      rows.forEach((row) => {
        lines.push(`#${row.id} [${row.prioridad || "N/D"}] ${row.alerta_tipo || "Operativo"}`);
        lines.push(`${row.titulo || ""}`);
        if (row.responsable) lines.push(`Responsable: ${row.responsable}`);
        lines.push("");
      });
      setResultado(lines.join("\n"));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cargarNotificacionesPendientes() {
    if (!selected) {
      Alert.alert("Operacion requerida", "Seleccione una operacion.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.getNotificacionesAi(selected.id, "PENDIENTE");
      const rows = data.data || [];
      const lines = [
        "Notificaciones operativas pendientes",
        "",
        `Total: ${rows.length}`,
        ""
      ];
      rows.forEach((row) => {
        lines.push(`#${row.id} [${row.prioridad || "N/D"}] ${row.canal || "INTERNO"}`);
        lines.push(row.asunto || "");
        if (row.destinatario) lines.push(`Destinatario: ${row.destinatario}`);
        if (row.mensaje) lines.push(String(row.mensaje).replace(/\n/g, " ").slice(0, 220));
        lines.push("");
      });
      setResultado(lines.join("\n"));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function escuchar() {
    try {
      Speech.stop();
      clearRestartTimer();
      await ExpoSpeechRecognitionModule.stop().catch(() => {});

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permiso requerido",
          "Debe permitir el uso del microfono para hablar con P.O.R.T.I.A."
        );
        return;
      }

      manualListenRef.current = true;
      awaitingCommandRef.current = false;
      recognitionModeRef.current = "manual";
      setPortiaState("ESCUCHANDO");
      setListening(true);

      await ExpoSpeechRecognitionModule.start({
        lang: "es-ES",
        interimResults: true,
        continuous: false,
        maxAlternatives: 4
      });
    } catch (_error) {
      setListening(false);
      Alert.alert(
        "Microfono no disponible",
        "Para dictado real use una build instalada de la app. En Expo Go puede no estar disponible."
      );
    }
  }


  async function startHotwordListening() {
    if (!hotwordEnabledRef.current || speechActiveRef.current || recognitionModeRef.current !== "idle") return;

    try {
      clearRestartTimer();
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        setListening(false);
        setPortiaState("PAUSADA");
        return;
      }

      manualListenRef.current = false;
      awaitingCommandRef.current = false;
      recognitionModeRef.current = "hotword";
      setPortiaState("DORMIDA");
      setListening(true);

      const config = {
        lang: "es-ES",
        interimResults: true,
        continuous: true,
        maxAlternatives: 6
      };

      try {
        await ExpoSpeechRecognitionModule.start(config);
      } catch (_continuousError) {
        await ExpoSpeechRecognitionModule.start({
          ...config,
          continuous: false
        });
      }
    } catch (_error) {
      setListening(false);
      recognitionModeRef.current = "idle";
      setPortiaState("PAUSADA");
    }
  }


  function restartHotwordListening() {
    if (!hotwordEnabledRef.current || manualListenRef.current || awaitingCommandRef.current || speechActiveRef.current) return;
    clearRestartTimer();
    setPortiaState("DORMIDA");
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (
        hotwordEnabledRef.current &&
        !manualListenRef.current &&
        !awaitingCommandRef.current &&
        !speechActiveRef.current &&
        recognitionModeRef.current === "idle"
      ) {
        startHotwordListening();
      }
    }, 450);
  }

  function scheduleCommandListening(delayMs = 550) {
    if (commandStartDelayRef.current) {
      clearTimeout(commandStartDelayRef.current);
      commandStartDelayRef.current = null;
    }
    commandStartDelayRef.current = setTimeout(() => {
      commandStartDelayRef.current = null;
      if (!awaitingCommandRef.current) return;
      setResultado((current) => {
        const base = String(current || "").trim();
        const prompt = "P.O.R.T.I.A: Puede hacer su pregunta ahora.";
        return base.includes(prompt) ? base : `${base}\n\n${prompt}`.trim();
      });
      armConversationListening(0);
    }, delayMs);
  }

  function armConversationListening(delayMs = 0) {
    if (!hotwordEnabledRef.current || !awaitingCommandRef.current) return;
    if (commandStartDelayRef.current) {
      clearTimeout(commandStartDelayRef.current);
      commandStartDelayRef.current = null;
    }
    commandStartDelayRef.current = setTimeout(() => {
      commandStartDelayRef.current = null;
      if (!hotwordEnabledRef.current || !awaitingCommandRef.current) return;
      pendingVoiceCommandRef.current = "";
      manualListenRef.current = false;
      setPortiaState("ESCUCHANDO");
      setListening(true);
      setResultado((current) => {
        const base = String(current || "").trim();
        const prompt = "P.O.R.T.I.A: escuchando su pregunta...";
        return base.includes(prompt) ? base : `${base}\n\n${prompt}`.trim();
      });
      if (recognitionModeRef.current === "hotword") {
        return;
      }
      startConversationListening();
    }, delayMs);
  }

  async function startConversationListening() {
    if (!hotwordEnabledRef.current || !awaitingCommandRef.current || speechActiveRef.current) return;

    try {
      if (commandListenFallbackRef.current) {
        clearTimeout(commandListenFallbackRef.current);
        commandListenFallbackRef.current = null;
      }
      if (commandStartDelayRef.current) {
        clearTimeout(commandStartDelayRef.current);
        commandStartDelayRef.current = null;
      }
      if (commandCaptureTimeoutRef.current) {
        clearTimeout(commandCaptureTimeoutRef.current);
        commandCaptureTimeoutRef.current = null;
      }

      clearRestartTimer();
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        awaitingCommandRef.current = false;
        setListening(false);
        setPortiaState("PAUSADA");
        return;
      }

      pendingVoiceCommandRef.current = "";
      manualListenRef.current = false;
      await ExpoSpeechRecognitionModule.stop().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 450));

      recognitionModeRef.current = "hotword";
      setPortiaState("ESCUCHANDO");
      setListening(true);
      setResultado((current) => {
        const base = String(current || "").trim();
        const prompt = "P.O.R.T.I.A: escuchando su pregunta...";
        return base.includes(prompt) ? base : `${base}\n\n${prompt}`.trim();
      });

      const config = {
        lang: "es-ES",
        interimResults: true,
        continuous: true,
        maxAlternatives: 6
      };

      try {
        await ExpoSpeechRecognitionModule.start(config);
      } catch (_continuousError) {
        await ExpoSpeechRecognitionModule.start({
          ...config,
          continuous: false
        });
      }

      commandCaptureTimeoutRef.current = setTimeout(async () => {
        const captured = pendingVoiceCommandRef.current;
        if (recognitionModeRef.current !== "hotword" || !awaitingCommandRef.current) return;
        try {
          await ExpoSpeechRecognitionModule.stop();
        } catch (_error) {}
        recognitionModeRef.current = "idle";
        setListening(false);
        commandCaptureTimeoutRef.current = null;
        if (captured && normalizeVoice(captured).length >= 3) {
          pendingVoiceCommandRef.current = "";
          handleVoiceResult(captured, { fromConversationTimeout: true });
        } else {
          if (conversationActiveRef.current && commandRetryRef.current < 3) {
            commandRetryRef.current += 1;
            setResultado("P.O.R.T.I.A: sigo escuchando. Repita la pregunta.");
            scheduleCommandListening(700);
          } else {
            awaitingCommandRef.current = false;
            commandRetryRef.current = 0;
            setPortiaState("DORMIDA");
            setResultado("P.O.R.T.I.A: No alcance a escuchar la pregunta completa. Diga Oye Portia e intente de nuevo.");
            restartHotwordListening();
          }
        }
      }, 15000);
    } catch (_error) {
      setListening(false);
      recognitionModeRef.current = "idle";
      if (conversationActiveRef.current && awaitingCommandRef.current && commandRetryRef.current < 3) {
        commandRetryRef.current += 1;
        scheduleCommandListening(650);
        return;
      }
      awaitingCommandRef.current = false;
      restartHotwordListening();
    }
  }

  async function startCommandListening() {
    if (!hotwordEnabledRef.current || !awaitingCommandRef.current) return;

    try {
      if (commandListenFallbackRef.current) {
        clearTimeout(commandListenFallbackRef.current);
        commandListenFallbackRef.current = null;
      }
      if (commandStartDelayRef.current) {
        clearTimeout(commandStartDelayRef.current);
        commandStartDelayRef.current = null;
      }
      if (commandCaptureTimeoutRef.current) {
        clearTimeout(commandCaptureTimeoutRef.current);
        commandCaptureTimeoutRef.current = null;
      }
      pendingVoiceCommandRef.current = "";
      Speech.stop();
      speechActiveRef.current = false;
      await ExpoSpeechRecognitionModule.stop().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 850));
      manualListenRef.current = true;
      recognitionModeRef.current = "manual";
      setPortiaState("ESCUCHANDO");
      setListening(true);
      setResultado((current) => {
        const base = String(current || "").trim();
        const prompt = "P.O.R.T.I.A: escuchando su pregunta... hable ahora.";
        return base.includes(prompt) ? base : `${base}\n\n${prompt}`.trim();
      });
      await ExpoSpeechRecognitionModule.start({
        lang: "es-ES",
        interimResults: true,
        continuous: false,
        maxAlternatives: 4
      });
      commandCaptureTimeoutRef.current = setTimeout(async () => {
        const captured = pendingVoiceCommandRef.current;
        if (recognitionModeRef.current !== "manual") return;
        try {
          await ExpoSpeechRecognitionModule.stop();
        } catch (_error) {}
        recognitionModeRef.current = "idle";
        setListening(false);
        commandCaptureTimeoutRef.current = null;
        if (captured && normalizeVoice(captured).length >= 3) {
          handleVoiceResult(captured, { fromCommandTimeout: true });
        } else {
          if (conversationActiveRef.current && commandRetryRef.current < 2) {
            commandRetryRef.current += 1;
            setResultado("P.O.R.T.I.A: No recibi audio. Sigo escuchando, repita la pregunta.");
            scheduleCommandListening(650);
          } else {
            awaitingCommandRef.current = false;
            commandRetryRef.current = 0;
            setPortiaState("DORMIDA");
            setResultado("P.O.R.T.I.A: No alcance a escuchar la pregunta completa. Diga Oye Portia e intente de nuevo.");
            restartHotwordListening();
          }
        }
      }, 12000);
    } catch (_error) {
      setListening(false);
      recognitionModeRef.current = "idle";
      if (conversationActiveRef.current && awaitingCommandRef.current && commandRetryRef.current < 2) {
        commandRetryRef.current += 1;
        scheduleCommandListening(900);
        return;
      }
      awaitingCommandRef.current = false;
      restartHotwordListening();
    }
  }

  async function toggleHotword() {
    const next = !hotwordEnabled;
    setHotwordEnabled(next);
    hotwordEnabledRef.current = next;
    if (next) {
      setPortiaState("DORMIDA");
      await startHotwordListening();
    } else {
      clearRestartTimer();
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch (_error) {}
      setListening(false);
      recognitionModeRef.current = "idle";
      awaitingCommandRef.current = false;
      conversationActiveRef.current = false;
      setPortiaState("PAUSADA");
    }
  }

  function leerResultado() {
    if (!resultado.trim()) {
      Alert.alert("Sin resultado", "No hay respuesta para leer.");
      return;
    }
    Speech.stop();
    setPortiaState("HABLANDO");
    speakPortia(resultado);
  }

  function apiBaseFromConfig() {
    return API_BASE;
  }

  function renderTimeline(data) {
    const resumen = data?.resumen || {};
    const eventos = data?.eventos || [];
    const lines = [
      "Timeline operativo",
      "",
      `Eventos: ${resumen.total_eventos || 0}`,
      `Alertas aparentes: ${resumen.alertas || 0}`,
      `Primer evento: ${resumen.primer_evento || "-"}`,
      `Ultimo evento: ${resumen.ultimo_evento || "-"}`,
      ""
    ];
    eventos.slice(0, 80).forEach((item) => {
      lines.push(`[${item.fecha || "-"}] ${item.tipo || ""} | ${item.titulo || ""}`);
      if (item.detalle) lines.push(`  ${item.detalle}`);
    });
    return lines.join("\n");
  }

  function renderMemoria(data) {
    const rows = data?.data || [];
    if (!rows.length) return "Esta operacion aun no tiene memoria P.O.R.T.I.A.";
    const lines = ["Memoria P.O.R.T.I.A", ""];
    rows.forEach((row) => {
      lines.push(`- ${row.creado_en || ""} | ${row.pregunta || ""}`);
      if (row.respuesta) lines.push(`  ${String(row.respuesta).replace(/\n/g, " ").slice(0, 240)}${String(row.respuesta).length > 240 ? "..." : ""}`);
    });
    return lines.join("\n");
  }

  const analysisOptions = [
    ["resumen", "Resumen ejecutivo"],
    ["sof", "SOF"],
    ["riesgos", "Riesgos operativos"],
    ["tiempo", "Tiempo estimado"],
    ["sala", "Sala de control"],
    ["briefing", "Briefing+"],
    ["plan", "Plan de accion"],
    ["timeline", "Timeline"],
    ["memoria", "Memoria"]
  ];
  const quickPrompts = [
    ["Riesgos", "riesgos de hoy"],
    ["Tiempo", "tiempo de cierre"],
    ["Cliente", "cliente atrasado contra cuota"],
    ["Bodega", "bodega critica pendiente de descarga"]
  ];

  function silenciarPortia() {
    Speech.stop();
    setPortiaState("DORMIDA");
    setResultado("P.O.R.T.I.A en espera. Diga Hey Portia para reactivar.");
  }

  return (
    <Screen
      title="P.O.R.T.I.A"
      subtitle="Port Operations & Risk Tactical Intelligence Assistant"
      minWidth={0}
      horizontal={false}
      right={<Button label="Cargar operaciones" icon="search-outline" onPress={loadOperaciones} />}
    >
      {loading && <Loading />}
      <ScrollView>
        <Card>
          <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 17, marginBottom: 10 }}>Analisis de operacion</Text>
          <Text style={{ color: COLORS.muted, fontWeight: "800", marginBottom: 8 }}>
            {selected ? `${selected.id} | ${selected.nombre_buque} | ${selected.fecha_inicio} | ${selected.estado}` : "Presione Cargar operaciones y seleccione una operacion."}
          </Text>
          {operaciones.length === 0 && <EmptyState title="Sin operaciones" subtitle="Presione Cargar operaciones para consultar el backend." />}
          {operaciones.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {operaciones.slice(0, 24).map((op) => {
                  const active = selected?.id === op.id;
                  return (
                    <Pressable
                      key={op.id}
                      onPress={() => setSelected(op)}
                      style={{
                        minWidth: 210,
                        borderWidth: 1,
                        borderColor: active ? COLORS.accent : COLORS.border,
                        backgroundColor: active ? COLORS.accent : COLORS.elevated,
                        padding: 10,
                        borderRadius: 7
                      }}
                    >
                      <Text style={{ color: active ? COLORS.bg : COLORS.text, fontWeight: "900" }} numberOfLines={1}>
                        {op.nombre_buque || "Operacion"}
                      </Text>
                      <Text style={{ color: active ? COLORS.bg : COLORS.muted, fontWeight: "700", marginTop: 3 }}>
                        {op.fecha_inicio || "-"} | {op.estado || "-"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
          <Text style={{ color: COLORS.text, fontWeight: "900", marginBottom: 8 }}>Tipo de analisis</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {analysisOptions.map(([key, label]) => {
                const active = analysisType === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setAnalysisType(key)}
                    style={{
                      backgroundColor: active ? COLORS.accent : COLORS.elevated,
                      borderColor: active ? COLORS.accent : COLORS.border,
                      borderWidth: 1,
                      borderRadius: 7,
                      paddingVertical: 10,
                      paddingHorizontal: 12
                    }}
                  >
                    <Text style={{ color: active ? COLORS.bg : COLORS.text, fontWeight: "900" }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ minWidth: 180, flex: 1 }}>
              <Button label="Generar analisis" icon="sparkles-outline" tone="success" onPress={generarSeleccionado} />
            </View>
            <View style={{ minWidth: 180, flex: 1 }}>
              <Button label="Crear acciones" icon="checkbox-outline" tone="danger" onPress={crearAccionesDesdePlan} />
            </View>
            <View style={{ minWidth: 180, flex: 1 }}>
              <Button label="Acciones abiertas" icon="clipboard-outline" tone="info" onPress={cargarAccionesAbiertas} />
            </View>
            <View style={{ minWidth: 180, flex: 1 }}>
              <Button label="Notificaciones" icon="notifications-outline" tone="warning" onPress={cargarNotificacionesPendientes} />
            </View>
          </View>
        </Card>
        <Card>
          <Text style={{ color: COLORS.text, fontWeight: "900", marginBottom: 10 }}>Chat sobre la operacion</Text>
          <Text style={{ color: COLORS.muted, fontWeight: "700", marginBottom: 10 }}>
            Estado: {portiaState}. Diga Oye Portia, Hola Portia o Portia estas ahi. No es necesario deletrear P.O.R.T.I.A.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <View style={{ minWidth: 190, flex: 1 }}>
              <Button
                label={`Sugerencia: ${quickPrompts[quickPromptIndex][0]}`}
                icon="flash-outline"
                tone="info"
                onPress={() => setPregunta(quickPrompts[quickPromptIndex][1])}
              />
            </View>
            <View style={{ minWidth: 130, flex: 0 }}>
              <Button
                label="Cambiar"
                icon="swap-horizontal-outline"
                tone="accent"
                onPress={() => setQuickPromptIndex((value) => (value + 1) % quickPrompts.length)}
              />
            </View>
          </View>
          <TextInput
            value={pregunta}
            onChangeText={setPregunta}
            placeholder="Ej: Cuanto falta para terminar la operacion?"
            placeholderTextColor={COLORS.auxiliary}
            style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.text, minHeight: 48, paddingHorizontal: 10, marginBottom: 10 }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 150 }}>
              <Switch
                value={hotwordEnabled}
                onValueChange={toggleHotword}
                trackColor={{ false: COLORS.elevated, true: COLORS.accent }}
                thumbColor={hotwordEnabled ? COLORS.text : COLORS.muted}
              />
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>Hey Portia</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 130 }}>
              <Switch
                value={readAnswer}
                onValueChange={setReadAnswer}
                trackColor={{ false: COLORS.elevated, true: COLORS.info }}
                thumbColor={readAnswer ? COLORS.text : COLORS.muted}
              />
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>Leer voz</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ minWidth: 160, flex: 1 }}><Button label={listening ? "Escuchando..." : "Dictar"} icon="mic-outline" tone={listening ? "warning" : "info"} onPress={escuchar} /></View>
            <View style={{ minWidth: 160, flex: 1 }}><Button label="Preguntar" icon="chatbubble-ellipses-outline" tone="success" onPress={() => preguntar()} /></View>
            <View style={{ minWidth: 160, flex: 1 }}><Button label="Silenciar" icon="moon-outline" tone="accent" onPress={silenciarPortia} /></View>
            {!!mapUrl && <Button label="Abrir mapa" icon="map-outline" tone="info" onPress={() => Linking.openURL(mapUrl)} />}
          </View>
        </Card>
        {!!resultado && (
          <Card>
            <Text style={{ color: COLORS.text, fontWeight: "900", marginBottom: 10 }}>Resultado IA</Text>
            <Text style={{ color: COLORS.text, lineHeight: 21 }}>{resultado}</Text>
            <View style={{ marginTop: 10 }}>
              <Button label="Leer resultado" icon="volume-high-outline" tone="info" onPress={leerResultado} />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
