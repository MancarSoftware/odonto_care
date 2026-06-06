import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditAction,
  BackupFrequency,
  BackupOperation,
  BackupSource,
  BackupStatus,
  Prisma,
} from "@prisma/client";
import { ZipArchive } from "archiver";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  parse,
  resolve,
} from "node:path";
import { randomUUID } from "node:crypto";
import * as unzipper from "unzipper";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { UpdateBackupSettingsDto } from "./dto/update-backup-settings.dto";

const PRIMARY_SETTINGS_ID = "primary";
const SCHEDULER_INTERVAL_MS = 60_000;

type BackupManifest = {
  app: "OdontoCare";
  createdAt: string;
  database: "database.sql";
  formatVersion: 1;
  includesUploads: boolean;
  uploadsDirectory?: "uploads";
};

export type ImportedBackupFile = {
  originalname: string;
  path: string;
  size: number;
};

@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsService.name);
  private activeOperation = false;
  private scheduler?: NodeJS.Timeout;

  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.prisma.backupJob.updateMany({
      data: {
        errorMessage: "La operacion fue interrumpida por un cierre del sistema",
        finishedAt: new Date(),
        status: BackupStatus.FAILED,
      },
      where: { status: { in: [BackupStatus.PENDING, BackupStatus.RUNNING] } },
    });

    this.scheduler = setInterval(() => {
      void this.runAutomaticBackupIfDue();
    }, SCHEDULER_INTERVAL_MS);
    this.scheduler.unref();
    void this.runAutomaticBackupIfDue();
  }

  onModuleDestroy() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
    }
  }

  async getSettings() {
    const configuredDirectory =
      this.config.getOrThrow<string>("BACKUPS_DIR");
    const settings = await this.prisma.backupSettings.upsert({
      create: {
        backupDirectory: configuredDirectory,
        id: PRIMARY_SETTINGS_ID,
      },
      update: {},
      where: { id: PRIMARY_SETTINGS_ID },
    });

    if (
      settings.backupDirectory === "C:/OdontoSystem/backups" &&
      resolve(configuredDirectory) !== resolve(settings.backupDirectory)
    ) {
      return this.prisma.backupSettings.update({
        data: { backupDirectory: configuredDirectory },
        where: { id: PRIMARY_SETTINGS_ID },
      });
    }

    return settings;
  }

  async updateSettings(dto: UpdateBackupSettingsDto, actorId: string) {
    const existing = await this.getSettings();
    const backupDirectory =
      dto.backupDirectory !== undefined
        ? validateBackupDirectory(dto.backupDirectory)
        : undefined;

    if (backupDirectory) {
      await mkdir(backupDirectory, { recursive: true });
    }

    const settings = await this.prisma.backupSettings.update({
      data: withoutUndefined({
        automaticEnabled: dto.automaticEnabled,
        backupDirectory,
        frequency: dto.frequency,
        includeUploads: dto.includeUploads,
        retentionCount: dto.retentionCount,
        scheduledHour: dto.scheduledHour,
      }) as Prisma.BackupSettingsUpdateInput,
      where: { id: PRIMARY_SETTINGS_ID },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: settingsToAudit(settings),
      before: settingsToAudit(existing),
      entity: "BackupSettings",
      entityId: PRIMARY_SETTINGS_ID,
    });

    return settings;
  }

  async findAll() {
    const jobs = await this.prisma.backupJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return jobs.map(normalizeJob);
  }

  async createManualBackup(actorId: string) {
    const job = await this.withOperationLock(() =>
      this.createBackup(BackupSource.MANUAL, actorId),
    );
    return normalizeJob(job);
  }

  async importBackup(file: ImportedBackupFile | undefined, actorId: string) {
    if (!file) {
      throw new BadRequestException("Selecciona un archivo de backup");
    }

    return this.withOperationLock(async () => {
      const settings = await this.getSettings();
      const backupDirectory = validateBackupDirectory(settings.backupDirectory);
      await mkdir(backupDirectory, { recursive: true });

      try {
        const manifest = await validateArchive(file.path);
        const fileName = `importado-${timestampForFile()}-${sanitizeFileName(
          file.originalname,
        )}`;
        const destination = join(backupDirectory, fileName);
        await cp(file.path, destination);
        const importedStat = await stat(destination);
        const job = await this.prisma.backupJob.create({
          data: {
            actorId,
            fileName,
            filePath: destination,
            finishedAt: new Date(),
            includesUploads: manifest.includesUploads,
            operation: BackupOperation.BACKUP,
            sizeBytes: importedStat.size,
            source: BackupSource.IMPORTED,
            startedAt: new Date(),
            status: BackupStatus.COMPLETED,
          },
        });

        await this.audit.log({
          action: AuditAction.CREATE,
          actorId,
          after: { fileName, source: BackupSource.IMPORTED },
          entity: "BackupJob",
          entityId: job.id,
        });

        return normalizeJob(job);
      } finally {
        await rm(file.path, { force: true });
      }
    });
  }

  async restore(id: string, actorId: string) {
    return this.withOperationLock(async () => {
      const sourceJob = await this.ensureDownloadableJob(id);
      const restoreJob = await this.prisma.backupJob.create({
        data: {
          actorId,
          fileName: sourceJob.fileName,
          filePath: sourceJob.filePath,
          includesUploads: sourceJob.includesUploads,
          operation: BackupOperation.RESTORE,
          source: sourceJob.source,
          startedAt: new Date(),
          status: BackupStatus.RUNNING,
        },
      });

      let safetyJob: Prisma.BackupJobGetPayload<Record<string, never>> | null =
        null;

      try {
        safetyJob = await this.createBackup(
          BackupSource.SAFETY,
          actorId,
          true,
        );
        await this.restoreArchive(sourceJob.filePath!);

        const completedRestore = await this.prisma.backupJob.upsert({
          create: {
            ...restoreJob,
            finishedAt: new Date(),
            status: BackupStatus.COMPLETED,
          },
          update: {
            errorMessage: null,
            finishedAt: new Date(),
            status: BackupStatus.COMPLETED,
          },
          where: { id: restoreJob.id },
        });

        if (safetyJob) {
          await this.prisma.backupJob.upsert({
            create: safetyJob,
            update: {
              errorMessage: safetyJob.errorMessage,
              fileName: safetyJob.fileName,
              filePath: safetyJob.filePath,
              finishedAt: safetyJob.finishedAt,
              includesUploads: safetyJob.includesUploads,
              sizeBytes: safetyJob.sizeBytes,
              status: safetyJob.status,
            },
            where: { id: safetyJob.id },
          });
        }

        await this.audit.log({
          action: AuditAction.RESTORE,
          actorId,
          after: {
            backupId: sourceJob.id,
            fileName: sourceJob.fileName,
            safetyBackupId: safetyJob?.id,
          },
          entity: "BackupJob",
          entityId: completedRestore.id,
        });

        return normalizeJob(completedRestore);
      } catch (error) {
        const message = errorMessage(error);
        const failedJob = await this.prisma.backupJob.upsert({
          create: {
            ...restoreJob,
            errorMessage: message,
            finishedAt: new Date(),
            status: BackupStatus.FAILED,
          },
          update: {
            errorMessage: message,
            finishedAt: new Date(),
            status: BackupStatus.FAILED,
          },
          where: { id: restoreJob.id },
        });
        throw new BadRequestException(
          `No se pudo restaurar el backup: ${message}`,
          { cause: error },
        );
      }
    });
  }

  async getDownload(id: string) {
    const job = await this.ensureDownloadableJob(id);
    return {
      fileName: job.fileName!,
      filePath: job.filePath!,
    };
  }

  async delete(id: string, actorId: string) {
    if (this.activeOperation) {
      throw new ConflictException(
        "Espera a que termine la operacion de backup actual",
      );
    }

    const job = await this.prisma.backupJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException("Backup no encontrado");
    }

    if (job.operation !== BackupOperation.BACKUP) {
      throw new BadRequestException(
        "Solo se pueden eliminar archivos de backup",
      );
    }

    if (job.filePath) {
      await rm(job.filePath, { force: true });
    }

    await this.prisma.backupJob.delete({ where: { id } });
    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: { fileName: job.fileName, source: job.source },
      entity: "BackupJob",
      entityId: id,
    });

    return { id };
  }

  private async createBackup(
    source: BackupSource,
    actorId?: string,
    skipRetention = false,
  ) {
    const settings = await this.getSettings();
    const backupDirectory = validateBackupDirectory(settings.backupDirectory);
    const includeUploads = settings.includeUploads;
    const fileName = `odontocare-${source.toLowerCase()}-${timestampForFile()}.zip`;
    const filePath = join(backupDirectory, fileName);
    const job = await this.prisma.backupJob.create({
      data: {
        actorId: actorId ?? null,
        fileName,
        filePath,
        includesUploads: includeUploads,
        operation: BackupOperation.BACKUP,
        source,
        startedAt: new Date(),
        status: BackupStatus.RUNNING,
      },
    });
    const tempDirectory = join(tmpdir(), `odontocare-backup-${randomUUID()}`);

    try {
      await mkdir(backupDirectory, { recursive: true });
      await mkdir(tempDirectory, { recursive: true });
      const databaseFile = join(tempDirectory, "database.sql");
      await this.dumpDatabase(databaseFile);

      const uploadsDirectory = resolve(
        this.config.getOrThrow<string>("UPLOADS_DIR"),
      );
      const archiveUploadsDirectory = join(tempDirectory, "uploads");
      const uploadsExist = includeUploads && (await pathExists(uploadsDirectory));

      if (uploadsExist) {
        await cp(uploadsDirectory, archiveUploadsDirectory, {
          recursive: true,
        });
      }

      const manifest: BackupManifest = {
        app: "OdontoCare",
        createdAt: new Date().toISOString(),
        database: "database.sql",
        formatVersion: 1,
        includesUploads: uploadsExist,
        ...(uploadsExist ? { uploadsDirectory: "uploads" as const } : {}),
      };
      await writeFile(
        join(tempDirectory, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        "utf8",
      );
      await createZip(tempDirectory, filePath);

      const archiveStat = await stat(filePath);
      const completed = await this.prisma.backupJob.update({
        data: {
          errorMessage: null,
          finishedAt: new Date(),
          includesUploads: uploadsExist,
          sizeBytes: archiveStat.size,
          status: BackupStatus.COMPLETED,
        },
        where: { id: job.id },
      });

      if (source === BackupSource.AUTOMATIC) {
        await this.prisma.backupSettings.update({
          data: { lastAutomaticBackupAt: new Date() },
          where: { id: PRIMARY_SETTINGS_ID },
        });
      }

      if (!skipRetention) {
        await this.applyRetention(settings.retentionCount);
      }

      if (actorId) {
        await this.audit.log({
          action: AuditAction.EXPORT,
          actorId,
          after: {
            fileName,
            includesUploads: uploadsExist,
            sizeBytes: archiveStat.size,
            source,
          },
          entity: "BackupJob",
          entityId: job.id,
        });
      }

      return completed;
    } catch (error) {
      const message = errorMessage(error);
      await rm(filePath, { force: true });
      await this.prisma.backupJob.update({
        data: {
          errorMessage: message,
          finishedAt: new Date(),
          status: BackupStatus.FAILED,
        },
        where: { id: job.id },
      });
      throw new BadRequestException(`No se pudo crear el backup: ${message}`, {
        cause: error,
      });
    } finally {
      await rm(tempDirectory, { force: true, recursive: true });
    }
  }

  private async restoreArchive(archivePath: string) {
    const tempDirectory = join(tmpdir(), `odontocare-restore-${randomUUID()}`);
    await mkdir(tempDirectory, { recursive: true });

    try {
      const manifest = await extractValidatedArchive(archivePath, tempDirectory);
      await this.restoreDatabase(join(tempDirectory, manifest.database));

      if (manifest.includesUploads && manifest.uploadsDirectory) {
        const extractedUploads = join(
          tempDirectory,
          manifest.uploadsDirectory,
        );
        const uploadsDirectory = resolve(
          this.config.getOrThrow<string>("UPLOADS_DIR"),
        );
        assertSafeDataDirectory(uploadsDirectory);
        await replaceDirectory(extractedUploads, uploadsDirectory);
      }
    } finally {
      await rm(tempDirectory, { force: true, recursive: true });
    }
  }

  private async dumpDatabase(outputPath: string) {
    const database = databaseConnection(this.config);

    if (this.config.get<string>("DATABASE_TOOLS_MODE") === "native") {
      await runProcessToFile(
        nativePostgresTool(this.config, "pg_dump"),
        [
          "--host",
          database.host,
          "--port",
          String(database.port),
          "--username",
          database.user,
          "--dbname",
          database.database,
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-privileges",
        ],
        outputPath,
        { PGPASSWORD: database.password },
      );
      return;
    }

    await runProcessToFile(
      "docker",
      [
        "exec",
        this.config.getOrThrow<string>("POSTGRES_CONTAINER"),
        "pg_dump",
        "-U",
        database.user,
        "-d",
        database.database,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
      ],
      outputPath,
    );
  }

  private async restoreDatabase(inputPath: string) {
    const database = databaseConnection(this.config);

    if (this.config.get<string>("DATABASE_TOOLS_MODE") === "native") {
      await runProcessFromFile(
        nativePostgresTool(this.config, "psql"),
        [
          "--host",
          database.host,
          "--port",
          String(database.port),
          "--username",
          database.user,
          "--dbname",
          database.database,
          "-v",
          "ON_ERROR_STOP=1",
        ],
        inputPath,
        { PGPASSWORD: database.password },
      );
      return;
    }

    await runProcessFromFile(
      "docker",
      [
        "exec",
        "-i",
        this.config.getOrThrow<string>("POSTGRES_CONTAINER"),
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        database.user,
        "-d",
        database.database,
      ],
      inputPath,
    );
  }

  private async ensureDownloadableJob(id: string) {
    const job = await this.prisma.backupJob.findFirst({
      where: {
        filePath: { not: null },
        id,
        operation: BackupOperation.BACKUP,
        status: BackupStatus.COMPLETED,
      },
    });

    if (!job?.filePath || !job.fileName || !(await pathExists(job.filePath))) {
      throw new NotFoundException("El archivo de backup no esta disponible");
    }

    return job;
  }

  private async applyRetention(retentionCount: number) {
    const jobs = await this.prisma.backupJob.findMany({
      orderBy: { createdAt: "desc" },
      skip: retentionCount,
      where: {
        operation: BackupOperation.BACKUP,
        source: { in: [BackupSource.AUTOMATIC, BackupSource.SAFETY] },
        status: BackupStatus.COMPLETED,
      },
    });

    for (const job of jobs) {
      if (job.filePath) {
        await rm(job.filePath, { force: true });
      }
      await this.prisma.backupJob.delete({ where: { id: job.id } });
    }
  }

  private async runAutomaticBackupIfDue() {
    if (this.activeOperation) {
      return;
    }

    try {
      const settings = await this.getSettings();
      if (!settings.automaticEnabled || !isAutomaticBackupDue(settings)) {
        return;
      }

      await this.withOperationLock(() =>
        this.createBackup(BackupSource.AUTOMATIC),
      );
    } catch (error) {
      this.logger.error(
        `Backup automatico fallido: ${errorMessage(error)}`,
      );
    }
  }

  private async withOperationLock<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeOperation) {
      throw new ConflictException(
        "Ya hay una operacion de backup o restauracion en curso",
      );
    }

    this.activeOperation = true;
    try {
      return await operation();
    } finally {
      this.activeOperation = false;
    }
  }
}

