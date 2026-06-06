import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const RUNTIME_CONFIG_VERSION = 1;

export type ProductionPaths = {
  apiEntry: string;
  apiLog: string;
  backupsDirectory: string;
  configDirectory: string;
  dataDirectory: string;
  databaseLog: string;
  logsDirectory: string;
  migrationsDirectory: string;
  postgresBinDirectory: string;
  postgresDataDirectory: string;
  prismaEngine: string;
  runtimeConfigFile: string;
  runtimeNodeModules: string;
  uploadsDirectory: string;
};

export type RuntimeConfig = {
  apiPort: number;
  databaseName: string;
  databasePassword: string;
  databasePort: number;
  databaseUser: string;
  initialAdminEmail: string;
  initialAdminPassword?: string;
  initialAdminPending: boolean;
  jwtSecret: string;
  version: number;
};

export function resolveProductionPaths(
  resourcesPath: string,
  fallbackAppData: string,
): ProductionPaths {
  const programData =
    process.env.PROGRAMDATA?.trim() || fallbackAppData;
  const dataDirectory = path.resolve(
    process.env.ODONTOCARE_DATA_DIR?.trim() ||
      path.join(programData, "OdontoCare"),
  );
  const configDirectory = path.join(dataDirectory, "config");
  const logsDirectory = path.join(dataDirectory, "logs");
  const runtimeDirectory = path.join(resourcesPath, "runtime");

  return {
    apiEntry: path.join(runtimeDirectory, "api", "main.cjs"),
    apiLog: path.join(logsDirectory, "api.log"),
    backupsDirectory: path.join(dataDirectory, "backups"),
    configDirectory,
    dataDirectory,
    databaseLog: path.join(logsDirectory, "postgresql.log"),
    logsDirectory,
    migrationsDirectory: path.join(runtimeDirectory, "database", "migrations"),
    postgresBinDirectory: path.join(resourcesPath, "postgresql", "bin"),
    postgresDataDirectory: path.join(dataDirectory, "postgresql", "data"),
    prismaEngine: path.join(
      runtimeDirectory,
      "node_modules",
      ".prisma",
      "client",
      "query_engine-windows.dll.node",
    ),
    runtimeConfigFile: path.join(configDirectory, "runtime.json"),
    runtimeNodeModules: path.join(runtimeDirectory, "node_modules"),
    uploadsDirectory: path.join(dataDirectory, "uploads"),
  };
}

export async function ensureProductionDirectories(paths: ProductionPaths) {
  await Promise.all([
    mkdir(paths.backupsDirectory, { recursive: true }),
    mkdir(paths.configDirectory, { recursive: true }),
    mkdir(paths.logsDirectory, { recursive: true }),
    mkdir(path.dirname(paths.postgresDataDirectory), { recursive: true }),
    mkdir(paths.uploadsDirectory, { recursive: true }),
  ]);
}

export async function loadOrCreateRuntimeConfig(
  paths: ProductionPaths,
): Promise<RuntimeConfig> {
  try {
    const contents = await readFile(paths.runtimeConfigFile, "utf8");
    const stored = JSON.parse(contents.replace(/^\uFEFF/, "")) as RuntimeConfig;

    if (
      stored.version !== RUNTIME_CONFIG_VERSION ||
      !stored.databasePassword ||
      !stored.jwtSecret
    ) {
      throw new Error("La configuracion local no es compatible");
    }

    return stored;
  } catch (error) {
    if (
      error instanceof Error &&
      !("code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }

    const config: RuntimeConfig = {
      apiPort: 3333,
      databaseName: "odontocare",
      databasePassword: secureToken(32),
      databasePort: 55433,
      databaseUser: "odontocare",
      initialAdminEmail: "admin@odontocare.local",
      initialAdminPassword: generateInitialPassword(),
      initialAdminPending: true,
      jwtSecret: secureToken(64),
      version: RUNTIME_CONFIG_VERSION,
    };

    await saveRuntimeConfig(paths, config);
    return config;
  }
}

export async function acknowledgeInitialAdmin(
  paths: ProductionPaths,
  config: RuntimeConfig,
) {
  const updated: RuntimeConfig = {
    ...config,
    initialAdminPending: false,
  };
  delete updated.initialAdminPassword;
  await saveRuntimeConfig(paths, updated);
}

async function saveRuntimeConfig(
  paths: ProductionPaths,
  config: RuntimeConfig,
) {
  const temporaryFile = `${paths.runtimeConfigFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(config, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryFile, paths.runtimeConfigFile);
}

function secureToken(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

function generateInitialPassword() {
  return `Odc-${secureToken(12)}-9a!`;
}
