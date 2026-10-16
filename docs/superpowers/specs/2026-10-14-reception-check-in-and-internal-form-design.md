# Recepción, Check-in y Formulario Interno

## Objetivo

Crear un flujo operativo para recepción que permita validar asistentes desde una tablet mediante QR o folio manual, sin dar acceso administrativo general. Administración podrá asignar usuarios de recepción por evento y gestionar registros mediante un formulario interno.

## Alcance Aprobado

- Nuevo rol `RECEPTION`.
- Asignación de usuarios de recepción por evento.
- Acceso de recepción limitado a `Registros` y `Check-in` de eventos asignados.
- Cámara QR como flujo principal y folio manual como respaldo.
- Modal de resultado para cada lectura o búsqueda.
- Confirmación de entrada configurable por evento, activada por defecto.
- Formulario interno exclusivo de Administración.
- Alta de acompañantes sin el límite público, con folio y QR individual.
- Auditoría de altas, ediciones y accesos.

## Modelo De Acceso Y Datos

### Roles

Agregar `RECEPTION` al enum de roles. `ADMIN` conserva acceso completo. `RECEPTION` solo puede consultar registros y ejecutar check-in en eventos asignados. El resto de roles no obtiene acceso a estas áreas por defecto.

### Asignaciones

Agregar una tabla many-to-many `event_receptionists` con:

- `event_id` como referencia al evento.
- `user_id` como referencia al usuario.
- `created_at`.
- Restricción única por evento y usuario.

Administración asigna y quita usuarios desde la edición del evento, en la sección `Equipo de recepción`.

### Configuración Del Evento

Agregar `check_in_confirmation_required` en `events`, con valor por defecto `true`. Cuando está activo, el primer acceso requiere confirmación explícita. Cuando está apagado, un registro válido se acredita automáticamente.

### Autorización

La autorización debe ejecutarse en servidor y no depender de ocultar enlaces:

- Sesión activa y usuario activo son obligatorios.
- `ADMIN` puede operar cualquier evento de su organización.
- `RECEPTION` solo puede operar eventos con asignación vigente.
- El folio siempre se valida contra el `eventId` actual.
- La URL directa a una sección no autorizada debe devolver acceso denegado o `notFound` según el patrón existente.

## Flujo De Check-in

### Pantalla

La pantalla muestra:

- `Escanear QR` como acción principal.
- `Registrar acceso con código` como respaldo.
- Indicador de que el lector queda inactivo hasta que recepción lo active.

El lector usa `@zxing/browser`, cámara trasera mediante `facingMode: environment`, y debe funcionar en Android/Chrome e iPad/Safari. Al detectar un QR se pausa inmediatamente y procesa una sola lectura. Después de cerrar el resultado no se reactiva automáticamente.

El QR contiene directamente el folio alfanumérico de 8 caracteres. El mismo folio se admite en el flujo manual mediante un input OTP alfanumérico de 8 posiciones, con mayúsculas automáticas y soporte para pegar el código completo.

### Resultados

Cada lectura o búsqueda abre un modal:

#### Acreditado

- Muestra la información completa del titular.
- Muestra sus acompañantes y el estado individual de cada uno.
- Con confirmación activa, ofrece `Confirmar entrada`.
- Con confirmación apagada, la entrada se registra automáticamente y se informa el resultado.

#### Ya ingresó

- Muestra la información del asistente.
- Muestra fecha, hora y usuario que registró el acceso.
- No permite duplicar el check-in.

#### No encontrado

- Se muestra cuando el folio es inválido o no pertenece al evento actual.
- No revela información de otros eventos.

#### Cancelado / Lista de espera

- Muestra la información disponible.
- Bloquea la acreditación.

### Acompañantes

El modal del titular lista todos sus acompañantes. Cada acompañante pendiente tiene un botón individual `Registrar entrada`. Después de registrar uno, el modal se cierra. No se registra ningún acompañante automáticamente junto con el titular.

### Idempotencia Y Auditoría

- El primer check-in guarda `checked_in_at` y `checked_in_by`.
- Un reescaneo devuelve el resultado `Ya ingresó` sin modificar el registro.
- Las operaciones concurrentes no deben generar dos accesos efectivos.
- Las altas, ediciones y check-ins registran usuario, timestamp, evento y recurso afectado en auditoría.

## Formulario Interno

Agregar la pestaña de Administración:

`Editar | Registros | Check-in | Formulario interno | Resultados`

La pestaña solo es visible y accesible para `ADMIN`.

### Buscar Registro

Permite localizar el titular por nombre, correo o folio y mostrar la información completa del registro y sus acompañantes.

### Editar Registro Principal

Permite corregir los datos del titular, con auditoría de cambios antes y después.

### Agregar Acompañante

Permite crear acompañantes sin aplicar el límite público. Cada alta:

- Se asocia al registro existente.
- Genera folio alfanumérico de 8 caracteres.
- Genera su QR.
- Queda pendiente de check-in.
- Registra quién lo creó y cuándo.

## Navegación Y Experiencia

- Recepción verá únicamente las secciones operativas permitidas para sus eventos asignados.
- Administración verá la navegación completa.
- La configuración de confirmación estará dentro de `Editar evento -> Check-in`.
- El formulario interno no se mezclará con la tabla pública de registros ni con la pantalla de check-in.

## Errores Y Fallbacks

- Cámara bloqueada: mostrar instrucciones para habilitar permisos y mantener disponible el folio manual.
- Cámara no disponible: permitir continuar con entrada manual.
- QR inválido: modal `No encontrado`.
- Evento no asignado: acceso bloqueado en servidor.
- Código perteneciente a otro evento: tratarlo como `No encontrado` sin filtrar información.
- Registros cancelados o en lista de espera: mostrar estado y bloquear entrada.

## Enfoques Evaluados

### BarcodeDetector nativo

Sin dependencia, pero con soporte inconsistente en Safari/iPad. Rechazado como única solución.

### html5-qrcode

Rápido de integrar, pero ofrece menos control sobre pausa, reinicio, cámara y modales. No elegido.

### @zxing/browser

Elegido por su compatibilidad multiplataforma y control explícito del ciclo de cámara. Requiere una dependencia adicional, pero reduce el riesgo entre Chrome y Safari.

## Pruebas

- Rol `RECEPTION` y asignación por evento.
- Bloqueo de eventos no asignados.
- Visibilidad y autorización de pestañas.
- QR válido, inválido y de otro evento.
- Folio manual de 8 caracteres y pegado completo.
- Cámara Android/Chrome e iPad/Safari.
- Confirmación activada y desactivada.
- Primer check-in y reescaneo.
- Cancelado y lista de espera.
- Titular con acompañantes pendientes.
- Registro individual de acompañantes.
- Concurrencia sobre el mismo folio.
- Alta y edición desde Formulario interno.
- Auditoría de cada mutación.

## Criterios De Éxito

1. Recepción puede operar únicamente los eventos asignados.
2. El QR es el flujo principal y el folio manual funciona como respaldo.
3. Cada lectura produce un resultado explícito y seguro.
4. No se duplica ningún check-in.
5. Administración puede gestionar acompañantes fuera del límite público.
6. Todos los cambios sensibles quedan auditados.
7. La experiencia funciona en Android/Chrome e iPad/Safari.
