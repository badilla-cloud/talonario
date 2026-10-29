/* ==========================================================
   Talonario – generador de PDF propio
   Dibuja la factura directamente como PDF (texto, líneas e
   imágenes), sin librerías externas. Funciona igual en el
   celular y en la computadora.
   ========================================================== */

const PAGINA = { ancho: 612, alto: 792, margen: 48 }; // carta, en puntos

/* ---------- Texto en codificación WinAnsi ---------- */

const ESPECIALES_WINANSI = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
  0x20A1: 0xA2, // ₡ (colón) se imprime como ¢, como en muchos documentos de Costa Rica
  0x2212: 0x2D, // signo menos
  0x202F: 0x20, 0x2009: 0x20, 0x200A: 0x20
};

// Convierte un carácter a su número de byte en WinAnsi (o "?" si no existe)
function byteWinAnsi(caracter) {
  const codigo = caracter.codePointAt(0);
  if (codigo < 0x80) return codigo;
  if (codigo >= 0xA0 && codigo <= 0xFF) return codigo;
  return ESPECIALES_WINANSI[codigo] ?? 0x3F;
}

function aBytes(texto) {
  let resultado = "";
  for (const caracter of String(texto ?? "")) {
    if (caracter === "\n" || caracter === "\r" || caracter === "\t") { resultado += " "; continue; }
    resultado += String.fromCharCode(byteWinAnsi(caracter));
  }
  return resultado;
}

