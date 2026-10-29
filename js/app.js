/* ==========================================================
   Talonario – lógica de la aplicación
   ========================================================== */

let datos = cargarDatos();
let doc = null;            // documento que se está editando
let editandoId = null;     // id del documento si se está editando uno guardado

const $ = (selector) => document.querySelector(selector);

/* ---------------------------------------------------------
   Navegación entre secciones
   --------------------------------------------------------- */
function mostrarVista(nombre) {
  document.querySelectorAll(".vista").forEach((vista) => {
    vista.hidden = vista.id !== "vista-" + nombre;
  });
  document.querySelectorAll(".nav-btn").forEach((boton) => {
    const activo = boton.dataset.vista === nombre;
    boton.classList.toggle("nav-btn--activo", activo);
    if (activo) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });

  if (nombre === "documentos") pintarDocumentos();
  if (nombre === "clientes") pintarClientes();
  if (nombre === "negocio") cargarFormNegocio();
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------
   Mensajes rápidos (toast)
   --------------------------------------------------------- */
let temporizadorToast;
function avisar(texto) {
  const toast = $("#toast");
  toast.textContent = texto;
  toast.classList.add("toast--visible");
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => toast.classList.remove("toast--visible"), 2800);
}

function guardarTodo() {
  if (!guardarDatos(datos)) {
    avisar("No se pudo guardar: el navegador no tiene espacio. Prueba con un logo más liviano.");
    return false;
  }
  return true;
}

/* ---------------------------------------------------------
   Documento nuevo
   --------------------------------------------------------- */
function documentoNuevo(tipo = "factura") {
  const n = datos.negocio;
  const fecha = hoyISO();
  return {
    id: null,
    tipo,
    numero: formatearNumero(tipo, datos.contadores[tipo]),
    fecha,
    vence: tipo === "factura" ? sumarDias(fecha, n.dias) : "",
    moneda: n.moneda,
    estado: tipo === "recibo" ? "pagada" : "pendiente",
    cliente: { nombre: "", cedula: "", correo: "", telefono: "", direccion: "" },
    items: [{ descripcion: "", cantidad: 1, precio: 0, iva: true }],
    descuento: 0,
    descuentoTipo: "%",
    ivaPorcentaje: n.iva,
    envio: 0,
    pagado: 0,
    notas: "",
    terminos: n.terminos
  };
}

function empezarNuevo(tipo = "factura", cliente = null) {
  doc = documentoNuevo(tipo);
  if (cliente) doc.cliente = Object.assign({}, cliente);
  editandoId = null;
  pasarDocAFormulario();
  $("#titulo-editor").textContent = "Nuevo documento";
  ocultarMensajeForm();
}

/* ---------------------------------------------------------
   Formulario <-> objeto doc
   --------------------------------------------------------- */
function pasarDocAFormulario() {
  document.querySelector(`input[name="tipo"][value="${doc.tipo}"]`).checked = true;
  $("#doc-numero").value = doc.numero;
  $("#doc-fecha").value = doc.fecha;
  $("#doc-vence").value = doc.vence;
  $("#doc-moneda").value = doc.moneda;
  $("#doc-estado").value = doc.estado;

  $("#doc-cliente-guardado").value = "";
  $("#cli-nombre").value = doc.cliente.nombre;
  $("#cli-cedula").value = doc.cliente.cedula;
  $("#cli-correo").value = doc.cliente.correo;
  $("#cli-telefono").value = doc.cliente.telefono;
  $("#cli-direccion").value = doc.cliente.direccion;

  $("#doc-descuento").value = doc.descuento;
  $("#doc-descuento-tipo").value = doc.descuentoTipo;
  $("#doc-iva").value = doc.ivaPorcentaje;
  $("#doc-envio").value = doc.envio;
  $("#doc-pagado").value = doc.pagado;
  $("#doc-notas").value = doc.notas;
  $("#doc-terminos").value = doc.terminos;

  limpiarErroresForm();
  ajustarCamposPorTipo();
  pintarItems();
  pintarHoja();
}

function leerFormulario() {
  doc.tipo = document.querySelector('input[name="tipo"]:checked').value;
  doc.numero = $("#doc-numero").value.trim();
  doc.fecha = $("#doc-fecha").value;
  doc.vence = $("#doc-vence").value;
  doc.moneda = $("#doc-moneda").value;
  doc.estado = $("#doc-estado").value;
  doc.cliente = {
    nombre: $("#cli-nombre").value.trim(),
    cedula: $("#cli-cedula").value.trim(),
    correo: $("#cli-correo").value.trim(),
    telefono: $("#cli-telefono").value.trim(),
    direccion: $("#cli-direccion").value.trim()
  };
  doc.descuento = Number($("#doc-descuento").value) || 0;
  doc.descuentoTipo = $("#doc-descuento-tipo").value;
  doc.ivaPorcentaje = Number($("#doc-iva").value) || 0;
  doc.envio = Number($("#doc-envio").value) || 0;
  doc.pagado = Number($("#doc-pagado").value) || 0;
  doc.notas = $("#doc-notas").value.trim();
  doc.terminos = $("#doc-terminos").value.trim();
  // los items se actualizan directamente al escribir en cada línea
}

