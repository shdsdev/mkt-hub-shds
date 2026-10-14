# Refinamiento UI De Operaciones De Check-in

## Objetivo

Mejorar la operación diaria de Check-in y Formulario interno sin cambiar el modelo de permisos ni los contratos de negocio ya implementados. La interfaz debe mantener una navegación estable, aprovechar mejor el espacio de tablet y comunicar los estados de acreditación con señales semánticas claras.

## Alcance

- Estabilizar la navegación secundaria del evento.
- Reorganizar la pantalla de Check-in para desktop, tablet y móvil.
- Diferenciar visualmente los estados del resultado de Check-in.
- Mejorar la densidad y legibilidad del Formulario interno.
- Documentar reglas persistentes para checkboxes, dropdowns premium, estados y responsive.
- Mantener intactos los permisos, las acciones server-side y el límite público de acompañantes.

## Enfoques Evaluados

### Tabs Horizontales Fijas Y Check-in En Dos Columnas

Elegido. Conserva el modelo mental actual, requiere cambios acotados y permite mostrar lector, acciones y ayuda operativa sin desplazar las pestañas entre rutas.

### Navegación Agrupada Por Operación

Descartado por ahora. Reduce la cantidad visual de pestañas, pero cambia la estructura aprendida y puede esconder acciones administrativas relevantes.

### Resultados Inline Sin Modal

Descartado por ahora. Puede acelerar un flujo continuo, pero exige modificar la interacción existente y reduce el foco sobre cada acreditación.

## Diseño De Navegación

`EventSubNav` conservará una única secuencia estable:

`Editar | Registros | Check-in | Formulario interno | Resultados`

- Cada pestaña tendrá un ancho y padding consistentes para evitar que `Check-in` se corte.
- El contenedor permitirá desplazamiento horizontal únicamente en viewport angosto.
- El estado activo cambiará color y énfasis, no dimensiones.
- La visibilidad seguirá dependiendo del rol actual; la posición relativa de las pestañas visibles no se calculará dinámicamente por contenido.
- Se mantendrán foco de teclado, indicador activo y contraste suficiente.

## Diseño De Check-in

En `lg` y superiores se usará una grilla de dos columnas:

- Columna principal: cámara, estado del lector y área de espera.
- Columna secundaria: `Escanear QR`, `Registrar acceso con código`, instrucciones y errores.

En móvil y tablet angosta se usará una sola columna, manteniendo el CTA de QR antes del fallback manual.

La cámara seguirá inactiva hasta que el operador la active. El error de permisos o de lectura se mostrará dentro del área operativa sin separar el mensaje del control que permite recuperarse. No se agregará un segundo flujo de check-in ni se modificará el ciclo QR/manual existente.

## Diseño De Estados

`CheckInResultDialog` conservará el modal y su contrato actual, pero agregará una identidad semántica por estado:

- **Acreditado:** superficie y acento verde; permite confirmar cuando corresponde.
- **Ya ingresó:** superficie y acento amarillo; informa que no se puede duplicar la entrada.
- **No encontrado:** superficie y acento rojo; no filtra información de otros eventos.
- **Cancelado / Lista de espera:** superficie y acento rojo; muestra el motivo y bloquea la acción.

El color nunca será la única señal: cada estado conservará título, texto descriptivo y acción explícita. Los botones de acompañantes permanecerán individuales y solo aparecerán para personas pendientes.

## Diseño Del Formulario Interno

- La búsqueda permanecerá arriba y ocupará el ancho disponible.
- En `xl`, el titular, alta de acompañante y lista de acompañantes usarán una composición de columnas; en tamaños menores volverán a una columna.
- Los campos mantendrán `Input` y `Select` existentes para conservar foco, animación y comportamiento premium.
- El copy seguirá aclarando que la alta interna no aplica el límite público.
- Los mensajes de éxito y error usarán una región `aria-live` y permanecerán cerca de la acción realizada.
- No se cambiarán las acciones `ignoreCapacity: true`, la autorización de Administración ni la auditoría.

## Reglas Persistentes De UI

Agregar a `AGENTS.md` reglas para:

- conservar la animación y los estados visuales de checkboxes existentes;
- conservar dropdowns premium y no sustituirlos por controles nativos sin una razón explícita;
- usar color semántico junto con texto o iconografía accesible;
- comprobar overflow, foco de teclado, estados disabled/loading/error y composición responsive;
- no corregir un corte de texto reduciendo tipografía si el problema real es distribución de espacio.

## Pruebas Y Verificación

- Verificar visualmente la secuencia y el overflow de `EventSubNav`.
- Verificar que cada estado del modal conserva copy, color, acciones y bloqueo correctos.
- Verificar que el lector QR continúa inactivo hasta activación y que el fallback manual sigue disponible.
- Verificar que el formulario interno permite múltiples acompañantes y conserva sus acciones server-side.
- Ejecutar tests enfocados de Check-in y formulario interno.
- Ejecutar `pnpm check`.
- Revisar desktop, tablet y móvil, incluyendo teclado y mensajes de error.

## Fuera De Alcance

- Cambios en roles, permisos, base de datos o auditoría.
- Reemplazo del modal por una pantalla inline.
- Rediseño global del dashboard o de los componentes UI compartidos.
- Modificación de cambios no relacionados presentes en el worktree.
