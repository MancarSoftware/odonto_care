import { motion } from "framer-motion";
import {
  Download,
  FileImage,
  FileText,
  Images,
  Maximize2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiBlob, apiDelete, apiForm, apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

type MediaType = "IMAGE" | "XRAY" | "PDF" | "DOCUMENT";

type ApiPatient = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
};

type ApiMediaAsset = {
  id: string;
  type: MediaType;
  label: string | null;
  filePath: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
};

type MediaForm = {
  file: File | null;
  label: string;
  patientId: string;
  type: MediaType;
};

type MediaPageProps = {
  onUnauthorized: () => void;
  patientContextId: string | null;
  token: string;
};

const typeLabels: Record<MediaType, string> = {
  DOCUMENT: "Documento",
  IMAGE: "Imagen",
  PDF: "PDF",
  XRAY: "Radiografia",
};

const typeTone: Record<MediaType, "default" | "success" | "warning" | "danger"> = {
  DOCUMENT: "default",
  IMAGE: "success",
  PDF: "danger",
  XRAY: "warning",
};

export function MediaPage({
  onUnauthorized,
  patientContextId,
  token,
}: MediaPageProps) {
  const [assets, setAssets] = useState<ApiMediaAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    patientContextId,
  );

  useEffect(() => {
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedPatientId) {
      setAssets([]);
      return;
    }

    void loadAssets(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, token]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const filteredAssets = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return assets;
    }

    return assets.filter((asset) =>
      [asset.label ?? "", typeLabels[asset.type], asset.mimeType]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [assets, query]);

  const stats = useMemo(
    () => ({
      docs: assets.filter((asset) => asset.type === "DOCUMENT").length,
      images: assets.filter((asset) => asset.type === "IMAGE").length,
      pdfs: assets.filter((asset) => asset.type === "PDF").length,
      xrays: assets.filter((asset) => asset.type === "XRAY").length,
    }),
    [assets],
  );

  async function loadPatients() {
    setError(null);

    try {
      const response = await apiGet<ApiPatient[]>("/patients", token);
      setPatients(response);

      if (!response.length) {
        setSelectedPatientId(null);
      } else if (
        !selectedPatientId ||
        !response.some((patient) => patient.id === selectedPatientId)
      ) {
        setSelectedPatientId(patientContextId ?? response[0]?.id ?? null);
      }
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function loadAssets(patientId: string) {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiGet<ApiMediaAsset[]>(
        `/media?patientId=${encodeURIComponent(patientId)}`,
        token,
      );
      setAssets(response);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload(form: MediaForm) {
    if (!form.file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", form.file);
    formData.append("patientId", form.patientId);
    formData.append("type", form.type);

    if (form.label.trim()) {
      formData.append("label", form.label.trim());
    }

    await apiForm<ApiMediaAsset>("/media/upload", formData, token);
    setIsUploadOpen(false);
    setSelectedPatientId(form.patientId);
    await loadAssets(form.patientId);
  }

  async function handleOpen(asset: ApiMediaAsset) {
    setError(null);

    try {
      const blob = await apiBlob(`/media/${asset.id}/file`, token);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Eliminar este archivo?")) {
      return;
    }

    setError(null);

    try {
      await apiDelete<{ id: string }>(`/media/${id}`, token);

      if (selectedPatientId) {
        await loadAssets(selectedPatientId);
      }
    } catch (requestError) {
      handleRequestError(requestError);
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

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-5">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
            <Images className="h-3.5 w-3.5 text-primary" />
            Archivo clinico
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Imagenes y radiografias
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona imagenes, PDFs y radiografias guardadas localmente.
          </p>
        </div>
        <Button
          disabled={!patients.length}
          onClick={() => setIsUploadOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Subir archivo
        </Button>
      </section>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Imagenes" value={String(stats.images)} />
        <MetricCard label="Radiografias" value={String(stats.xrays)} />
        <MetricCard label="PDFs" value={String(stats.pdfs)} />
        <MetricCard label="Documentos" value={String(stats.docs)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pacientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {patients.map((patient) => {
              const isSelected = patient.id === selectedPatientId;

              return (
                <button
                  className={cn(
                    "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                    isSelected
                      ? "border-primary/35 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/60",
                  )}
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  type="button"
                >
                  <div className="truncate text-sm font-bold text-foreground">
                    {formatPatientName(patient)}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-muted-foreground">
                    {patient.code}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="min-h-[620px]">
          <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {selectedPatient
                  ? `Archivos de ${formatPatientName(selectedPatient)}`
                  : "Archivos del paciente"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Se guardan en disco local; PostgreSQL conserva metadatos.
              </p>
            </div>
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar archivo"
                value={query}
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && <MediaSkeleton />}

            {!isLoading && filteredAssets.length === 0 && (
              <EmptyState onUpload={() => setIsUploadOpen(true)} />
            )}

            {!isLoading && filteredAssets.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredAssets.map((asset, index) => (
                  <MediaCard
                    asset={asset}
                    index={index}
                    key={asset.id}
                    onDelete={handleDelete}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {isUploadOpen && (
        <UploadModal
          initialPatientId={selectedPatientId}
          onClose={() => setIsUploadOpen(false)}
          onUpload={handleUpload}
          patients={patients}
        />
      )}
    </div>
  );
}

function MediaCard({
  asset,
  index,
  onDelete,
  onOpen,
}: {
  asset: ApiMediaAsset;
  index: number;
  onDelete: (id: string) => Promise<void>;
  onOpen: (asset: ApiMediaAsset) => Promise<void>;
}) {
  const Icon = asset.type === "PDF" || asset.type === "DOCUMENT" ? FileText : FileImage;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-lg border border-border bg-card"
      initial={{ opacity: 0, y: 8 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <div className="grid aspect-[4/3] place-items-center bg-muted/40">
        <div className="grid h-16 w-16 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">
              {asset.label || "Archivo clinico"}
            </div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">
              {formatDate(asset.createdAt)} · {formatFileSize(asset.sizeBytes)}
            </div>
          </div>
          <Badge variant={typeTone[asset.type]}>{typeLabels[asset.type]}</Badge>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            aria-label="Abrir archivo"
            onClick={() => void onOpen(asset)}
            size="icon"
            variant="outline"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Descargar o ver archivo"
            onClick={() => void onOpen(asset)}
            size="icon"
            variant="outline"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Eliminar archivo"
            onClick={() => void onDelete(asset.id)}
            size="icon"
            variant="ghost"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function UploadModal({
  initialPatientId,
  onClose,
  onUpload,
  patients,
}: {
  initialPatientId: string | null;
  onClose: () => void;
  onUpload: (form: MediaForm) => Promise<void>;
  patients: ApiPatient[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MediaForm>({
    file: null,
    label: "",
    patientId: initialPatientId ?? patients[0]?.id ?? "",
    type: "IMAGE",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.patientId || !form.file) {
      setError("Paciente y archivo son obligatorios");
      return;
    }

    setIsSubmitting(true);

    try {
      await onUpload(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo subir el archivo",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof MediaForm>(field: K, value: MediaForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[700px] rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              Subir archivo
            </div>
            <div className="text-sm text-muted-foreground">
              Imagen, radiografia, PDF o documento
            </div>
          </div>
          <Button aria-label="Cerrar" onClick={onClose} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Paciente">
              <Select
                onChange={(value) => updateField("patientId", value)}
                value={form.patientId}
              >
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {formatPatientName(patient)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select
                onChange={(value) => updateField("type", value as MediaType)}
                value={form.type}
              >
                {(Object.keys(typeLabels) as MediaType[]).map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="md:col-span-2" label="Etiqueta">
              <Input
                onChange={(event) => updateField("label", event.target.value)}
                placeholder="Panoramica inicial, antes/despues..."
                value={form.label}
              />
            </Field>
            <Field className="md:col-span-2" label="Archivo">
              <label className="grid min-h-36 cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-muted/35 px-4 py-8 text-center transition-colors hover:bg-muted/55">
                <input
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(event) =>
                    updateField("file", event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-foreground">
                    {form.file ? form.file.name : "Seleccionar archivo"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Maximo 35 MB
                  </div>
                </div>
              </label>
            </Field>
          </div>

          {error && (
            <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Subiendo..." : "Guardar archivo"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-2xl font-extrabold text-foreground">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary/10 text-primary">
          <Images className="h-7 w-7" />
        </div>
        <div className="mt-4 text-base font-bold text-foreground">
          Sin archivos registrados
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Sube imagenes, radiografias o PDFs del paciente.
        </p>
        <Button className="mt-5" onClick={onUpload}>
          <Plus className="h-4 w-4" />
          Subir archivo
        </Button>
      </div>
    </div>
  );
}

function MediaSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="overflow-hidden rounded-lg border border-border bg-card"
          key={index}
        >
          <div className="aspect-[4/3] animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  children,
  onChange,
  value,
}: {
  children: ReactNode;
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

function formatPatientName(patient: Pick<ApiPatient, "firstName" | "lastName">) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatFileSize(size: number | null): string {
  if (!size) {
    return "Tamano no disponible";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