function normalizeJob(job: Prisma.BackupJobGetPayload<Record<string, never>>) {
  return {
    ...job,
    sizeBytes: job.sizeBytes === null ? null : Number(job.sizeBytes),
  };
}

function settingsToAudit(settings: {
  automaticEnabled: boolean;
  backupDirectory: string;
  frequency: BackupFrequency;
  includeUploads: boolean;
  retentionCount: number;
  scheduledHour: number;
}) {
  return {
    automaticEnabled: settings.automaticEnabled,
    backupDirectory: settings.backupDirectory,
    frequency: settings.frequency,
    includeUploads: settings.includeUploads,
    retentionCount: settings.retentionCount,
    scheduledHour: settings.scheduledHour,
  };
}

function validateBackupDirectory(value: string): string {
  const trimmed = value.trim();
  const directory = resolve(trimmed);

  if (!trimmed || !isAbsolute(trimmed) || directory === parse(directory).root) {
    throw new BadRequestException("Selecciona una carpeta de backup valida");
  }

  return directory;
}

function assertSafeDataDirectory(directory: string) {
  if (directory === parse(directory).root || directory.length < 6) {
    throw new BadRequestException("La carpeta de archivos no es segura");
  }
}

function databaseConnection(config: ConfigService) {
  const url = new URL(config.getOrThrow<string>("DATABASE_URL"));
  return {
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username),
  };
}