// La cotización no lleva "vence" sino "válida hasta"; el recibo no lleva saldo pendiente
function ajustarCamposPorTipo() {
  const etiquetaVence = $("#campo-vence").firstChild;
  etiquetaVence.textContent = doc.tipo === "cotizacion" ? "Válida hasta" : "Vence";
  $("#campo-vence").hidden = doc.tipo === "recibo";
  $("#campo-pagado").hidden = doc.tipo !== "factura";
}

/* ---------------------------------------------------------
   Líneas de productos
   --------------------------------------------------------- */
function pintarItems() {
  const lista = $("#lista-items");
  lista.innerHTML = "";

  doc.items.forEach((item, indice) => {
    const fila = document.createElement("div");
    fila.className = "item";
    fila.dataset.indice = indice;
    fila.innerHTML = `
      <label class="item__desc"><span class="solo-lector">Descripción</span>
        <input type="text" data-campo="descripcion" placeholder="Producto o servicio" value="${escaparHTML(item.descripcion)}">
      </label>
      <label><span class="solo-lector">Cantidad</span>
        <input type="number" data-campo="cantidad" min="0" step="any" value="${item.cantidad}">
      </label>
      <label><span class="solo-lector">Precio unitario</span>
        <input type="number" data-campo="precio" min="0" step="any" value="${item.precio}">
      </label>
      <label class="item__iva" title="Aplica IVA"><span class="solo-lector">Aplica IVA</span>
        <input type="checkbox" data-campo="iva" ${item.iva ? "checked" : ""}>
      </label>
      <button type="button" class="item__quitar" data-accion="quitar" aria-label="Quitar línea ${indice + 1}" ${doc.items.length === 1 ? "disabled" : ""}>×</button>
    `;
    lista.appendChild(fila);
  });
}

function agregarItem() {
  doc.items.push({ descripcion: "", cantidad: 1, precio: 0, iva: true });
  pintarItems();
  pintarHoja();
  const entradas = document.querySelectorAll('#lista-items [data-campo="descripcion"]');
  entradas[entradas.length - 1].focus();
}

/* ---------------------------------------------------------
   Vista previa (la hoja del documento)
   --------------------------------------------------------- */
