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

La aplicacion esta pensada para funcionar offline. En produccion, PostgreSQL se instalara como dependencia local del sistema o servicio Windows, y Electron iniciara el backend NestJS embebido.
