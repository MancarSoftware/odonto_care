import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const postgresDirectory = path.join(
  rootDirectory,
  "vendor",
  "postgresql",
);
const requiredPaths = [
  "bin/createdb.exe",
  "bin/initdb.exe",
  "bin/pg_ctl.exe",
  "bin/pg_dump.exe",
  "bin/pg_isready.exe",
  "bin/postgres.exe",
  "bin/psql.exe",
  "lib",
  "share",
];
const missing = [];

for (const relativePath of requiredPaths) {
  try {
    await access(path.join(postgresDirectory, relativePath));
  } catch {
    missing.push(relativePath);
  }
}

if (missing.length > 0) {
  console.error("PostgreSQL portable para Windows no esta completo.");
  console.error(`Carpeta esperada: ${postgresDirectory}`);
  console.error(`Faltan: ${missing.join(", ")}`);
  console.error(
    "Consulta vendor/postgresql/README.md antes de generar el instalador.",
  );
  process.exit(1);
}

console.log("Runtime PostgreSQL verificado.");
