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
