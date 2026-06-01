import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, DeviceEventEmitter, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";
import { ANDROID_PACKAGE, COLORS, IS_HANDHELD } from "../config";

const PLATFORM_DEVICE_TEXT = Object.values(Platform.constants || {})
  .map((value) => String(value || ""))
  .join(" ")
  .toUpperCase();
const IS_ZEBRA_DEVICE = Platform.OS === "android" && /ZEBRA|TC26|TC2|SE4710|MOTOROLA SOLUTIONS/.test(PLATFORM_DEVICE_TEXT);
const USE_HARDWARE_SCANNER = IS_HANDHELD || IS_ZEBRA_DEVICE;

const TABLE_COLUMNS = [
  ["id", "ID", 54],
  ["guia", "Guia", 88],
  ["numero_embarque", "Embarque", 112],
  ["bodega_numero", "Bodega", 82],
  ["empresa", "Empresa", 150],
  ["buque", "Buque", 150],
  ["fecha", "Fecha", 112],
  ["producto", "Producto", 130],
  ["chofer", "Chofer", 150],
  ["placa", "Placa", 96],
  ["estado", "Estado", 112],
  ["lecturas", "Lecturas", 92],
  ["etapa_qr", "Etapa QR", 138],
  ["numero_tolva", "Tolva", 90],
  ["qr_bloqueado", "Bloqueado", 104]
];

const PAGE_SIZE = 40;
const BOLETAS_EMPTY_FILTERS = {
  empresa: "",
  guia: "",
  producto: "",
  chofer: "",
  placa: ""
};
const BOLETAS_FILTER_LABELS = {
  empresa: "Empresa",
  guia: "Guia",
  producto: "Producto",
  chofer: "Chofer",
  placa: "Placa"
};
const BOLETAS_OPTION_MAP = {
  empresa: "empresas",
  guia: "guias",
  producto: "productos",
  chofer: "choferes",
  placa: "placas"
};
const OFFLINE_QUEUE_FILE = `${FileSystem.documentDirectory || ""}xtravon_qr_offline_queue.json`;
const OFFLINE_QUEUE_BACKUP_FILE = `${FileSystem.documentDirectory || ""}xtravon_qr_offline_queue.bak.json`;
const OFFLINE_GUIDES_FILE = `${FileSystem.documentDirectory || ""}xtravon_qr_guides_cache.json`;
const OFFLINE_GUIDES_BACKUP_FILE = `${FileSystem.documentDirectory || ""}xtravon_qr_guides_cache.bak.json`;
const DEVICE_ID_FILE = `${FileSystem.documentDirectory || ""}xtravon_handheld_device_id.txt`;
const SYNC_BATCH_SIZE = 25;
const DATAWEDGE_PROFILE = "XTRAVON_ONE_PATIO";
const DATAWEDGE_ACTION = "com.xtravon.scan.ACTION";
const DATAWEDGE_CATEGORY = "android.intent.category.DEFAULT";
const DATAWEDGE_PACKAGE = ANDROID_PACKAGE;
const DATAWEDGE_ACTIONS = [
  DATAWEDGE_ACTION,
  "com.xtravon.one.SCAN",
  "com.xtravon.one.handheld.SCAN",
  "com.erpelsurco.mobile.SCAN",
  "com.symbol.datawedge.api.RESULT_ACTION"
];
const DATAWEDGE_PACKAGES = [
  DATAWEDGE_PACKAGE,
  "com.xtravon.one.handheld",
  "com.xtravon.one.celular",
  "com.xtravon.one",
  "com.erpelsurco.mobile"
];

function utf8Bytes(value) {
  const input = String(value || "");
  const bytes = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
        i += 1;
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

function sha256Hex(value) {
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i -= 1) {
    bytes.push((bitLength / Math.pow(2, i * 8)) & 0xff);
  }

  const rightRotate = (num, amount) => (num >>> amount) | (num << (32 - amount));
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array(64).fill(0);
    for (let j = 0; j < 16; j += 1) {
      w[j] = ((bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3]) >>> 0;
    }
    for (let j = 16; j < 64; j += 1) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let j = 0; j < 64; j += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + k[j] + w[j]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((value32) => value32.toString(16).padStart(8, "0")).join("");
}

function sanitizarGuiaOffline(guia = {}) {
  const { hash_qr, offline_token_hash, token, raw_qr, ...rest } = guia || {};
  return rest;
}

function getDataWedgeModule() {
  if (!USE_HARDWARE_SCANNER) return null;
  if (Platform.OS !== "android") return null;
  try {
    return require("react-native-datawedge-intents");
  } catch (_error) {
    return null;
  }
}

function extraerCampoDataWedge(intent, key) {
  return intent?.[key] ?? intent?.extras?.[key] ?? intent?.intentExtras?.[key] ?? "";
}

function extraerLecturaDataWedge(intent) {
  if (!intent) return null;
  const data =
    extraerCampoDataWedge(intent, "com.symbol.datawedge.data_string") ||
    extraerCampoDataWedge(intent, "data_string") ||
    intent.data ||
    "";
  if (!data) return null;
  return {
    data: String(data),
    source: intent.source || extraerCampoDataWedge(intent, "com.symbol.datawedge.source") || "SE4710",
    labelType: intent.labelType || extraerCampoDataWedge(intent, "com.symbol.datawedge.label_type") || ""
  };
}

