/* ==========================================================
   Talonario – datos, guardado y cálculos
   Todo se guarda en el localStorage del navegador.
   ========================================================== */

const CLAVE_DATOS = "talonario_datos_v1";

const TIPOS = {
  factura: { nombre: "Factura", prefijo: "F" },
  cotizacion: { nombre: "Cotización", prefijo: "C" },
  recibo: { nombre: "Recibo", prefijo: "R" }
};

const ESTADOS = {
  pendiente: "Pendiente",
  vencida: "Vencida",
  pagada: "Pagada",
  anulada: "Anulada"
};

const COLORES = ["#2A3B8F", "#0F6E5C", "#9B2C3A", "#5B3A8C", "#1F2937", "#B4650E"];

// Datos con los que arranca la aplicación la primera vez
function datosIniciales() {
  return {
    negocio: {
      nombre: "",
      cedula: "",
      telefono: "",
      correo: "",
      web: "",
      direccion: "",
      logo: "",
      firma: "",
      plantilla: "clasica",
      color: COLORES[0],
      moneda: "CRC",
      iva: 13,
      dias: 15,
      terminos: ""
    },
    clientes: [],
    documentos: [],
    productos: [],
    contadores: { factura: 1, cotizacion: 1, recibo: 1 }
  };
}

// Lee los datos guardados. Si no hay o están dañados, devuelve los iniciales
function cargarDatos() {
  const base = datosIniciales();
  try {
    const texto = localStorage.getItem(CLAVE_DATOS);
    if (!texto) return base;
    const guardado = JSON.parse(texto);
    return {
      negocio: Object.assign(base.negocio, guardado.negocio),
      clientes: Array.isArray(guardado.clientes) ? guardado.clientes : [],
      documentos: Array.isArray(guardado.documentos) ? guardado.documentos : [],
      productos: Array.isArray(guardado.productos) ? guardado.productos : [],
      contadores: Object.assign(base.contadores, guardado.contadores)
    };
  } catch (error) {
    console.warn("No se pudieron leer los datos guardados.", error);
    return base;
  }
}

// Guarda todo. Devuelve false si el navegador no tiene espacio
function guardarDatos(datos) {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// Crea un id único sencillo
function crearId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Número con ceros a la izquierda: F-0007
function formatearNumero(tipo, numero) {
  return TIPOS[tipo].prefijo + "-" + String(numero).padStart(4, "0");
}

// Formato de dinero según la moneda: ₡12 500,00 o $12,500.00
function formatearDinero(valor, moneda) {
  const idioma = moneda === "USD" ? "en-US" : "es-CR";
  return new Intl.NumberFormat(idioma, {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor || 0);
}

// Fecha de hoy en formato AAAA-MM-DD (el que usan los input date)
function hoyISO() {
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  return hoy.toISOString().slice(0, 10);
}

function sumarDias(fechaISO, dias) {
  const fecha = new Date(fechaISO + "T12:00:00");
  fecha.setDate(fecha.getDate() + Number(dias || 0));
  return fecha.toISOString().slice(0, 10);
}

// 2026-10-28 -> 28 oct. 2026
function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const fecha = new Date(fechaISO + "T12:00:00");
  return fecha.toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });
}

// Redondea a 2 decimales para evitar errores como 0.1 + 0.2
function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

// Calcula subtotal, descuento, IVA y total de un documento
function calcularTotales(doc) {
  let subtotal = 0;
  let baseGravada = 0;

  for (const item of doc.items) {
    const linea = Number(item.cantidad || 0) * Number(item.precio || 0);
    subtotal += linea;
    if (item.iva) baseGravada += linea;
  }

  let descuento = 0;
  if (doc.descuentoTipo === "%") {
    descuento = subtotal * Math.min(Number(doc.descuento || 0), 100) / 100;
  } else {
    descuento = Math.min(Number(doc.descuento || 0), subtotal);
  }

  // El descuento se reparte en proporción sobre la parte que lleva IVA
  const proporcionGravada = subtotal > 0 ? baseGravada / subtotal : 0;
  const baseIva = (baseGravada - descuento * proporcionGravada);
  const iva = baseIva * Number(doc.ivaPorcentaje || 0) / 100;
  const envio = Number(doc.envio || 0);
  const total = subtotal - descuento + iva + envio;
  const pagado = doc.estado === "pagada" ? total : Math.min(Number(doc.pagado || 0), total);

  return {
    subtotal: redondear(subtotal),
    descuento: redondear(descuento),
    iva: redondear(iva),
    envio: redondear(envio),
    total: redondear(total),
    pagado: redondear(pagado),
    saldo: redondear(total - pagado)
  };
}

// Estado que se muestra: una factura pendiente con fecha pasada está vencida
function estadoVisible(doc) {
  if (doc.estado === "pendiente" && doc.tipo === "factura" && doc.vence && doc.vence < hoyISO()) {
    return "vencida";
  }
  return doc.estado;
}

// Evita que el texto escrito se interprete como HTML
function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