function pintarHoja() {
  const n = datos.negocio;
  const t = calcularTotales(doc);
  const m = doc.moneda;
  const estado = estadoVisible(doc);
  const hoja = $("#hoja");

  hoja.className = "hoja hoja--" + n.plantilla;
  hoja.style.setProperty("--color-doc", n.color);

  const sello = { pagada: "Pagada", anulada: "Anulada", vencida: "Vencida" }[estado];

  const filasItems = doc.items
    .filter((item) => item.descripcion || Number(item.precio))
    .map((item) => `
      <tr>
        <td>${escaparHTML(item.descripcion) || "—"}${item.iva ? "" : ' <span class="exento">(exento)</span>'}</td>
        <td class="num">${Number(item.cantidad || 0)}</td>
        <td class="num">${formatearDinero(item.precio, m)}</td>
        <td class="num">${formatearDinero(item.cantidad * item.precio, m)}</td>
      </tr>`)
    .join("") || `<tr><td colspan="4" class="vacio">Agrega productos o servicios para verlos aquí.</td></tr>`;

  const datosNegocio = [n.cedula && "Cédula " + n.cedula, n.telefono, n.correo, n.web, n.direccion]
    .filter(Boolean).map(escaparHTML).join("<br>");

  const datosCliente = [doc.cliente.cedula && "Cédula " + doc.cliente.cedula, doc.cliente.telefono,
    doc.cliente.correo, doc.cliente.direccion].filter(Boolean).map(escaparHTML).join("<br>");

  const etiquetaVence = doc.tipo === "cotizacion" ? "Válida hasta" : "Vence";

  hoja.innerHTML = `
    <header class="hoja__cabeza">
      <div class="hoja__negocio">
        ${n.logo ? `<img class="hoja__logo" src="${n.logo}" alt="Logo de ${escaparHTML(n.nombre)}">` : ""}
        <div>
          <p class="hoja__nombre">${escaparHTML(n.nombre) || "Nombre de tu negocio"}</p>
          <p class="hoja__datos">${datosNegocio || "Completa tus datos en Mi negocio"}</p>
        </div>
      </div>
      <div class="hoja__titulo">
        <p class="hoja__tipo">${TIPOS[doc.tipo].nombre}</p>
        <p class="hoja__numero">${escaparHTML(doc.numero)}</p>
      </div>
    </header>

    <div class="hoja__info">
      <div>
        <p class="hoja__etiqueta">${doc.tipo === "recibo" ? "Recibido de" : "Para"}</p>
        <p class="hoja__cliente">${escaparHTML(doc.cliente.nombre) || "Nombre del cliente"}</p>
        <p class="hoja__datos">${datosCliente}</p>
      </div>
      <dl class="hoja__fechas">
        <dt>Fecha</dt><dd>${formatearFecha(doc.fecha)}</dd>
        ${doc.vence && doc.tipo !== "recibo" ? `<dt>${etiquetaVence}</dt><dd>${formatearFecha(doc.vence)}</dd>` : ""}
      </dl>
    </div>

    <table class="hoja__tabla">
      <thead>
        <tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr>
      </thead>
      <tbody>${filasItems}</tbody>
    </table>

    <div class="hoja__cierre">
    ${sello ? `<div class="sello sello--${estado}" aria-label="Estado: ${sello}">${sello}</div>` : ""}
    <dl class="hoja__totales">
      <dt>Subtotal</dt><dd>${formatearDinero(t.subtotal, m)}</dd>
      ${t.descuento ? `<dt>Descuento${doc.descuentoTipo === "%" ? " (" + doc.descuento + "%)" : ""}</dt><dd>− ${formatearDinero(t.descuento, m)}</dd>` : ""}
      ${doc.ivaPorcentaje ? `<dt>IVA (${doc.ivaPorcentaje}%)</dt><dd>${formatearDinero(t.iva, m)}</dd>` : ""}
      ${t.envio ? `<dt>Envío u otros</dt><dd>${formatearDinero(t.envio, m)}</dd>` : ""}
      <dt class="hoja__total">Total</dt><dd class="hoja__total">${formatearDinero(t.total, m)}</dd>
      ${doc.tipo === "factura" && t.pagado && estado !== "pagada" ? `<dt>Pagado</dt><dd>− ${formatearDinero(t.pagado, m)}</dd><dt class="hoja__saldo">Saldo</dt><dd class="hoja__saldo">${formatearDinero(t.saldo, m)}</dd>` : ""}
    </dl>
    </div>

    ${doc.notas ? `<div class="hoja__bloque"><p class="hoja__etiqueta">Notas</p><p>${escaparHTML(doc.notas)}</p></div>` : ""}
    ${doc.terminos ? `<div class="hoja__bloque"><p class="hoja__etiqueta">Términos y forma de pago</p><p>${escaparHTML(doc.terminos)}</p></div>` : ""}

    ${n.firma ? `<div class="hoja__firma"><img src="${n.firma}" alt="Firma"><p>${escaparHTML(n.nombre)}</p></div>` : ""}
  `;
}

/* ---------------------------------------------------------
   Validación y guardado del documento
   --------------------------------------------------------- */
function marcarError(campo, mensaje) {
  campo.classList.add("con-error");
  campo.setAttribute("aria-invalid", "true");
  let texto = campo.parentElement.querySelector(".error");
  if (!texto) {
    texto = document.createElement("span");
    texto.className = "error";
    campo.closest(".campo, .item")?.appendChild(texto);
  }
  texto.textContent = mensaje;
}

function limpiarErroresForm() {
  document.querySelectorAll("#form-doc .con-error").forEach((campo) => {
    campo.classList.remove("con-error");
    campo.removeAttribute("aria-invalid");
  });
  document.querySelectorAll("#form-doc .error").forEach((texto) => texto.remove());
}

function validarDocumento() {
  limpiarErroresForm();
  const errores = [];

  if (!doc.numero) {
    marcarError($("#doc-numero"), "Escribe un número.");
    errores.push("número");
  } else {
    const repetido = datos.documentos.some((d) =>
      d.tipo === doc.tipo && d.numero === doc.numero && d.id !== editandoId);
    if (repetido) {
      marcarError($("#doc-numero"), "Ya tienes un documento con este número.");
      errores.push("número");
    }
  }

  if (!doc.fecha) {
    marcarError($("#doc-fecha"), "Elige la fecha.");
    errores.push("fecha");
  }
  if (doc.vence && doc.fecha && doc.vence < doc.fecha && doc.tipo !== "recibo") {
    marcarError($("#doc-vence"), "Debe ser igual o posterior a la fecha.");
    errores.push("vencimiento");
  }

  if (doc.cliente.nombre.length < 2) {
    marcarError($("#cli-nombre"), "Escribe el nombre del cliente.");
    errores.push("cliente");
  }
  if (doc.cliente.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(doc.cliente.correo)) {
    marcarError($("#cli-correo"), "Revisa el correo, por ejemplo ana@correo.com.");
    errores.push("correo");
  }

  const lineasValidas = doc.items.filter((item) => item.descripcion.trim() && Number(item.cantidad) > 0);
  if (lineasValidas.length === 0) {
    const primera = document.querySelector('#lista-items [data-campo="descripcion"]');
    marcarError(primera, "Agrega al menos un producto con su cantidad.");
    errores.push("productos");
  }

  return errores;
}

