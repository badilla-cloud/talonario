/* ==========================================================
   Talonario – PDF y compartir
   El PDF se arma dentro de la página con la librería html2pdf
   (se carga desde un CDN en index.html). Si no cargó, se usa la
   ventana de impresión del navegador como plan B.
   ========================================================== */

let pdfPendiente = null; // PDF listo para compartir con un segundo toque

function nombreArchivoPDF() {
  const cliente = doc.cliente.nombre ? " " + doc.cliente.nombre.replace(/\.+$/, "") : "";
  return `${TIPOS[doc.tipo].nombre} ${doc.numero}${cliente}.pdf`.replace(/[\\/:*?"<>|]/g, "");
}

// Crea el archivo PDF a partir de la hoja de vista previa
async function crearArchivoPDF() {
  leerFormulario();
  pintarHoja();

  if (typeof html2pdf === "undefined") return null;

  // Se usa una copia de la hoja con ancho fijo de carta, para que el PDF
  // salga igual en el celular y en la computadora
  const copia = $("#hoja").cloneNode(true);
  copia.removeAttribute("id");
  copia.classList.add("hoja--pdf");
  const caja = document.createElement("div");
  caja.className = "pdf-caja";
  caja.appendChild(copia);
  document.body.appendChild(caja);

  try {
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename: nombreArchivoPDF(),
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "pt", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      })
      .from(copia)
      .outputPdf("blob");
    return new File([blob], nombreArchivoPDF(), { type: "application/pdf" });
  } finally {
    caja.remove();
  }
}

function descargarArchivo(archivo) {
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = archivo.name;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 4000);
}

// Plan B: la ventana de impresión, donde se elige "Guardar como PDF"
function imprimirConNavegador() {
  const tituloOriginal = document.title;
  document.title = nombreArchivoPDF().replace(/\.pdf$/, "");
  window.print();
  document.title = tituloOriginal;
}

function ocupado(boton, activo, texto) {
  if (activo) {
    boton.dataset.textoOriginal = boton.textContent;
    boton.textContent = texto;
    boton.disabled = true;
  } else {
    boton.textContent = boton.dataset.textoOriginal || boton.textContent;
    boton.disabled = false;
  }
}

/* ---------- Descargar PDF ---------- */
async function imprimir(evento) {
  const boton = evento?.currentTarget || $("#btn-imprimir");
  ocupado(boton, true, "Creando PDF…");
  try {
    const archivo = await crearArchivoPDF();
    if (archivo) {
      descargarArchivo(archivo);
      avisar("PDF descargado.");
    } else {
      imprimirConNavegador();
    }
  } catch (error) {
    console.error(error);
    imprimirConNavegador();
  } finally {
    ocupado(boton, false);
  }
}

/* ---------- Compartir (WhatsApp y correo) ---------- */

function puedeCompartirArchivos(archivo) {
  return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files: [archivo] }));
}

async function compartirArchivo(archivo) {
  await navigator.share({
    files: [archivo],
    title: archivo.name.replace(/\.pdf$/, ""),
    text: textoParaCompartir()
  });
}

function abrirWhatsAppConTexto(mensaje) {
  let telefono = doc.cliente.telefono.replace(/\D/g, "");
  if (telefono.length === 8) telefono = "506" + telefono; // número de Costa Rica sin código
  window.open("https://wa.me/" + telefono + "?text=" + encodeURIComponent(mensaje), "_blank", "noopener");
}

function abrirCorreoConTexto(mensaje) {
  const asunto = `${TIPOS[doc.tipo].nombre} ${doc.numero} - ${datos.negocio.nombre}`;
  window.location.href = `mailto:${encodeURIComponent(doc.cliente.correo)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
}

// Panel que aparece cuando el navegador pide un segundo toque para compartir
function mostrarPanelCompartir(archivo) {
  pdfPendiente = archivo;
  $("#panel-compartir-nombre").textContent = archivo.name;
  $("#panel-compartir").hidden = false;
  $("#btn-panel-compartir").focus();
}

function cerrarPanelCompartir() {
  $("#panel-compartir").hidden = true;
  pdfPendiente = null;
}

async function compartir(destino, boton) {
  ocupado(boton, true, "Creando PDF…");
  let archivo = null;
  try {
    archivo = await crearArchivoPDF();
  } catch (error) {
    console.error(error);
  } finally {
    ocupado(boton, false);
  }

  // Sin librería de PDF: se envía solo el mensaje, como antes
  if (!archivo) {
    avisar("No se pudo crear el PDF. Revisa tu conexión a internet.");
    if (destino === "whatsapp") abrirWhatsAppConTexto(textoParaCompartir());
    else abrirCorreoConTexto(textoParaCompartir());
    return;
  }

  // Celular y navegadores compatibles: se abre el menú de compartir con el PDF adjunto
  if (puedeCompartirArchivos(archivo)) {
    try {
      await compartirArchivo(archivo);
    } catch (error) {
      if (error.name === "NotAllowedError") mostrarPanelCompartir(archivo);
      // AbortError = la persona cerró el menú; no se hace nada
    }
    return;
  }

  // Computadora sin menú de compartir: se descarga el PDF y se abre el chat
  descargarArchivo(archivo);
  if (destino === "whatsapp") {
    abrirWhatsAppConTexto(textoParaCompartir());
    avisar("PDF descargado. Arrástralo al chat de WhatsApp que se abrió.");
  } else {
    abrirCorreoConTexto(textoParaCompartir());
    avisar("PDF descargado. Adjúntalo al correo que se abrió.");
  }
}

function compartirWhatsApp(evento) {
  compartir("whatsapp", evento.currentTarget);
}

function compartirCorreo(evento) {
  compartir("correo", evento.currentTarget);
}

document.addEventListener("DOMContentLoaded", () => {
  $("#btn-panel-compartir").addEventListener("click", async () => {
    if (!pdfPendiente) return;
    const archivo = pdfPendiente;
    cerrarPanelCompartir();
    try { await compartirArchivo(archivo); } catch (error) { /* la persona cerró el menú */ }
  });
  $("#btn-panel-descargar").addEventListener("click", () => {
    if (pdfPendiente) descargarArchivo(pdfPendiente);
    cerrarPanelCompartir();
  });
  $("#btn-panel-cerrar").addEventListener("click", cerrarPanelCompartir);
});
