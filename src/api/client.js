import { API_BASE } from "../config";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

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
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

export const api = {
  templateBoletasUrl: () => `${API_BASE}/base-operaciones-camiones/template-excel/descargar`,
  exportarBoletasExcelUrl: () => `${API_BASE}/base-operaciones-camiones/exportar-excel`,
  cargarExcelBoletasArchivo: async (blob) => {
    const response = await fetch(`${API_BASE}/base-operaciones-camiones/cargar-excel-archivo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      body: blob
    });

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
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
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

  getAprobacionesPendientes: () => request("/aprobaciones/pendientes"),
  cargarAprobacionesTemplate: () => request("/aprobaciones/cargar-template", { method: "POST" }),
  aprobar: (ids, comentario, usuario) => request("/aprobaciones/aprobar", {
    method: "POST",
    body: JSON.stringify({ ids, comentario, usuario })
  }),
  rechazar: (ids, comentario, usuario) => request("/aprobaciones/rechazar", {
    method: "POST",
    body: JSON.stringify({ ids, comentario, usuario })
  }),

  getBoletas: () => request("/base-operaciones-camiones"),
  getBoleta: (id) => request(`/base-operaciones-camiones/${id}`),
  generarQrBoletas: () => request("/base-operaciones-camiones/generar-qr", {
    method: "POST",
    body: JSON.stringify({ formato: "jpg" })
  }),
  validarQr: (id, token) => request(`/base-operaciones-camiones/qr/${id}/validar?token=${encodeURIComponent(token || "")}`),
  primerEscaneo: (id, payload) => request(`/base-operaciones-camiones/qr/${id}/primer-escaneo`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  tercerEscaneo: (id, payload) => request(`/base-operaciones-camiones/qr/${id}/tercer-escaneo-json`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),

  getInformeOperacion: (id) => request(`/control-operativo/operaciones/${id}/resumen`),
  getReporteBuque: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/reportes-buque/operacion/${id}${query ? `?${query}` : ""}`);
  },
  getReporteBuqueFiltros: (id) => request(`/reportes-buque/operacion/${id}/filtros`),
  reporteBuqueDownloadUrl: (id, formato, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE}/reportes-buque/operacion/${id}/${formato}${query ? `?${query}` : ""}`;
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
  })
};