function guardarDocumento(evento) {
  evento.preventDefault();
  leerFormulario();
  const errores = validarDocumento();

  if (errores.length) {
    mostrarMensajeForm("Revisa: " + [...new Set(errores)].join(", ") + ".");
    document.querySelector("#form-doc .con-error")?.focus();
    return;
  }

  // Se descartan las líneas vacías
  doc.items = doc.items.filter((item) => item.descripcion.trim() && Number(item.cantidad) > 0);

  if ($("#cli-guardar").checked) guardarCliente(doc.cliente);

  const copia = JSON.parse(JSON.stringify(doc));
  if (editandoId) {
    const indice = datos.documentos.findIndex((d) => d.id === editandoId);
    datos.documentos[indice] = copia;
  } else {
    copia.id = crearId();
    copia.creado = new Date().toISOString();
    datos.documentos.unshift(copia);
    // Si se usó el número sugerido, el siguiente documento usa el próximo
    if (copia.numero === formatearNumero(copia.tipo, datos.contadores[copia.tipo])) {
      datos.contadores[copia.tipo]++;
    }
    editandoId = copia.id;
    doc.id = copia.id;
  }

  if (guardarTodo()) {
    ocultarMensajeForm();
    $("#titulo-editor").textContent = TIPOS[doc.tipo].nombre + " " + doc.numero;
    pintarItems();
    pintarHoja();
    avisar(TIPOS[doc.tipo].nombre + " " + doc.numero + " guardada.");
  }
}

function mostrarMensajeForm(texto) {
  const mensaje = $("#mensaje-form");
  mensaje.textContent = texto;
  mensaje.hidden = false;
}
function ocultarMensajeForm() {
  $("#mensaje-form").hidden = true;
}

/* ---------------------------------------------------------
   Clientes
   --------------------------------------------------------- */
function guardarCliente(cliente) {
  if (!cliente.nombre) return;
  const existente = datos.clientes.find((c) =>
    c.nombre.toLowerCase() === cliente.nombre.toLowerCase());
  if (existente) {
    Object.assign(existente, cliente);
  } else {
    datos.clientes.push(Object.assign({ id: crearId() }, cliente));
  }
  datos.clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  cargarSelectClientes();
}

function cargarSelectClientes() {
  const select = $("#doc-cliente-guardado");
  select.innerHTML = '<option value="">Escribir uno nuevo</option>';
  for (const cliente of datos.clientes) {
    const opcion = document.createElement("option");
    opcion.value = cliente.id;
    opcion.textContent = cliente.nombre;
    select.appendChild(opcion);
  }
}

function usarClienteGuardado() {
  const cliente = datos.clientes.find((c) => c.id === $("#doc-cliente-guardado").value);
  if (!cliente) return;
  $("#cli-nombre").value = cliente.nombre;
  $("#cli-cedula").value = cliente.cedula || "";
  $("#cli-correo").value = cliente.correo || "";
  $("#cli-telefono").value = cliente.telefono || "";
  $("#cli-direccion").value = cliente.direccion || "";
  leerFormulario();
  pintarHoja();
}

function pintarClientes() {
  const lista = $("#lista-clientes");
  lista.innerHTML = "";

  if (datos.clientes.length === 0) {
    lista.innerHTML = `<div class="vacio-grande"><p>Todavía no tienes clientes guardados.</p>
      <button type="button" class="btn btn--principal" data-ir="editor">Hacer mi primera factura</button></div>`;
    return;
  }

  for (const cliente of datos.clientes) {
    const docsCliente = datos.documentos.filter((d) => d.cliente.nombre === cliente.nombre);
    const pendiente = docsCliente
      .filter((d) => d.tipo === "factura" && ["pendiente", "vencida"].includes(estadoVisible(d)))
      .reduce((suma, d) => suma + calcularTotales(d).saldo, 0);

    const tarjeta = document.createElement("article");
    tarjeta.className = "cliente";
    tarjeta.innerHTML = `
      <h2>${escaparHTML(cliente.nombre)}</h2>
      <p>${[cliente.cedula && "Cédula " + cliente.cedula, cliente.telefono, cliente.correo]
        .filter(Boolean).map(escaparHTML).join("<br>") || "Sin datos de contacto"}</p>
      <p class="cliente__cifras">${docsCliente.length} documento(s)${pendiente ? " · por cobrar " + formatearDinero(pendiente, datos.negocio.moneda) : ""}</p>
      <div class="cliente__acciones">
        <button type="button" class="btn btn--linea" data-facturar="${cliente.id}">Nueva factura</button>
        <button type="button" class="btn btn--texto" data-borrar-cliente="${cliente.id}">Borrar</button>
      </div>`;
    lista.appendChild(tarjeta);
  }
}

/* ---------------------------------------------------------
   Lista de documentos
   --------------------------------------------------------- */
