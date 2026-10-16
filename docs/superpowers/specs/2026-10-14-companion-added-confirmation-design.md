# Confirmación De Acompañante Agregado

## Objetivo

Reemplazar la confirmación inline después de agregar un acompañante administrativo por un modal explícito que permita verificar rápidamente que la operación terminó y recuperar el folio generado.

## Alcance

La confirmación se aplicará a los dos flujos administrativos existentes:

- Formulario interno de Administración.
- Modal `Agregar acompañante` disponible desde la tabla de Registros.

No se modifican la capacidad pública, el bypass administrativo de capacidad, la unicidad de correo, la auditoría, el envío de correo ni la generación del folio.

## Contrato De Éxito

Cada acción server-side de alta debe devolver, además del estado exitoso, los datos mínimos para la confirmación:

```ts
type AddedCompanion = {
  fullName: string;
  backupCode: string;
};
```

El folio debe ser el mismo `backupCode` generado por `addAttendeeToRegistration`. No se debe generar otro folio en el cliente.

Los errores conservarán su flujo actual y no abrirán el modal. En particular, un correo duplicado debe continuar mostrando el mensaje específico de validación.

## Diseño Del Modal

El modal usará el primitive de diálogo existente de Base UI y respetará el lenguaje visual actual de los formularios administrativos:

- Título visible: `Acompañante agregado exitosamente`.
- Texto secundario con el nombre agregado.
- Folio destacado en tipografía monoespaciada, con suficiente contraste y selección sencilla.
- Botón `Listo` como única acción de cierre.
- Foco inicial y retorno de foco administrados por el primitive existente.
- El modal no se cerrará automáticamente; el operador debe confirmar que vio el folio.

El estado de éxito se comunicará con texto explícito. Si se agrega un acento verde, será complementario y no la única señal.

## Flujo De Datos

1. El formulario envía los datos a su acción existente.
2. La acción persiste el acompañante y obtiene el `backupCode` resultante.
3. La acción devuelve `AddedCompanion` en la respuesta exitosa.
4. El componente cliente guarda ese resultado en estado local.
5. El componente abre el modal y muestra nombre y folio.
6. `Listo` cierra el modal sin repetir la mutación.

La revalidación existente se conserva. No se introduce una segunda mutación ni se cambia el alcance de autorización.

## Estados Y Errores

- Éxito: modal abierto con nombre y folio.
- Error de validación o permiso: mensaje inline existente, modal cerrado.
- Correo duplicado: mensaje específico existente, modal cerrado.
- Acción pendiente: botón de envío deshabilitado y texto de carga existente.
- Cierre manual del modal: no reenvía el formulario ni borra datos persistidos.

## Pruebas

- La acción del formulario interno devuelve el `backupCode` en éxito.
- La acción de Registros devuelve el `backupCode` en éxito.
- El error de correo duplicado no contiene estado exitoso ni abre confirmación.
- El componente muestra el título, nombre, folio y botón `Listo` cuando recibe un éxito.
- El botón `Listo` cierra el modal.
- La suite completa y `pnpm check` deben continuar pasando.

## Fuera De Alcance

- Permitir correos duplicados dentro de un evento.
- Cambiar la generación de folios o QR.
- Cambiar el formulario público.
- Rediseñar otros modales administrativos.
