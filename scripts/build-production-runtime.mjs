import { build } from "esbuild";
import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const runtimeDirectory = path.join(
  rootDirectory,
  "apps",
  "desktop",
  "runtime",
);
const apiOutputDirectory = path.join(runtimeDirectory, "api");
const databaseOutputDirectory = path.join(runtimeDirectory, "database");
const runtimeNodeModules = path.join(runtimeDirectory, "node_modules");

await rm(runtimeDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(apiOutputDirectory, { recursive: true }),
  mkdir(databaseOutputDirectory, { recursive: true }),
  mkdir(runtimeNodeModules, { recursive: true }),
]);

await build({
  bundle: true,
  entryPoints: [path.join(rootDirectory, "apps", "api", "dist", "main.js")],
  external: [
    "@aws-sdk/client-s3",
    "@nestjs/microservices",
    "@nestjs/microservices/*",
    "@nestjs/websockets/*",
    "@prisma/client",
  ],
  format: "cjs",
  minify: false,
  outfile: path.join(apiOutputDirectory, "main.cjs"),
  platform: "node",
  sourcemap: false,
  target: "node22",
});

await Promise.all([
  cp(
    path.join(rootDirectory, "packages", "database", "prisma", "migrations"),
    path.join(databaseOutputDirectory, "migrations"),
    { recursive: true },
  ),
  cp(
    path.join(rootDirectory, "node_modules", "@prisma", "client"),
    path.join(runtimeNodeModules, "@prisma", "client"),
    { recursive: true },
  ),
  cp(
    path.join(rootDirectory, "node_modules", ".prisma", "client"),
    path.join(runtimeNodeModules, ".prisma", "client"),
    { recursive: true },
  ),
]);

const packageJson = JSON.parse(
  await readFile(path.join(rootDirectory, "package.json"), "utf8"),
);
await writeFile(
  path.join(runtimeDirectory, "runtime-manifest.json"),
  JSON.stringify(
    {
      apiBundle: "api/main.cjs",
      appVersion: packageJson.version,
      createdAt: new Date().toISOString(),
      migrationDirectory: "database/migrations",
      runtimeVersion: 1,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Runtime de produccion creado en ${runtimeDirectory}`);