function escaparCadenaPDF(bytes) {
  return bytes.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function anchoTexto(texto, fuente, tamano) {
  const anchos = ANCHOS_FUENTE[fuente];
  let total = 0;
  for (const caracter of aBytes(texto)) total += anchos[caracter.charCodeAt(0)] || 500;
  return total * tamano / 1000;
}

// Parte un texto en líneas que caben en el ancho indicado
function envolverTexto(texto, fuente, tamano, anchoMaximo) {
  const lineas = [];
  for (const parrafo of String(texto ?? "").split(/\r?\n/)) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) { lineas.push(""); continue; }
    let actual = "";
    for (let palabra of palabras) {
      // Palabras más largas que la línea se cortan por letras
      while (anchoTexto(palabra, fuente, tamano) > anchoMaximo) {
        let corte = palabra.length - 1;
        while (corte > 1 && anchoTexto(palabra.slice(0, corte), fuente, tamano) > anchoMaximo) corte--;
        if (actual) { lineas.push(actual); actual = ""; }
        lineas.push(palabra.slice(0, corte));
        palabra = palabra.slice(corte);
      }
      const prueba = actual ? actual + " " + palabra : palabra;
      if (anchoTexto(prueba, fuente, tamano) <= anchoMaximo) {
        actual = prueba;
      } else {
        lineas.push(actual);
        actual = palabra;
      }
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

/* ---------- Colores ---------- */

function colorRGB(hex) {
  const limpio = String(hex || "#000000").replace("#", "");
  const n = parseInt(limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3)).join(" ");
}

const COLOR = {
  tinta: colorRGB("#1E2333"),
  gris: colorRGB("#565E78"),
  grisClaro: colorRGB("#8A91A8"),
  linea: colorRGB("#E3E7F0"),
  fondoTabla: colorRGB("#F2F4F9"),
  blanco: "1 1 1",
  verde: colorRGB("#1C6B47"),
  rojo: colorRGB("#B3261E"),
  apagado: colorRGB("#5D6378")
};

const FUENTE_PDF = { normal: "/F1", negrita: "/F2", serif: "/F3" };

/* ---------- Imágenes (logo y firma) ---------- */

// Convierte una imagen (data URL) en JPEG con fondo blanco para el PDF
function prepararImagen(dataURL, maxLado) {
  return new Promise((resolver) => {
    if (!dataURL) { resolver(null); return; }
    const imagen = new Image();
    imagen.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(imagen.width, imagen.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.max(1, Math.round(imagen.width * escala));
      lienzo.height = Math.max(1, Math.round(imagen.height * escala));
      const ctx = lienzo.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      const base64 = lienzo.toDataURL("image/jpeg", 0.92).split(",")[1];
      resolver({ datos: atob(base64), ancho: lienzo.width, alto: lienzo.height });
    };
    imagen.onerror = () => resolver(null);
    imagen.src = dataURL;
  });
}

/* ---------- Páginas ---------- */

class PaginaPDF {
  constructor() { this.ops = []; }

  // y se mide desde arriba, como en la pantalla
  Y(y) { return (PAGINA.alto - y).toFixed(2); }

  texto(x, y, texto, { fuente = "normal", tamano = 10, color = COLOR.tinta, alinear = "izq", espaciado = 0 } = {}) {
    const bytes = aBytes(texto);
    if (!bytes) return;
    let xFinal = x;
    const ancho = anchoTexto(texto, fuente, tamano) + espaciado * bytes.length;
    if (alinear === "der") xFinal = x - ancho;
    if (alinear === "centro") xFinal = x - ancho / 2;
    this.ops.push(`BT ${FUENTE_PDF[fuente]} ${tamano} Tf ${color} rg ${espaciado ? espaciado + " Tc " : ""}${xFinal.toFixed(2)} ${this.Y(y)} Td (${escaparCadenaPDF(bytes)}) Tj ET`);
  }

  rect(x, y, ancho, alto, color) {
    this.ops.push(`${color} rg ${x.toFixed(2)} ${this.Y(y + alto)} ${ancho.toFixed(2)} ${alto.toFixed(2)} re f`);
  }

  linea(x1, y1, x2, y2, color, grosor = 1) {
    this.ops.push(`${grosor} w ${color} RG ${x1.toFixed(2)} ${this.Y(y1)} m ${x2.toFixed(2)} ${this.Y(y2)} l S`);
  }

  imagen(nombre, x, y, ancho, alto) {
    this.ops.push(`q ${ancho.toFixed(2)} 0 0 ${alto.toFixed(2)} ${x.toFixed(2)} ${this.Y(y + alto)} cm /${nombre} Do Q`);
  }

  // Sello rotado: centro en (x, y), girado unos grados como un sello de hule
  sello(x, y, texto, color) {
    const tamano = 22;
    const espaciado = 2;
    const bytes = aBytes(texto.toUpperCase());
    const anchoTxt = anchoTexto(texto.toUpperCase(), "negrita", tamano) + espaciado * bytes.length;
    const ancho = anchoTxt + 28;
    const alto = 40;
    const angulo = 12 * Math.PI / 180;
    const c = Math.cos(angulo).toFixed(4), s = Math.sin(angulo).toFixed(4);
    this.ops.push(`q ${c} ${s} ${-s} ${c} ${x.toFixed(2)} ${this.Y(y)} cm`);
    this.ops.push(`2.2 w ${color} RG ${(-ancho / 2).toFixed(2)} ${(-alto / 2).toFixed(2)} ${ancho.toFixed(2)} ${alto} re S`);
    this.ops.push(`0.8 w ${(-ancho / 2 + 4).toFixed(2)} ${(-alto / 2 + 4).toFixed(2)} ${(ancho - 8).toFixed(2)} ${alto - 8} re S`);
    this.ops.push(`BT /F2 ${tamano} Tf ${color} rg ${espaciado} Tc ${(-anchoTxt / 2).toFixed(2)} -7.5 Td (${escaparCadenaPDF(bytes)}) Tj ET Q`);
  }
}

/* ---------- Armar el archivo PDF ---------- */

function construirArchivoPDF(paginas, imagenes) {
  const objetos = [];
  const agregar = (contenido) => { objetos.push(contenido); return objetos.length; };

  const idCatalogo = agregar(null);
  const idPaginas = agregar(null);
  const idF1 = agregar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const idF2 = agregar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const idF3 = agregar("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");

  let recursosImagenes = "";
  for (const [nombre, img] of Object.entries(imagenes)) {
    const id = agregar(`<< /Type /XObject /Subtype /Image /Width ${img.ancho} /Height ${img.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.datos.length} >>\nstream\n${img.datos}\nendstream`);
    recursosImagenes += ` /${nombre} ${id} 0 R`;
  }

  const recursos = `<< /Font << /F1 ${idF1} 0 R /F2 ${idF2} 0 R /F3 ${idF3} 0 R >>${recursosImagenes ? ` /XObject <<${recursosImagenes} >>` : ""} >>`;
  const idsPaginas = [];
  for (const pagina of paginas) {
    const contenido = pagina.ops.join("\n");
    const idContenido = agregar(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
    idsPaginas.push(agregar(`<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${PAGINA.ancho} ${PAGINA.alto}] /Resources ${recursos} /Contents ${idContenido} 0 R >>`));
  }
  objetos[idCatalogo - 1] = `<< /Type /Catalog /Pages ${idPaginas} 0 R >>`;
  objetos[idPaginas - 1] = `<< /Type /Pages /Kids [${idsPaginas.map((id) => id + " 0 R").join(" ")}] /Count ${idsPaginas.length} >>`;

  let salida = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const posiciones = [];
  objetos.forEach((contenido, i) => {
    posiciones.push(salida.length);
    salida += `${i + 1} 0 obj\n${contenido}\nendobj\n`;
  });
  const inicioXref = salida.length;
  salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const posicion of posiciones) salida += String(posicion).padStart(10, "0") + " 00000 n \n";
  salida += `trailer\n<< /Size ${objetos.length + 1} /Root ${idCatalogo} 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;

  const bytes = new Uint8Array(salida.length);
  for (let i = 0; i < salida.length; i++) bytes[i] = salida.charCodeAt(i) & 0xFF;
  return new Blob([bytes], { type: "application/pdf" });
}

/* ---------- Diseño del documento ---------- */

async function generarPDFDocumento(documento, negocio) {
  const M = PAGINA.margen;
  const ANCHO = PAGINA.ancho - M * 2;
  const LIMITE = PAGINA.alto - 56; // donde se corta la página
  const t = calcularTotales(documento);
  const m = documento.moneda;
  const plantilla = negocio.plantilla || "clasica";
  const colorDoc = colorRGB(negocio.color);
  const estado = estadoVisible(documento);
  const dinero = (valor) => formatearDinero(valor, m);

  const imagenes = {};
  const logo = await prepararImagen(negocio.logo, 400);
  const firma = await prepararImagen(negocio.firma, 600);
  if (logo) imagenes.Logo = logo;
  if (firma) imagenes.Firma = firma;

  const paginas = [new PaginaPDF()];
  let p = paginas[0];
  let y = M;

  function nuevaPagina() {
    p = new PaginaPDF();
    paginas.push(p);
    y = M;
  }

  /* --- Encabezado --- */
  const enBanda = plantilla === "banda";
  const colorTitulo = enBanda ? COLOR.blanco : (plantilla === "minima" ? COLOR.tinta : colorDoc);
  const colorNombre = enBanda ? COLOR.blanco : COLOR.tinta;
  const colorDatos = enBanda ? colorRGB("#DDE3F6") : COLOR.gris;

  const datosNegocio = [negocio.cedula && "Cédula " + negocio.cedula, negocio.telefono, negocio.correo, negocio.web, negocio.direccion].filter(Boolean);
  const xTexto = logo ? M + 92 : M;
  const anchoDatos = ANCHO * 0.55 - (logo ? 92 : 0);
  const lineasDatos = datosNegocio.flatMap((d) => envolverTexto(d, "normal", 8.5, anchoDatos));
  let altoLogo = 0, anchoLogo = 0;
  if (logo) {
    const escala = Math.min(80 / logo.ancho, 56 / logo.alto);
    anchoLogo = logo.ancho * escala;
    altoLogo = logo.alto * escala;
  }
  const altoIzquierda = Math.max(altoLogo, 16 + lineasDatos.length * 11.5);
  const altoCabeza = Math.max(altoIzquierda, 48);

  if (enBanda) p.rect(0, 0, PAGINA.ancho, M + altoCabeza + 22, colorDoc);
  if (logo) {
    if (enBanda) p.rect(M - 4, y - 4, anchoLogo + 8, altoLogo + 8, COLOR.blanco);
    p.imagen("Logo", M, y, anchoLogo, altoLogo);
  }
  p.texto(xTexto, y + 12, negocio.nombre || "Nombre de tu negocio", { fuente: "negrita", tamano: 13, color: colorNombre });
  lineasDatos.forEach((linea, i) => p.texto(xTexto, y + 27 + i * 11.5, linea, { tamano: 8.5, color: colorDatos }));

  const fuenteTitulo = plantilla === "clasica" ? "serif" : (plantilla === "minima" ? "normal" : "negrita");
  p.texto(M + ANCHO, y + 24, TIPOS[documento.tipo].nombre, { fuente: fuenteTitulo, tamano: 28, color: colorTitulo, alinear: "der" });
  p.texto(M + ANCHO, y + 42, documento.numero, { fuente: "negrita", tamano: 10, color: colorNombre, alinear: "der" });

  y += altoCabeza + 14;
  if (enBanda) y += 8;
  else p.linea(M, y, M + ANCHO, y, plantilla === "minima" ? colorRGB("#D9DEEA") : colorDoc, plantilla === "minima" ? 0.75 : 1.5);

  /* --- Cliente y fechas --- */
  y += 24;
  const colorEtiqueta = plantilla === "minima" ? COLOR.grisClaro : colorDoc;
  p.texto(M, y, documento.tipo === "recibo" ? "Recibido de" : "Para", { fuente: "negrita", tamano: 8, color: colorEtiqueta });
  p.texto(M, y + 15, documento.cliente.nombre || "Nombre del cliente", { fuente: "negrita", tamano: 11.5 });
  const datosCliente = [documento.cliente.cedula && "Cédula " + documento.cliente.cedula, documento.cliente.telefono, documento.cliente.correo, documento.cliente.direccion]
    .filter(Boolean).flatMap((d) => envolverTexto(d, "normal", 8.5, ANCHO * 0.55));
  datosCliente.forEach((linea, i) => p.texto(M, y + 29 + i * 11.5, linea, { tamano: 8.5, color: COLOR.gris }));

  const fechas = [["Fecha", formatearFecha(documento.fecha)]];
  if (documento.vence && documento.tipo !== "recibo") {
    fechas.push([documento.tipo === "cotizacion" ? "Válida hasta" : "Vence", formatearFecha(documento.vence)]);
  }
  fechas.forEach(([etiqueta, valor], i) => {
    p.texto(M + ANCHO - 82, y + 4 + i * 14, etiqueta, { tamano: 9, color: COLOR.gris, alinear: "der" });
    p.texto(M + ANCHO, y + 4 + i * 14, valor, { fuente: "negrita", tamano: 9, alinear: "der" });
  });
  y += Math.max(29 + datosCliente.length * 11.5, fechas.length * 14) + 18;

  /* --- Tabla de productos --- */
  const derImporte = M + ANCHO - 6;
  const derPrecio = derImporte - 100;
  const derCant = derPrecio - 92;
  const anchoDesc = derCant - 48 - (M + 6);

  function encabezadoTabla() {
    if (enBanda) p.rect(M, y, ANCHO, 22, COLOR.fondoTabla);
    p.texto(M + 6, y + 14, "Descripción", { fuente: "negrita", tamano: 8, color: COLOR.gris });
    p.texto(derCant, y + 14, "Cant.", { fuente: "negrita", tamano: 8, color: COLOR.gris, alinear: "der" });
    p.texto(derPrecio, y + 14, "Precio", { fuente: "negrita", tamano: 8, color: COLOR.gris, alinear: "der" });
    p.texto(derImporte, y + 14, "Importe", { fuente: "negrita", tamano: 8, color: COLOR.gris, alinear: "der" });
    y += 22;
    if (!enBanda) p.linea(M, y, M + ANCHO, y, COLOR.tinta, plantilla === "minima" ? 0.75 : 1.2);
  }
  encabezadoTabla();

  const items = documento.items.filter((item) => item.descripcion || Number(item.precio));
  if (items.length === 0) {
    p.texto(M + ANCHO / 2, y + 24, "Sin productos", { tamano: 9.5, color: COLOR.grisClaro, alinear: "centro" });
    y += 40;
  }
  for (const item of items) {
    const descripcion = (item.descripcion || "—") + (item.iva ? "" : " (exento)");
    const lineas = envolverTexto(descripcion, "normal", 9.5, anchoDesc);
    const altoFila = lineas.length * 12.5 + 10;
    if (y + altoFila > LIMITE) {
      nuevaPagina();
      encabezadoTabla();
    }
    lineas.forEach((linea, i) => p.texto(M + 6, y + 15 + i * 12.5, linea, { tamano: 9.5 }));
    p.texto(derCant, y + 15, String(Number(item.cantidad || 0)), { tamano: 9.5, alinear: "der" });
    p.texto(derPrecio, y + 15, dinero(item.precio), { tamano: 9.5, alinear: "der" });
    p.texto(derImporte, y + 15, dinero(item.cantidad * item.precio), { tamano: 9.5, alinear: "der" });
    y += altoFila;
    p.linea(M, y, M + ANCHO, y, COLOR.linea, 0.75);
  }

  /* --- Totales --- */
  const filas = [["Subtotal", dinero(t.subtotal)]];
  if (t.descuento) filas.push([`Descuento${documento.descuentoTipo === "%" ? " (" + documento.descuento + "%)" : ""}`, "- " + dinero(t.descuento)]);
  if (documento.ivaPorcentaje) filas.push([`IVA (${documento.ivaPorcentaje}%)`, dinero(t.iva)]);
  if (t.envio) filas.push(["Envío u otros", dinero(t.envio)]);
  const mostrarSaldo = documento.tipo === "factura" && t.pagado && estado !== "pagada";

  const altoTotales = filas.length * 15 + 34 + (mostrarSaldo ? 32 : 0);
  if (y + 18 + altoTotales > LIMITE) nuevaPagina();
  y += 18;
  const inicioTotales = y;
  const xEtiquetas = derImporte - 118;

  for (const [etiqueta, valor] of filas) {
    p.texto(xEtiquetas, y + 10, etiqueta, { tamano: 9.5, color: COLOR.gris, alinear: "der" });
    p.texto(derImporte, y + 10, valor, { fuente: "negrita", tamano: 9.5, alinear: "der" });
    y += 15;
  }
  y += 5;
  p.linea(xEtiquetas - 70, y, derImporte, y, COLOR.tinta, 1.2);
  y += 18;
  const colorTotal = plantilla === "minima" ? COLOR.tinta : colorDoc;
  p.texto(xEtiquetas, y, "Total", { fuente: "negrita", tamano: 13, color: colorTotal, alinear: "der" });
  p.texto(derImporte, y, dinero(t.total), { fuente: "negrita", tamano: 13, color: colorTotal, alinear: "der" });
  if (mostrarSaldo) {
    y += 16;
    p.texto(xEtiquetas, y, "Pagado", { tamano: 9.5, color: COLOR.gris, alinear: "der" });
    p.texto(derImporte, y, "- " + dinero(t.pagado), { fuente: "negrita", tamano: 9.5, alinear: "der" });
    y += 16;
    p.texto(xEtiquetas, y, "Saldo", { fuente: "negrita", tamano: 10.5, alinear: "der" });
    p.texto(derImporte, y, dinero(t.saldo), { fuente: "negrita", tamano: 10.5, alinear: "der" });
  }

  // Sello de estado a la izquierda de los totales
  const sellos = { pagada: ["Pagada", COLOR.verde], anulada: ["Anulada", COLOR.apagado], vencida: ["Vencida", COLOR.rojo] };
  if (sellos[estado]) p.sello(M + 95, inicioTotales + 34, sellos[estado][0], sellos[estado][1]);

  y = Math.max(y, inicioTotales + 70) + 24;

  /* --- Notas y términos --- */
  function bloqueTexto(titulo, contenido) {
    if (!contenido) return;
    const lineas = envolverTexto(contenido, "normal", 9.5, ANCHO * 0.8);
    if (y + 16 + Math.min(lineas.length, 3) * 13 > LIMITE) nuevaPagina();
    p.texto(M, y, titulo, { fuente: "negrita", tamano: 8, color: colorEtiqueta });
    y += 14;
    for (const linea of lineas) {
      if (y > LIMITE) nuevaPagina();
      p.texto(M, y, linea, { tamano: 9.5 });
      y += 13;
    }
    y += 12;
  }
  bloqueTexto("Notas", documento.notas);
  bloqueTexto("Términos y forma de pago", documento.terminos);

  /* --- Firma --- */
  if (firma) {
    const escala = Math.min(160 / firma.ancho, 52 / firma.alto);
    const anchoF = firma.ancho * escala, altoF = firma.alto * escala;
    if (y + altoF + 30 > LIMITE) nuevaPagina();
    y += 10;
    p.imagen("Firma", M, y, anchoF, altoF);
    y += altoF + 4;
    p.linea(M, y, M + 170, y, COLOR.tinta, 0.75);
    p.texto(M + 85, y + 12, negocio.nombre || "", { tamano: 8.5, color: COLOR.gris, alinear: "centro" });
  }

  /* --- Número de página --- */
  if (paginas.length > 1) {
    paginas.forEach((pagina, i) => pagina.texto(PAGINA.ancho / 2, PAGINA.alto - 28, `Página ${i + 1} de ${paginas.length}`,
      { tamano: 8, color: COLOR.grisClaro, alinear: "centro" }));
  }

  return construirArchivoPDF(paginas, imagenes);
}
