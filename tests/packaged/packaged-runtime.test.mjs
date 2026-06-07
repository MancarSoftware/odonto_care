import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const rootDirectory = path.resolve(import.meta.dirname, "../..");
const executable = path.join(
  rootDirectory,
  "apps",
  "desktop",
  "release",
  "win-unpacked",
  "OdontoCare.exe",
);

test(
  "el ejecutable empaquetado inicia PostgreSQL y la API sin Docker ni Node",
  { timeout: 180_000 },
  async () => {
    const dataDirectory = await mkdtemp(
      path.join(tmpdir(), "odontocare-packaged-"),
    );
    const configDirectory = path.join(dataDirectory, "config");
    const apiPort = 3345;
    const databasePort = 55445;
    const adminEmail = "admin.packaged@odontocare.local";
    const adminPassword = "Packaged-Admin-12345!";
    let application;
    let cdp;

    try {
      await mkdir(configDirectory, { recursive: true });
      await writeFile(
        path.join(configDirectory, "runtime.json"),
        JSON.stringify(
          {
            apiPort,
            databaseName: "odontocare",
            databasePassword: "packaged-database-password-2026",
            databasePort,
            databaseUser: "odontocare",
            initialAdminEmail: adminEmail,
            initialAdminPassword: adminPassword,
            initialAdminPending: false,
            jwtSecret:
              "packaged-runtime-jwt-secret-with-more-than-thirty-two-characters",
            version: 1,
          },
          null,
          2,
        ),
        "utf8",
      );

      application = spawn(
        executable,
        [
          "--remote-debugging-port=9230",
          `--user-data-dir=${path.join(dataDirectory, "electron-user-data")}`,
        ],
        {
          env: {
            ...process.env,
            ODONTOCARE_DATA_DIR: dataDirectory,
            PATH: [
              process.env.SystemRoot
                ? path.join(process.env.SystemRoot, "System32")
                : "C:\\Windows\\System32",
              process.env.SystemRoot ?? "C:\\Windows",
            ].join(path.delimiter),
          },
          stdio: "ignore",
        },
      );

      const health = await waitForJson(
        `http://127.0.0.1:${apiPort}/api/health`,
        120_000,
      );
      assert.equal(health.status, "ok");

      const loginResponse = await fetch(
        `http://127.0.0.1:${apiPort}/api/auth/login`,
        {
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      assert.equal(loginResponse.status, 201);
      const login = await loginResponse.json();
      assert.equal(login.user.role, "ADMIN");

      const targets = await waitForJson(
        "http://127.0.0.1:9230/json/list",
        30_000,
      );
      const target = targets.find(
        (candidate) =>
          candidate.type === "page" &&
          (candidate.title.includes("OdontoCare") ||
            candidate.url.startsWith("file:")),
      );
      assert.ok(target, "Electron no expuso la ventana principal");

      cdp = createCdpClient(target.webSocketDebuggerUrl);
      await cdp.ready;
      await cdp.send("Runtime.enable");

      await waitForPageText(cdp, "OdontoCare");
      const loginText = await evaluate(cdp, "document.body.innerText");
      assert.match(loginText, /OdontoCare/);
      assert.match(loginText, /Ingresar/);
      assert.equal(
        await evaluate(
          cdp,
          `document.querySelector("#password")?.value ?? null`,
        ),
        "",
      );

      await evaluate(
        cdp,
        `localStorage.setItem("odontocare.accessToken", ${JSON.stringify(
          login.accessToken,
        )});
        localStorage.setItem("odontocare.user", ${JSON.stringify(
          JSON.stringify(login.user),
        )});
        location.reload();`,
      );
      await waitForPageText(cdp, "Dashboard");

      const openedAgenda = await evaluate(
        cdp,
        `(() => {
          const button = [...document.querySelectorAll("button")]
            .find((item) => item.textContent.trim() === "Agenda");
          button?.click();
          return Boolean(button);
        })()`,
      );
      assert.equal(openedAgenda, true);
      await waitForPageText(cdp, "Nueva cita");
      await closeBrowser(cdp);
      cdp = undefined;
      await waitForExit(application, 20_000);
    } finally {
      if (cdp) {
        await closeBrowser(cdp);
      }

      await waitForExit(application, 15_000);
      await stopPackagedPostgres(dataDirectory);

      if (application?.pid && application.exitCode === null) {
        try {
          execFileSync("taskkill", ["/PID", String(application.pid), "/F"], {
            stdio: "ignore",
          });
        } catch {
          // Electron may already have stopped.
        }
      }

      await rm(dataDirectory, {
        force: true,
        maxRetries: 5,
        recursive: true,
        retryDelay: 300,
      });
    }
  },
);

async function waitForJson(url, timeout) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No hubo respuesta de ${url}`, { cause: lastError });
}

function createCdpClient(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();

  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const operation = pending.get(message.id);
    if (!operation) return;

    pending.delete(message.id);
    if (message.error) {
      operation.reject(new Error(message.error.message));
    } else {
      operation.resolve(message.result);
    }
  };

  return {
    close: () => socket.close(),
    ready: new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    }),
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { reject, resolve });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }

  return result.result.value;
}

async function waitForPageText(cdp, expectedText) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const text = await evaluate(cdp, "document.body.innerText");
      if (text.includes(expectedText)) return;
    } catch {
      // Reloading replaces the JavaScript context for a brief moment.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`La interfaz no mostro: ${expectedText}`);
}

async function waitForExit(process, timeout) {
  if (!process || process.exitCode !== null) return;

  await Promise.race([
    new Promise((resolve) => process.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

async function stopPackagedPostgres(dataDirectory) {
  const postgresData = path.join(dataDirectory, "postgresql", "data");

  try {
    await access(path.join(postgresData, "PG_VERSION"));
  } catch {
    return;
  }

  const pgCtl = path.join(
    rootDirectory,
    "apps",
    "desktop",
    "release",
    "win-unpacked",
    "resources",
    "postgresql",
    "bin",
    "pg_ctl.exe",
  );

  try {
    execFileSync(
      pgCtl,
      ["stop", "-D", postgresData, "-m", "fast", "-w", "-t", "30"],
      { stdio: "ignore" },
    );
  } catch {
    // PostgreSQL may already be stopped by Electron's graceful shutdown.
  }
}

async function closeBrowser(cdp) {
  void cdp.send("Browser.close").catch(() => {
    // Closing the browser usually closes the socket before a response arrives.
  });
  await new Promise((resolve) => setTimeout(resolve, 750));
  cdp.close();
}
