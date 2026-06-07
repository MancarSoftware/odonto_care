# Checklist de publicacion

## Automatizado

- [ ] `npm ci`
- [ ] `npm audit --omit=dev`
- [ ] `npm run release:build`
- [ ] Confirmar que `release:verify` muestra la version esperada.
- [ ] Confirmar que el instalador supera 100 MB.

## Prueba manual en Windows

- [ ] Instalar en una cuenta sin Node.js, Docker ni PostgreSQL.
- [ ] Verificar el primer acceso y cambiar la contrasena.
- [ ] Crear un usuario por cada rol.
- [ ] Crear un paciente con y sin alerta clinica.
- [ ] Registrar historial, odontograma y tratamiento.
- [ ] Crear, mover, completar y cancelar citas.
- [ ] Registrar un pago pendiente y luego cobrarlo.
- [ ] Subir y visualizar JPG, PNG y PDF.
- [ ] Registrar entradas y consumos de inventario.
- [ ] Crear un backup, agregar datos nuevos y restaurar el backup.
- [ ] Cerrar Windows de forma normal y comprobar el siguiente inicio.
- [ ] Actualizar sobre una version anterior sin perder datos.

## Distribucion

- [ ] Firmar el instalador con un certificado de firma de codigo.
- [ ] Guardar el hash SHA-256 del instalador publicado.
- [ ] Archivar instalador, notas de version y esquema de base.
- [ ] Entregar la guia de usuario y el procedimiento de soporte.

Electron Builder usa automaticamente `CSC_LINK` y `CSC_KEY_PASSWORD` cuando
se proporciona un certificado de firma compatible durante el empaquetado.
