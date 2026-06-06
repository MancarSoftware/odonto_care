import { motion } from "framer-motion";
import {
  Archive,
  Clock3,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  Image,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  apiBlob,
  apiDelete,
  apiForm,
  apiGet,
  apiPatch,
  apiPost,
} from "@/lib/api";

type BackupFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
type BackupOperation = "BACKUP" | "RESTORE";
type BackupSource = "MANUAL" | "AUTOMATIC" | "IMPORTED" | "SAFETY";
type BackupStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

type BackupSettings = {
  automaticEnabled: boolean;
  backupDirectory: string;
  frequency: BackupFrequency;
  id: string;
  includeUploads: boolean;
  lastAutomaticBackupAt: string | null;
  retentionCount: number;
  scheduledHour: number;
  updatedAt: string;
};

type BackupJob = {
  createdAt: string;
  errorMessage: string | null;
  fileName: string | null;
  filePath: string | null;
  finishedAt: string | null;
  id: string;
  includesUploads: boolean;
  operation: BackupOperation;
  sizeBytes: number | null;
  source: BackupSource;
  startedAt: string | null;
  status: BackupStatus;
};

type BackupsPanelProps = {
  onUnauthorized: () => void;
  token: string;
};

const frequencyLabels: Record<BackupFrequency, string> = {
  DAILY: "Diario",
  MONTHLY: "Mensual",
  WEEKLY: "Semanal",
};

const sourceLabels: Record<BackupSource, string> = {
  AUTOMATIC: "Automatico",
  IMPORTED: "Importado",
  MANUAL: "Manual",
  SAFETY: "Seguridad",
};

const statusLabels: Record<BackupStatus, string> = {
  COMPLETED: "Completado",
  FAILED: "Fallido",
  PENDING: "Pendiente",
  RUNNING: "En proceso",
};