function enviarComandoDataWedge(extraName, extraValue) {
  const dw = getDataWedgeModule();
  if (!dw) return false;
  try {
    const extras = {};
    extras[extraName] = extraValue;
    extras.SEND_RESULT = "true";
    dw.sendBroadcastWithExtras({
      action: "com.symbol.datawedge.api.ACTION",
      extras
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function dispararSoftScanDataWedge(accion = "START_SCANNING") {
  const dw = getDataWedgeModule();
  if (!dw) return false;
  try {
    const action = dw.ACTION_SOFTSCANTRIGGER || "com.symbol.datawedge.api.SOFT_SCAN_TRIGGER";
    const value = accion === "STOP_SCANNING" ? (dw.STOP_SCANNING || "STOP_SCANNING") : (dw.START_SCANNING || "START_SCANNING");
    if (typeof dw.sendIntent === "function") {
      dw.sendIntent(action, value);
      return true;
    }
  } catch (_error) {
    // Si el metodo nativo no esta disponible, se intenta por broadcast.
  }
  return enviarComandoDataWedge("com.symbol.datawedge.api.SOFT_SCAN_TRIGGER", accion);
}

function configurarPerfilDataWedge() {
  const dw = getDataWedgeModule();
  if (!dw) return false;

  try {
    dw.registerBroadcastReceiver({
      filterActions: DATAWEDGE_ACTIONS,
      filterCategories: [DATAWEDGE_CATEGORY]
    });
  } catch (_error) {
    return false;
  }

  enviarComandoDataWedge("com.symbol.datawedge.api.CREATE_PROFILE", DATAWEDGE_PROFILE);
  enviarComandoDataWedge(
    "com.symbol.datawedge.api.SET_CONFIG",
    {
      PROFILE_NAME: DATAWEDGE_PROFILE,
      PROFILE_ENABLED: "true",
      CONFIG_MODE: "UPDATE",
      APP_LIST: DATAWEDGE_PACKAGES.map((packageName) => ({
        PACKAGE_NAME: packageName,
        ACTIVITY_LIST: ["*"]
      })),
      PLUGIN_CONFIG: [
        {
          PLUGIN_NAME: "BARCODE",
          RESET_CONFIG: "true",
          PARAM_LIST: {
            scanner_input_enabled: "true",
            scanner_selection: "auto",
            decoder_qrcode: "true"
          }
        },
        {
          PLUGIN_NAME: "INTENT",
          RESET_CONFIG: "true",
          PARAM_LIST: {
            intent_output_enabled: "true",
            intent_action: DATAWEDGE_ACTION,
            intent_category: DATAWEDGE_CATEGORY,
            intent_delivery: "2"
          }
        },
        {
          PLUGIN_NAME: "KEYSTROKE",
          RESET_CONFIG: "true",
          PARAM_LIST: {
            // Respaldo del SE4710: si el intent de DataWedge no llega, el lector
            // escribe en el input oculto. La camara sigue apagada por defecto.
            keystroke_output_enabled: "true",
            keystroke_action_char: "10"
          }
        }
      ]
    }
  );
  enviarComandoDataWedge("com.symbol.datawedge.api.SWITCH_TO_PROFILE", DATAWEDGE_PROFILE);
  return true;
}

function isPatioOperatorSession(session) {
  const values = [
    session?.rol,
    session?.role,
    session?.perfil,
    ...(Array.isArray(session?.roles) ? session.roles : [])
  ]
    .filter(Boolean)
    .map((value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
  return values.some((value) => (
    value === "OPERADOR" ||
    value.includes("OPERADOR_PATIO") ||
    value.includes("OPERADOR DE PATIO") ||
    (value.includes("OPERADOR") && value.includes("PATIO"))
  ));
}

export default function ScanScreen({ session, onNavigate }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [boleta, setBoleta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [manualId, setManualId] = useState("");
  const [scannerSession, setScannerSession] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [boletas, setBoletas] = useState([]);
  const [boletasFilters, setBoletasFilters] = useState(BOLETAS_EMPTY_FILTERS);
  const [boletasFilterOptions, setBoletasFilterOptions] = useState(null);
  const [activeBoletasFilter, setActiveBoletasFilter] = useState(null);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [operacionActiva, setOperacionActiva] = useState(null);
  const [operacionConsultada, setOperacionConsultada] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrError, setQrError] = useState("");
  const [ficha, setFicha] = useState("");
  const [pesoVacio, setPesoVacio] = useState("");
  const [numeroTolva, setNumeroTolva] = useState("");
  const [marchamos, setMarchamos] = useState("");
  const [marchamosLista, setMarchamosLista] = useState([""]);
  const [pesoLleno, setPesoLleno] = useState("");
  const [crearIssueLog, setCrearIssueLog] = useState(false);
  const [comentarioIssueLog, setComentarioIssueLog] = useState("");
  const [page, setPage] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [offlineQr, setOfflineQr] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [guideCacheInfo, setGuideCacheInfo] = useState(null);
  const [deviceId, setDeviceId] = useState("");
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [usarCamaraRespaldo, setUsarCamaraRespaldo] = useState(false);
  const [dataWedgeStatus, setDataWedgeStatus] = useState(
    USE_HARDWARE_SCANNER
      ? "Lector SE4710 pendiente de inicializar."
      : "Modo celular: camara activa como lector principal."
  );
  const [hardwareScanValue, setHardwareScanValue] = useState("");
  const syncTimerRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const hardwareInputRef = useRef(null);
  const hardwareScanTimerRef = useRef(null);
  const lastHardwareScanRef = useRef({ value: "", at: 0 });
  const isOperator = isPatioOperatorSession(session);

  useEffect(() => {
    if (isOperator) {
      setUsarCamaraRespaldo(false);
    }
  }, [isOperator]);

  const totalPages = Math.max(1, Math.ceil(boletas.length / PAGE_SIZE));
  const visibleBoletas = useMemo(
    () => boletas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [boletas, page]
  );

  const selectedBoleta = useMemo(
    () => boletas.find((item) => Number(item.id) === Number(selectedId)) || boleta,
    [boletas, selectedId, boleta]
  );

  const boletasParams = useMemo(() => {
    const params = cleanParams(boletasFilters);
    if (operacionActiva?.id) {
      params.operacion_id = operacionActiva.id;
    }
    return params;
  }, [boletasFilters, operacionActiva?.id]);

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

  function sincronizarMarchamosLista(lista) {
    const normalizados = normalizarMarchamos(lista);
    setMarchamosLista(normalizados.length ? normalizados : [""]);
    setMarchamos(normalizados.join(", "));
    return normalizados;
  }

  function cargarMarchamosDesdeTexto(value) {
    const normalizados = normalizarMarchamos(String(value || "").split(/[,;\n|]+/));
    setMarchamosLista(normalizados.length ? normalizados : [""]);
    setMarchamos(normalizados.join(", "));
  }

  function cambiarMarchamo(index, value) {
    const next = [...marchamosLista];
    next[index] = value;
    setMarchamosLista(next);
    setMarchamos(normalizarMarchamos(next).join(", "));
  }

  function agregarMarchamo() {
    if (marchamosLista.length >= 10) {
      Alert.alert("Limite de marchamos", "Puede agregar maximo 10 marchamos por camion.");
      return;
    }
    setMarchamosLista([...marchamosLista, ""]);
  }

  function quitarMarchamo(index) {
    const next = marchamosLista.filter((_item, idx) => idx !== index);
    sincronizarMarchamosLista(next.length ? next : [""]);
  }

  useEffect(() => {
    let active = true;
    Promise.all([cargarColaOffline(), cargarGuiasOffline(), obtenerDeviceId()]).then(([items, cache, id]) => {
      if (active) {
        setDeviceId(id);
        setOfflineQueue(items);
        if (cache?.guias?.length) {
          guardarGuiasOffline(cache);
          setBoletas(cache.guias);
          setGuideCacheInfo({
            operacion_id: cache.operacion_id,
            buque: cache.buque,
            total: cache.guias.length,
            actualizado_en: cache.actualizado_en
          });
        }
        if (items.length) {
          setSyncMessage(`${items.length} lectura(s) pendientes por sincronizar.`);
        }
      }
    }).catch((error) => {
      if (active) {
        setSyncMessage(`Memoria offline no inicializada: ${error?.message || "error local"}`);
      }
    });
    return () => {
      active = false;
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOperator || !USE_HARDWARE_SCANNER || Platform.OS !== "android") {
      if (isOperator && !USE_HARDWARE_SCANNER) {
        setDataWedgeStatus("Modo celular: use el boton de camara solo como lector manual.");
      }
      return undefined;
    }

    const dwReady = configurarPerfilDataWedge();
    setDataWedgeStatus(
      dwReady
        ? "Lector SE4710 listo. Use el boton fisico amarillo del Zebra TC26."
        : "DataWedge nativo no disponible. Use modo teclado SE4710 o camara de respaldo."
    );

    const handler = (intent) => {
      try {
        const scan = extraerLecturaDataWedge(intent);
        if (scan?.data) {
          procesarLecturaHardware(scan.data, scan.source || "SE4710").catch((error) => {
            setDataWedgeStatus(`Lectura recibida, pero no se pudo procesar: ${error?.message || "error"}`);
          });
        }
      } catch (error) {
        setDataWedgeStatus(`DataWedge activo con aviso: ${error?.message || "lectura no procesada"}`);
      }
    };

    const subBroadcast = DeviceEventEmitter.addListener("datawedge_broadcast_intent", handler);
    const subBarcode = DeviceEventEmitter.addListener("barcode_scan", handler);
    const focusTimer = setTimeout(() => hardwareInputRef.current?.focus?.(), 450);

    return () => {
      subBroadcast?.remove?.();
      subBarcode?.remove?.();
      clearTimeout(focusTimer);
      if (hardwareScanTimerRef.current) {
        clearTimeout(hardwareScanTimerRef.current);
      }
    };
  }, [isOperator]);

  useEffect(() => {
    if (isOperator && USE_HARDWARE_SCANNER) {
      setUsarCamaraRespaldo(false);
      setCameraReady(false);
      setCameraError("");
      setTimeout(() => {
        try {
          hardwareInputRef.current?.focus?.();
        } catch (_error) {
          // El SE4710 por DataWedge es el lector principal; la camara no se monta.
        }
      }, 300);
    }
  }, [isOperator]);

  useEffect(() => {
    if (!isOperator || !USE_HARDWARE_SCANNER || Platform.OS !== "android" || usarCamaraRespaldo) {
      return undefined;
    }
    setUsarCamaraRespaldo(false);
    const focus = () => {
      try {
        hardwareInputRef.current?.focus?.();
      } catch (_error) {
        // El enfoque del teclado wedge es auxiliar; nunca debe cerrar la app.
      }
    };
    focus();
    const focusTimer = setInterval(focus, 1500);
    return () => clearInterval(focusTimer);
  }, [isOperator, usarCamaraRespaldo]);

  useEffect(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (!offlineQueue.length) {
      return;
    }
    syncTimerRef.current = setInterval(() => {
      sincronizarColaOffline(false);
    }, 15000);
    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [offlineQueue.length]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && offlineQueue.length > 0) {
        sincronizarColaOffline(false);
      }
      if (state === "active" && isOperator && usarCamaraRespaldo) {
        setCameraReady(false);
        setScannerSession((value) => value + 1);
      }
    });
    return () => sub.remove();
  }, [offlineQueue.length, isOperator, usarCamaraRespaldo]);

  useEffect(() => {
    let active = true;
    async function pedirPermisoCamara() {
      if (!isOperator || !usarCamaraRespaldo || permission?.granted || permission?.canAskAgain === false) {
        return;
      }
      try {
        await requestPermission();
        if (active) {
          setCameraError("");
          setScannerSession((value) => value + 1);
        }
      } catch (error) {
        if (active) {
          setCameraError(error?.message || "No se pudo activar la camara.");
        }
      }
    }
    const timer = setTimeout(pedirPermisoCamara, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOperator, usarCamaraRespaldo, permission?.granted, permission?.canAskAgain]);

  async function cargarColaOffline() {
    if (!OFFLINE_QUEUE_FILE) return [];
    const leerArchivo = async (path) => {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return [];
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    };
    try {
      return await leerArchivo(OFFLINE_QUEUE_FILE);
    } catch (_error) {
      try {
        return await leerArchivo(OFFLINE_QUEUE_BACKUP_FILE);
      } catch (_backupError) {
        return [];
      }
    }
  }

  async function guardarColaOffline(items) {
    if (!OFFLINE_QUEUE_FILE) return;
    const payload = JSON.stringify(items || []);
    const tempFile = `${OFFLINE_QUEUE_FILE}.tmp`;
    await FileSystem.writeAsStringAsync(OFFLINE_QUEUE_BACKUP_FILE, payload);
    await FileSystem.writeAsStringAsync(tempFile, payload);
    await FileSystem.deleteAsync(OFFLINE_QUEUE_FILE, { idempotent: true });
    await FileSystem.moveAsync({ from: tempFile, to: OFFLINE_QUEUE_FILE });
  }

  async function cargarGuiasOffline() {
    if (!OFFLINE_GUIDES_FILE) return { guias: [] };
    const leerArchivo = async (path) => {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return { guias: [] };
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw || "{}");
      return parsed && Array.isArray(parsed.guias)
        ? { ...parsed, guias: parsed.guias.map(sanitizarGuiaOffline) }
        : { guias: [] };
    };
    try {
      return await leerArchivo(OFFLINE_GUIDES_FILE);
    } catch (_error) {
      try {
        return await leerArchivo(OFFLINE_GUIDES_BACKUP_FILE);
      } catch (_backupError) {
        return { guias: [] };
      }
    }
  }

  async function guardarGuiasOffline(cache) {
    if (!OFFLINE_GUIDES_FILE) return;
    const safeCache = {
      ...(cache || { guias: [] }),
      guias: Array.isArray(cache?.guias) ? cache.guias.map(sanitizarGuiaOffline) : []
    };
    const payload = JSON.stringify(safeCache);
    const tempFile = `${OFFLINE_GUIDES_FILE}.tmp`;
    await FileSystem.writeAsStringAsync(OFFLINE_GUIDES_BACKUP_FILE, payload);
    await FileSystem.writeAsStringAsync(tempFile, payload);
    await FileSystem.deleteAsync(OFFLINE_GUIDES_FILE, { idempotent: true });
    await FileSystem.moveAsync({ from: tempFile, to: OFFLINE_GUIDES_FILE });
  }

  function tokenCoincideConCache(guia, token) {
    const received = String(token || "").trim();
    if (!received) return true;
    const digest = String(guia?.offline_token_digest || "").trim().toLowerCase();
    return !!digest && digest === sha256Hex(received).toLowerCase();
  }

  function guiaOperableOffline(guia) {
    const estadoAsignacion = String(guia?.estado_asignacion || "").toUpperCase();
    const lecturas = Number(guia?.lecturas || 0);
    if (!["RESERVADA", "ASIGNADA", "EN_PUERTO", "CARGADO"].includes(estadoAsignacion)) {
      return false;
    }
    if (guia?.qr_activo === false) return false;
    if (guia?.qr_bloqueado || lecturas >= 3) return false;
    return true;
  }

  function construirBaseChoferesOffline(guias = []) {
    const map = new Map();
    (Array.isArray(guias) ? guias : []).forEach((item) => {
      const chofer = String(item?.chofer_asignado || item?.chofer || "").trim();
      const placa = String(item?.placa_asignada || item?.placa || "").trim();
      if (!chofer && !placa) return;
      const key = `${chofer.toUpperCase()}|${placa.toUpperCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          chofer,
          placa,
          empresa: item?.empresa || "",
          producto: item?.producto || "",
          guias: 0
        });
      }
      const current = map.get(key);
      current.guias = Number(current.guias || 0) + 1;
    });
    return Array.from(map.values()).sort((a, b) => `${a.chofer} ${a.placa}`.localeCompare(`${b.chofer} ${b.placa}`));
  }

  async function buscarGuiaEnCache(idOrGuia, token = "") {
    const cache = await cargarGuiasOffline();
    const needle = String(idOrGuia || "").trim();
    const found = (cache.guias || []).find((item) => (
      String(item.id || "") === needle ||
      String(item.guia || "").trim() === needle
    ));
    if (!found) return { guia: null, cache, error: "La guia no esta en la memoria offline del handheld." };
    if (!tokenCoincideConCache(found, token)) {
      return { guia: null, cache, error: "El token del QR no coincide con la memoria local. Requiere conexion para validar." };
    }
    if (!guiaOperableOffline(found)) {
      return { guia: null, cache, error: "La guia no esta activa/asignada para operar offline." };
    }
    return { guia: found, cache, error: "" };
  }

  async function actualizarGuiaEnCache(nextGuia) {
    if (!nextGuia?.id) return;
    const safeGuia = sanitizarGuiaOffline(nextGuia);
    const cache = await cargarGuiasOffline();
    const current = Array.isArray(cache.guias) ? cache.guias : [];
    const exists = current.some((item) => Number(item.id) === Number(safeGuia.id));
    const nextGuias = exists
      ? current.map((item) => Number(item.id) === Number(safeGuia.id) ? sanitizarGuiaOffline({ ...item, ...safeGuia }) : sanitizarGuiaOffline(item))
      : [safeGuia, ...current.map(sanitizarGuiaOffline)];
    const nextCache = {
      ...cache,
      guias: nextGuias,
      choferes: construirBaseChoferesOffline(nextGuias),
      actualizado_en: new Date().toISOString()
    };
    setBoletas(nextGuias);
    setGuideCacheInfo({
      operacion_id: nextCache.operacion_id,
      buque: nextCache.buque,
      total: nextGuias.length,
      actualizado_en: nextCache.actualizado_en
    });
    await guardarGuiasOffline(nextCache);
  }

  async function obtenerDeviceId() {
    if (!DEVICE_ID_FILE) return `handheld-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const info = await FileSystem.getInfoAsync(DEVICE_ID_FILE);
      if (info.exists) {
        const value = (await FileSystem.readAsStringAsync(DEVICE_ID_FILE)).trim();
        if (value) return value;
      }
    } catch (_error) {
      // Continua creando uno nuevo.
    }
    const generated = `handheld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await FileSystem.writeAsStringAsync(DEVICE_ID_FILE, generated);
    } catch (_error) {
      // Si no se puede persistir, igual se usa en memoria durante esta sesion.
    }
    return generated;
  }

  function crearClientEventId(tipo, registroId) {
    const id = deviceId || "handheld-pending";
    return `${id}-${tipo}-${registroId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function esErrorReintentable(error) {
    const message = String(error?.message || "").toLowerCase();
    const status = Number(error?.status || 0);
    const esErrorQrControlado = (
      (status >= 400 && status < 500) ||
      /\b4\d\d\b/.test(message) ||
      message.includes("qr no activo") ||
      message.includes("qr no autorizado") ||
      message.includes("qr expirado") ||
      message.includes("qr no valido") ||
      message.includes("no habilitado") ||
      message.includes("cumplio sus escaneos") ||
      message.includes("cancelada")
    );
    if (esErrorQrControlado) {
      return false;
    }
    return (
      !error?.status ||
      status >= 500 ||
      message.includes("network request failed") ||
      message.includes("failed to fetch") ||
      message.includes("timeout") ||
      message.includes("application failed to respond")
    );
  }

  function authOfflineActual() {
    if (offlineMode && offlineQr?.offline_signature) {
      return {
        token: "",
        offline_signature: offlineQr.offline_signature
      };
    }
    return {
      token: qrToken || "",
      offline_signature: ""
    };
  }

  async function agregarEventoOffline(tipo, registroId, auth, payload = {}) {
    const safeAuth = typeof auth === "string"
      ? { token: auth, offline_signature: "" }
      : (auth || {});
    const evento = {
      client_event_id: crearClientEventId(tipo, registroId),
      tipo,
      registro_id: Number(registroId),
      token: safeAuth.offline_signature ? "" : (safeAuth.token || ""),
      offline_signature: safeAuth.offline_signature || "",
      payload,
      dispositivo: deviceId || "handheld-pending",
      capturado_en: new Date().toISOString(),
      intentos: 0,
      ultimo_error: "",
      ultimo_intento_en: "",
      estado_local: "PENDIENTE"
    };
    const current = await cargarColaOffline();
    const next = [...current, evento];
    setOfflineQueue(next);
    await guardarColaOffline(next);
    setSyncMessage(`${next.length} lectura(s) guardadas en cola offline.`);
    return evento;
  }

  async function sincronizarColaOffline(mostrarResultado = true) {
    if (syncInFlightRef.current) {
      return;
    }
    const cola = await cargarColaOffline();
    if (!cola.length) {
      setOfflineQueue([]);
      setSyncMessage("No hay lecturas pendientes.");
      if (mostrarResultado) {
        Alert.alert("Sincronizacion", "No hay lecturas pendientes.");
      }
      return;
    }

    syncInFlightRef.current = true;
    setSyncingQueue(true);
    try {
      const lote = cola.slice(0, SYNC_BATCH_SIZE);
      const data = await api.sincronizarQrEventos(lote);
      const resultados = Array.isArray(data.resultados) ? data.resultados : [];
      const removibles = new Set(
        resultados
          .filter((item) => ["PROCESADO", "DUPLICADO", "ERROR_VALIDACION"].includes(item.estado))
          .map((item) => item.client_event_id)
      );
      const pendientes = cola.filter((item) => !removibles.has(item.client_event_id));
      setOfflineQueue(pendientes);
      await guardarColaOffline(pendientes);
      const mensaje = `Procesados: ${data.procesados || 0} | Duplicados: ${data.duplicados || 0} | Errores: ${data.errores || 0} | Pendientes: ${pendientes.length}`;
      setSyncMessage(mensaje);
      api.registrarPulsoOffline({
        operacion_id: operacionActiva?.id || null,
        dispositivo: deviceId || "handheld-pending",
        perfil: "OPERADOR_PATIO",
        estado: "SYNC_OK",
        pendientes_qr: pendientes.length,
        pendientes_sof: 0,
        detalle: { origen: "ScanScreen", procesados: data.procesados || 0, duplicados: data.duplicados || 0, errores: data.errores || 0 }
      }).catch(() => {});
      if (mostrarResultado) {
        Alert.alert("Sincronizacion QR", mensaje);
      }
    } catch (error) {
      const loteIds = new Set(cola.slice(0, SYNC_BATCH_SIZE).map((item) => item.client_event_id));
      const ahora = new Date().toISOString();
      const actualizada = cola.map((item) => (
        loteIds.has(item.client_event_id)
          ? {
              ...item,
              intentos: Number(item.intentos || 0) + 1,
              ultimo_error: error?.message || "Sin conexion con backend",
              ultimo_intento_en: ahora,
              estado_local: "PENDIENTE_REINTENTO"
            }
          : item
      ));
      setOfflineQueue(actualizada);
      await guardarColaOffline(actualizada);
      setSyncMessage(`Sin conexion con backend. Pendientes: ${actualizada.length}. Ultimo intento: ${actualizada[0]?.intentos || 1}`);
      api.registrarPulsoOffline({
        operacion_id: operacionActiva?.id || null,
        dispositivo: deviceId || "handheld-pending",
        perfil: "OPERADOR_PATIO",
        estado: "SIN_CONEXION",
        pendientes_qr: actualizada.length,
        pendientes_sof: 0,
        detalle: { origen: "ScanScreen", error: error?.message || "Sin conexion con backend" }
      }).catch(() => {});
      if (mostrarResultado) {
        Alert.alert("Sin conexion", "Las lecturas siguen guardadas y se reenviaran cuando vuelva la red.");
      }
    } finally {
      syncInFlightRef.current = false;
      setSyncingQueue(false);
    }
  }

  async function buscarOperacionActiva() {
    try {
      await runWithLoading("Consultando operacion activa...", async () => {
        const data = await api.getOperacionActiva();
        setOperacionActiva(data);
        setOperacionConsultada(true);
        setBoletasFilters(BOLETAS_EMPTY_FILTERS);
        setBoletasFilterOptions(null);
        setBoletas([]);
        setPage(0);
      });
    } catch (error) {
      setOperacionActiva(null);
      setOperacionConsultada(true);
      Alert.alert("Operacion activa", error.message || "No hay operacion abierta.");
    }
  }

  async function sincronizarDatosOperacion() {
    try {
      await runWithLoading("Descargando guias de operacion para modo offline...", async () => {
        const id = deviceId || await obtenerDeviceId();
        setDeviceId(id);
        const cacheData = await api.getQrOfflineCache({ dispositivo: id });
        const operacion = cacheData?.operacion;
        const rows = (Array.isArray(cacheData?.guias) ? cacheData.guias : []).map(sanitizarGuiaOffline);
        const cache = {
          operacion_id: operacion?.id || null,
          codigo_operacion: operacion?.codigo_operacion || "",
          buque: operacion?.nombre_buque || operacion?.buque || "",
          politica: cacheData?.politica || {},
          actualizado_en: cacheData?.actualizado_en || new Date().toISOString(),
          guias: rows,
          choferes: Array.isArray(cacheData?.choferes) ? cacheData.choferes : construirBaseChoferesOffline(rows),
          placas: Array.isArray(cacheData?.placas)
            ? cacheData.placas
            : [...new Set(rows.map((item) => item?.placa_asignada || item?.placa).filter(Boolean).map(String))]
        };
        await guardarGuiasOffline(cache);
        setOperacionActiva(operacion);
        setOperacionConsultada(true);
        setBoletas(rows);
        setGuideCacheInfo({
          operacion_id: cache.operacion_id,
          buque: cache.buque,
          total: rows.length,
          actualizado_en: cache.actualizado_en
        });
        const cacheSinFirma = Boolean(cacheData?.politica?.cache_sin_firma);
        const guiasOperables = rows.filter(guiaOperableOffline).length;
        const guiasReservadas = rows.filter(
          (item) => String(item?.estado_asignacion || "").toUpperCase() === "RESERVADA"
        ).length;
        Alert.alert(
          cacheSinFirma ? "Cache descargado sin firma offline" : "Datos offline listos",
          `${guiasOperables} guia(s) operables offline, ${rows.length} guia(s) cacheadas y ${cache.choferes.length} chofer(es) descargados para ${cache.buque || "la operacion activa"}.${
            guiasReservadas
              ? `\n\n${guiasReservadas} guia(s) estan reservadas y solo se activan cuando despacho/chofer confirma continuidad.`
              : ""
          }\n\n${
            cacheSinFirma
              ? "Railway no tiene QR_SECRET valido. La operacion online puede consultar datos, pero el modo offline seguro no quedara habilitado hasta configurar QR_SECRET y regenerar QR."
              : "Si se cae la red, el handheld podra validar QR cacheados, abrir captura y guardar escaneos en memoria local."
          }`
        );
      });
    } catch (error) {
      Alert.alert("Sincronizar operacion", error.message || "No se pudo descargar la operacion.");
    }
  }

  async function abrirTemplate() {
    try {
      await runWithLoading("Descargando template Excel...", async () => {
        const url = api.templateBoletasUrl();
        const fileUri = `${FileSystem.cacheDirectory}Template_base_operaciones_camiones.xlsx`;
        const result = await FileSystem.downloadAsync(url, fileUri);
        if (!result?.uri) {
          throw new Error("No se pudo descargar el template.");
        }

        if (Platform.OS === "android") {
          try {
            const IntentLauncher = require("expo-intent-launcher");
            const contentUri = await FileSystem.getContentUriAsync(result.uri);
            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
              data: contentUri,
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              flags: 1
            });
            return;
          } catch (_openError) {
            // Si no hay Excel/Sheets o Android bloquea el intent, usamos el selector nativo como respaldo.
          }
        }

        const Sharing = require("expo-sharing");
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(result.uri, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Abrir Template base_operaciones_camiones.xlsx",
            UTI: "org.openxmlformats.spreadsheetml.sheet"
          });
          return;
        }

        await Linking.openURL(result.uri);
      });
    } catch (error) {
      Alert.alert("Abrir Template", error.message || "No se pudo abrir el Excel.");
    }
  }

  async function cargarExcel() {
    try {
      const DocumentPicker = require("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel"
        ],
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Excel", "No se pudo leer el archivo seleccionado.");
        return;
      }

      await runWithLoading("Cargando datos en la base. Por favor espere...", async () => {
        if (!operacionActiva?.id) {
          throw new Error("Primero presione Buscar operacion activa antes de cargar el Excel.");
        }
        const localResponse = await fetch(asset.uri);
        const blob = await localResponse.blob();
        const data = await api.cargarExcelBoletasArchivo(blob, { operacion_id: operacionActiva.id });
        Alert.alert(
          "Excel cargado",
          `Archivo cargado en base_operaciones_camiones.\n\nInsertados: ${data.insertados || 0}\nOmitidos: ${data.omitidos || 0}\n\nPresione Cargar Tabla para consultar la base.`
        );
      });
    } catch (error) {
      Alert.alert("Cargando Excel", error.message);
    }
  }

  async function cargarTabla() {
    try {
      await runWithLoading("Consultando boletas en la base...", async () => {
        const data = await api.getBoletas(boletasParams);
        setBoletas(Array.isArray(data) ? data : []);
        setBoleta(null);
        setSelectedId(null);
        setPage(0);
      });
    } catch (error) {
      Alert.alert("Cargar Tabla", error.message);
    }
  }

  async function cargarFiltrosBoletas() {
    if (!operacionActiva?.id) {
      Alert.alert("Operacion requerida", "Primero presione Buscar operacion activa.");
      return;
    }
    setFiltersLoading(true);
    try {
      const data = await api.getBoletasFiltros(boletasParams);
      setBoletasFilterOptions(data?.opciones || {});
    } catch (error) {
      Alert.alert("Filtros", error.message || "No se pudieron cargar los filtros.");
    } finally {
      setFiltersLoading(false);
    }
  }

  function updateBoletasFilter(key, value) {
    setBoletasFilters((current) => ({ ...current, [key]: value }));
  }

  function limpiarFiltrosBoletas() {
    setBoletasFilters(BOLETAS_EMPTY_FILTERS);
    setBoletasFilterOptions(null);
    setPage(0);
  }

  function reactivarScanner() {
    setScanned(false);
    setQrError("");
    setOfflineQr(null);
    setCameraError("");
    setCameraReady(false);
    setHardwareScanValue("");
    if (USE_HARDWARE_SCANNER) {
      setUsarCamaraRespaldo(false);
    }
    setScannerSession((value) => value + 1);
    setTimeout(() => hardwareInputRef.current?.focus?.(), 150);
  }

  async function generarQr() {
    try {
      await runWithLoading("Generando codigos QR...", async () => {
        const data = await api.generarQrBoletas();
        Alert.alert(
          "QR generados",
          `QR generados correctamente.\n\nTotal backend: ${data.total_generados || 0}`
        );
      });
    } catch (error) {
      Alert.alert("Generar QR", error.message);
    }
  }

  async function entregarQr(canal = "CARPETA") {
    try {
      await runWithLoading("Preparando entrega QR...", async () => {
        const data = await api.entregarQrBoletas({ canal, formato: "jpg" });
        const links = (data.entregas || []).map((item) => item.link).filter(Boolean);
        Alert.alert(
          "Entrega QR",
          [
            `Lote: ${data.lote_codigo || ""}`,
            `Canal: ${data.canal || canal}`,
            `QR preparados: ${data.total_qr || 0}`,
            `Entregas: ${data.total_entregas || 0}`,
            `Pendientes contacto: ${data.pendientes_contacto || 0}`,
            `Enviadas: ${(data.entregas || []).filter((item) => item.estado === "ENVIADO").length}`,
            `Errores envio: ${(data.entregas || []).filter((item) => item.estado === "ERROR_ENVIO").length}`,
            data.ruta_base_qr ? `Ruta: ${data.ruta_base_qr}` : ""
          ].filter(Boolean).join("\n"),
          links.length
            ? [
                { text: "Cerrar", style: "cancel" },
                { text: "Abrir link", onPress: () => Linking.openURL(links[0]) }
              ]
            : undefined
        );
      });
    } catch (error) {
      Alert.alert("Entrega QR", error.message);
    }
  }

  async function exportarExcel() {
    const url = api.exportarBoletasExcelUrl();
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Exportar Excel", "No se pudo abrir el archivo exportado.");
      return;
    }
    Linking.openURL(url);
  }

  async function loadBoleta(id, token = "", rawQr = "", options = {}) {
    if (!id) return;
    setLoading(true);
    setLoadingLabel("Consultando guia...");
    setQrError("");
    setOfflineQr(null);
    setOfflineMode(false);
    try {
      const data = token ? await api.validarQr(id, token) : await api.getBoleta(id);
      setBoleta(data);
      setSelectedId(data?.id || id);
      setQrToken(token);
      setFicha(data?.ficha || "");
      setPesoVacio(data?.peso_vacio ? String(data.peso_vacio) : "");
      setNumeroTolva(data?.numero_tolva || "");
      cargarMarchamosDesdeTexto(data?.marchamos_lista?.length ? data.marchamos_lista.join(", ") : data?.marchamos || "");
      setPesoLleno(data?.peso_lleno ? String(data.peso_lleno) : "");
      setComentarioIssueLog(data?.comentario_issue_log || "");
      await actualizarGuiaEnCache(data);
      if (isOperator) {
        setCaptureOpen(true);
      }
      return data;
    } catch (error) {
      if (esErrorReintentable(error)) {
        const cached = await buscarGuiaEnCache(id, token);
        if (cached.guia) {
          setBoleta(cached.guia);
          setSelectedId(cached.guia.id || id);
          setQrToken(cached.guia.offline_signature ? "" : token);
          setFicha(cached.guia.ficha || "");
          setPesoVacio(cached.guia.peso_vacio ? String(cached.guia.peso_vacio) : "");
          setNumeroTolva(cached.guia.numero_tolva || "");
          cargarMarchamosDesdeTexto(cached.guia.marchamos_lista?.length ? cached.guia.marchamos_lista.join(", ") : cached.guia.marchamos || "");
          setPesoLleno(cached.guia.peso_lleno ? String(cached.guia.peso_lleno) : "");
          setComentarioIssueLog(cached.guia.comentario_issue_log || "");
          setOfflineMode(true);
          setOfflineQr({
            registro_id: Number(id),
            offline_signature: cached.guia.offline_signature || "",
            offline_token_digest: cached.guia.offline_token_digest || "",
            capturado_en: new Date().toISOString()
          });
          if (isOperator) {
            setCaptureOpen(true);
          }
          setQrError("Modo offline: guia encontrada en memoria local. Puede llenar datos y guardar; se enviaran al volver la red.");
          return cached.guia;
        }

        setOfflineQr(null);
        setQrError(cached.error || "Backend o red no disponible. QR no existe en la memoria offline segura.");
        Alert.alert(
          "QR sin cache offline",
          "Este QR no esta en la memoria segura del handheld. Para operar sin red primero debe sincronizar la operacion cuando haya conexion."
        );
        return null;
      }
      setBoleta(null);
      setQrError(error.message || "QR no valido");
      if (!options.silent) {
        Alert.alert("QR no valido", error.message || "Ese QR no es valido.");
      }
      return null;
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function buscarGuiaManual() {
    const value = manualId.trim();
    if (!value) {
      Alert.alert("Dato requerido", "Digite ID interno o numero de guia.");
      return;
    }

    if (/^\d+$/.test(value)) {
      const foundById = await loadBoleta(value, "", "", { silent: true });
      if (foundById?.id) {
        return;
      }
    }

    setLoading(true);
    setLoadingLabel("Buscando guia...");
    setQrError("");
    setOfflineQr(null);
    try {
      const data = await api.getBoletas({ guia: value });
      const rows = Array.isArray(data) ? data : [];
      const exact = rows.find((item) => String(item.guia || "").trim() === value) || rows[0];
      if (!exact?.id) {
        throw new Error("No se encontro una guia con ese numero.");
      }
      setBoleta(exact);
      setSelectedId(exact.id);
      setQrToken("");
      setFicha(exact.ficha || "");
      setPesoVacio(exact.peso_vacio ? String(exact.peso_vacio) : "");
      setNumeroTolva(exact.numero_tolva || "");
      cargarMarchamosDesdeTexto(exact.marchamos_lista?.length ? exact.marchamos_lista.join(", ") : exact.marchamos || "");
      setPesoLleno(exact.peso_lleno ? String(exact.peso_lleno) : "");
      setComentarioIssueLog(exact.comentario_issue_log || "");
      await actualizarGuiaEnCache(exact);
      if (isOperator) {
        setCaptureOpen(true);
      }
      setScanned(false);
    } catch (error) {
      setBoleta(null);
      setQrError(error.message || "No se pudo buscar la guia.");
      Alert.alert("Buscar guia", error.message || "No se pudo buscar la guia.");
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function extraerDatosQr(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const id = parsed.registro_id || parsed.id || parsed.boleta_id || parsed.guia_id;
      const token = parsed.token || parsed.hash || parsed.hash_qr || "";
      if (id) return { id: String(id), token: String(token || ""), raw };
    } catch (_error) {
      // No era JSON; continua con URL/texto plano.
    }

    try {
      const url = new URL(raw);
      const id =
        url.searchParams.get("registro_id") ||
        url.searchParams.get("id") ||
        url.searchParams.get("boleta_id") ||
        url.pathname.match(/qr\/(\d+)/)?.[1] ||
        url.pathname.match(/base-operaciones-camiones\/(\d+)/)?.[1];
      const token = url.searchParams.get("token") || url.searchParams.get("hash") || url.searchParams.get("hash_qr") || "";
      if (id) return { id: String(id), token: String(token || ""), raw };
    } catch (_error) {
      // No era URL absoluta; continua con regex.
    }

    const match = raw.match(/qr\/(\d+)/) || raw.match(/registro[_-]?id[=:]\s*(\d+)/i) || raw.match(/^(\d+)$/);
    if (match) return { id: String(match[1]), token: "", raw };
    return null;
  }

  async function procesarLecturaHardware(rawValue, source = "SE4710") {
    try {
      const value = String(rawValue || "").trim().replace(/[\r\n]+/g, "");
      if (!value) return;

      const now = Date.now();
      if (lastHardwareScanRef.current.value === value && now - lastHardwareScanRef.current.at < 1300) {
        return;
      }
      lastHardwareScanRef.current = { value, at: now };
      setHardwareScanValue("");
      setScanned(true);
      setQrError("");
      setManualId(value);
      setDataWedgeStatus(`Lectura ${source}: ${value.slice(0, 80)}`);

      const parsed = extraerDatosQr(value);
      if (parsed?.id) {
        await loadBoleta(parsed.id, parsed.token, parsed.raw);
        return;
      }

      setQrError("Lectura recibida por SE4710, pero no pertenece a XTRAVON ONE / GRAIN CONTROL.");
      Alert.alert("QR no valido", "Lectura recibida por el lector SE4710, pero ese QR no pertenece a XTRAVON ONE / GRAIN CONTROL.");
    } catch (error) {
      setScanned(false);
      setQrError(error?.message || "No se pudo procesar la lectura del SE4710.");
      setDataWedgeStatus(`SE4710 activo. Ultimo error controlado: ${error?.message || "lectura no procesada"}`);
    } finally {
      if (USE_HARDWARE_SCANNER) {
        setTimeout(() => {
          try {
            hardwareInputRef.current?.focus?.();
          } catch (_error) {
            // No bloquear lectura por un error de foco.
          }
        }, 250);
      }
    }
  }

  function onHardwareTextChange(text) {
    setHardwareScanValue(text);
    if (hardwareScanTimerRef.current) {
      clearTimeout(hardwareScanTimerRef.current);
    }

    const clean = String(text || "").trim();
    if (!clean) return;

    const hasEnter = /[\r\n]/.test(text);
    hardwareScanTimerRef.current = setTimeout(() => {
      const value = String(hardwareScanValue || text || "").trim().replace(/[\r\n]+/g, "");
      if (value) {
        procesarLecturaHardware(value, "SE4710 teclado").catch(() => {});
      }
    }, hasEnter ? 20 : 220);
  }

  function activarPerfilZebra() {
    if (!USE_HARDWARE_SCANNER) {
      setDataWedgeStatus("SE4710 no detectado en este dispositivo. Use camara manual en esta version.");
      return;
    }
    const ok = configurarPerfilDataWedge();
    setUsarCamaraRespaldo(false);
    setDataWedgeStatus(
      ok
        ? "Lector SE4710 listo. Presione el boton fisico amarillo para leer."
        : "No se detecto DataWedge nativo. Si el Zebra esta en modo teclado, mantenga esta pantalla activa y presione el boton fisico."
    );
    setTimeout(() => {
      try {
        hardwareInputRef.current?.focus?.();
      } catch (_error) {
        // Fallback visual sin cerrar la app.
      }
    }, 200);
  }

  function dispararLecturaZebra() {
    if (!USE_HARDWARE_SCANNER) {
      setDataWedgeStatus("Disparo SE4710 no detectado en este dispositivo.");
      return;
    }
    setUsarCamaraRespaldo(false);
    setCameraReady(false);
    setCameraError("");
    const ok = dispararSoftScanDataWedge("START_SCANNING");
    if (!ok) {
      setDataWedgeStatus("Disparo nativo no disponible. Use el boton fisico amarillo o camara de respaldo.");
      try {
        hardwareInputRef.current?.focus?.();
      } catch (_error) {
        // Sin foco disponible.
      }
    } else {
      setDataWedgeStatus("SE4710 activado. Apunte al QR; si no lee, presione el gatillo amarillo.");
      setTimeout(() => {
        dispararSoftScanDataWedge("STOP_SCANNING");
      }, 6000);
    }
  }

  function onBarcodeScanned({ data }) {
    if (scanned) return;
    setScanned(true);
    const parsed = extraerDatosQr(data);
    if (parsed?.id) {
      loadBoleta(parsed.id, parsed.token, parsed.raw);
    } else {
      setQrError("Ese QR no pertenece a XTRAVON ONE / GRAIN CONTROL.");
      Alert.alert("QR no valido", "Ese QR no pertenece a XTRAVON ONE / GRAIN CONTROL.");
    }
  }

  async function aplicarEscaneoLocal(tipo, payload = {}) {
    if (!boleta?.id) return;
    const now = new Date().toISOString();
    let next = { ...boleta };
    if (tipo === "PRIMER_ESCANEO") {
      next = {
        ...next,
        ficha: payload.ficha,
        peso_vacio: payload.peso_vacio,
        lectura_ingreso: now,
        fecha_escaneo: now,
        lecturas: 1,
        etapa_qr: "PRIMER_ESCANEO",
        estado: "ESCANEADO",
        estado_asignacion: "EN_PUERTO"
      };
    } else if (tipo === "SEGUNDO_ESCANEO") {
      next = {
        ...next,
        numero_tolva: payload.numero_tolva,
        comentario_issue_log: payload.comentario_issue_log,
        lecturas: 2,
        etapa_qr: "SEGUNDO_ESCANEO",
        estado: "SEGUNDO_ESCANEO",
        estado_asignacion: "CARGADO"
      };
    } else if (tipo === "TERCER_ESCANEO") {
      next = {
        ...next,
        marchamos: payload.marchamos,
        marchamos_lista: payload.marchamos_lista || normalizarMarchamos(String(payload.marchamos || "").split(/[,;\n|]+/)),
        peso_lleno: payload.peso_lleno,
        comentario_issue_log: payload.comentario_issue_log,
        lectura_salida: now,
        fecha_cierre: now,
        lecturas: 3,
        etapa_qr: "TERCER_ESCANEO",
        qr_bloqueado: true,
        qr_activo: false,
        estado: "COMPLETA",
        estado_asignacion: "COMPLETA"
      };
    }
    setBoleta(next);
    await actualizarGuiaEnCache(next);
  }

  function cerrarCapturaGuardada() {
    setCaptureOpen(false);
    setScanned(false);
    setBoleta(null);
    setOfflineQr(null);
    setQrToken("");
    setQrError("");
    if (USE_HARDWARE_SCANNER) {
      setUsarCamaraRespaldo(false);
    }
    setTimeout(() => hardwareInputRef.current?.focus?.(), 180);
  }

  async function guardarPrimerEscaneo() {
    const registroId = boleta?.id || offlineQr?.registro_id;
    const auth = authOfflineActual();
    if (!registroId) return;
    if (!auth.token && !auth.offline_signature) {
      Alert.alert("QR requerido", "Escanee el QR original para validar el primer escaneo.");
      return;
    }
    if (!ficha.trim() || !pesoVacio.trim()) {
      Alert.alert("Datos requeridos", "Indique ficha y peso vacio.");
      return;
    }

    setLoading(true);
    setLoadingLabel("Guardando primer escaneo...");
    try {
      const payload = {
        token: auth.token,
        ficha: ficha.trim(),
        peso_vacio: Number(pesoVacio)
      };
      if (offlineMode && auth.offline_signature) {
        const offlinePayload = { ficha: payload.ficha, peso_vacio: payload.peso_vacio };
        await agregarEventoOffline("PRIMER_ESCANEO", registroId, auth, offlinePayload);
        await aplicarEscaneoLocal("PRIMER_ESCANEO", offlinePayload);
        cerrarCapturaGuardada();
        Alert.alert("Guardado offline", "El primer escaneo quedo guardado y se enviara automaticamente al volver la conexion.");
        return;
      }
      const result = await api.primerEscaneo(registroId, payload);
      setBoleta(result.registro);
      await actualizarGuiaEnCache(result.registro);
      cerrarCapturaGuardada();
      Alert.alert("Primer escaneo", result.mensaje || "Ingreso registrado correctamente.");
    } catch (error) {
      if (esErrorReintentable(error)) {
        if (!auth.offline_signature) {
          Alert.alert("Sin cache offline", "No se guardo el evento porque esta guia no tiene firma offline segura. Sincronice la operacion antes de operar sin red.");
          return;
        }
        const payload = {
          ficha: ficha.trim(),
          peso_vacio: Number(pesoVacio)
        };
        await agregarEventoOffline("PRIMER_ESCANEO", registroId, auth, payload);
        await aplicarEscaneoLocal("PRIMER_ESCANEO", payload);
        cerrarCapturaGuardada();
        Alert.alert("Guardado offline", "El primer escaneo quedo guardado y se enviara automaticamente al volver la conexion.");
        return;
      }
      Alert.alert("No se pudo registrar", error.message);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function guardarSegundoEscaneo() {
    const registroId = boleta?.id || offlineQr?.registro_id;
    const auth = authOfflineActual();
    if (!registroId) return;
    if (!auth.token && !auth.offline_signature) {
      Alert.alert("QR requerido", "Escanee el QR original para validar el segundo escaneo.");
      return;
    }
    if (!numeroTolva.trim()) {
      Alert.alert("Tolva requerida", "Indique el numero de tolva.");
      return;
    }
    setLoading(true);
    setLoadingLabel("Guardando segundo escaneo...");
    try {
      if (offlineMode && auth.offline_signature) {
        const offlinePayload = {
          numero_tolva: numeroTolva.trim(),
          crear_issue_log: crearIssueLog,
          comentario_issue_log: comentarioIssueLog.trim()
        };
        await agregarEventoOffline("SEGUNDO_ESCANEO", registroId, auth, offlinePayload);
        await aplicarEscaneoLocal("SEGUNDO_ESCANEO", offlinePayload);
        setOfflineQr(null);
        setNumeroTolva("");
        setComentarioIssueLog("");
        setCrearIssueLog(false);
        cerrarCapturaGuardada();
        Alert.alert(
          "Movimiento guardado offline",
          "El escaneo quedo en memoria local y se enviara automaticamente cuando vuelva la conexion."
        );
        return;
      }

      const result = await api.segundoEscaneo(registroId, {
        token: auth.token,
        numero_tolva: numeroTolva.trim(),
        crear_issue_log: crearIssueLog,
        comentario_issue_log: comentarioIssueLog.trim()
      });
      setBoleta(result.registro);
      await actualizarGuiaEnCache(result.registro);
      cerrarCapturaGuardada();
      Alert.alert("Segundo escaneo", result.mensaje || "Tolva registrada correctamente.");
    } catch (error) {
      if (esErrorReintentable(error)) {
        if (!auth.offline_signature) {
          Alert.alert("Sin cache offline", "No se guardo el evento porque esta guia no tiene firma offline segura. Sincronice la operacion antes de operar sin red.");
          return;
        }
        const payload = {
          numero_tolva: numeroTolva.trim(),
          crear_issue_log: crearIssueLog,
          comentario_issue_log: comentarioIssueLog.trim()
        };
        await agregarEventoOffline("SEGUNDO_ESCANEO", registroId, auth, payload);
        await aplicarEscaneoLocal("SEGUNDO_ESCANEO", payload);
        cerrarCapturaGuardada();
        Alert.alert(
          "Guardado offline",
          "El escaneo quedÃ³ guardado en este handheld y se enviarÃ¡ automÃ¡ticamente cuando vuelva la conexiÃ³n."
        );
        return;
      }
      Alert.alert("No se pudo registrar", error.message);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function guardarTercerEscaneo() {
    const registroId = boleta?.id || offlineQr?.registro_id;
    const auth = authOfflineActual();
    if (!registroId) return;
    if (!auth.token && !auth.offline_signature) {
      Alert.alert("QR requerido", "Escanee el QR original para validar el tercer escaneo.");
      return;
    }
    const marchamosValidos = normalizarMarchamos(marchamosLista);
    if (!marchamosValidos.length || !pesoLleno.trim()) {
      Alert.alert("Datos requeridos", "Indique marchamos y peso lleno.");
      return;
    }
    setLoading(true);
    setLoadingLabel("Guardando tercer escaneo...");
    try {
      const payload = {
        token: auth.token,
        marchamos: marchamosValidos.join(", "),
        marchamos_lista: marchamosValidos,
        peso_lleno: Number(pesoLleno),
        crear_issue_log: crearIssueLog,
        comentario_issue_log: comentarioIssueLog.trim()
      };
      if (offlineMode && auth.offline_signature) {
        const offlinePayload = {
          marchamos: payload.marchamos,
          marchamos_lista: payload.marchamos_lista,
          peso_lleno: payload.peso_lleno,
          crear_issue_log: payload.crear_issue_log,
          comentario_issue_log: payload.comentario_issue_log
        };
        await agregarEventoOffline("TERCER_ESCANEO", registroId, auth, offlinePayload);
        await aplicarEscaneoLocal("TERCER_ESCANEO", offlinePayload);
        cerrarCapturaGuardada();
        Alert.alert("Guardado offline", "El tercer escaneo quedo guardado y se enviara automaticamente al volver la conexion.");
        return;
      }
      const result = await api.tercerEscaneo(registroId, payload);
      setBoleta(result.registro);
      await actualizarGuiaEnCache(result.registro);
      cerrarCapturaGuardada();
      Alert.alert("Tercer escaneo", result.mensaje || "Guia cerrada correctamente.");
    } catch (error) {
      if (esErrorReintentable(error)) {
        if (!auth.offline_signature) {
          Alert.alert("Sin cache offline", "No se guardo el evento porque esta guia no tiene firma offline segura. Sincronice la operacion antes de operar sin red.");
          return;
        }
        const payload = {
          marchamos: marchamosValidos.join(", "),
          marchamos_lista: marchamosValidos,
          peso_lleno: Number(pesoLleno),
          crear_issue_log: crearIssueLog,
          comentario_issue_log: comentarioIssueLog.trim()
        };
        await agregarEventoOffline("TERCER_ESCANEO", registroId, auth, payload);
        await aplicarEscaneoLocal("TERCER_ESCANEO", payload);
        cerrarCapturaGuardada();
        Alert.alert("Guardado offline", "El tercer escaneo quedo guardado y se enviara automaticamente al volver la conexion.");
        return;
      }
      Alert.alert("No se pudo registrar", error.message);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function verGuiaSeleccionada() {
    if (!selectedBoleta) {
      Alert.alert("Sin seleccion", "Seleccione una guia en la tabla o busque por ID.");
      return;
    }

    Alert.alert(
      `Detalle guia ${selectedBoleta.guia || ""}`,
      [
        `ID: ${selectedBoleta.id || ""}`,
        `Embarque: ${selectedBoleta.numero_embarque || ""}`,
        `Bodega: ${selectedBoleta.bodega_numero || ""}`,
        `Empresa: ${selectedBoleta.empresa || ""}`,
        `Buque: ${selectedBoleta.buque || ""}`,
        `Fecha: ${formatDate(selectedBoleta.fecha)}`,
        `Producto: ${selectedBoleta.producto || ""}`,
        `Chofer: ${selectedBoleta.chofer || ""}`,
        `Placa: ${selectedBoleta.placa || ""}`,
        `Estado: ${selectedBoleta.estado || ""}`,
        `Lecturas: ${selectedBoleta.lecturas ?? ""}`,
        `Etapa QR: ${selectedBoleta.etapa_qr || ""}`,
        `Tolva: ${selectedBoleta.numero_tolva || ""}`,
        `Bloqueado: ${selectedBoleta.qr_bloqueado ? "SI" : "NO"}`
      ].join("\n")
    );
  }

  return (
    <Screen
      title={isOperator ? "Lector QR Patio" : "Carga de Boletas"}
      subtitle={isOperator ? "Escanee el QR. Al detectar una guia se abre la captura para validar datos y registrar SOF si aplica." : "Carga el Excel a la base de datos y consulta la tabla. La asignacion y entrega de QR se gestiona desde Despacho de Viajes."}
      minWidth={isOperator ? 430 : 1180}
      horizontal={!isOperator}
    >
      <ScrollView contentContainerStyle={isOperator ? styles.operatorContent : undefined}>
        {!isOperator && <Card>
          <View style={styles.operationHeader}>
            <Text style={styles.operationText}>
              {operacionActiva
                ? `Operacion activa: ${operacionActiva.codigo_operacion || ""} | ${operacionActiva.nombre_buque || ""} | ${formatDate(operacionActiva.fecha_inicio)}`
                : operacionConsultada
                  ? "Operacion activa: no hay operacion abierta."
                  : "Operacion activa: presione Buscar operacion activa para consultar."}
            </Text>
            <Button label="Buscar operacion activa" icon="search-outline" tone="info" onPress={buscarOperacionActiva} />
          </View>
        </Card>}

        {!isOperator && <Card>
          <View style={styles.actions}>
            <Button label="Abrir Template" icon="open-outline" tone="info" onPress={abrirTemplate} />
            <Button label="Cargar Excel" icon="cloud-upload-outline" onPress={cargarExcel} />
            <Button label="Cargar Tabla" icon="table-outline" tone="info" onPress={cargarTabla} />
            <Button label="Ver" icon="eye-outline" tone="info" onPress={verGuiaSeleccionada} />
            <Button label="Exportar Excel" icon="download-outline" tone="info" onPress={exportarExcel} />
          </View>
        </Card>}

        {!isOperator && <Card>
          <Text style={styles.sectionTitle}>Filtros dinamicos</Text>
          <View style={styles.filterGrid}>
            {Object.keys(BOLETAS_EMPTY_FILTERS).map((key) => (
              <FilterCombo
                key={key}
                name={key}
                label={BOLETAS_FILTER_LABELS[key]}
                value={boletasFilters[key]}
                options={boletasFilterOptions?.[BOLETAS_OPTION_MAP[key]] || []}
                active={activeBoletasFilter === key}
                onFocus={() => setActiveBoletasFilter(key)}
                onBlur={() => setTimeout(() => setActiveBoletasFilter((current) => (current === key ? null : current)), 180)}
                onChange={(value) => updateBoletasFilter(key, value)}
                onSelect={(value) => {
                  updateBoletasFilter(key, value);
                  setActiveBoletasFilter(null);
                }}
              />
            ))}
          </View>
          {filtersLoading && <Loading label="Cargando filtros..." />}
          <View style={styles.actions}>
            <Button label="Cargar filtros" icon="options-outline" tone="info" onPress={cargarFiltrosBoletas} />
            <Button label="Buscar tabla" icon="search-outline" onPress={cargarTabla} />
            <Button label="Limpiar" icon="refresh-outline" tone="info" onPress={limpiarFiltrosBoletas} />
          </View>
        </Card>}

        {loading && <Loading label={loadingLabel || "Procesando..."} />}

        {isOperator && (
          <Card>
            <Text style={styles.sectionTitle}>Lector QR de patio</Text>
            <View style={styles.operatorActions}>
              <Button label="Sincronizar operacion" icon="cloud-download-outline" onPress={sincronizarDatosOperacion} />
              <Button label="Abrir SOF" icon="list-outline" tone="info" onPress={() => onNavigate?.("statement")} />
              {USE_HARDWARE_SCANNER && <Button label="Activar Zebra" icon="barcode-outline" tone="info" onPress={activarPerfilZebra} />}
              {USE_HARDWARE_SCANNER && <Button label="Escanear" icon="scan-outline" tone="info" onPress={dispararLecturaZebra} />}
              <Button label="Reactivar lectura" icon="refresh-outline" tone="info" onPress={reactivarScanner} />
            </View>
            <Card style={styles.handheldStatus}>
              <Text style={styles.syncMessage}>
                {guideCacheInfo?.total
                  ? `Memoria local lista: ${guideCacheInfo.total} guia(s).`
                  : "Sincronice la operacion antes de trabajar sin senal."}
              </Text>
              {USE_HARDWARE_SCANNER ? (
                <TextInput
                  ref={hardwareInputRef}
                  value={hardwareScanValue}
                  onChangeText={onHardwareTextChange}
                  onSubmitEditing={() => {
                    const value = hardwareScanValue.trim();
                    if (value) {
                      procesarLecturaHardware(value, "SE4710 teclado").catch(() => {});
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  blurOnSubmit={false}
                  showSoftInputOnFocus={false}
                  placeholder="Entrada SE4710/DataWedge"
                  placeholderTextColor={COLORS.auxiliary}
                  style={styles.hardwareInput}
                />
              ) : (
                <Text style={styles.helper}>
                  Esta version no inicializa el lector fisico. Active la camara manualmente si necesita respaldo.
                </Text>
              )}
            </Card>
            <View style={styles.operatorActions}>
              <Button
                label={usarCamaraRespaldo ? (USE_HARDWARE_SCANNER ? "Ocultar camara" : "Pausar camara") : (USE_HARDWARE_SCANNER ? "Camara respaldo" : "Activar camara")}
                icon="camera-outline"
                tone="info"
                onPress={() => setUsarCamaraRespaldo((value) => !value)}
              />
            </View>
            {usarCamaraRespaldo && !permission?.granted && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.warningText}>
                  {permission?.canAskAgain === false
                    ? "La camara esta bloqueada para esta app. Abra ajustes del telefono y permita Camara."
                    : "Permiso de camara requerido."}
                </Text>
                <View style={styles.operatorActions}>
                  <Button
                    label="Activar camara"
                    icon="camera-outline"
                    onPress={async () => {
                      setCameraError("");
                      await requestPermission();
                      reactivarScanner();
                    }}
                  />
                  {permission?.canAskAgain === false && (
                    <Button label="Abrir ajustes" icon="settings-outline" tone="info" onPress={() => Linking.openSettings?.()} />
                  )}
                </View>
              </View>
            )}

            {usarCamaraRespaldo && permission?.granted && (
              <Card style={styles.cameraShell}>
                {!cameraReady && (
                  <View style={styles.cameraOverlay}>
                    <Text style={styles.helper}>Activando camara...</Text>
                  </View>
                )}
                <CameraView
                  key={scannerSession}
                  style={styles.cameraView}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
                  onCameraReady={() => {
                    setCameraReady(true);
                    setCameraError("");
                  }}
                  onMountError={(event) => {
                    const message = event?.nativeEvent?.message || "No se pudo iniciar la camara.";
                    setCameraError(message);
                    setCameraReady(false);
                  }}
                />
              </Card>
            )}
            {!!cameraError && <Text style={styles.warningText}>{cameraError}</Text>}
          </Card>
        )}

        {!isOperator && <Card>
          <View style={styles.offlineHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Control offline handheld</Text>
              <Text style={styles.helper}>
                {offlineQueue.length
                  ? `${offlineQueue.length} lectura(s) pendientes. Se reenviaran automaticamente cuando haya red.`
                  : "Sin lecturas pendientes en este equipo."}
              </Text>
              {!!syncMessage && <Text style={styles.syncMessage}>{syncMessage}</Text>}
            </View>
            <Button
              label={syncingQueue ? "Sincronizando..." : "Sincronizar ahora"}
              icon="sync-outline"
              tone="info"
              disabled={syncingQueue || offlineQueue.length === 0}
              onPress={() => sincronizarColaOffline(true)}
            />
          </View>
        </Card>}

        {!isOperator && <Card>
          <Text style={styles.sectionTitle}>Boletas en base_operaciones_camiones</Text>
          {boletas.length === 0 ? (
            <EmptyState title="Tabla sin cargar" subtitle="Presione Cargar Tabla para consultar la base." />
          ) : (
            <>
              <View style={styles.pagination}>
                <Button label="Anterior" icon="chevron-back-outline" tone="info" disabled={page <= 0} onPress={() => setPage((value) => Math.max(value - 1, 0))} />
                <Text style={styles.paginationText}>
                  Pagina {page + 1} de {totalPages} | {boletas.length.toLocaleString()} registros
                </Text>
                <Button label="Siguiente" icon="chevron-forward-outline" tone="info" disabled={page + 1 >= totalPages} onPress={() => setPage((value) => Math.min(value + 1, totalPages - 1))} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tableHeader}>
                    {TABLE_COLUMNS.map(([key, label, width]) => (
                      <Text key={key} style={[styles.th, { width }]}>{label}</Text>
                    ))}
                  </View>
                  {visibleBoletas.map((item) => {
                    const selected = Number(item.id) === Number(selectedId);
                    return (
                      <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setBoleta(item); }} style={[styles.tableRow, selected && styles.tableRowSelected]}>
                        {TABLE_COLUMNS.map(([key, _label, width]) => (
                          <Text key={key} style={[styles.td, { width }]} numberOfLines={1}>
                            {formatCell(item, key)}
                          </Text>
                        ))}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}
        </Card>}

        {!!qrError && (
          <Card style={{ borderColor: COLORS.danger, borderWidth: 2 }}>
            <Text style={{ color: COLORS.danger, fontWeight: "900" }}>{qrError}</Text>
          </Card>
        )}

        {!!offlineQr && !boleta && (
          <Card style={{ borderColor: COLORS.warning, borderWidth: 2 }}>
            <Text style={styles.sectionTitle}>Captura operativa offline</Text>
            <Text style={styles.helper}>
              Guia ID {offlineQr.registro_id} guardada localmente. El QR y el escaneo se validaran contra backend al sincronizar.
            </Text>
            <Text style={styles.warningText}>
              Sin conexion no se puede confirmar la etapa de la guia. El handheld conserva el QR y lo validara automaticamente cuando vuelva la red.
            </Text>
            <View style={styles.actions}>
              <Button label="Sincronizar ahora" icon="sync-outline" onPress={() => sincronizarColaOffline(true)} />
              <Button
                label="Cancelar captura"
                icon="close-outline"
                tone="info"
                onPress={() => {
                  setOfflineQr(null);
                  setScanned(false);
                  setQrError("");
                }}
              />
            </View>
          </Card>
        )}

        {!!boleta && !isOperator && (
          <Card>
            <Text style={styles.sectionTitle}>Guia {boleta.guia}</Text>
            <View style={styles.detailGrid}>
              <Row label="Cliente" value={boleta.empresa} />
              <Row label="Buque" value={boleta.buque} />
              <Row label="Embarque" value={boleta.numero_embarque || ""} />
              <Row label="Bodega" value={boleta.bodega_numero || ""} />
              <Row label="Producto" value={boleta.producto} />
              <Row label="Chofer" value={boleta.chofer} />
              <Row label="Placa" value={boleta.placa} />
              <Row label="Estado" value={boleta.estado} />
              <Row label="Lecturas" value={String(boleta.lecturas)} />
              <Row label="Etapa QR" value={boleta.etapa_qr} />
              <Row label="Peso vacio" value={formatNumber(boleta.peso_vacio)} />
              <Row label="Peso lleno" value={formatNumber(boleta.peso_lleno)} />
              <Row label="Tolva" value={boleta.numero_tolva || ""} />
            </View>

            {Number(boleta.lecturas || 0) >= 3 && (
              <Card style={{ backgroundColor: COLORS.elevated, borderColor: COLORS.warning }}>
                <Text style={{ color: COLORS.warning, fontWeight: "900" }}>Esta guia ya cumplio la cantidad de escaneos.</Text>
              </Card>
            )}
            {Number(boleta.lecturas || 0) === 2 && (
              <Card>
                <Text style={styles.sectionTitle}>Tercer escaneo</Text>
                <MarchamosEditor
                  values={marchamosLista}
                  onChange={cambiarMarchamo}
                  onAdd={agregarMarchamo}
                  onRemove={quitarMarchamo}
                />
                <TextInput
                  placeholder="Peso lleno"
                  placeholderTextColor={COLORS.auxiliary}
                  value={pesoLleno}
                  onChangeText={setPesoLleno}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.helper}>Agregar comentario a SOF</Text>
                  <Switch value={crearIssueLog} onValueChange={setCrearIssueLog} />
                </View>
                <TextInput
                  placeholder="Comentario SOF"
                  placeholderTextColor={COLORS.auxiliary}
                  value={comentarioIssueLog}
                  onChangeText={setComentarioIssueLog}
                  multiline
                  style={[styles.input, { minHeight: 90 }]}
                />
                <Button label="Guardar tercer escaneo" icon="checkmark-circle-outline" onPress={guardarTercerEscaneo} />
              </Card>
            )}
          </Card>
        )}
        <QrCaptureModal
          visible={captureOpen && !!boleta}
          boleta={boleta}
          offlineMode={offlineMode}
          numeroTolva={numeroTolva}
          setNumeroTolva={setNumeroTolva}
          ficha={ficha}
          setFicha={setFicha}
          pesoVacio={pesoVacio}
          setPesoVacio={setPesoVacio}
          marchamosLista={marchamosLista}
          onChangeMarchamo={cambiarMarchamo}
          onAddMarchamo={agregarMarchamo}
          onRemoveMarchamo={quitarMarchamo}
          pesoLleno={pesoLleno}
          setPesoLleno={setPesoLleno}
          crearIssueLog={crearIssueLog}
          setCrearIssueLog={setCrearIssueLog}
          comentarioIssueLog={comentarioIssueLog}
          setComentarioIssueLog={setComentarioIssueLog}
          onGuardarPrimer={guardarPrimerEscaneo}
          onGuardarSegundo={guardarSegundoEscaneo}
          onGuardarTercer={guardarTercerEscaneo}
          onSof={() => onNavigate?.("statement")}
          onClose={cerrarCapturaGuardada}
        />
      </ScrollView>
    </Screen>
  );
}

function QrCaptureModal({
  visible,
  boleta,
  offlineMode,
  numeroTolva,
  setNumeroTolva,
  ficha,
  setFicha,
  pesoVacio,
  setPesoVacio,
  marchamosLista,
  onChangeMarchamo,
  onAddMarchamo,
  onRemoveMarchamo,
  pesoLleno,
  setPesoLleno,
  crearIssueLog,
  setCrearIssueLog,
  comentarioIssueLog,
  setComentarioIssueLog,
  onGuardarPrimer,
  onGuardarSegundo,
  onGuardarTercer,
  onSof,
  onClose
}) {
  if (!boleta) return null;
  const lecturas = Number(boleta.lecturas || 0);
  const listoParaIngreso = lecturas === 0;
  const listoParaTolva = lecturas === 1;
  const listoParaSalida = lecturas === 2;
  const cerrado = lecturas >= 3;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.capturePanel}>
          <View style={styles.captureHeader}>
            <Text style={styles.captureTitle}>Revision QR Patio</Text>
            <Text style={styles.captureSubtitle}>Guia {boleta.guia || boleta.id}</Text>
            <View style={styles.captureActionBar}>
              {listoParaIngreso && <Button label="Guardar ingreso" icon="checkmark-circle-outline" onPress={onGuardarPrimer} />}
              {listoParaTolva && <Button label="Guardar tolva" icon="checkmark-circle-outline" onPress={onGuardarSegundo} />}
              {listoParaSalida && <Button label="Guardar salida" icon="checkmark-circle-outline" onPress={onGuardarTercer} />}
              <Button label="Abrir SOF" icon="list-outline" tone="info" onPress={onSof} />
            </View>
          </View>
          <ScrollView style={styles.captureScroll} contentContainerStyle={styles.captureScrollContent}>
            {offlineMode && (
              <Card style={{ borderColor: COLORS.warning, borderWidth: 1 }}>
                <Text style={styles.warningText}>MODO OFFLINE: los datos se guardaran en este handheld y se enviaran al volver la conexion.</Text>
              </Card>
            )}
            <View style={styles.detailGrid}>
              <Row label="Cliente" value={boleta.empresa} />
              <Row label="Buque" value={boleta.buque} />
              <Row label="Producto" value={boleta.producto} />
              <Row label="Chofer" value={boleta.chofer} />
              <Row label="Placa" value={boleta.placa} />
              <Row label="Estado" value={boleta.estado} />
              <Row label="Lecturas" value={String(boleta.lecturas ?? "")} />
              <Row label="Etapa QR" value={boleta.etapa_qr} />
              <Row label="Bodega" value={boleta.bodega_numero || ""} />
            </View>

            {cerrado && (
              <Card style={{ borderColor: COLORS.warning }}>
                <Text style={styles.warningText}>Esta guia ya cumplio todos los escaneos.</Text>
              </Card>
            )}

            {listoParaIngreso ? (
              <>
                <Text style={styles.sectionTitle}>Primer escaneo: ingreso</Text>
                <TextInput
                  placeholder="Ficha"
                  placeholderTextColor={COLORS.auxiliary}
                  value={ficha}
                  onChangeText={setFicha}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Peso vacio"
                  placeholderTextColor={COLORS.auxiliary}
                  value={pesoVacio}
                  onChangeText={setPesoVacio}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </>
            ) : listoParaTolva ? (
              <>
                <Text style={styles.sectionTitle}>Segundo escaneo: tolva</Text>
                <TextInput
                  placeholder="Numero de tolva"
                  placeholderTextColor={COLORS.auxiliary}
                  value={numeroTolva}
                  onChangeText={setNumeroTolva}
                  style={styles.input}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.helper}>Agregar comentario a SOF</Text>
                  <Switch value={crearIssueLog} onValueChange={setCrearIssueLog} />
                </View>
                <TextInput
                  placeholder="Comentario SOF"
                  placeholderTextColor={COLORS.auxiliary}
                  value={comentarioIssueLog}
                  onChangeText={setComentarioIssueLog}
                  multiline
                  style={[styles.input, { minHeight: 90 }]}
                />
              </>
            ) : listoParaSalida ? (
              <>
                <Text style={styles.sectionTitle}>Tercer escaneo: salida</Text>
                <MarchamosEditor
                  values={marchamosLista}
                  onChange={onChangeMarchamo}
                  onAdd={onAddMarchamo}
                  onRemove={onRemoveMarchamo}
                />
                <TextInput
                  placeholder="Peso lleno"
                  placeholderTextColor={COLORS.auxiliary}
                  value={pesoLleno}
                  onChangeText={setPesoLleno}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.helper}>Agregar comentario a SOF</Text>
                  <Switch value={crearIssueLog} onValueChange={setCrearIssueLog} />
                </View>
                <TextInput
                  placeholder="Comentario SOF"
                  placeholderTextColor={COLORS.auxiliary}
                  value={comentarioIssueLog}
                  onChangeText={setComentarioIssueLog}
                  multiline
                  style={[styles.input, { minHeight: 90 }]}
                />
              </>
            ) : !cerrado ? (
              <Card style={{ borderColor: COLORS.info }}>
                <Text style={styles.helper}>
                  QR detectado. Revise la etapa actual y continue el flujo operativo correspondiente.
                </Text>
              </Card>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatDate(value) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 19);
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number === 0) return "";
  return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCell(item, key) {
  if (key === "fecha") return formatDate(item[key]);
  if (key === "qr_bloqueado") return item[key] ? "SI" : "NO";
  return item[key] ?? "";
}

function cleanParams(filters) {
  const params = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    const text = String(value || "").trim();
    if (text) {
      params[key] = text;
    }
  });
  return params;
}

function normalizarMarchamos(values) {
  const source = Array.isArray(values) ? values : [values];
  const result = [];
  const seen = new Set();
  source.forEach((item) => {
    String(item || "")
      .split(/[,;\n|]+/)
      .forEach((part) => {
        const value = part.trim();
        const key = value.toUpperCase();
        if (value && !seen.has(key)) {
          seen.add(key);
          result.push(value);
        }
      });
  });
  return result.slice(0, 10);
}

function MarchamosEditor({ values, onChange, onAdd, onRemove }) {
  const rows = values?.length ? values : [""];
  return (
    <View style={styles.marchamosBox}>
      <View style={styles.marchamosHeader}>
        <Text style={styles.filterLabel}>Marchamos</Text>
        <Text style={styles.helper}>Maximo 10 por camion</Text>
      </View>
      {rows.map((value, index) => (
        <View key={`marchamo-${index}`} style={styles.marchamoRow}>
          <Text style={styles.marchamoLabel}>M{index + 1}</Text>
          <TextInput
            placeholder={`Marchamo ${index + 1}`}
            placeholderTextColor={COLORS.auxiliary}
            value={value}
            onChangeText={(text) => onChange(index, text)}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, styles.marchamoInput]}
          />
          <Pressable
            onPress={() => onRemove(index)}
            style={[styles.marchamoButton, rows.length <= 1 && styles.marchamoButtonDisabled]}
            disabled={rows.length <= 1}
          >
            <Text style={styles.marchamoButtonText}>-</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={onAdd} style={styles.marchamoAddButton}>
        <Text style={styles.marchamoAddText}>+ Agregar marchamo</Text>
      </Pressable>
    </View>
  );
}

function FilterCombo({ label, value, options, active, onFocus, onBlur, onChange, onSelect }) {
  const text = String(value || "");
  const visibleOptions = useMemo(() => {
    const normalized = text.trim().toLowerCase();
    const rows = (options || [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set(rows));
    if (!normalized) return unique.slice(0, 12);
    return unique.filter((item) => item.toLowerCase().includes(normalized)).slice(0, 12);
  }, [options, text]);

  return (
    <View style={styles.filterBox}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={`Filtrar ${label}`}
        placeholderTextColor={COLORS.auxiliary}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.filterInput}
      />
      {active && (
        <View style={styles.filterDropdown}>
          <Pressable onPress={() => onSelect("")} style={styles.filterOption}>
            <Text style={styles.filterOptionText}>(Todos)</Text>
          </Pressable>
          {visibleOptions.length === 0 ? (
            <Text style={styles.filterEmpty}>Sin opciones cargadas</Text>
          ) : (
            visibleOptions.map((item) => (
              <Pressable key={item} onPress={() => onSelect(item)} style={styles.filterOption}>
                <Text style={styles.filterOptionText} numberOfLines={1}>{item}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  operatorContent: {
    paddingBottom: 32
  },
  operationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  operationText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900"
  },
  operatorActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
    zIndex: 20
  },
  filterBox: {
    minWidth: 210,
    flexGrow: 1,
    flexBasis: "18%",
    position: "relative",
    zIndex: 30
  },
  filterLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 6
  },
  filterInput: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontWeight: "800"
  },
  filterDropdown: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 64,
    backgroundColor: COLORS.card,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 6,
    zIndex: 100,
    elevation: 8,
    maxHeight: 260,
    overflow: "hidden"
  },
  filterOption: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border
  },
  filterOptionText: {
    color: COLORS.text,
    fontWeight: "800"
  },
  filterEmpty: {
    color: COLORS.muted,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontWeight: "800"
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12
  },
  helper: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 10
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
  marchamosBox: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10
  },
  marchamosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap"
  },
  marchamoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  marchamoLabel: {
    width: 34,
    color: COLORS.accent,
    fontWeight: "900",
    textAlign: "center"
  },
  marchamoInput: {
    flex: 1,
    marginBottom: 0
  },
  marchamoButton: {
    width: 44,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1
  },
  marchamoButtonDisabled: {
    opacity: 0.35
  },
  marchamoButtonText: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900"
  },
  marchamoAddButton: {
    minHeight: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent
  },
  marchamoAddText: {
    color: COLORS.bg,
    fontWeight: "900"
  },
  manualSearch: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.accent
  },
  th: {
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
  tableRowSelected: {
    backgroundColor: COLORS.elevated
  },
  td: {
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    textAlign: "center"
  },
  detailGrid: {
    gap: 2
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10
  },
  paginationText: {
    color: COLORS.text,
    fontWeight: "900",
    flex: 1,
    textAlign: "center"
  },
  offlineHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12
  },
  syncMessage: {
    color: COLORS.accent,
    fontWeight: "900"
  },
  handheldStatus: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.accent,
    marginTop: 8,
    marginBottom: 10,
    paddingVertical: 10
  },
  hardwareInput: {
    height: 1,
    opacity: 0.01,
    padding: 0,
    margin: 0,
    color: COLORS.bg,
    backgroundColor: COLORS.bg
  },
  cameraShell: {
    height: 300,
    overflow: "hidden",
    marginTop: 10,
    padding: 0,
    backgroundColor: "#000000",
    borderColor: COLORS.accent
  },
  cameraView: {
    width: "100%",
    height: "100%"
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
    zIndex: 2
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end"
  },
  capturePanel: {
    maxHeight: "96%",
    width: "100%",
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderColor: COLORS.border,
    borderWidth: 1,
    overflow: "hidden"
  },
  captureScroll: {
    flexGrow: 0
  },
  captureScrollContent: {
    padding: 14,
    paddingBottom: Platform.OS === "android" ? 300 : 180
  },
  captureHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card
  },
  captureActionBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 8
  },
  captureTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 4
  },
  captureSubtitle: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 14
  },
  warningText: {
    color: COLORS.warning,
    fontWeight: "900"
  }
});
