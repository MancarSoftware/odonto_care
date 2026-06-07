# Guia de uso de OdontoCare

## Primera instalacion

1. Ejecuta `OdontoCare-Setup-<version>-x64.exe` como administrador.
2. Elige la carpeta de instalacion.
3. Espera mientras OdontoCare prepara PostgreSQL y la base local.
4. En el primer inicio se mostraran el usuario administrador y una contrasena
   temporal. La contrasena se copia al portapapeles.
5. Inicia sesion y cambia la contrasena desde Configuracion.

Los datos se guardan en `C:\ProgramData\OdontoCare`. Desinstalar la aplicacion
no elimina esa carpeta.

## Flujo recomendado

1. Configura la clinica, los usuarios y el directorio de backups.
2. Registra al paciente y sus alertas clinicas.
3. Agrega antecedentes y evoluciones al historial.
4. Registra hallazgos por pieza en el odontograma.
5. Crea tratamientos y asigna sus costos.
6. Programa citas desde Agenda.
7. Registra pagos o abonos.
8. Adjunta radiografias, imagenes y PDF.
9. Revisa reportes, inventario y alertas del dashboard.

## Roles

- `ADMIN`: configuracion, usuarios, auditoria, backups y todos los modulos.
- `DENTIST`: historial, odontograma, tratamientos, agenda y consumo de insumos.
- `RECEPTION`: pacientes, agenda, pagos, archivos e inventario administrativo.

## Backups

- Conserva activado el backup automatico.
- Usa una carpeta ubicada en otro disco o una unidad externa.
- Comprueba periodicamente que los archivos `.zip` puedan descargarse.
- Antes de actualizar OdontoCare, crea un backup manual.
- La restauracion reemplaza la base y los archivos actuales. OdontoCare genera
  primero una copia de seguridad adicional.

## Actualizaciones

1. Crea un backup manual.
2. Cierra OdontoCare.
3. Ejecuta el instalador de la nueva version.
4. Instala sobre la version existente.
5. Abre el sistema y revisa pacientes, agenda e imagenes.

Las migraciones de base de datos se aplican automaticamente al iniciar.

## Recuperacion

Si el sistema no inicia, revisa:

- `C:\ProgramData\OdontoCare\logs\api.log`
- `C:\ProgramData\OdontoCare\logs\postgresql.log`

No borres manualmente `C:\ProgramData\OdontoCare\postgresql\data`. Conserva
tambien el backup mas reciente antes de solicitar soporte.