function pintarResumen() {
  const moneda = datos.negocio.moneda;
  const facturas = datos.documentos.filter((d) => d.tipo === "factura" && d.estado !== "anulada" && d.moneda === moneda);

  let facturado = 0, cobrado = 0, porCobrar = 0, vencido = 0;
  for (const factura of facturas) {
    const t = calcularTotales(factura);
    facturado += t.total;
    cobrado += t.pagado;
    porCobrar += t.saldo;
    if (estadoVisible(factura) === "vencida") vencido += t.saldo;
  }
  const cotizaciones = datos.documentos.filter((d) => d.tipo === "cotizacion" && d.estado === "pendiente").length;

  $("#resumen").innerHTML = `
    <div class="cifra"><span>Facturado</span><strong>${formatearDinero(facturado, moneda)}</strong></div>
    <div class="cifra"><span>Cobrado</span><strong>${formatearDinero(cobrado, moneda)}</strong></div>
    <div class="cifra cifra--alerta"><span>Por cobrar</span><strong>${formatearDinero(porCobrar, moneda)}</strong>
      ${vencido ? `<small>${formatearDinero(vencido, moneda)} vencido</small>` : ""}</div>
    <div class="cifra"><span>Cotizaciones abiertas</span><strong>${cotizaciones}</strong></div>`;
}

function pintarDocumentos() {
  pintarResumen();
  const texto = $("#buscar-doc").value.trim().toLowerCase();
  const tipo = $("#filtro-tipo").value;
  const estado = $("#filtro-estado").value;

  const lista = datos.documentos.filter((d) => {
    const coincideTexto = !texto ||
      d.numero.toLowerCase().includes(texto) ||
      d.cliente.nombre.toLowerCase().includes(texto);
    const coincideTipo = !tipo || d.tipo === tipo;
    const coincideEstado = !estado || estadoVisible(d) === estado;
    return coincideTexto && coincideTipo && coincideEstado;
  });

  const contenedor = $("#lista-docs");

  if (datos.documentos.length === 0) {
    contenedor.innerHTML = `<div class="vacio-grande"><p>Aquí aparecerán tus facturas, cotizaciones y recibos.</p>
      <button type="button" class="btn btn--principal" data-ir="editor">Crear el primero</button></div>`;
    return;
  }
  if (lista.length === 0) {
    contenedor.innerHTML = `<div class="vacio-grande"><p>Ningún documento coincide con la búsqueda.</p>
      <button type="button" class="btn btn--linea" id="btn-limpiar-filtros">Quitar filtros</button></div>`;
    return;
  }

  contenedor.innerHTML = `
    <table>
      <thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th class="num">Total</th><th>Estado</th><th><span class="solo-lector">Acciones</span></th></tr></thead>
      <tbody>${lista.map((d) => {
        const est = estadoVisible(d);
        return `<tr>
          <td data-etiqueta="Número"><strong>${escaparHTML(d.numero)}</strong><br><small>${TIPOS[d.tipo].nombre}</small></td>
          <td data-etiqueta="Cliente">${escaparHTML(d.cliente.nombre)}</td>
          <td data-etiqueta="Fecha">${formatearFecha(d.fecha)}</td>
          <td data-etiqueta="Total" class="num">${formatearDinero(calcularTotales(d).total, d.moneda)}</td>
          <td data-etiqueta="Estado"><span class="estado estado--${est}">${ESTADOS[est]}</span></td>
          <td class="acciones">
            <button type="button" class="btn btn--texto" data-abrir="${d.id}">Abrir</button>
            ${d.tipo === "factura" && ["pendiente", "vencida"].includes(est) ? `<button type="button" class="btn btn--texto" data-pagar="${d.id}">Marcar pagada</button>` : ""}
            ${d.tipo === "cotizacion" && d.estado !== "anulada" ? `<button type="button" class="btn btn--texto" data-convertir="${d.id}">Convertir en factura</button>` : ""}
            <button type="button" class="btn btn--texto" data-duplicar="${d.id}">Duplicar</button>
            <button type="button" class="btn btn--texto btn--peligro" data-borrar="${d.id}">Borrar</button>
          </td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
}

function buscarDoc(id) {
  return datos.documentos.find((d) => d.id === id);
}

function abrirDocumento(id) {
  doc = JSON.parse(JSON.stringify(buscarDoc(id)));
  editandoId = id;
  pasarDocAFormulario();
  $("#titulo-editor").textContent = TIPOS[doc.tipo].nombre + " " + doc.numero;
  mostrarVista("editor");
}

function copiarComoNuevo(id, tipoNuevo) {
  const original = buscarDoc(id);
  const tipo = tipoNuevo || original.tipo;
  doc = JSON.parse(JSON.stringify(original));
  doc.id = null;
  doc.tipo = tipo;
  doc.numero = formatearNumero(tipo, datos.contadores[tipo]);
  doc.fecha = hoyISO();
  doc.vence = tipo === "factura" ? sumarDias(doc.fecha, datos.negocio.dias) : "";
  doc.estado = tipo === "recibo" ? "pagada" : "pendiente";
  doc.pagado = 0;
  editandoId = null;
  pasarDocAFormulario();
  $("#titulo-editor").textContent = tipoNuevo ? "Factura desde cotización " + original.numero : "Copia de " + original.numero;
  mostrarVista("editor");
  avisar("Revisa los datos y presiona Guardar documento.");
}

