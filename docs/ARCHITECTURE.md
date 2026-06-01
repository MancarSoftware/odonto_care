# Arquitectura OdontoCare

OdontoCare es una aplicacion desktop local, no SaaS. La arquitectura separa responsabilidades para mantener el sistema testeable, instalable y escalable.

## Capas

```txt
Electron shell
  React renderer
    API client local
      NestJS API local
        Prisma ORM
          PostgreSQL local
```

## Modulos de dominio

- Auth: login, sesiones JWT locales, permisos y auditoria.
- Users: usuarios clinicos, roles y estado de cuenta.
- Patients: ficha, contacto, antecedentes, busqueda y soft delete.
- Clinical history: evolucion, notas, archivos y timeline.
- Odontogram: piezas SVG, estados, eventos y tratamientos por diente.
- Appointments: agenda diaria/semanal, estados y doctor asignado.
- Billing: pagos, abonos, pendientes y metodos de pago.
- Media: imagenes, radiografias y PDFs en almacenamiento local.
- Reports: indicadores operativos y financieros.
- Backups: exportacion SQL, restauracion y jobs programados.
- Audit: trazabilidad de acciones sensibles.

## Decisiones

- PostgreSQL local da integridad, concurrencia y mejores reportes que SQLite.
- Los archivos clinicos se guardan en disco, no como blobs en PostgreSQL.
- Prisma concentra el modelo relacional y las migraciones.
- NestJS valida permisos en backend; el frontend nunca es la fuente de seguridad.
- Electron solo orquesta la experiencia desktop y procesos locales.

## Riesgos tempranos

- Instalacion y actualizacion de PostgreSQL en Windows.
- Restauracion de backups con versionado de esquema.
- Auditoria clinica completa sin almacenar informacion sensible innecesaria.
- Empaquetado del backend dentro del instalador Electron.