function nativePostgresTool(config: ConfigService, tool: "pg_dump" | "psql") {
  const binDirectory = config.getOrThrow<string>("PG_BIN_DIR");
  if (!binDirectory.trim()) {
    throw new Error("PG_BIN_DIR no esta configurado");
  }

  return join(binDirectory, process.platform === "win32" ? `${tool}.exe` : tool);
}

function isAutomaticBackupDue(settings: {
  frequency: BackupFrequency;
  lastAutomaticBackupAt: Date | null;
  scheduledHour: number;
}) {
  const now = new Date();
  if (now.getHours() < settings.scheduledHour) {
    return false;
  }

  const last = settings.lastAutomaticBackupAt;
  if (!last) {
    return true;
  }

  if (settings.frequency === BackupFrequency.DAILY) {
    return localDateKey(last) !== localDateKey(now);
  }

  if (settings.frequency === BackupFrequency.WEEKLY) {
    return now.getTime() - last.getTime() >= 7 * 24 * 60 * 60 * 1000;
  }

  return (
    now.getFullYear() !== last.getFullYear() ||
    now.getMonth() !== last.getMonth()
  );
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeFileName(value: string) {
  const sanitized = basename(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 150);
  return sanitized.toLowerCase().endsWith(".zip")
    ? sanitized
    : `${sanitized}.zip`;
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function replaceDirectory(source: string, destination: string) {
  const parentDirectory = dirname(destination);
  const operationId = randomUUID();
  const stagedDirectory = join(
    parentDirectory,
    `.odontocare-restore-${operationId}`,
  );
  const previousDirectory = join(
    parentDirectory,
    `.odontocare-previous-${operationId}`,
  );
  const hadPreviousDirectory = await pathExists(destination);

  await mkdir(parentDirectory, { recursive: true });
  await cp(source, stagedDirectory, { recursive: true });

  try {
    if (hadPreviousDirectory) {
      await rename(destination, previousDirectory);
    }

    await rename(stagedDirectory, destination);
    await rm(previousDirectory, { force: true, recursive: true });
  } catch (error) {
    await rm(stagedDirectory, { force: true, recursive: true });

    if (
      hadPreviousDirectory &&
      !(await pathExists(destination)) &&
      (await pathExists(previousDirectory))
    ) {
      await rename(previousDirectory, destination);
    }

    throw error;
  }
}

function createZip(sourceDirectory: string, destination: string) {
  return new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(destination);
    const archive = new ZipArchive({ zlib: { level: 6 } });

    output.on("close", () => resolvePromise());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    void archive.finalize();
  });
}

