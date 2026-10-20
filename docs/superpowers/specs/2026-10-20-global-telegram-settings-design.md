# Global Telegram Settings Design

## Goal

Permitir que un administrador configure el chat de Telegram que recibe las notificaciones de solicitudes, sin exponer ni mover el token secreto del bot fuera de `TELEGRAM_BOT_TOKEN`.

## Scope

- Añadir una configuración Telegram por organización.
- Permitir activar o desactivar el envío global.
- Permitir guardar y editar el `chat_id`.
- Permitir enviar un mensaje de prueba desde Configuraciones → Integraciones.
- Usar esta configuración en las notificaciones de solicitudes y decisiones.
- Mantener `events.telegramChatId` durante esta iteración para no romper el editor de eventos ni los datos existentes; la configuración global será el nuevo destino predeterminado y el destino por evento seguirá teniendo prioridad cuando exista.

## Architecture

Se agregará una tabla `telegram_settings` con una única fila por organización, relacionada con `organizations`. El módulo `notifications` expondrá operaciones para leer y actualizar esa configuración, mientras que las server actions de Integraciones validarán sesión, estado activo y rol ADMIN antes de mutar datos o llamar a Telegram.

El token seguirá siendo leído exclusivamente desde `env.TELEGRAM_BOT_TOKEN`. La prueba usará el mismo `sendTelegramMessage` que las notificaciones reales y devolverá un mensaje de error accionable si Telegram rechaza el chat o el token.

## UI

La pantalla existente de Integraciones conservará HCS y sumará una tarjeta Telegram con:

- Estado visible: `No configurado`, `Activo` o `Desactivado`.
- Campo `Chat ID` con ayuda para grupos/canales.
- Checkbox `Enviar notificaciones de nuevas solicitudes`.
- Botón `Guardar configuración`.
- Botón `Enviar mensaje de prueba`.
- Mensajes de éxito/error con `role="status"` o `role="alert"`.

El layout seguirá el lenguaje visual actual: tarjetas con borde, `bg-card`, controles existentes y responsive horizontal sólo cuando el contenido lo requiera.

## Data Flow

1. La página de Integraciones obtiene conexiones HCS y la configuración Telegram en paralelo.
2. El administrador guarda `chatId` y `enabled` mediante una server action autenticada.
3. La acción de prueba valida que exista una configuración activa, lee el token de entorno y envía un mensaje corto.
4. Al crear o actualizar una solicitud, el servicio de notificaciones consulta la configuración de la organización; si está activa usa el chat global, de lo contrario conserva el fallback por evento.
5. Los fallos de Telegram no bloquean la decisión de la solicitud, igual que el comportamiento actual.

## Validation and Error Handling

- `chatId`: string requerido cuando `enabled` es verdadero, máximo 100 caracteres.
- La acción rechaza acceso de usuarios no ADMIN o inactivos.
- Guardar desactivado permite limpiar el `chatId` sin eliminar la fila.
- La prueba exige configuración activa y reporta el error sin filtrar el token.
- La base de datos conserva timestamps de creación y actualización.

## Testing

- Esquema y servicio: crear, actualizar, leer por organización y aislamiento entre organizaciones.
- Server actions: permisos, validación, guardado y prueba exitosa/fallida.
- UI: valores iniciales, estados, formularios y mensajes.
- Notificaciones: prioridad del chat por evento, fallback global y ausencia de envío cuando ambos están deshabilitados.
- Ejecutar `pnpm test`, `pnpm typecheck` y `pnpm lint`.
