export const DEVICE_VARIANT = process.env.EXPO_PUBLIC_DEVICE_VARIANT || "celular";
export const IS_HANDHELD = DEVICE_VARIANT === "handheld";
export const IS_CELULAR = !IS_HANDHELD;
export const ANDROID_PACKAGE = IS_HANDHELD ? "com.xtravon.one.handheld" : "com.xtravon.one.celular";
export const APP_DISPLAY_NAME = IS_HANDHELD ? "XTRAVON Handheld" : "XTRAVON One";

const normalizeApiBase = (value) => String(value || "").trim().replace(/\/+$/, "");
const variantApiBase = IS_HANDHELD
  ? process.env.EXPO_PUBLIC_API_BASE_URL_HANDHELD
  : process.env.EXPO_PUBLIC_API_BASE_URL_CELULAR;

export const API_BASE = normalizeApiBase(
  variantApiBase || process.env.EXPO_PUBLIC_API_BASE_URL
);
export const API_BASE_CONFIGURED = Boolean(API_BASE);

export const COLORS = {
  bg: "#050B14",
  sidebar: "#07111F",
  topbar: "#0B1B2E",
  card: "#0B1B2E",
  elevated: "#14283D",
  accent: "#00D1FF",
  accentLight: "#2979FF",
  teal: "#00B8A9",
  text: "#F4F8FF",
  muted: "#DCEBFF",
  auxiliary: "#8FA4BC",
  white: "#FFFFFF",
  border: "#14283D",
  warning: "#FFB020",
  success: "#1EE6A8",
  info: "#5AA9FF",
  danger: "#FF5A6A"
};

export const MODULES = [
  { key: "dashboard", label: "Centro Ejecutivo", icon: "speedometer-outline" },
  { key: "informes", label: "Informes", icon: "document-text-outline" },
  { key: "despacho", label: "Despacho de Viajes", icon: "swap-horizontal-outline" },
  { key: "operaciones", label: "Operaciones Buque", icon: "boat-outline" },
  { key: "scan", label: "Carga de Boletas", icon: "qr-code-outline" },
  { key: "aprobaciones", label: "Aprobaciones", icon: "checkmark-done-outline" },
  { key: "statement", label: "SOF", icon: "list-outline" },
  { key: "historial", label: "Historial de Buques", icon: "list-circle-outline" },
  { key: "ai", label: "P.O.R.T.I.A", icon: "sparkles-outline" },
  { key: "roles", label: "Roles y Permisos", icon: "key-outline" },
  { key: "help", label: "Ayuda / Q&A", icon: "help-circle-outline" },
  { key: "chofer", label: "Chofer", icon: "person-circle-outline" },
  { key: "cliente", label: "Portal Cliente", icon: "people-outline" }
];
