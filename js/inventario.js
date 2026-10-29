/* ==========================================================
   Talonario – inventario
   Lista de productos con precio y stock. El stock se actualiza
   a mano; las facturas no lo descuentan.
   ========================================================== */

let productoEditandoId = null;

// Busca un producto por nombre exacto (sin importar mayúsculas)
function buscarProductoPorNombre(nombre) {
  const buscado = String(nombre).trim().toLowerCase();
  if (!buscado) return null;
  return datos.productos.find((p) => p.nombre.toLowerCase() === buscado) || null;
}

// Un producto tiene stock bajo cuando llega a su mínimo o menos
function stockBajo(producto) {
  return Number(producto.stock) <= Number(producto.minimo || 0);
}

// Llena el <datalist> que sugiere productos al escribir en una factura
function cargarSugerenciasProductos() {
  const lista = $("#lista-productos");
  lista.innerHTML = "";
  for (const producto of datos.productos) {
    const opcion = document.createElement("option");
    opcion.value = producto.nombre;
    opcion.label = formatearDinero(producto.precio, datos.negocio.moneda) + " · stock " + producto.stock;
    lista.appendChild(opcion);
  }
}

// Llena el filtro de categorías sin repetir
function cargarCategorias() {
  const select = $("#filtro-categoria-inv");
  const actual = select.value;
  const categorias = [];
  for (const producto of datos.productos) {
    if (producto.categoria && !categorias.includes(producto.categoria)) categorias.push(producto.categoria);
  }
  categorias.sort((a, b) => a.localeCompare(b, "es"));
  select.innerHTML = '<option value="">Todas</option>' +
    categorias.map((c) => `<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`).join("");
  select.value = categorias.includes(actual) ? actual : "";

  $("#lista-categorias").innerHTML = categorias.map((c) => `<option value="${escaparHTML(c)}"></option>`).join("");
}

// Cifras de arriba: cantidad de productos, unidades, valor y stock bajo
function pintarResumenInventario() {
  const moneda = datos.negocio.moneda;
  let unidades = 0, valor = 0, bajos = 0;
  for (const producto of datos.productos) {
    unidades += Number(producto.stock);
    valor += Number(producto.stock) * Number(producto.precio);
    if (stockBajo(producto)) bajos++;
  }
  $("#resumen-inventario").innerHTML = `
    <div class="cifra"><span>Productos</span><strong>${datos.productos.length}</strong></div>
    <div class="cifra"><span>Unidades en stock</span><strong>${unidades}</strong></div>
    <div class="cifra"><span>Valor a precio de venta</span><strong>${formatearDinero(valor, moneda)}</strong></div>
    <div class="cifra ${bajos ? "cifra--alerta" : ""}"><span>Con stock bajo</span><strong>${bajos}</strong></div>`;
}

// Dibuja la tabla de productos según la búsqueda y los filtros
function pintarInventario() {
  cargarCategorias();
  pintarResumenInventario();

  const texto = $("#buscar-producto").value.trim().toLowerCase();
  const categoria = $("#filtro-categoria-inv").value;
  const soloBajo = $("#filtro-stock-bajo").checked;

  const lista = datos.productos.filter((p) => {
    const coincideTexto = !texto || p.nombre.toLowerCase().includes(texto) ||
      (p.codigo || "").toLowerCase().includes(texto);
    const coincideCategoria = !categoria || p.categoria === categoria;
    const coincideStock = !soloBajo || stockBajo(p);
    return coincideTexto && coincideCategoria && coincideStock;
  });

  const contenedor = $("#lista-productos-inv");

  if (datos.productos.length === 0) {
    contenedor.innerHTML = `<div class="vacio-grande"><p>Agrega tu primer producto con el formulario de arriba.</p></div>`;
    return;
  }
  if (lista.length === 0) {
    contenedor.innerHTML = `<div class="vacio-grande"><p>Ningún producto coincide con la búsqueda.</p>
      <button type="button" class="btn btn--linea" data-inv="limpiar">Quitar filtros</button></div>`;
    return;
  }

  const moneda = datos.negocio.moneda;
  contenedor.innerHTML = `
    <table>
      <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th class="num">Stock</th><th><span class="solo-lector">Acciones</span></th></tr></thead>
      <tbody>${lista.map((p) => `
        <tr class="${stockBajo(p) ? "fila-baja" : ""}">
          <td data-etiqueta="Producto"><strong>${escaparHTML(p.nombre)}</strong>${p.codigo ? `<br><small>${escaparHTML(p.codigo)}</small>` : ""}${p.iva ? "" : ' <small>(exento)</small>'}</td>
          <td data-etiqueta="Categoría">${escaparHTML(p.categoria) || "—"}</td>
          <td data-etiqueta="Precio" class="num">${formatearDinero(p.precio, moneda)}</td>
          <td data-etiqueta="Stock" class="num">
            <span class="stock">
              <button type="button" class="stock__btn" data-inv="restar" data-id="${p.id}" aria-label="Restar 1 a ${escaparHTML(p.nombre)}">−</button>
              <strong class="stock__num">${p.stock}</strong>
              <button type="button" class="stock__btn" data-inv="sumar" data-id="${p.id}" aria-label="Sumar 1 a ${escaparHTML(p.nombre)}">+</button>
            </span>
            ${stockBajo(p) ? `<small class="stock__aviso">Stock bajo (mínimo ${p.minimo})</small>` : ""}
          </td>
          <td class="acciones">
            <button type="button" class="btn btn--texto" data-inv="editar" data-id="${p.id}">Editar</button>
            <button type="button" class="btn btn--texto btn--peligro" data-inv="borrar" data-id="${p.id}">Borrar</button>
          </td>
        </tr>`).join("")}</tbody>
    </table>`;
}

