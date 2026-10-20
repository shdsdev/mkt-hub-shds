# Telegram Message Templates Design

## Goal

Permitir personalizar el texto de las notificaciones de Telegram con plantillas globales y por evento, usando etiquetas seguras reemplazadas en servidor.

## Scope

- Plantilla global en Configuraciones → Integraciones.
- Plantilla específica en Evento → Integraciones.
- La plantilla del evento sobrescribe la global.
- Si ambas están vacías, conservar el mensaje actual.
- Etiquetas soportadas: `{{evento}}`, `{{nombre}}`, `{{email}}`, `{{telefono}}`, `{{empresa}}`, `{{puesto}}`, `{{ocupacion}}`, `{{estado}}`, `{{fecha_evento}}`, `{{url_revision}}`.
- Las etiquetas desconocidas se rechazan al guardar.
- En local, las URLs `localhost` no se agregan como botones inline de Telegram.

## Architecture

La tabla `telegram_settings` recibirá `message_template` para la plantilla global. La tabla `events` recibirá `telegram_message_template` nullable para el override del evento. El módulo notifications tendrá un renderer puro que reemplaza únicamente el catálogo permitido y construye el mensaje con el botón de revisión sólo cuando la URL es válida para Telegram.

La resolución será `event template ?? organization template ?? default template`. Los valores de contacto provienen del asistente principal; los campos ausentes se reemplazan con una cadena vacía. El renderer no ejecuta código ni interpreta HTML/Markdown.

## UI

Ambas pantallas tendrán un `textarea`, ayuda visible con el catálogo de etiquetas y botón de guardado independiente:

- Global: `Guardar configuración` guarda chat, activación y plantilla.
- Evento: `Guardar grupo` guarda chat y `Guardar mensaje` guarda sólo el override.
- El evento mostrará una nota indicando que una plantilla vacía usa la global.

## Validation

- Plantillas limitadas a 3000 caracteres para dejar margen al límite de 4096 de Telegram.
- El contenido se guarda como texto plano.
- Se valida que cada `{{tag}}` pertenezca al catálogo permitido.
- Las etiquetas con datos faltantes quedan vacías; no se filtran datos de otros asistentes.
- Las acciones requieren ADMIN activo y respetan el aislamiento de organización/evento.

## Testing

- Renderer: reemplazo completo, etiqueta desconocida, valores vacíos, URL local y URL pública.
- Servicios/actions: upsert global, override por evento, permisos y validación.
- Notificaciones: prioridad evento → global → default en alta y decisiones.
- UI: campos, ayudas, botones y feedback de guardado.
- Ejecutar `pnpm test`, `pnpm typecheck` y `pnpm lint`.
