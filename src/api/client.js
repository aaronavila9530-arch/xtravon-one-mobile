import { API_BASE } from "../config";

const DEFAULT_TIMEOUT_MS = 30000;
const BASE_URL = String(API_BASE || "").replace(/\/+$/, "");

function requireBaseUrl() {
  if (!BASE_URL) {
    throw new Error(
      "API no configurada. Defina EXPO_PUBLIC_API_BASE_URL o EXPO_PUBLIC_API_BASE_URL_CELULAR/HANDHELD antes de compilar o publicar la app."
    );
  }
  return BASE_URL;
}

async function request(path, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions = { ...options };
  delete fetchOptions.timeoutMs;

  const url = `${requireBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...fetchOptions,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {})
    }
  }).catch((error) => {
    if (error.name === "AbortError") {
      throw new Error("La API no respondio a tiempo. Intente de nuevo o trabaje en modo offline si aplica.");
    }
    throw error;
  }).finally(() => clearTimeout(timeoutId));

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || "Error consultando API";
    const cleanDetail = typeof detail === "string" ? detail : JSON.stringify(detail);
    const error = new Error(`${response.status} ${response.statusText || "Error"} en ${path}: ${cleanDetail}`);
    error.status = response.status;
    error.data = data;
    error.url = url;
    error.path = path;
    throw error;
  }

  return data;
}

export const api = {
  templateBoletasUrl: () => `${requireBaseUrl()}/base-operaciones-camiones/template-excel/descargar`,
  exportarBoletasExcelUrl: () => `${requireBaseUrl()}/base-operaciones-camiones/exportar-excel`,
  cargarExcelBoletasArchivo: async (blob, params = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    const query = new URLSearchParams(params).toString();
    const url = `${requireBaseUrl()}/base-operaciones-camiones/cargar-excel-archivo${query ? `?${query}` : ""}`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      body: blob
    }).catch((error) => {
      if (error.name === "AbortError") {
        throw new Error("La carga de Excel no respondio a tiempo. Verifique conexion y vuelva a intentar.");
      }
      throw error;
    }).finally(() => clearTimeout(timeoutId));

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_error) {
        data = { detail: text };
      }
    }

    if (!response.ok) {
      const detail = data?.detail || data?.message || "Error cargando Excel";
      const cleanDetail = typeof detail === "string" ? detail : JSON.stringify(detail);
      const error = new Error(`${response.status} ${response.statusText || "Error"} en /base-operaciones-camiones/cargar-excel-archivo: ${cleanDetail}`);
      error.status = response.status;
      error.data = data;
      error.url = url;
      throw error;
    }

    return data;
  },
  getDashboard: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/dashboard/resumen${query ? `?${query}` : ""}`);
  },
  getDashboardFiltros: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/dashboard/filtros${query ? `?${query}` : ""}`);
  },
  getDashboardDetalle: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/dashboard/detalle${query ? `?${query}` : ""}`);
  },

  getOperaciones: () => request("/operaciones-buque"),
  getOperacionActiva: () => request("/operaciones-buque/activa"),
  getOperacionDetalle: (id) => request(`/operaciones-buque/${id}`),
  crearOperacion: (payload) => request("/operaciones-buque", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  actualizarOperacion: (id, payload) => request(`/operaciones-buque/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  cerrarOperacion: (id) => request(`/operaciones-buque/${id}/cerrar`, { method: "POST", body: JSON.stringify({}) }),
  reabrirOperacion: (id) => request(`/operaciones-buque/${id}/reabrir`, { method: "POST", body: JSON.stringify({}) }),
  getCuotasOperacion: (id) => request(`/operaciones-buque-cuotas/operacion/${id}`),
  crearCuotaOperacion: (payload) => request("/operaciones-buque-cuotas", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  actualizarCuotaOperacion: (id, payload) => request(`/operaciones-buque-cuotas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }),
  eliminarCuotaOperacion: (id) => request(`/operaciones-buque-cuotas/${id}`, { method: "DELETE" }),

  getAprobacionesPendientes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/aprobaciones/pendientes${query ? `?${query}` : ""}`);
  },
  getAprobacionesFiltros: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/aprobaciones/filtros${query ? `?${query}` : ""}`);
  },
  cargarAprobacionesTemplate: () => request("/aprobaciones/cargar-template", { method: "POST" }),
  aprobar: (ids, comentario, usuario) => request("/aprobaciones/aprobar", {
    method: "POST",
    body: JSON.stringify({ ids, comentario, usuario })
  }),
  rechazar: (ids, comentario, usuario) => request("/aprobaciones/rechazar", {
    method: "POST",
    body: JSON.stringify({ ids, comentario, usuario })
  }),
  reasignarAprobaciones: (ids, chofer, placa, comentario, usuario) => request("/aprobaciones/reasignar", {
    method: "POST",
    body: JSON.stringify({ ids, chofer, placa, comentario, usuario })
  }),

  getBoletas: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/base-operaciones-camiones${query ? `?${query}` : ""}`);
  },
  getBoletasFiltros: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/base-operaciones-camiones/filtros${query ? `?${query}` : ""}`);
  },
  getBoleta: (id) => request(`/base-operaciones-camiones/${id}`),
  getQrOfflineCache: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/base-operaciones-camiones/offline-cache${query ? `?${query}` : ""}`);
  },
  generarQrBoletas: () => request("/base-operaciones-camiones/generar-qr", {
    method: "POST",
    body: JSON.stringify({ formato: "jpg" })
  }),
  entregarQrBoletas: (payload = {}) => request("/base-operaciones-camiones/entregar-qr", {
    method: "POST",
    body: JSON.stringify({
      formato: payload.formato || "jpg",
      canal: payload.canal || "CARPETA",
      email_destino: payload.email_destino || null,
      whatsapp_destino: payload.whatsapp_destino || null,
      empresa: payload.empresa || null,
      chofer: payload.chofer || null
    })
  }),
  getEntregasQr: () => request("/base-operaciones-camiones/entregas-qr"),
  validarQr: (id, token) => request(`/base-operaciones-camiones/qr/${id}/validar?token=${encodeURIComponent(token || "")}`),
  primerEscaneo: (id, payload) => request(`/base-operaciones-camiones/qr/${id}/primer-escaneo-json`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  segundoEscaneo: (id, payload) => request(`/base-operaciones-camiones/qr/${id}/segundo-escaneo-json`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  tercerEscaneo: (id, payload) => request(`/base-operaciones-camiones/qr/${id}/tercer-escaneo-json`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  solicitarNuevoViaje: (payload) => request("/despacho-viajes/solicitar-nuevo-viaje", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  getEstadoChofer: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/despacho-viajes/chofer/estado${query ? `?${query}` : ""}`);
  },
  confirmarContinuidadChofer: (payload) => request("/despacho-viajes/chofer/continuar", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  getDespachoResumen: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/despacho-viajes/resumen${query ? `?${query}` : ""}`);
  },
  getDespachoFiltros: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/despacho-viajes/filtros${query ? `?${query}` : ""}`);
  },
  asignarDespacho: (payload) => request("/despacho-viajes/asignar", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  reasignarDespacho: (payload) => request("/despacho-viajes/reasignar", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  liberarDespacho: (ids, comentario, usuario) => request("/despacho-viajes/liberar", {
    method: "POST",
    body: JSON.stringify({ ids, comentario, usuario })
  }),
  cancelarDespacho: (ids, comentario, usuario) => request("/despacho-viajes/cancelar", {
    method: "POST",
    body: JSON.stringify({ ids, comentario, usuario })
  }),
  bloquearDespacho: (payload) => request("/despacho-viajes/bloquear", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  rechazarSolicitudDespacho: (solicitudId, comentario, usuario) => request(`/despacho-viajes/solicitudes/${solicitudId}/rechazar`, {
    method: "POST",
    body: JSON.stringify({ comentario, usuario })
  }),
  sincronizarQrEventos: (eventos) => request("/base-operaciones-camiones/qr/sincronizar", {
    method: "POST",
    body: JSON.stringify({ eventos })
  }),

  getInformeOperacion: (id) => request(`/control-operativo/operaciones/${id}/resumen`),
  getReporteBuque: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/reportes-buque/operacion/${id}${query ? `?${query}` : ""}`);
  },
  getReporteBuqueFiltros: (id) => request(`/reportes-buque/operacion/${id}/filtros`),
  reporteBuqueDownloadUrl: (id, formato, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return `${requireBaseUrl()}/reportes-buque/operacion/${id}/${formato}${query ? `?${query}` : ""}`;
  },
  getEvidencias: (id) => request(`/control-operativo/operaciones/${id}/evidencias`),

  getIssueFiltros: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/issue-log/filtros${query ? `?${query}` : ""}`);
  },
  getIssueLog: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/issue-log${query ? `?${query}` : ""}`);
  },
  crearIssueLog: (payload) => request("/issue-log", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  crearIssueLogBulk: (items) => request("/issue-log/bulk", {
    method: "POST",
    body: JSON.stringify({ items })
  }),
  sincronizarSofEventos: (eventos) => request("/issue-log/sincronizar", {
    method: "POST",
    body: JSON.stringify({ eventos })
  }),
  actualizarIssueLog: (id, payload) => request(`/issue-log/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  eliminarIssueLog: (id) => request(`/issue-log/${id}`, { method: "DELETE" })
  ,
  getAiResumen: (id) => request(`/ai/operacion/${id}/resumen-ejecutivo`),
  getAiSof: (id) => request(`/ai/operacion/${id}/sof`),
  getAiRiesgos: (id) => request(`/ai/operacion/${id}/riesgos`),
  getAiTiempo: (id) => request(`/ai/operacion/${id}/tiempo-finalizacion`),
  getAiBriefing: (id) => request(`/ai/operacion/${id}/briefing`),
  getAiSalaControl: (id) => request(`/ai/operacion/${id}/sala-control`),
  getAiTimeline: (id) => request(`/ai/operacion/${id}/timeline`),
  getAiMemoria: (id) => request(`/ai/operacion/${id}/memoria`),
  getAiPlanAccion: (id) => request(`/ai/operacion/${id}/plan-accion`),
  comandoPortia: (id, comando) => request(`/ai/operacion/${id}/comando`, {
    method: "POST",
    body: JSON.stringify({ comando, creado_por: "P.O.R.T.I.A" })
  }),
  crearAccionesDesdePlan: (id) => request(`/ai/operacion/${id}/plan-accion/crear-acciones`, {
    method: "POST",
    body: JSON.stringify({ creado_por: "P.O.R.T.I.A", limpiar_abiertas_portia: false })
  }),
  getAccionesAi: (id, estado = "ABIERTA") => request(`/ai/operacion/${id}/acciones?estado=${encodeURIComponent(estado)}`),
  completarAccionAi: (id) => request(`/ai/acciones/${id}/completar`, { method: "POST" }),
  escalarAccionAi: (id, payload = {}) => request(`/ai/acciones/${id}/escalar`, {
    method: "POST",
    body: JSON.stringify({
      destinatario: payload.destinatario || "",
      canal: payload.canal || "INTERNO",
      creado_por: payload.creado_por || "P.O.R.T.I.A"
    })
  }),
  getNotificacionesAi: (id, estado = "PENDIENTE") => request(`/ai/operacion/${id}/notificaciones?estado=${encodeURIComponent(estado)}`),
  marcarNotificacionEnviadaAi: (id) => request(`/ai/notificaciones/${id}/marcar-enviada`, { method: "POST" }),
  chatAiOperacion: (id, pregunta) => request(`/ai/operacion/${id}/chat`, {
    method: "POST",
    body: JSON.stringify({ pregunta })
  }),
  maritimeChat: ({ pregunta, operacion_id, modo = "Ejecutivo", buscar_web = false }) => request("/ai/maritime-chat", {
    method: "POST",
    body: JSON.stringify({ pregunta, operacion_id, modo, buscar_web })
  }),
  clasificarSofAi: (texto) => request("/ai/sof/clasificar", {
    method: "POST",
    body: JSON.stringify({ texto })
  }),

  getRbacCatalogo: () => request("/rbac/catalogo"),
  getRbacUsuario: (id) => request(`/rbac/usuarios/${id}`),
  crearRbacUsuario: (payload) => request("/rbac/usuarios", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  crearRbacRol: (payload) => request("/rbac/roles", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  asignarRbac: (payload) => request("/rbac/asignar", {
    method: "POST",
    body: JSON.stringify(payload)
  })
};