/* ---------------------------------------------------------
   Compartir e imprimir
   --------------------------------------------------------- */
function textoParaCompartir() {
  const t = calcularTotales(doc);
  const negocio = datos.negocio.nombre || "nuestro negocio";
  let texto = `Hola ${doc.cliente.nombre || ""}, le envío la ${TIPOS[doc.tipo].nombre.toLowerCase()} ${doc.numero} de ${negocio} por ${formatearDinero(t.total, doc.moneda)}.`;
  if (doc.tipo === "factura" && doc.vence) texto += ` Fecha de pago: ${formatearFecha(doc.vence)}.`;
  if (doc.terminos) texto += `\n${doc.terminos}`;
  return texto;
}

function compartirWhatsApp() {
  leerFormulario();
  let telefono = doc.cliente.telefono.replace(/\D/g, "");
  if (telefono.length === 8) telefono = "506" + telefono; // número de Costa Rica sin código
  const url = "https://wa.me/" + telefono + "?text=" + encodeURIComponent(textoParaCompartir() + "\n(Adjunto el PDF.)");
  window.open(url, "_blank", "noopener");
}

function compartirCorreo() {
  leerFormulario();
  const asunto = `${TIPOS[doc.tipo].nombre} ${doc.numero} - ${datos.negocio.nombre}`;
  window.location.href = `mailto:${encodeURIComponent(doc.cliente.correo)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoParaCompartir() + "\n\nAdjunto el PDF.")}`;
}

function imprimir() {
  leerFormulario();
  pintarHoja();
  const tituloOriginal = document.title;
  // El nombre sugerido del PDF sale del título de la página
  document.title = `${TIPOS[doc.tipo].nombre} ${doc.numero} ${doc.cliente.nombre}`.trim();
  window.print();
  document.title = tituloOriginal;
}

/* ---------------------------------------------------------
   Mi negocio
   --------------------------------------------------------- */
function cargarFormNegocio() {
  const n = datos.negocio;
  $("#neg-nombre").value = n.nombre;
  $("#neg-cedula").value = n.cedula;
  $("#neg-telefono").value = n.telefono;
  $("#neg-correo").value = n.correo;
  $("#neg-web").value = n.web;
  $("#neg-direccion").value = n.direccion;
  $("#neg-moneda").value = n.moneda;
  $("#neg-iva").value = n.iva;
  $("#neg-dias").value = n.dias;
  $("#neg-terminos").value = n.terminos;
  document.querySelector(`input[name="plantilla"][value="${n.plantilla}"]`).checked = true;
  pintarColores();
  pintarLogo();
  cargarFirma();
  $("#mensaje-negocio").hidden = true;
}

function pintarColores() {
  const contenedor = $("#colores");
  contenedor.innerHTML = "";
  for (const color of COLORES) {
    const etiqueta = document.createElement("label");
    etiqueta.className = "color";
    etiqueta.style.setProperty("--muestra", color);
    etiqueta.innerHTML = `<input type="radio" name="color" value="${color}" ${color === datos.negocio.color ? "checked" : ""}><span class="solo-lector">Color ${color}</span>`;
    contenedor.appendChild(etiqueta);
  }
}

function pintarLogo() {
  const vista = $("#logo-vista");
  vista.innerHTML = datos.negocio.logo ? `<img src="${datos.negocio.logo}" alt="Logo actual">` : "Sin logo";
}

