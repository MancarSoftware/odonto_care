# OdontoCare

Sistema odontologico desktop profesional para clinicas, construido como aplicacion local instalable en Windows.

## Stack

- Electron
- React + TypeScript
- TailwindCSS + componentes estilo shadcn/ui
- Framer Motion
- NestJS
- PostgreSQL local
- Prisma

## Desarrollo

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia variables de entorno:

   ```bash
   copy .env.example .env
   ```

3. Levanta PostgreSQL si tienes Docker:

   ```bash
   docker compose up -d
   ```

4. Genera Prisma Client y aplica migraciones:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Inicia la aplicacion:

   ```bash
   npm run dev
   ```

## Calidad y pruebas

La verificacion automatizada usa una base PostgreSQL temporal e independiente.
No modifica los datos de desarrollo ni los datos instalados de la clinica.

```bash
npm run test
npm run verify
```

`npm run test` cubre autenticacion, roles, pacientes, historial clinico,
odontograma, tratamientos, pagos, agenda, inventario, imagenes, reportes,
auditoria, backups y restauracion.

`npm run verify` agrega typecheck y build completo.

## Nota de instalacion local

La aplicacion funciona offline con dos modos:

- Desarrollo: PostgreSQL se ejecuta con Docker y `npm run dev`.
- Produccion: Electron administra PostgreSQL, migraciones y NestJS desde el
  propio instalador.

Los datos de produccion se conservan en
`C:\ProgramData\OdontoCare` y el desinstalador no los elimina.

Para preparar el instalador:

1. Coloca la distribucion PostgreSQL 16 x64 en `vendor/postgresql`.
2. Ejecuta `npm run runtime:verify`.
3. Genera el instalador con `npm run package:win`.

El empaquetado se detiene si PostgreSQL esta incompleto, evitando distribuir
un ejecutable que no pueda iniciar la base de datos.

Para generar y comprobar una entrega completa:

```bash
npm run release:build
```

Ese comando ejecuta pruebas, genera el instalador, inicia el ejecutable
empaquetado con una carpeta de datos limpia y verifica PostgreSQL, API, login,
dashboard y agenda sin depender de Node.js o Docker externos.

Consulta [docs/USER_GUIDE.md](docs/USER_GUIDE.md) y
[docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) antes de entregar una
version a una clinica.
