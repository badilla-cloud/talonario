# Talonario

Aplicación web para crear **facturas, cotizaciones y recibos**, guardarlos y descargarlos en PDF.

## Funciones
- Facturas, cotizaciones y recibos con numeración automática (F-0001, C-0001, R-0001).
- Datos del negocio, logo y firma que aparecen en todos los documentos.
- Clientes guardados para reutilizarlos.
- Productos con cantidad, precio e IVA por línea (se puede marcar como exento).
- Descuento en % o monto, IVA configurable, envío y adelantos.
- Colones (₡) o dólares ($).
- Vista previa en vivo con 3 plantillas y 6 colores.
- Descarga en PDF y envío del PDF por WhatsApp o correo (en el celular se adjunta directo).
- Inventario: productos con precio, stock, categoría y aviso de stock bajo. Al escribir un producto en una factura, el precio se llena solo.
- Lista de documentos con búsqueda, filtros y estados: pendiente, vencida, pagada y anulada.
- Resumen de lo facturado, cobrado y por cobrar.
- Convertir una cotización en factura y duplicar documentos.
- Copia de seguridad para descargar y restaurar los datos.

## Cómo usarla
1. Abre `index.html` con Live Server o publícala en GitHub Pages.
2. La primera vez completa **Mi negocio**.
3. Crea tu documento en **Nuevo documento** y presiona **Guardar documento**.
4. Presiona **Descargar PDF**, **WhatsApp** o **Correo**. El PDF lo crea la propia app (js/pdfgen.js), sin internet ni librerías externas.

## Importante
- Los datos se guardan en el navegador (localStorage). Descarga una copia de seguridad cada cierto tiempo desde **Mi negocio**.
- Si tu negocio está inscrito en Hacienda, los comprobantes con validez fiscal se emiten como factura electrónica. Usa Talonario para proformas, cotizaciones, recibos y control interno.
