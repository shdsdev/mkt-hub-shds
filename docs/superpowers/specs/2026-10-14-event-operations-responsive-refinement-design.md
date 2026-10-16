# Refinamiento Responsive De Operaciones De Eventos

## Objetivo

Mejorar la composición visual de las pantallas administrativas de eventos para que el contenido quede centrado, Check-in sea comprensible para operadores de tablet y celular, el Formulario interno tenga una jerarquía clara y la navegación no corte opciones en viewports angostos.

## Alcance

- Centrar los bloques internos de Editar, Check-in, Formulario interno y Resultados.
- Mantener Registros como superficie ancha para la tabla.
- Reorganizar la tarjeta inicial de Check-in para explicar la cámara y el fallback manual.
- Mejorar la jerarquía visual del Formulario interno sin cambiar sus acciones.
- Hacer responsive la navegación completa de cinco tabs.
- Mantener el idioma visual oscuro, los dropdowns premium y los checkboxes `check ck-10` existentes.

## Alineación Del Shell

Los page shells conservarán un ancho máximo amplio para que la navegación comparta una posición estable. Los contenidos operativos usarán un contenedor interno centrado:

- Editar: contenido centrado con ancho máximo de edición.
- Check-in: contenido centrado con ancho máximo operativo.
- Formulario interno: contenido centrado con ancho máximo de administración.
- Resultados: métricas centradas con ancho máximo de lectura.
- Registros: tabla y filtros conservan ancho amplio.

La navegación no se moverá según la anchura del contenido de cada pantalla.

## Check-in

La pantalla debe comunicar la tarea en el primer vistazo:

- Panel principal titulado `Escanear QR`.
- Estado inicial explícito `Cámara apagada`.
- Instrucción: `Presioná “Escanear QR” para activar el lector.`
- Al activarse, el lector conserva el ciclo QR existente y muestra el estado activo.
- El folio manual se presenta como `Ingreso manual`, con explicación de que es la alternativa si no se puede usar cámara.
- En desktop se permite una composición de lector y acciones lado a lado.
- En tablet y celular se usa una columna, con botones de tamaño táctil y área de lector sin compresión.
- Los errores permanecen próximos a las acciones que los resuelven.

No se cambia la autorización, el contrato de lookup, la confirmación ni la idempotencia del check-in.

## Formulario Interno

- El encabezado y la búsqueda se presentan dentro de un bloque centrado y claramente etiquetado como `Buscar registro`.
- Una vez encontrado el registro, el titular se muestra primero.
- Agregar acompañante y acompañantes actuales se muestran después.
- En desktop amplio pueden ocupar dos columnas; en tablet y celular se apilan.
- El feedback de acciones sigue siendo visible y accesible.
- Se conservan los componentes `Select`, el bypass de capacidad, la unicidad de correo, auditoría y acciones server-side.

## Navegación Responsive

La navegación mantiene las cinco rutas:

`Editar | Registros | Check-in | Formulario interno | Resultados`

- Desktop: una fila centrada con ancho natural.
- Tablet: una fila flexible donde los tabs pueden distribuir el espacio sin cortar labels.
- Celular: dos filas con tabs completos y wrap controlado; no se depende de scroll horizontal para descubrir rutas.
- El estado activo mantiene el mismo alto, foco visible y subrayado.
- No se ocultan rutas ni se modifica su autorización por breakpoint.

## Enfoques Evaluados

### Wrap Responsive De Todos Los Tabs

Elegido. Mantiene todas las rutas visibles, evita cortes y conserva el modelo mental de tabs.

### Scroll Horizontal Con Indicadores

Descartado. Requiere menos cambios, pero todavía oculta rutas y fue parte del problema visual reportado.

### Select Único En Celular

Descartado. Reduce el espacio, pero convierte navegación directa en una acción adicional y pierde contexto entre rutas.

## Estados Y Accesibilidad

- El lector debe diferenciar inactivo, activo, cargando, error y resultado.
- Los botones deben conservar estados disabled/loading y foco de teclado.
- Los labels explican la acción; no se usan badges ambiguos como única explicación.
- El wrap de tabs debe ser navegable por teclado y no cortar texto.
- Los controles táctiles deben conservar área cómoda en tablet y celular.

## Pruebas Y Verificación

- Tests de páginas existentes continúan pasando.
- Verificación visual de Editar, Check-in, Formulario interno, Resultados y Registros.
- Verificación de navegación en desktop, tablet y celular.
- Verificación de cámara inactiva, activación QR, fallback manual y errores.
- Ejecutar `pnpm check`.
- Ejecutar el detector visual de Impeccable sobre los targets modificados.

## Fuera De Alcance

- Cambios de permisos, base de datos o acciones de negocio.
- Rediseño global de la tabla de Registros.
- Cambio del flujo QR/manual.
- Reemplazo de dropdowns premium o checkboxes del proyecto.
