import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";

import type {
  ProductionPaths,
  RuntimeConfig,
} from "./runtime-config.js";

export class ApiRuntime {
  private child: ChildProcess | undefined;
  private logStream: ReturnType<typeof createWriteStream> | undefined;

  constructor(
    private readonly paths: ProductionPaths,
    private readonly config: RuntimeConfig,
  ) {}

  async start() {
    const databaseUrl = new URL("postgresql://127.0.0.1");
    databaseUrl.username = this.config.databaseUser;
    databaseUrl.password = this.config.databasePassword;
    databaseUrl.hostname = "127.0.0.1";
    databaseUrl.port = String(this.config.databasePort);
    databaseUrl.pathname = `/${this.config.databaseName}`;
    databaseUrl.searchParams.set("schema", "public");

    this.logStream = createWriteStream(this.paths.apiLog, { flags: "a" });
    this.child = spawn(process.execPath, [this.paths.apiEntry], {
      cwd: this.paths.dataDirectory,
      env: {
        ...process.env,
        API_PORT: String(this.config.apiPort),
        APP_ENV: "production",
        BACKUPS_DIR: this.paths.backupsDirectory,
        BOOTSTRAP_ADMIN_EMAIL: this.config.initialAdminEmail,
        BOOTSTRAP_ADMIN_PASSWORD:
          this.config.initialAdminPassword ?? "not-used-existing-installation",
        DATABASE_TOOLS_MODE: "native",
        DATABASE_URL: databaseUrl.toString(),
        ELECTRON_RUN_AS_NODE: "1",
        JWT_EXPIRES_IN: "8h",
        JWT_SECRET: this.config.jwtSecret,
        NODE_ENV: "production",
        NODE_PATH: this.paths.runtimeNodeModules,
        PG_BIN_DIR: this.paths.postgresBinDirectory,
        PRISMA_QUERY_ENGINE_LIBRARY: this.paths.prismaEngine,
        UPLOADS_DIR: this.paths.uploadsDirectory,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    this.child.stdout?.pipe(this.logStream, { end: false });
    this.child.stderr?.pipe(this.logStream, { end: false });

    await waitForApi(this.config.apiPort, this.child);
  }

  async stop() {
    const child = this.child;
    this.child = undefined;

    if (child && child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise<void>((resolve) => child.once("exit", () => resolve())),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);

      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }

    this.logStream?.end();
    this.logStream = undefined;
  }
}

async function waitForApi(port: number, child: ChildProcess) {
  const healthUrl = `http://127.0.0.1:${port}/api/health`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < 45_000) {
    if (child.exitCode !== null) {
      throw new Error(
        `La API local termino inesperadamente con codigo ${child.exitCode}`,
      );
    }

    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // The API may still be connecting to PostgreSQL.
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error("La API local no respondio dentro del tiempo esperado");
}
