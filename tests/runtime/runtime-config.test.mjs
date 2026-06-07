import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const rootDirectory = path.resolve(import.meta.dirname, "../..");
const runtimeConfigModule = path.join(
  rootDirectory,
  "apps",
  "desktop",
  "dist-electron",
  "runtime-config.js",
);

test("la configuracion de produccion crea secretos y conserva los datos", async () => {
  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "odontocare-runtime-config-"),
  );
  const previousDataDirectory = process.env.ODONTOCARE_DATA_DIR;
  process.env.ODONTOCARE_DATA_DIR = dataDirectory;

  try {
    const runtime = await import(
      `${pathToFileURL(runtimeConfigModule).href}?test=${Date.now()}`
    );
    const paths = runtime.resolveProductionPaths(
      path.join(dataDirectory, "resources"),
      dataDirectory,
    );

    assert.equal(paths.dataDirectory, path.resolve(dataDirectory));

    await runtime.ensureProductionDirectories(paths);
    const created = await runtime.loadOrCreateRuntimeConfig(paths);

    assert.equal(created.version, 1);
    assert.equal(created.initialAdminPending, true);
    assert.match(created.initialAdminEmail, /@odontocare\.local$/);
    assert.ok(created.initialAdminPassword.length >= 16);
    assert.ok(created.jwtSecret.length >= 64);
    assert.ok(created.databasePassword.length >= 32);

    const loaded = await runtime.loadOrCreateRuntimeConfig(paths);
    assert.deepEqual(loaded, created);

    await runtime.acknowledgeInitialAdmin(paths, created);
    const acknowledged = JSON.parse(
      await readFile(paths.runtimeConfigFile, "utf8"),
    );

    assert.equal(acknowledged.initialAdminPending, false);
    assert.equal("initialAdminPassword" in acknowledged, false);
    assert.equal(acknowledged.jwtSecret, created.jwtSecret);
    assert.equal(acknowledged.databasePassword, created.databasePassword);
  } finally {
    if (previousDataDirectory === undefined) {
      delete process.env.ODONTOCARE_DATA_DIR;
    } else {
      process.env.ODONTOCARE_DATA_DIR = previousDataDirectory;
    }
    await rm(dataDirectory, { force: true, recursive: true });
  }
});
