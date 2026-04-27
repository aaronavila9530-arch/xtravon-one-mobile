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
  getDashboard: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/dashboard/resumen${query ? `?${query}` : ""}`);
  },

  getOperaciones: () => request("/operaciones-buque"),
  getOperacionActiva: () => request("/operaciones-buque/activa"),
  getOperacionDetalle: (id) => request(`/operaciones-buque/${id}`),
  cerrarOperacion: (id) => request(`/operaciones-buque/${id}/cerrar`, { method: "POST", body: JSON.stringify({}) }),
  reabrirOperacion: (id) => request(`/operaciones-buque/${id}/reabrir`, { method: "POST", body: JSON.stringify({}) }),

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
  primerEscaneo: (id, payload) => request(`/base-operaciones-camiones/qr/${id}/primer-escaneo`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),

  getInformeOperacion: (id) => request(`/control-operativo/operaciones/${id}/resumen`),
  getEvidencias: (id) => request(`/control-operativo/operaciones/${id}/evidencias`)
};