async function validateArchive(archivePath: string) {
  const archive = await unzipper.Open.file(archivePath);
  validateArchiveEntries(archive.files.map((file) => file.path));
  const manifestEntry = archive.files.find(
    (file) => normalize(file.path) === "manifest.json",
  );
  const databaseEntry = archive.files.find(
    (file) => normalize(file.path) === "database.sql",
  );

  if (!manifestEntry || !databaseEntry) {
    throw new BadRequestException(
      "El ZIP no es un backup valido de OdontoCare",
    );
  }

  const manifest = JSON.parse(
    (await manifestEntry.buffer()).toString("utf8"),
  ) as BackupManifest;
  validateManifest(manifest);
  return manifest;
}

async function extractValidatedArchive(
  archivePath: string,
  destination: string,
) {
  const archive = await unzipper.Open.file(archivePath);
  validateArchiveEntries(archive.files.map((file) => file.path));
  await archive.extract({ path: destination });
  const manifest = JSON.parse(
    await readFile(join(destination, "manifest.json"), "utf8"),
  ) as BackupManifest;
  validateManifest(manifest);
  await access(join(destination, manifest.database));
  return manifest;
}

function validateArchiveEntries(paths: string[]) {
  for (const entryPath of paths) {
    const normalized = normalize(entryPath).replace(/\\/g, "/");
    if (
      normalized.startsWith("../") ||
      normalized.includes("/../") ||
      isAbsolute(normalized)
    ) {
      throw new BadRequestException("El ZIP contiene rutas no seguras");
    }
  }
}

