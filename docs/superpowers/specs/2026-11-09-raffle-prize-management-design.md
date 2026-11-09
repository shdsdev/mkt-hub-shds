# Gestión segura de premios y correo de ganadores

## Objetivo

Permitir que el administrador elimine premios todavía no utilizados y controle, por premio, si la confirmación de un ganador envía correo. La eliminación no debe destruir historial y la configuración de correo no debe cambiar resultados ya sorteados.

## Reglas aprobadas

- Un premio se puede eliminar solamente si nunca se ha sorteado ninguna unidad de ese premio. La comprobación se hace por existencia de filas en `raffle_draws`, no solamente por `drawnQuantity`, porque un resultado invalidado conserva historial.
- La eliminación requiere una confirmación explícita en la interfaz y se ejecuta con una comprobación transaccional y de organización/evento.
- Si un premio tiene historial, no se elimina; se puede pausar.
- Cada premio tiene `sendWinnerEmail`, activado por defecto.
- El interruptor solo se puede cambiar cuando no existe un resultado pendiente (`pending_reveal` o `revealed`) en el sorteo.
- Al crear una unidad sorteada se copia la configuración del premio a `raffle_draws.sendWinnerEmail`, para que los cambios futuros no sean retroactivos.
- La confirmación usa el snapshot del sorteo: si está activo, intenta enviar correo; si está apagado, confirma sin enviar.
- Un fallo del proveedor no revierte la confirmación. El reenvío solo aparece y funciona cuando el snapshot del sorteo tenía correo activado.
- La UI muestra estados claros: `Correo activado` o `Entrega presencial · Sin correo`, y acciones `Confirmar y enviar correo` o `Confirmar ganador`.

## Diseño técnico

Se agregará `send_winner_email boolean not null default true` a `raffle_prizes` y a `raffle_draws`, junto con una migración Drizzle. El servicio expondrá operaciones transaccionales para eliminar y actualizar la configuración del premio; ambas validarán el alcance y bloquearán el sorteo/premio antes de decidir. La confirmación y el reenvío leerán el snapshot del draw.

Las server actions validarán UUID, autorización y errores de dominio. La tarjeta de premio tendrá un interruptor con estado pendiente deshabilitado cuando exista un draw sin resolver y un botón de eliminación con confirmación explícita. El historial mostrará la acción de confirmación y ocultará el reenvío cuando corresponda.

## Pruebas y aceptación

- Servicio: eliminación antes de cualquier draw, rechazo después de cualquier draw incluso invalidado, snapshot al sortear, bloqueo del toggle con draw pendiente, confirmación sin correo y reenvío bloqueado para snapshots apagados.
- Actions: autorización/validación, mensajes de dominio, confirmación requerida para eliminar y actualización del toggle.
- Regresión: pruebas de rifas, typecheck, ESLint y build.
