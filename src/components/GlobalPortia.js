import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import * as Speech from "expo-speech";
import { api } from "../api/client";
import { COLORS } from "../config";

const WAKE_WORDS = [
  "oye portia",
  "hola portia",
  "hey portia",
  "portia estas ahi",
  "portia está ahí",
  "estas ahi portia",
  "portia",
  "por tia",
  "porshia",
  "porcha",
  "porcia"
];

const SLEEP_WORDS = [
  "es todo portia",
  "desconectate portia",
  "desconéctate portia",
  "silencio portia",
  "gracias portia"
];

const ACKS = [
  "Le escucho.",
  "Estoy en línea.",
  "A la orden.",
  "Dígame, le escucho.",
  "Lista para asistir.",
  "Adelante."
];

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, patterns) {
  const clean = normalize(text);
  return patterns.some((pattern) => clean.includes(normalize(pattern)));
}

function stripWake(text) {
  let clean = normalize(text);
  WAKE_WORDS.forEach((pattern) => {
    clean = clean.replace(normalize(pattern), " ");
  });
  return clean.replace(/\s+/g, " ").trim();
}

function pickAck() {
  return ACKS[Math.floor(Math.random() * ACKS.length)];
}

export default function GlobalPortia({ enabled = true, session, active }) {
  const [state, setState] = useState("DORMIDA");
  const [last, setLast] = useState("");
  const enabledRef = useRef(enabled);
  const modeRef = useRef("idle");
  const activeRef = useRef(active);
  const commandTimerRef = useRef(null);
  const processingRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    activeRef.current = active;
    if (enabled) {
      startWakeLoop();
    } else {
      stopAll();
    }
    return () => {};
  }, [enabled, active]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        stopAll();
      } else if (enabledRef.current) {
        startWakeLoop();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => stopAll(), []);

  useSpeechRecognitionEvent("result", (event) => {
    const text = (event?.results || [])
      .map((item) => item?.transcript || item?.text || "")
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] || "";
    if (!text) return;
    setLast(text);

    if (modeRef.current === "wake") {
      if (hasAny(text, SLEEP_WORDS)) {
        sleep();
        return;
      }
      if (hasAny(text, WAKE_WORDS)) {
        const command = stripWake(text);
        activate(command);
      }
      return;
    }

    if (modeRef.current === "command") {
      if (hasAny(text, SLEEP_WORDS)) {
        sleep();
        return;
      }
      const command = stripWake(text);
      if (command.length >= 5) {
        clearTimeout(commandTimerRef.current);
        commandTimerRef.current = setTimeout(() => ask(command), 550);
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (!enabledRef.current || processingRef.current) return;
    if (modeRef.current === "command") {
      setTimeout(() => listenCommand(), 250);
    } else {
      setTimeout(() => startWakeLoop(), 350);
    }
  });

  useSpeechRecognitionEvent("error", () => {
    if (!enabledRef.current) return;
    setState("PAUSADA");
    setTimeout(() => startWakeLoop(), 900);
  });

  async function startWakeLoop() {
    if (!enabledRef.current || modeRef.current === "wake" || processingRef.current) return;
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setState("SIN MICROFONO");
        return;
      }
      await ExpoSpeechRecognitionModule.stop().catch(() => {});
      modeRef.current = "wake";
      setState("DORMIDA");
      await ExpoSpeechRecognitionModule.start({
        lang: "es-ES",
        interimResults: true,
        continuous: true,
        maxAlternatives: 5
      });
    } catch (_error) {
      setState("PAUSADA");
    }
  }

  async function listenCommand() {
    if (!enabledRef.current || processingRef.current) return;
    try {
      await ExpoSpeechRecognitionModule.stop().catch(() => {});
      modeRef.current = "command";
      setState("ESCUCHANDO");
      await ExpoSpeechRecognitionModule.start({
        lang: "es-ES",
        interimResults: true,
        continuous: false,
        maxAlternatives: 5
      });
    } catch (_error) {
      setState("PAUSADA");
      setTimeout(() => startWakeLoop(), 800);
    }
  }

  function activate(initialCommand = "") {
    const ack = pickAck();
    setState("ACTIVA");
    Speech.stop();
    Speech.speak(ack, {
      language: "es-ES",
      rate: 0.98,
      pitch: 1.02,
      onDone: () => {
        if (initialCommand && initialCommand.length >= 5) {
          ask(initialCommand);
        } else {
          listenCommand();
        }
      },
      onError: () => listenCommand()
    });
  }

  async function ask(command) {
    if (!command || processingRef.current) return;
    processingRef.current = true;
    clearTimeout(commandTimerRef.current);
    await ExpoSpeechRecognitionModule.stop().catch(() => {});
    modeRef.current = "idle";
    setState("PROCESANDO");
    setLast(command);
    try {
      const data = await api.maritimeChat({
        pregunta: command,
        operacion_id: null,
        modo: "Operativo",
        buscar_web: false
      });
      const answer = String(data?.text || data?.respuesta || "No tengo respuesta disponible.").slice(0, 900);
      setState("HABLANDO");
      Speech.speak(answer, {
        language: "es-ES",
        rate: 0.96,
        pitch: 1.02,
        onDone: () => {
          processingRef.current = false;
          listenCommand();
        },
        onError: () => {
          processingRef.current = false;
          listenCommand();
        }
      });
    } catch (_error) {
      const fallback = "No pude consultar el backend en este momento.";
      Speech.speak(fallback, {
        language: "es-ES",
        onDone: () => {
          processingRef.current = false;
          startWakeLoop();
        }
      });
    }
  }

  async function stopAll() {
    clearTimeout(commandTimerRef.current);
    modeRef.current = "idle";
    processingRef.current = false;
    await ExpoSpeechRecognitionModule.stop().catch(() => {});
    Speech.stop();
    setState("PAUSADA");
  }

  function sleep() {
    clearTimeout(commandTimerRef.current);
    Speech.stop();
    Speech.speak("Entendido. Quedo en espera.", {
      language: "es-ES",
      rate: 0.98,
      onDone: () => startWakeLoop()
    });
    setState("DORMIDA");
  }

  if (!enabled || !session) return null;

  return (
    <Pressable style={styles.floating} onPress={() => activate()}>
      <Text style={styles.title}>P.O.R.T.I.A</Text>
      <Text style={styles.status}>{state}</Text>
      {!!last && <Text style={styles.last} numberOfLines={1}>{last}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: "absolute",
    right: 12,
    bottom: 14,
    maxWidth: 230,
    backgroundColor: COLORS.card,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8
  },
  title: {
    color: COLORS.accent,
    fontWeight: "900",
    fontSize: 13
  },
  status: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 2,
    fontSize: 12
  },
  last: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    fontSize: 10
  }
});