function validateManifest(manifest: BackupManifest) {
  if (
    manifest.app !== "OdontoCare" ||
    manifest.formatVersion !== 1 ||
    manifest.database !== "database.sql"
  ) {
    throw new BadRequestException(
      "El manifiesto del backup no es compatible",
    );
  }
}

function runProcessToFile(
  command: string,
  args: string[],
  outputPath: string,
  environment: NodeJS.ProcessEnv = {},
) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...environment },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = createWriteStream(outputPath);
    let stderr = "";
    let childCompleted = false;
    let outputCompleted = false;

    const completeIfReady = () => {
      if (childCompleted && outputCompleted) {
        resolvePromise();
      }
    };

    child.stdout.pipe(output);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    output.on("error", reject);
    output.on("close", () => {
      outputCompleted = true;
      completeIfReady();
    });
    child.on("close", (code) => {
      if (code === 0) {
        childCompleted = true;
        completeIfReady();
      } else {
        reject(new Error(stderr.trim() || `${command} termino con codigo ${code}`));
      }
    });
  });
}

function runProcessFromFile(
  command: string,
  args: string[],
  inputPath: string,
  environment: NodeJS.ProcessEnv = {},
) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...environment },
      windowsHide: true,
      stdio: ["pipe", "ignore", "pipe"],
    });
    const input = createReadStream(inputPath);
    let stderr = "";

    input.pipe(child.stdin);
    input.on("error", reject);
    child.stdin.on("error", reject);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(stderr.trim() || `${command} termino con codigo ${code}`));
      }
    });
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
