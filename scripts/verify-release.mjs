import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const rootPackage = JSON.parse(
  await readFile(path.join(rootDirectory, "package.json"), "utf8"),
);
const desktopPackage = JSON.parse(
  await readFile(
    path.join(rootDirectory, "apps", "desktop", "package.json"),
    "utf8",
  ),
);

assert.equal(
  desktopPackage.version,
  rootPackage.version,
  "La version del desktop debe coincidir con la version raiz",
);

const releaseDirectory = path.join(
  rootDirectory,
  "apps",
  "desktop",
  "release",
);
const installer = path.join(
  releaseDirectory,
  `OdontoCare-Setup-${desktopPackage.version}-x64.exe`,
);
const unpackedExecutable = path.join(
  releaseDirectory,
  "win-unpacked",
  "OdontoCare.exe",
);
const runtimeManifest = path.join(
  releaseDirectory,
  "win-unpacked",
  "resources",
  "runtime",
  "runtime-manifest.json",
);

await Promise.all([
  access(installer),
  access(unpackedExecutable),
  access(runtimeManifest),
]);

const installerStat = await stat(installer);
assert.ok(
  installerStat.size > 100_000_000,
  "El instalador parece incompleto",
);

const manifest = JSON.parse(await readFile(runtimeManifest, "utf8"));
assert.equal(manifest.appVersion, rootPackage.version);
assert.equal(manifest.runtimeVersion, 1);

console.log(
  [
    "Release verificada.",
    `Version: ${rootPackage.version}`,
    `Instalador: ${installer}`,
    `Tamano: ${(installerStat.size / 1024 / 1024).toFixed(1)} MB`,
  ].join("\n"),
);