/* ---------- Formulario de producto ---------- */

function limpiarFormProducto() {
  $("#form-producto").reset();
  $("#prod-iva").checked = true;
  $("#prod-minimo").value = 5;
  productoEditandoId = null;
  $("#titulo-form-producto").textContent = "Agregar producto";
  $("#btn-guardar-producto").textContent = "Agregar producto";
  $("#btn-cancelar-producto").hidden = true;
  document.querySelectorAll("#form-producto .con-error").forEach((c) => c.classList.remove("con-error"));
  document.querySelectorAll("#form-producto .error").forEach((e) => e.remove());
}

function editarProducto(id) {
  const p = datos.productos.find((x) => x.id === id);
  productoEditandoId = id;
  $("#prod-nombre").value = p.nombre;
  $("#prod-codigo").value = p.codigo || "";
  $("#prod-categoria").value = p.categoria || "";
  $("#prod-precio").value = p.precio;
  $("#prod-stock").value = p.stock;
  $("#prod-minimo").value = p.minimo || 0;
  $("#prod-iva").checked = p.iva;
  $("#titulo-form-producto").textContent = "Editar " + p.nombre;
  $("#btn-guardar-producto").textContent = "Guardar cambios";
  $("#btn-cancelar-producto").hidden = false;
  $("#form-producto").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#prod-nombre").focus({ preventScroll: true });
}

function errorProducto(campo, mensaje) {
  campo.classList.add("con-error");
  const texto = document.createElement("span");
  texto.className = "error";
  texto.textContent = mensaje;
  campo.closest(".campo").appendChild(texto);
}

// Valida y guarda el producto (nuevo o editado)
function guardarProducto(evento) {
  evento.preventDefault();
  document.querySelectorAll("#form-producto .con-error").forEach((c) => c.classList.remove("con-error"));
  document.querySelectorAll("#form-producto .error").forEach((e) => e.remove());

  const nombre = $("#prod-nombre").value.trim();
  const precio = Number($("#prod-precio").value);
  const stockTexto = $("#prod-stock").value.trim();
  const stock = Number(stockTexto);
  const minimo = Number($("#prod-minimo").value) || 0;
  let valido = true;

  if (nombre.length < 2) {
    errorProducto($("#prod-nombre"), "Escribe el nombre del producto.");
    valido = false;
  } else {
    const repetido = datos.productos.some((p) =>
      p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== productoEditandoId);
    if (repetido) {
      errorProducto($("#prod-nombre"), "Ya tienes un producto con ese nombre.");
      valido = false;
    }
  }
  if ($("#prod-precio").value === "" || precio < 0) {
    errorProducto($("#prod-precio"), "Escribe un precio de 0 o más.");
    valido = false;
  }
  if (stockTexto === "" || !Number.isInteger(stock) || stock < 0) {
    errorProducto($("#prod-stock"), "El stock debe ser un número entero de 0 o más.");
    valido = false;
  }
  if (!valido) {
    document.querySelector("#form-producto .con-error").focus();
    return;
  }

  const producto = {
    nombre,
    codigo: $("#prod-codigo").value.trim(),
    categoria: $("#prod-categoria").value.trim(),
    precio,
    stock,
    minimo,
    iva: $("#prod-iva").checked
  };

  if (productoEditandoId) {
    Object.assign(datos.productos.find((p) => p.id === productoEditandoId), producto);
  } else {
    datos.productos.push(Object.assign({ id: crearId() }, producto));
  }
  datos.productos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  if (guardarTodo()) {
    avisar(productoEditandoId ? "Producto actualizado." : "Producto agregado.");
    limpiarFormProducto();
    cargarSugerenciasProductos();
    pintarInventario();
  }
}

function cambiarStock(id, cambio) {
  const p = datos.productos.find((x) => x.id === id);
  p.stock = Math.max(0, Number(p.stock) + cambio);
  if (guardarTodo()) {
    pintarInventario();
    cargarSugerenciasProductos();
  }
}

function registrarEventosInventario() {
  $("#form-producto").addEventListener("submit", guardarProducto);
  $("#btn-cancelar-producto").addEventListener("click", limpiarFormProducto);

  ["#buscar-producto", "#filtro-categoria-inv", "#filtro-stock-bajo"].forEach((selector) =>
    $(selector).addEventListener("input", pintarInventario));

  $("#lista-productos-inv").addEventListener("click", (evento) => {
    const b = evento.target.closest("button[data-inv]");
    if (!b) return;
    const accion = b.dataset.inv;
    if (accion === "limpiar") {
      $("#buscar-producto").value = "";
      $("#filtro-categoria-inv").value = "";
      $("#filtro-stock-bajo").checked = false;
      pintarInventario();
    } else if (accion === "sumar") {
      cambiarStock(b.dataset.id, 1);
    } else if (accion === "restar") {
      cambiarStock(b.dataset.id, -1);
    } else if (accion === "editar") {
      editarProducto(b.dataset.id);
    } else if (accion === "borrar") {
      const p = datos.productos.find((x) => x.id === b.dataset.id);
      if (!confirm(`¿Borrar ${p.nombre} del inventario?`)) return;
      datos.productos = datos.productos.filter((x) => x.id !== p.id);
      if (productoEditandoId === p.id) limpiarFormProducto();
      if (guardarTodo()) { pintarInventario(); cargarSugerenciasProductos(); avisar("Producto borrado."); }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  registrarEventosInventario();
  limpiarFormProducto();
  cargarSugerenciasProductos();
});
