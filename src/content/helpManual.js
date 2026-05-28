export const HELP_SECTIONS = [
  {
    id: "login",
    title: "1. Logueo y selección de perfil",
    keywords: ["login", "logueo", "ingreso", "perfil", "usuario", "contraseña"],
    image: "XTRAVON",
    steps: [
      "Abra XTRAVON ONE desde el icono de la aplicación.",
      "Espere a que finalice el splash de carga.",
      "Seleccione el perfil correspondiente: Supervisor, Operador patio, Cliente o Chofer.",
      "En producción, cada usuario debe entrar con sus credenciales asignadas por roles y permisos.",
      "Si la app no responde, cierre y vuelva a abrir; si está en handheld, valide batería, conexión y perfil correcto."
    ],
    notes: [
      "El perfil determina qué pantallas puede ver el usuario.",
      "Operador patio solo debe usar Lector QR Patio y SOF.",
      "Chofer solo debe ver sus guías, QR activo y resumen propio."
    ]
  },
  {
    id: "apertura-buque",
    title: "2. Apertura de buque",
    keywords: ["abrir buque", "apertura", "operacion", "operación", "productos", "bodegas", "stowage", "stowage plan"],
    image: "BUQUE",
    steps: [
      "Ingrese a Operaciones Buque.",
      "Digite el nombre del buque exactamente como se usará en la operación.",
      "Seleccione fecha de inicio.",
      "Agregue uno o varios productos con el botón +.",
      "Registre capacidad por bodega en MT.",
      "Si una bodega está partida, use particiones para dividir la capacidad por producto o cliente.",
      "Revise visualmente la silueta del buque antes de abrir la operación.",
      "Presione Abrir operación.",
      "Valide que la operación quede ABIERTA y visible como operación activa."
    ],
    notes: [
      "Puede existir más de una operación abierta si el negocio lo requiere.",
      "El stowage plan debe reflejar bodegas, particiones, producto y capacidad real.",
      "No cierre la operación hasta completar descarga o autorización gerencial."
    ]
  },
  {
    id: "cuotas",
    title: "3. Cuotas por cliente",
    keywords: ["cuotas", "cliente", "empresa", "asignar cuota", "producto", "mt", "kg", "lb"],
    image: "CUOTAS",
    steps: [
      "En Operaciones Buque seleccione la operación activa.",
      "Agregue cliente, cuota y unidad.",
      "Use + para agregar múltiples líneas de cliente.",
      "Use - para quitar líneas incorrectas antes de guardar.",
      "Presione Crear cuotas para vincularlas a la operación seleccionada.",
      "Use Cargar cuotas activas para verificar que todas quedaron registradas.",
      "Si una cuota cambia, seleccione la cuota, edite y guarde."
    ],
    notes: [
      "Las cuotas controlan sobrecuota y pendiente de descarga.",
      "El QR no debe habilitar un viaje que exceda cuota disponible según reglas operativas.",
      "Las cuotas son por operación, cliente y producto."
    ]
  },
  {
    id: "carga-boletas",
    title: "4. Carga inicial de choferes, guías y QR",
    keywords: ["boletas", "template", "excel", "cargar excel", "guías", "guias", "qr", "pass hatch", "choferes"],
    image: "EXCEL",
    steps: [
      "Ingrese a Carga de Boletas.",
      "Presione Buscar operación activa para confirmar la operación correcta.",
      "Presione Abrir Template para editar el archivo Excel de la operación.",
      "Complete guía, empresa, buque, fecha, producto, chofer, placa, bodega y embarque si aplica.",
      "Guarde el Excel.",
      "Presione Cargar Excel.",
      "La carga inicial queda aprobada automáticamente porque pertenece al arranque controlado de la operación.",
      "Presione Cargar Tabla para consultar registros.",
      "La entrega y asignación de QR se gestiona desde Despacho de Viajes."
    ],
    notes: [
      "Las guías extraordinarias posteriores se cargan por Aprobaciones y sí requieren aprobación.",
      "Cada QR se valida por hash interno; el chofer no debe ver datos técnicos del QR.",
      "Los QR deben pertenecer a la operación correcta."
    ]
  },
  {
    id: "aprobaciones",
    title: "5. Aprobaciones extraordinarias",
    keywords: ["aprobaciones", "extraordinarias", "aprobar", "rechazar", "pending", "pendientes"],
    image: "APROBACIONES",
    steps: [
      "Use Aprobaciones solo para guías extraordinarias no incluidas en la carga inicial.",
      "Abra el template de aprobaciones.",
      "Complete las guías extraordinarias.",
      "Cargue el Excel.",
      "Presione Ver datos cargados para mostrar registros PENDING.",
      "Filtre si necesita aprobar solo un grupo.",
      "Marque las guías necesarias o use Seleccionar todo.",
      "Seleccione Aprobar o Rechazar desde acciones.",
      "Agregue comentario obligatorio si rechaza o si requiere dejar evidencia.",
      "Al aprobar, se genera el QR y se asigna al chofer correspondiente."
    ],
    notes: [
      "PENDING significa pendiente de revisión.",
      "Aprobado habilita el flujo QR.",
      "Rechazado conserva trazabilidad y comentario."
    ]
  },
  {
    id: "despacho",
    title: "6. Despacho de viajes",
    keywords: ["despacho", "asignar", "reasignar", "viajes", "chofer disponible", "solicitud", "whatsapp", "correo"],
    image: "DESPACHO",
    steps: [
      "Ingrese a Despacho de Viajes.",
      "Busque la operación activa.",
      "Revise solicitudes de nuevo viaje, guías asignadas, primer escaneo, segundo escaneo, tercer escaneo, completadas y bloqueos.",
      "Para asignar, seleccione o filtre por chofer, placa, cliente y producto.",
      "El sistema debe elegir una guía disponible según operación, cliente, producto y reglas de cuota.",
      "Confirme asignación manualmente.",
      "El QR se envía a la app del chofer y opcionalmente por WhatsApp o correo.",
      "Si un chofer no continúa, sus guías pendientes quedan para reasignación manual.",
      "Use clic derecho o presión larga sobre una guía para acciones: asignar, liberar, cancelar, bloquear o enviar QR."
    ],
    notes: [
      "El ERP propone, pero despacho confirma.",
      "No se debe autoasignar sin control humano.",
      "La app del chofer solo muestra un QR activo por ciclo."
    ]
  },
  {
    id: "lector-patio",
    title: "7. Lector QR Patio",
    keywords: ["lector", "qr", "patio", "primer escaneo", "segundo escaneo", "tercer escaneo", "offline", "handheld"],
    image: "QR",
    steps: [
      "Ingrese como Operador Patio.",
      "Use Lector QR Patio.",
      "En handheld Zebra, use el botón físico del lector si está configurado por DataWedge.",
      "Si el lector físico falla, use cámara manual como respaldo.",
      "Primer escaneo: registre ficha y peso vacío.",
      "Segundo escaneo: registre número de tolva.",
      "Tercer escaneo: registre peso lleno y marchamos.",
      "Use + para agregar múltiples marchamos y - para eliminar uno incorrecto.",
      "Al guardar, la app intenta enviar al backend.",
      "Si no hay señal, guarda en memoria local y reintenta sincronizar automáticamente."
    ],
    notes: [
      "La operación no debe detenerse por caída de señal.",
      "El QR inválido debe generar alerta y evidencia.",
      "El QR completado no debe permitir nuevos escaneos."
    ]
  },
  {
    id: "sof",
    title: "8. SOF - Statement of Facts",
    keywords: ["sof", "statement", "evento", "demora", "clima", "maquinaria", "bodega", "offline"],
    image: "SOF",
    steps: [
      "Ingrese a SOF.",
      "La operación abierta debe cargarse por defecto.",
      "Seleccione fecha, hora desde y hora hasta.",
      "Seleccione categoría y subcategoría.",
      "Seleccione bodega si aplica.",
      "Escriba el evento con claridad operativa.",
      "Guarde SOF.",
      "Si está sin conexión, el SOF queda guardado localmente.",
      "Al recuperar señal, se sincroniza automáticamente.",
      "Use historial para revisar eventos por operación."
    ],
    notes: [
      "SOF es evidencia operacional.",
      "Evite textos ambiguos; indique causa, duración, bodega y efecto.",
      "Demoras relevantes deben alimentar informes y reclamos."
    ]
  },
  {
    id: "centro-ejecutivo",
    title: "9. Centro Ejecutivo",
    keywords: ["dashboard", "centro ejecutivo", "kpi", "graficos", "filtros", "bodegas", "cuotas", "retiro", "descargado"],
    image: "DASHBOARD",
    steps: [
      "Ingrese a Centro Ejecutivo.",
      "Presione Buscar operación.",
      "Seleccione operación.",
      "Cargue filtros si necesita filtrar por empresa, guía, producto, chofer o placa.",
      "Presione Generar datos.",
      "Revise KPIs: guías, completas, pendientes, capacidad, descargado, pendiente y avance.",
      "Revise silueta del buque por bodegas.",
      "Revise cuotas vs descargado, tendencia diaria, duración por camión y alertas.",
      "Use exportar para PDF, Excel, Word o CSV según el módulo."
    ],
    notes: [
      "Los datos no deben cargarse solos para evitar lag.",
      "Los filtros deben actualizar gráficos y tablas.",
      "La lectura ejecutiva debe orientar decisiones, no reemplazarlas."
    ]
  },
  {
    id: "informes",
    title: "10. Informes",
    keywords: ["informes", "reporte", "pdf", "excel", "word", "csv", "descargar"],
    image: "INFORMES",
    steps: [
      "Ingrese a Informes.",
      "Seleccione operación.",
      "Seleccione tipo de informe: ejecutivo, SOF, cuotas vs descargado, bodega, alertas, productividad o diferencias.",
      "Presione Ver informe.",
      "Revise KPIs, tablas, gráficos y análisis.",
      "Seleccione formato de descarga.",
      "Use Guardar como para elegir la ruta.",
      "Revise el archivo descargado antes de enviarlo a clientes."
    ],
    notes: [
      "Cada reporte tiene estructura distinta según su propósito.",
      "SOF se centra en eventos y duración.",
      "Cuotas se centra en asignado vs descargado vs pendiente."
    ]
  },
  {
    id: "portia",
    title: "11. P.O.R.T.I.A",
    keywords: ["portia", "ia", "preguntar", "voz", "clima", "calado", "buque", "riesgo"],
    image: "PORTIA",
    steps: [
      "Diga Oye Portia, Hola Portia o Portia estás ahí.",
      "Espere confirmación de voz.",
      "Haga una pregunta corta y clara.",
      "Ejemplos: cuánto falta, riesgos de hoy, clima en puerto, calado de puerto, ubicación de buque, cliente atrasado.",
      "Para detener conversación diga: es todo Portia, desconéctate Portia o silencio Portia.",
      "Si necesita análisis completo, entre a la pantalla P.O.R.T.I.A.",
      "PORTIA puede consultar operación, SOF, riesgos, clima, puertos y ubicación AIS si las APIs están configuradas."
    ],
    notes: [
      "PORTIA no debe sustituir confirmación oficial de autoridad portuaria.",
      "Para clima debe iniciar con criterio de pronóstico.",
      "Para riesgo debe usar lenguaje prudente como aparentemente."
    ]
  }
];

export function searchHelpManual(query) {
  const clean = String(query || "").trim().toLowerCase();
  if (!clean) return HELP_SECTIONS;
  const tokens = clean.split(/\s+/).filter(Boolean);
  return HELP_SECTIONS
    .map((section) => {
      const haystack = [
        section.title,
        ...(section.keywords || []),
        ...(section.steps || []),
        ...(section.notes || [])
      ].join(" ").toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { section, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.section);
}

export function answerHelpQuestion(query) {
  const matches = searchHelpManual(query);
  if (!matches.length) {
    return {
      title: "No encontré ese punto exacto",
      text: "Pruebe con palabras como apertura, cuotas, QR, SOF, despacho, aprobaciones, informes, handheld, chofer o PORTIA."
    };
  }
  const section = matches[0];
  return {
    title: section.title,
    text: [
      "Pasos:",
      ...section.steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "Notas importantes:",
      ...section.notes.map((note) => `- ${note}`)
    ].join("\n")
  };
}