export function BackupsPanel({
  onUnauthorized,
  token,
}: BackupsPanelProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BackupSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [operationId, setOperationId] = useState<string | null>(null);

  const isOperationRunning =
    operationId !== null ||
    jobs.some((job) => job.status === "PENDING" || job.status === "RUNNING");

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!isOperationRunning || operationId !== null) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadJobs(false);
    }, 3000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOperationRunning, operationId, token]);

  const metrics = useMemo(() => {
    const completedBackups = jobs.filter(
      (job) => job.operation === "BACKUP" && job.status === "COMPLETED",
    );
    const latest = completedBackups[0] ?? null;

    return {
      failed: jobs.filter((job) => job.status === "FAILED").length,
      latest,
      storage: completedBackups.reduce(
        (total, job) => total + (job.sizeBytes ?? 0),
        0,
      ),
      total: completedBackups.length,
    };
  }, [jobs]);

  async function loadAll() {
    setError(null);
    setIsLoading(true);

    try {
      const [settings, history] = await Promise.all([
        apiGet<BackupSettings>("/backups/settings", token),
        apiGet<BackupJob[]>("/backups", token),
      ]);
      setForm(settings);
      setJobs(history);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadJobs(showError = true) {
    try {
      setJobs(await apiGet<BackupJob[]>("/backups", token));
    } catch (requestError) {
      if (showError) {
        handleRequestError(requestError);
      }
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const settings = await apiPatch<BackupSettings>(
        "/backups/settings",
        {
          automaticEnabled: form.automaticEnabled,
          backupDirectory: form.backupDirectory.trim(),
          frequency: form.frequency,
          includeUploads: form.includeUploads,
          retentionCount: Number(form.retentionCount),
          scheduledHour: Number(form.scheduledHour),
        },
        token,
      );
      setForm(settings);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChooseDirectory() {
    if (!form) {
      return;
    }

    const selectedDirectory =
      await window.odontoCare?.chooseBackupDirectory?.();

    if (selectedDirectory) {
      setForm({ ...form, backupDirectory: selectedDirectory });
    }
  }

  async function handleCreateBackup() {
    setError(null);
    setOperationId("create");

    try {
      await apiPost<BackupJob>("/backups", {}, token);
      await loadJobs();
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setOperationId(null);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setError(null);
    setOperationId("import");

    try {
      await apiForm<BackupJob>("/backups/import", formData, token);
      await loadJobs();
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setOperationId(null);
    }
  }

  async function handleDownload(job: BackupJob) {
    setError(null);
    setOperationId(`download-${job.id}`);

    try {
      const blob = await apiBlob(`/backups/${job.id}/download`, token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = job.fileName ?? "odontocare-backup.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setOperationId(null);
    }
  }

  async function handleRestore(job: BackupJob) {
    const confirmed = window.confirm(
      `Restaurar ${job.fileName ?? "este backup"}? Se creara una copia de seguridad del estado actual antes de continuar.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setOperationId(`restore-${job.id}`);

    try {
      await apiPost<BackupJob>(`/backups/${job.id}/restore`, {}, token);
      await loadJobs();
    } catch (requestError) {
      handleRequestError(requestError);
      await loadJobs(false);
    } finally {
      setOperationId(null);
    }
  }

  async function handleDelete(job: BackupJob) {
    if (
      !window.confirm(
        `Eliminar ${job.fileName ?? "este backup"} del historial y del disco?`,
      )
    ) {
      return;
    }

    setError(null);
    setOperationId(`delete-${job.id}`);

    try {
      await apiDelete<{ id: string }>(`/backups/${job.id}`, token);
      await loadJobs();
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setOperationId(null);
    }
  }

  function handleRequestError(requestError: unknown) {
    const message =
      requestError instanceof Error
        ? requestError.message
        : "No se pudo completar la operacion";

    if (message.includes("401") || message.toLowerCase().includes("sesion")) {
      onUnauthorized();
      return;
    }

    setError(message);
  }

  if (isLoading || !form) {
    return <BackupsSkeleton />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BackupMetric
          icon={Archive}
          label="Backups disponibles"
          value={String(metrics.total)}
        />
        <BackupMetric
          icon={Clock3}
          label="Ultimo backup"
          value={
            metrics.latest
              ? formatCompactDate(metrics.latest.createdAt)
              : "Sin registros"
          }
        />
        <BackupMetric
          icon={HardDrive}
          label="Espacio utilizado"
          value={formatBytes(metrics.storage)}
        />
        <BackupMetric
          danger={metrics.failed > 0}
          icon={ShieldCheck}
          label="Operaciones fallidas"
          value={String(metrics.failed)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Programacion automatica</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Destino, frecuencia y politica de conservacion.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSave}>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-foreground">
                  Carpeta de backups
                </span>
                <div className="flex gap-2">
                  <Input
                    onChange={(event) =>
                      setForm({
                        ...form,
                        backupDirectory: event.target.value,
                      })
                    }
                    value={form.backupDirectory}
                  />
                  <Button
                    aria-label="Seleccionar carpeta"
                    onClick={() => void handleChooseDirectory()}
                    size="icon"
                    title="Seleccionar carpeta"
                    type="button"
                    variant="outline"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </label>

              <BackupField label="Frecuencia">
                <BackupSelect
                  onChange={(value) =>
                    setForm({
                      ...form,
                      frequency: value as BackupFrequency,
                    })
                  }
                  value={form.frequency}
                >
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </BackupSelect>
              </BackupField>

              <BackupField label="Hora de ejecucion">
                <Input
                  max={23}
                  min={0}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      scheduledHour: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={form.scheduledHour}
                />
              </BackupField>

              <BackupField label="Backups automaticos conservados">
                <Input
                  max={100}
                  min={1}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      retentionCount: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={form.retentionCount}
                />
              </BackupField>

              <div className="space-y-3">
                <BackupCheckbox
                  checked={form.automaticEnabled}
                  label="Backups automaticos"
                  onChange={(checked) =>
                    setForm({ ...form, automaticEnabled: checked })
                  }
                />
                <BackupCheckbox
                  checked={form.includeUploads}
                  label="Incluir imagenes y documentos"
                  onChange={(checked) =>
                    setForm({ ...form, includeUploads: checked })
                  }
                />
              </div>

              <div className="flex justify-end border-t border-border pt-5 md:col-span-2">
                <Button disabled={isSaving || isOperationRunning} type="submit">
                  <Save className="h-4 w-4" />
                  {isSaving ? "Guardando..." : "Guardar configuracion"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Acciones</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Operaciones locales del sistema.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isOperationRunning}
              onClick={() => void handleCreateBackup()}
              type="button"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-foreground">
                  Crear backup ahora
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  PostgreSQL {form.includeUploads ? "y archivos" : ""}
                </span>
              </span>
            </button>

            <button
              className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isOperationRunning}
              onClick={() => importInputRef.current?.click()}
              type="button"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                <Upload className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-foreground">
                  Importar backup
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Archivo ZIP de OdontoCare
                </span>
              </span>
            </button>

            <input
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => void handleImport(event)}
              ref={importInputRef}
              type="file"
            />

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                {form.includeUploads ? (
                  <Image className="h-4 w-4 text-primary" />
                ) : (
                  <Database className="h-4 w-4 text-primary" />
                )}
                Contenido actual
              </div>
              <div className="mt-2 text-xs leading-5 text-muted-foreground">
                Base de datos
                {form.includeUploads
                  ? ", imagenes, radiografias y documentos."
                  : "."}
              </div>
            </div>

            {isOperationRunning && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Procesando operacion...
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Historial</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Copias, restauraciones y resultados recientes.
            </p>
          </div>
          <Button
            aria-label="Actualizar historial"
            disabled={operationId !== null}
            onClick={() => void loadJobs()}
            size="icon"
            title="Actualizar historial"
            variant="outline"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 && (
            <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              No hay backups registrados.
            </div>
          )}

          {jobs.map((job, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_130px_120px_150px]"
              initial={{ opacity: 0, y: 5 }}
              key={job.id}
              transition={{ delay: index * 0.015, duration: 0.2 }}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  {job.operation === "RESTORE" ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">
                    {job.operation === "RESTORE"
                      ? `Restauracion: ${job.fileName ?? "backup"}`
                      : job.fileName ?? "Backup sin archivo"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDateTime(job.createdAt)}</span>
                    <span>{sourceLabels[job.source]}</span>
                    {job.operation === "BACKUP" && (
                      <span>
                        {job.includesUploads
                          ? "Con archivos clinicos"
                          : "Solo base de datos"}
                      </span>
                    )}
                  </div>
                  {job.errorMessage && (
                    <div className="mt-2 text-xs font-semibold text-danger">
                      {job.errorMessage}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Tamano
                </div>
                <div className="mt-2 text-sm font-bold text-foreground">
                  {job.operation === "BACKUP"
                    ? formatBytes(job.sizeBytes ?? 0)
                    : "Registro"}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Estado
                </div>
                <div className="mt-2">
                  <BackupStatusBadge status={job.status} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-1">
                {job.operation === "BACKUP" &&
                  job.status === "COMPLETED" && (
                    <>
                      <Button
                        aria-label="Descargar backup"
                        disabled={isOperationRunning}
                        onClick={() => void handleDownload(job)}
                        size="icon"
                        title="Descargar backup"
                        variant="ghost"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label="Restaurar backup"
                        disabled={isOperationRunning}
                        onClick={() => void handleRestore(job)}
                        size="icon"
                        title="Restaurar backup"
                        variant="ghost"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label="Eliminar backup"
                        disabled={isOperationRunning}
                        onClick={() => void handleDelete(job)}
                        size="icon"
                        title="Eliminar backup"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </>
                  )}
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function BackupMetric({
  danger = false,
  icon: Icon,
  label,
  value,
}: {
  danger?: boolean;
  icon: typeof Archive;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${
            danger ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold text-foreground">
            {value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BackupStatusBadge({ status }: { status: BackupStatus }) {
  const variant =
    status === "COMPLETED"
      ? "success"
      : status === "FAILED"
        ? "danger"
        : status === "RUNNING"
          ? "default"
          : "warning";

  return <Badge variant={variant}>{statusLabels[status]}</Badge>;
}

function BackupField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function BackupSelect({
  children,
  onChange,
  value,
}: {
  children: React.ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function BackupCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function BackupsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-24 animate-pulse rounded-lg border border-border bg-muted"
            key={index}
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg border border-border bg-muted" />
    </div>
  );
}

function formatBytes(value: number) {
  if (value <= 0) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** unitIndex;

  return `${amount.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
