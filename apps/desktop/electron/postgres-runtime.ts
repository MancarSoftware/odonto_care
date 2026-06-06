import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  errorMessage,
  runProcess,
  runRequiredProcess,
} from "./process-utils.js";
import type {
  ProductionPaths,
  RuntimeConfig,
} from "./runtime-config.js";

const REQUIRED_TOOLS = [
  "createdb.exe",
  "initdb.exe",
  "pg_ctl.exe",
  "pg_dump.exe",
  "pg_isready.exe",
  "psql.exe",
] as const;

export class PostgresRuntime {
  private shouldStop = false;

  constructor(
    private readonly paths: ProductionPaths,
    private readonly config: RuntimeConfig,
  ) {}

  async start() {
    await this.verifyDistribution();
    await this.initializeClusterIfNeeded();

    if (!(await this.isReady())) {
      await runRequiredProcess(
        this.tool("pg_ctl.exe"),
        [
          "start",
          "-D",
          this.paths.postgresDataDirectory,
          "-l",
          this.paths.databaseLog,
          "-w",
          "-t",
          "45",
          "-o",
          `-p ${this.config.databasePort} -h 127.0.0.1`,
        ],
        { env: this.databaseEnvironment() },
      );
    }

    this.shouldStop = true;
    await this.ensureApplicationDatabase();
    await this.applyMigrations();
  }

  async stop() {
    if (!this.shouldStop) {
      return;
    }

    try {
      await runProcess(
        this.tool("pg_ctl.exe"),
        [
          "stop",
          "-D",
          this.paths.postgresDataDirectory,
          "-m",
          "fast",
          "-w",
          "-t",
          "30",
        ],
        { env: this.databaseEnvironment() },
      );
    } finally {
      this.shouldStop = false;
    }
  }

  private async verifyDistribution() {
    const missing: string[] = [];

    for (const tool of REQUIRED_TOOLS) {
      try {
        await access(this.tool(tool));
      } catch {
        missing.push(tool);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `La instalacion no incluye PostgreSQL completo. Faltan: ${missing.join(", ")}`,
      );
    }
  }

  private async initializeClusterIfNeeded() {
    try {
      await access(path.join(this.paths.postgresDataDirectory, "PG_VERSION"));
      return;
    } catch {
      // A new installation has no cluster yet.
    }

    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "odontocare-init-"),
    );
    const passwordFile = path.join(temporaryDirectory, "database-password.txt");

    try {
      await writeFile(passwordFile, this.config.databasePassword, {
        encoding: "utf8",
        mode: 0o600,
      });
      await runRequiredProcess(
        this.tool("initdb.exe"),
        [
          "-D",
          this.paths.postgresDataDirectory,
          "--username",
          this.config.databaseUser,
          "--pwfile",
          passwordFile,
          "--auth-host=scram-sha-256",
          "--auth-local=scram-sha-256",
          "--encoding=UTF8",
          "--locale=C",
        ],
        { env: this.databaseEnvironment() },
      );
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }

  private async isReady() {
    const result = await runProcess(
      this.tool("pg_isready.exe"),
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(this.config.databasePort),
        "--username",
        this.config.databaseUser,
      ],
      { env: this.databaseEnvironment() },
    );

    return result.exitCode === 0;
  }

  private async ensureApplicationDatabase() {
    const result = await this.psql(
      "postgres",
      `SELECT 1 FROM pg_database WHERE datname = '${escapeSqlLiteral(
        this.config.databaseName,
      )}'`,
      true,
    );

    if (result.stdout.trim() === "1") {
      return;
    }

    await runRequiredProcess(
      this.tool("createdb.exe"),
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(this.config.databasePort),
        "--username",
        this.config.databaseUser,
        "--encoding=UTF8",
        this.config.databaseName,
      ],
      { env: this.databaseEnvironment() },
    );
  }

  private async applyMigrations() {
    await this.psql(
      this.config.databaseName,
      `CREATE TABLE IF NOT EXISTS odontocare_schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    const entries = await readdir(this.paths.migrationsDirectory, {
      withFileTypes: true,
    });
    const migrationNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migrationName of migrationNames) {
      const applied = await this.psql(
        this.config.databaseName,
        `SELECT 1 FROM odontocare_schema_migrations WHERE name = '${escapeSqlLiteral(
          migrationName,
        )}'`,
        true,
      );
      if (applied.stdout.trim() === "1") {
        continue;
      }

      const migrationFile = path.join(
        this.paths.migrationsDirectory,
        migrationName,
        "migration.sql",
      );
      await access(migrationFile);
      await runRequiredProcess(
        this.tool("psql.exe"),
        [
          "--host",
          "127.0.0.1",
          "--port",
          String(this.config.databasePort),
          "--username",
          this.config.databaseUser,
          "--dbname",
          this.config.databaseName,
          "--set",
          "ON_ERROR_STOP=1",
          "--single-transaction",
          "--file",
          migrationFile,
        ],
        { env: this.databaseEnvironment() },
      );
      await this.psql(
        this.config.databaseName,
        `INSERT INTO odontocare_schema_migrations (name) VALUES ('${escapeSqlLiteral(
          migrationName,
        )}')`,
      );
    }
  }

  private psql(database: string, sql: string, tuplesOnly = false) {
    return runRequiredProcess(
      this.tool("psql.exe"),
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(this.config.databasePort),
        "--username",
        this.config.databaseUser,
        "--dbname",
        database,
        "--set",
        "ON_ERROR_STOP=1",
        ...(tuplesOnly ? ["--tuples-only", "--no-align"] : []),
        "--command",
        sql,
      ],
      { env: this.databaseEnvironment() },
    );
  }

  private tool(name: (typeof REQUIRED_TOOLS)[number]) {
    return path.join(this.paths.postgresBinDirectory, name);
  }

  private databaseEnvironment(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PGPASSWORD: this.config.databasePassword,
    };
  }
}

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

export function formatPostgresStartupError(error: unknown) {
  return `No se pudo preparar PostgreSQL: ${errorMessage(error)}`;
}