// Reduce el logo a máximo 400 px para que quepa en el almacenamiento del navegador
function subirLogo(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  if (!archivo.type.startsWith("image/")) {
    avisar("Elige un archivo de imagen (PNG o JPG).");
    return;
  }
  const lector = new FileReader();
  lector.onload = () => {
    const imagen = new Image();
    imagen.onload = () => {
      const escala = Math.min(1, 400 / Math.max(imagen.width, imagen.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(imagen.width * escala);
      lienzo.height = Math.round(imagen.height * escala);
      lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      datos.negocio.logo = lienzo.toDataURL("image/png");
      if (guardarTodo()) {
        pintarLogo();
        pintarHoja();
        avisar("Logo guardado.");
      }
    };
    imagen.src = lector.result;
  };
  lector.readAsDataURL(archivo);
  evento.target.value = "";
}

function guardarNegocio(evento) {
  evento.preventDefault();
  const nombre = $("#neg-nombre");
  nombre.classList.remove("con-error");
  if (nombre.value.trim().length < 2) {
    nombre.classList.add("con-error");
    const mensaje = $("#mensaje-negocio");
    mensaje.textContent = "Escribe el nombre de tu negocio.";
    mensaje.className = "aviso";
    mensaje.hidden = false;
    nombre.focus();
    return;
  }

  Object.assign(datos.negocio, {
    nombre: nombre.value.trim(),
    cedula: $("#neg-cedula").value.trim(),
    telefono: $("#neg-telefono").value.trim(),
    correo: $("#neg-correo").value.trim(),
    web: $("#neg-web").value.trim(),
    direccion: $("#neg-direccion").value.trim(),
    moneda: $("#neg-moneda").value,
    iva: Number($("#neg-iva").value) || 0,
    dias: Number($("#neg-dias").value) || 0,
    terminos: $("#neg-terminos").value.trim(),
    plantilla: document.querySelector('input[name="plantilla"]:checked').value,
    color: document.querySelector('input[name="color"]:checked')?.value || COLORES[0],
    firma: lienzoFirmaVacio ? "" : $("#firma").toDataURL("image/png")
  });

  if (guardarTodo()) {
    const mensaje = $("#mensaje-negocio");
    mensaje.textContent = "Datos guardados. Ya aparecen en tus documentos.";
    mensaje.className = "aviso aviso--ok";
    mensaje.hidden = false;
    if (doc && !editandoId) {
      // un documento nuevo sin guardar toma los nuevos valores por defecto
      doc.terminos = doc.terminos || datos.negocio.terminos;
    }
    pintarHoja();
    avisar("Datos del negocio guardados.");
  }
}

/* ---------------------------------------------------------
   Firma con el dedo o el mouse
   --------------------------------------------------------- */
let lienzoFirmaVacio = true;

function prepararFirma() {
  const lienzo = $("#firma");
  const ctx = lienzo.getContext("2d");
  let dibujando = false;

  function punto(evento) {
    const caja = lienzo.getBoundingClientRect();
    return {
      x: (evento.clientX - caja.left) * (lienzo.width / caja.width),
      y: (evento.clientY - caja.top) * (lienzo.height / caja.height)
    };
  }

  lienzo.addEventListener("pointerdown", (evento) => {
    dibujando = true;
    lienzo.setPointerCapture(evento.pointerId);
    const p = punto(evento);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  lienzo.addEventListener("pointermove", (evento) => {
    if (!dibujando) return;
    const p = punto(evento);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a2350";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lienzoFirmaVacio = false;
  });
  ["pointerup", "pointercancel"].forEach((tipo) =>
    lienzo.addEventListener(tipo, () => { dibujando = false; }));
}

function cargarFirma() {
  const lienzo = $("#firma");
  const ctx = lienzo.getContext("2d");
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  lienzoFirmaVacio = true;
  if (datos.negocio.firma) {
    const imagen = new Image();
    imagen.onload = () => ctx.drawImage(imagen, 0, 0);
    imagen.src = datos.negocio.firma;
    lienzoFirmaVacio = false;
  }
}

/* ---------------------------------------------------------
   Copia de seguridad
   --------------------------------------------------------- */
function exportarDatos() {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `talonario-copia-${hoyISO()}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  avisar("Copia descargada.");
}

function importarDatos(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const nuevos = JSON.parse(lector.result);
      if (!nuevos.negocio || !Array.isArray(nuevos.documentos)) throw new Error("formato");
      if (!confirm("Esto reemplaza todos los datos actuales por los de la copia. ¿Continuar?")) return;
      localStorage.setItem(CLAVE_DATOS, JSON.stringify(nuevos));
      datos = cargarDatos();
      cargarSelectClientes();
      cargarFormNegocio();
      empezarNuevo();
      avisar("Copia restaurada.");
    } catch (error) {
      avisar("Ese archivo no es una copia de Talonario.");
    }
  };
  lector.readAsText(archivo);
  evento.target.value = "";
}

/* ---------------------------------------------------------
   Eventos
   --------------------------------------------------------- */
function registrarEventos() {
  // Navegación
  document.querySelectorAll(".nav-btn").forEach((boton) =>
    boton.addEventListener("click", () => {
      if (boton.dataset.vista === "editor" && editandoId) empezarNuevo();
      mostrarVista(boton.dataset.vista);
    }));

  // Botones "ir a" dentro de estados vacíos
  document.addEventListener("click", (evento) => {
    const ir = evento.target.closest("[data-ir]");
    if (ir) { empezarNuevo(); mostrarVista(ir.dataset.ir); }
  });

  // Editor: cualquier cambio actualiza la vista previa
  const form = $("#form-doc");
  form.addEventListener("input", (evento) => {
    const fila = evento.target.closest(".item");
    if (fila) {
      const item = doc.items[Number(fila.dataset.indice)];
      const campo = evento.target.dataset.campo;
      item[campo] = campo === "iva" ? evento.target.checked
        : campo === "descripcion" ? evento.target.value
        : Number(evento.target.value) || 0;
    }
    if (evento.target.classList.contains("con-error")) {
      evento.target.classList.remove("con-error");
      evento.target.closest(".campo, .item")?.querySelector(".error")?.remove();
    }
    leerFormulario();
    pintarHoja();
  });
  form.addEventListener("change", (evento) => {
    if (evento.target.name === "tipo") {
      const tipo = evento.target.value;
      leerFormulario();
      if (!editandoId) {
        doc.numero = formatearNumero(tipo, datos.contadores[tipo]);
        $("#doc-numero").value = doc.numero;
        doc.estado = tipo === "recibo" ? "pagada" : "pendiente";
        $("#doc-estado").value = doc.estado;
        if (tipo === "factura" && !doc.vence) {
          doc.vence = sumarDias(doc.fecha, datos.negocio.dias);
          $("#doc-vence").value = doc.vence;
        }
      }
      ajustarCamposPorTipo();
      pintarHoja();
    }
  });
  form.addEventListener("submit", guardarDocumento);

  $("#lista-items").addEventListener("click", (evento) => {
    const boton = evento.target.closest('[data-accion="quitar"]');
    if (!boton) return;
    doc.items.splice(Number(boton.closest(".item").dataset.indice), 1);
    pintarItems();
    pintarHoja();
  });
  $("#btn-agregar-item").addEventListener("click", agregarItem);
  $("#doc-cliente-guardado").addEventListener("change", usarClienteGuardado);
  $("#btn-nuevo").addEventListener("click", () => { empezarNuevo(); avisar("Documento nuevo listo."); });

  $("#btn-imprimir").addEventListener("click", imprimir);
  $("#btn-whatsapp").addEventListener("click", compartirWhatsApp);
  $("#btn-correo").addEventListener("click", compartirCorreo);

  // Documentos
  ["#buscar-doc", "#filtro-tipo", "#filtro-estado"].forEach((selector) =>
    $(selector).addEventListener("input", pintarDocumentos));

  $("#lista-docs").addEventListener("click", (evento) => {
    const b = evento.target.closest("button");
    if (!b) return;
    if (b.id === "btn-limpiar-filtros") {
      $("#buscar-doc").value = ""; $("#filtro-tipo").value = ""; $("#filtro-estado").value = "";
      pintarDocumentos();
    } else if (b.dataset.abrir) {
      abrirDocumento(b.dataset.abrir);
    } else if (b.dataset.pagar) {
      buscarDoc(b.dataset.pagar).estado = "pagada";
      if (guardarTodo()) { pintarDocumentos(); avisar("Factura marcada como pagada."); }
    } else if (b.dataset.convertir) {
      copiarComoNuevo(b.dataset.convertir, "factura");
    } else if (b.dataset.duplicar) {
      copiarComoNuevo(b.dataset.duplicar);
    } else if (b.dataset.borrar) {
      const d = buscarDoc(b.dataset.borrar);
      if (!confirm(`¿Borrar ${TIPOS[d.tipo].nombre.toLowerCase()} ${d.numero}? No se puede deshacer.`)) return;
      datos.documentos = datos.documentos.filter((x) => x.id !== d.id);
      if (editandoId === d.id) empezarNuevo();
      if (guardarTodo()) { pintarDocumentos(); avisar("Documento borrado."); }
    }
  });

  // Clientes
  $("#lista-clientes").addEventListener("click", (evento) => {
    const b = evento.target.closest("button");
    if (!b) return;
    if (b.dataset.facturar) {
      const cliente = datos.clientes.find((c) => c.id === b.dataset.facturar);
      empezarNuevo("factura", cliente);
      mostrarVista("editor");
    } else if (b.dataset.borrarCliente) {
      const cliente = datos.clientes.find((c) => c.id === b.dataset.borrarCliente);
      if (!confirm(`¿Borrar a ${cliente.nombre} de tus clientes? Sus documentos no se borran.`)) return;
      datos.clientes = datos.clientes.filter((c) => c.id !== cliente.id);
      if (guardarTodo()) { cargarSelectClientes(); pintarClientes(); avisar("Cliente borrado."); }
    }
  });

  // Mi negocio
  $("#form-negocio").addEventListener("submit", guardarNegocio);
  $("#neg-logo").addEventListener("change", subirLogo);
  $("#btn-quitar-logo").addEventListener("click", () => {
    datos.negocio.logo = "";
    if (guardarTodo()) { pintarLogo(); pintarHoja(); avisar("Logo quitado."); }
  });
  $("#btn-borrar-firma").addEventListener("click", () => {
    const lienzo = $("#firma");
    lienzo.getContext("2d").clearRect(0, 0, lienzo.width, lienzo.height);
    lienzoFirmaVacio = true;
  });
  $("#btn-exportar").addEventListener("click", exportarDatos);
  $("#archivo-importar").addEventListener("change", importarDatos);
}

/* ---------------------------------------------------------
   Inicio
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  registrarEventos();
  prepararFirma();
  cargarSelectClientes();
  empezarNuevo();
  // La primera vez se pide completar los datos del negocio
  mostrarVista(datos.negocio.nombre ? "editor" : "negocio");
});
