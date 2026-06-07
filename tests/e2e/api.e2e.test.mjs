import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const rootDirectory = path.resolve(import.meta.dirname, "../..");
const composeFile = path.join(rootDirectory, "docker-compose.test.yml");
const databaseUrl =
  "postgresql://odontocare_test:odontocare_test@127.0.0.1:55434/odontocare_test?schema=public";
const apiPort = 3334;
const apiBaseUrl = `http://127.0.0.1:${apiPort}/api`;
const projectName = "odontocare-e2e";
const adminEmail = "admin.e2e@odontocare.local";
const adminPassword = "AdminE2E-12345!";
let apiProcess;
let temporaryDirectory;

test(
  "flujos clinicos, permisos y recuperacion de datos",
  { timeout: 300_000 },
  async (context) => {
    try {
      await startInfrastructure();
      const state = {};

      await context.test("salud, login y sesion local", async () => {
        const health = await request("/health");
        assert.equal(health.status, 200);
        assert.equal(health.body.status, "ok");

        const rejected = await request("/auth/login", {
          body: { email: adminEmail, password: "incorrecta" },
          method: "POST",
        });
        assert.equal(rejected.status, 401);

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const bruteForceAttempt = await request("/auth/login", {
            body: {
              email: "blocked.e2e@odontocare.local",
              password: "incorrecta",
            },
            method: "POST",
          });
          assert.equal(bruteForceAttempt.status, 401);
        }

        const blocked = await request("/auth/login", {
          body: {
            email: "blocked.e2e@odontocare.local",
            password: "incorrecta",
          },
          method: "POST",
        });
        assert.equal(blocked.status, 429);

        const login = await request("/auth/login", {
          body: { email: adminEmail, password: adminPassword },
          method: "POST",
        });
        assert.equal(login.status, 201);
        assert.equal(login.body.user.role, "ADMIN");
        state.adminToken = login.body.accessToken;
        state.adminId = login.body.user.id;

        const me = await request("/auth/me", { token: state.adminToken });
        assert.equal(me.status, 200);
        assert.equal(me.body.email, adminEmail);
      });

      await context.test("usuarios y permisos por rol", async () => {
        const dentist = await request("/users", {
          body: {
            email: "dentist.e2e@odontocare.local",
            fullName: "Dra. Elena Pruebas",
            password: "DentistE2E-12345!",
            role: "DENTIST",
          },
          method: "POST",
          token: state.adminToken,
        });
        assert.equal(dentist.status, 201);
        state.dentistId = dentist.body.id;

        const reception = await request("/users", {
          body: {
            email: "reception.e2e@odontocare.local",
            fullName: "Recepcion E2E",
            password: "ReceptionE2E-12345!",
            role: "RECEPTION",
          },
          method: "POST",
          token: state.adminToken,
        });
        assert.equal(reception.status, 201);

        const dentistLogin = await request("/auth/login", {
          body: {
            email: "dentist.e2e@odontocare.local",
            password: "DentistE2E-12345!",
          },
          method: "POST",
        });
        state.dentistToken = dentistLogin.body.accessToken;

        const receptionLogin = await request("/auth/login", {
          body: {
            email: "reception.e2e@odontocare.local",
            password: "ReceptionE2E-12345!",
          },
          method: "POST",
        });
        state.receptionToken = receptionLogin.body.accessToken;

        const forbidden = await request("/users", {
          token: state.dentistToken,
        });
        assert.equal(forbidden.status, 403);
      });

      await context.test("pacientes e historial clinico", async () => {
        const invalid = await request("/patients", {
          body: {
            email: "correo-invalido",
            firstName: "Paciente",
            lastName: "Invalido",
          },
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(invalid.status, 400);

        const patient = await request("/patients", {
          body: {
            allergies: "Penicilina",
            documentId: "E2E-1001",
            email: "ana.e2e@example.test",
            firstName: "Ana",
            lastName: "Prueba Clinica",
            medicalAlerts: "Hipertension",
            phone: "0990000001",
          },
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(patient.status, 201);
        assert.match(patient.body.code, /^PAC-/);
        state.patientId = patient.body.id;

        const search = await request("/patients?q=Prueba%20Clinica", {
          token: state.adminToken,
        });
        assert.equal(search.status, 200);
        assert.equal(search.body.some((item) => item.id === state.patientId), true);

        const forbiddenEntry = await request(
          `/patients/${state.patientId}/clinical-history`,
          {
            body: {
              notes: "No debe guardarse",
              title: "Intento recepcion",
              type: "NOTE",
            },
            method: "POST",
            token: state.receptionToken,
          },
        );
        assert.equal(forbiddenEntry.status, 403);

        const entry = await request(
          `/patients/${state.patientId}/clinical-history`,
          {
            body: {
              notes: "Evaluacion completa sin complicaciones.",
              title: "Consulta inicial",
              type: "CONSULTATION",
            },
            method: "POST",
            token: state.dentistToken,
          },
        );
        assert.equal(entry.status, 201);

        const history = await request(
          `/patients/${state.patientId}/clinical-history`,
          { token: state.adminToken },
        );
        assert.equal(history.status, 200);
        assert.equal(history.body[0].title, "Consulta inicial");
      });

      await context.test("odontograma, tratamientos y pagos", async () => {
        const tooth = await request(
          `/patients/${state.patientId}/odontogram/teeth/16`,
          {
            body: { notes: "Caries oclusal", status: "CARIES" },
            method: "PUT",
            token: state.dentistToken,
          },
        );
        assert.equal(tooth.status, 200);
        assert.equal(tooth.body.status, "CARIES");

        const events = await request(
          `/patients/${state.patientId}/odontogram/teeth/16/events`,
          { token: state.adminToken },
        );
        assert.equal(events.status, 200);
        assert.equal(events.body.length, 1);

        const treatment = await request("/treatments", {
          body: {
            estimatedCost: 120,
            name: "Restauracion de resina",
            patientId: state.patientId,
            status: "IN_PROGRESS",
            toothNumber: 16,
          },
          method: "POST",
          token: state.dentistToken,
        });
        assert.equal(treatment.status, 201);
        state.treatmentId = treatment.body.id;

        const dentistPayment = await request("/billing/payments", {
          body: {
            amount: 40,
            method: "CASH",
            patientId: state.patientId,
          },
          method: "POST",
          token: state.dentistToken,
        });
        assert.equal(dentistPayment.status, 403);

        const payment = await request("/billing/payments", {
          body: {
            amount: 40,
            method: "CASH",
            patientId: state.patientId,
            status: "PENDING",
            treatmentId: state.treatmentId,
          },
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(payment.status, 201);

        const paid = await request(`/billing/payments/${payment.body.id}`, {
          body: { status: "PAID" },
          method: "PATCH",
          token: state.receptionToken,
        });
        assert.equal(paid.status, 200);
        assert.equal(paid.body.status, "PAID");
      });

      await context.test("agenda y conflictos de horario", async () => {
        const first = await request("/appointments", {
          body: {
            color: "#8b5cf6",
            doctorId: state.dentistId,
            endsAt: "2030-06-10T15:00:00.000Z",
            patientId: state.patientId,
            startsAt: "2030-06-10T14:00:00.000Z",
            status: "CONFIRMED",
            title: "Control E2E",
          },
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(first.status, 201);

        const conflict = await request("/appointments", {
          body: {
            doctorId: state.dentistId,
            endsAt: "2030-06-10T15:30:00.000Z",
            patientId: state.patientId,
            startsAt: "2030-06-10T14:30:00.000Z",
            title: "Choque E2E",
          },
          method: "POST",
          token: state.adminToken,
        });
        assert.equal(conflict.status, 400);

        const cancelled = await request("/appointments", {
          body: {
            doctorId: state.dentistId,
            endsAt: "2030-06-10T15:30:00.000Z",
            patientId: state.patientId,
            startsAt: "2030-06-10T14:30:00.000Z",
            status: "CANCELLED",
            title: "Cancelada E2E",
          },
          method: "POST",
          token: state.adminToken,
        });
        assert.equal(cancelled.status, 201);

        const moved = await request(`/appointments/${first.body.id}`, {
          body: {
            endsAt: "2030-06-10T17:00:00.000Z",
            startsAt: "2030-06-10T16:00:00.000Z",
          },
          method: "PATCH",
          token: state.receptionToken,
        });
        assert.equal(moved.status, 200);

        const range = await request(
          "/appointments?from=2030-06-10T00%3A00%3A00.000Z&to=2030-06-11T00%3A00%3A00.000Z",
          { token: state.adminToken },
        );
        assert.equal(range.status, 200);
        assert.equal(range.body.some((item) => item.id === first.body.id), true);
      });

      await context.test("inventario y restricciones operativas", async () => {
        const supplier = await request("/inventory/suppliers", {
          body: {
            email: "proveedor@example.test",
            name: "Proveedor E2E",
            phone: "022000001",
          },
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(supplier.status, 201);

        const item = await request("/inventory/items", {
          body: {
            minimumStock: 2,
            name: "Resina E2E",
            openingStock: 5,
            sku: "RES-E2E-001",
            supplierId: supplier.body.id,
            type: "MATERIAL",
            unit: "unidad",
            unitCost: 10,
          },
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(item.status, 201);
        state.inventoryItemId = item.body.id;

        const forbiddenPurchase = await request("/inventory/movements", {
          body: {
            itemId: state.inventoryItemId,
            quantity: 1,
            type: "PURCHASE",
          },
          method: "POST",
          token: state.dentistToken,
        });
        assert.equal(forbiddenPurchase.status, 400);

        const consumption = await request("/inventory/movements", {
          body: {
            itemId: state.inventoryItemId,
            quantity: 2,
            type: "CONSUMPTION",
          },
          method: "POST",
          token: state.dentistToken,
        });
        assert.equal(consumption.status, 201);
        assert.equal(Number(consumption.body.resultingStock), 3);

        const insufficient = await request("/inventory/movements", {
          body: {
            itemId: state.inventoryItemId,
            quantity: 10,
            type: "CONSUMPTION",
          },
          method: "POST",
          token: state.dentistToken,
        });
        assert.equal(insufficient.status, 400);
      });

      await context.test("archivos locales, busqueda y reportes", async () => {
        const externalFile = await request("/media", {
          body: {
            filePath:
              process.platform === "win32"
                ? "C:\\Windows\\win.ini"
                : "/etc/hosts",
            mimeType: "text/plain",
            patientId: state.patientId,
            type: "DOCUMENT",
          },
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(externalFile.status, 400);

        const form = new FormData();
        form.set("patientId", state.patientId);
        form.set("type", "IMAGE");
        form.set("label", "Radiografia E2E");
        form.set(
          "file",
          new Blob([Buffer.from("odontocare-e2e-image")], {
            type: "image/png",
          }),
          "radiografia-e2e.png",
        );

        const upload = await request("/media/upload", {
          form,
          method: "POST",
          token: state.receptionToken,
        });
        assert.equal(upload.status, 201);
        state.mediaId = upload.body.id;

        const file = await request(`/media/${state.mediaId}/file`, {
          raw: true,
          token: state.adminToken,
        });
        assert.equal(file.status, 200);
        assert.equal(
          Buffer.from(await file.response.arrayBuffer()).toString(),
          "odontocare-e2e-image",
        );

        const search = await request("/search?q=Ana", {
          token: state.adminToken,
        });
        assert.equal(search.status, 200);
        assert.equal(
          search.body.some((item) => item.patientId === state.patientId),
          true,
        );

        const dashboard = await request("/dashboard/summary", {
          token: state.adminToken,
        });
        assert.equal(dashboard.status, 200);

        const reports = await request(
          "/reports/summary?from=2020-01-01&to=2031-01-01",
          { token: state.adminToken },
        );
        assert.equal(reports.status, 200);

        const audit = await request("/audit?limit=100", {
          token: state.adminToken,
        });
        assert.equal(audit.status, 200);
        assert.equal(audit.body.length > 0, true);
      });

      await context.test("configuracion, backup y restauracion real", async () => {
        const forbiddenSettings = await request("/settings/clinic", {
          body: { clinicName: "No permitido" },
          method: "PATCH",
          token: state.receptionToken,
        });
        assert.equal(forbiddenSettings.status, 403);

        const clinic = await request("/settings/clinic", {
          body: {
            appointmentDurationMin: 45,
            clinicName: "Clinica E2E",
            timezone: "America/Guayaquil",
          },
          method: "PATCH",
          token: state.adminToken,
        });
        assert.equal(clinic.status, 200);
        assert.equal(clinic.body.clinicName, "Clinica E2E");

        const backupSettings = await request("/backups/settings", {
          body: {
            automaticEnabled: false,
            backupDirectory: path.join(temporaryDirectory, "backups"),
            includeUploads: true,
          },
          method: "PATCH",
          token: state.adminToken,
        });
        assert.equal(backupSettings.status, 200);

        const backup = await request("/backups", {
          method: "POST",
          token: state.adminToken,
        });
        assert.equal(backup.status, 201);
        assert.equal(backup.body.status, "COMPLETED");
        state.backupId = backup.body.id;

        const download = await request(`/backups/${state.backupId}/download`, {
          raw: true,
          token: state.adminToken,
        });
        assert.equal(download.status, 200);
        assert.equal(
          Buffer.from(await download.response.arrayBuffer())
            .subarray(0, 2)
            .toString(),
          "PK",
        );

        const marker = await request("/patients", {
          body: {
            firstName: "Marcador",
            lastName: "Posterior Backup",
          },
          method: "POST",
          token: state.adminToken,
        });
        assert.equal(marker.status, 201);

        const restored = await request(`/backups/${state.backupId}/restore`, {
          method: "POST",
          token: state.adminToken,
        });
        assert.equal(restored.status, 201);
        assert.equal(restored.body.status, "COMPLETED");

        const markerSearch = await request("/patients?q=Posterior%20Backup", {
          token: state.adminToken,
        });
        assert.equal(markerSearch.status, 200);
        assert.equal(markerSearch.body.length, 0);

        const original = await request(`/patients/${state.patientId}`, {
          token: state.adminToken,
        });
        assert.equal(original.status, 200);
        assert.equal(original.body.firstName, "Ana");

        const restoredFile = await request(`/media/${state.mediaId}/file`, {
          raw: true,
          token: state.adminToken,
        });
        assert.equal(restoredFile.status, 200);
      });
    } finally {
      await stopInfrastructure();
    }
  },
);

async function startInfrastructure() {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "odontocare-e2e-"));
  runDockerCompose(["down", "-v", "--remove-orphans"], true);
  runDockerCompose(["up", "-d", "--wait"]);

  runCommand(process.execPath, [
    path.join(rootDirectory, "node_modules", "prisma", "build", "index.js"),
    "migrate",
    "deploy",
    "--schema",
    path.join(rootDirectory, "packages", "database", "prisma", "schema.prisma"),
  ], {
    DATABASE_URL: databaseUrl,
  });

  runCommand(
    process.execPath,
    [
      path.join(
        rootDirectory,
        "node_modules",
        "@nestjs",
        "cli",
        "bin",
        "nest.js",
      ),
      "build",
    ],
    {},
    false,
    path.join(rootDirectory, "apps", "api"),
  );

  apiProcess = spawn(
    process.execPath,
    [path.join(rootDirectory, "apps", "api", "dist", "main.js")],
    {
      cwd: rootDirectory,
      env: {
        ...process.env,
        API_PORT: String(apiPort),
        APP_ENV: "test",
        BACKUPS_DIR: path.join(temporaryDirectory, "backups"),
        BOOTSTRAP_ADMIN_EMAIL: adminEmail,
        BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
        DATABASE_TOOLS_MODE: "docker",
        DATABASE_URL: databaseUrl,
        JWT_EXPIRES_IN: "1h",
        JWT_SECRET:
          "odontocare-e2e-secret-that-is-long-enough-for-validation-2026",
        PG_BIN_DIR: "",
        POSTGRES_CONTAINER: "odontocare-postgres-e2e",
        UPLOADS_DIR: path.join(temporaryDirectory, "uploads"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let apiOutput = "";
  apiProcess.stdout.on("data", (chunk) => {
    apiOutput += chunk.toString();
  });
  apiProcess.stderr.on("data", (chunk) => {
    apiOutput += chunk.toString();
  });

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`La API de pruebas termino antes de iniciar:\n${apiOutput}`);
    }

    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The API and bootstrap migration are still starting.
    }

    await delay(250);
  }

  throw new Error(`La API de pruebas no inicio a tiempo:\n${apiOutput}`);
}

async function stopInfrastructure() {
  if (apiProcess?.pid) {
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", [
          "/PID",
          String(apiProcess.pid),
          "/T",
          "/F",
        ]);
      } catch {
        // The process may already have stopped after a restore failure.
      }
    } else {
      apiProcess.kill("SIGTERM");
    }
  }

  runDockerCompose(["down", "-v", "--remove-orphans"], true);

  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

async function request(
  pathname,
  { body, form, method = "GET", raw = false, token } = {},
) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    body:
      form ??
      (body === undefined ? undefined : JSON.stringify(body)),
    headers,
    method,
  });

  if (raw) {
    return { response, status: response.status };
  }

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  return { body: parsed, response, status: response.status };
}

function runDockerCompose(argumentsList, ignoreFailure = false) {
  runCommand(
    "docker",
    [
      "compose",
      "-p",
      projectName,
      "-f",
      composeFile,
      ...argumentsList,
    ],
    {},
    ignoreFailure,
  );
}

function runCommand(
  executable,
  argumentsList,
  extraEnvironment = {},
  ignoreFailure = false,
  workingDirectory = rootDirectory,
) {
  try {
    execFileSync(executable, argumentsList, {
      cwd: workingDirectory,
      env: { ...process.env, ...extraEnvironment },
      stdio: ignoreFailure ? "ignore" : "inherit",
    });
  } catch (error) {
    if (!ignoreFailure) throw error;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
