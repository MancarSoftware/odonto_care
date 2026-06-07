import { motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  DollarSign,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

type TreatmentStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type ApiPatient = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
};

type ApiTreatment = {
  id: string;
  name: string;
  description: string | null;
  status: TreatmentStatus;
  estimatedCost: number | string | null;
  toothNumber: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  doctor: { fullName: string; id: string } | null;
  patient: ApiPatient;
  payments: Array<{ amount: number | string; status: string }>;
};

type TreatmentForm = {
  description: string;
  estimatedCost: string;
  name: string;
  patientId: string;
  status: TreatmentStatus;
  toothNumber: string;
};

type TreatmentsPageProps = {
  openCreate: boolean;
  onUnauthorized: () => void;
  patientContextId: string | null;
  token: string;
};

const statusLabels: Record<TreatmentStatus, string> = {
  CANCELLED: "Cancelado",
  COMPLETED: "Finalizado",
  IN_PROGRESS: "En progreso",
  PLANNED: "Planificado",
};

const statusTone: Record<
  TreatmentStatus,
  "default" | "success" | "warning" | "danger"
> = {
  CANCELLED: "danger",
  COMPLETED: "success",
  IN_PROGRESS: "warning",
  PLANNED: "default",
};

export function TreatmentsPage({
  openCreate,
  onUnauthorized,
  patientContextId,
  token,
}: TreatmentsPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    patientContextId,
  );
  const [treatments, setTreatments] = useState<ApiTreatment[]>([]);

  useEffect(() => {
    if (openCreate && patients.length > 0) {
      setIsCreateOpen(true);
    }
  }, [openCreate, patients.length]);

  useEffect(() => {
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedPatientId) {
      setTreatments([]);
      return;
    }

    void loadTreatments(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, token]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const filteredTreatments = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return treatments;
    }

    return treatments.filter((treatment) =>
      [treatment.name, treatment.description ?? "", String(treatment.toothNumber ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [query, treatments]);

  const stats = useMemo(() => {
    const active = treatments.filter(
      (treatment) => treatment.status === "IN_PROGRESS",
    ).length;
    const completed = treatments.filter(
      (treatment) => treatment.status === "COMPLETED",
    ).length;
    const estimated = treatments.reduce(
      (total, treatment) => total + toNumber(treatment.estimatedCost),
      0,
    );
    const paid = treatments.reduce(
      (total, treatment) =>
        total +
        treatment.payments
          .filter((payment) => payment.status === "PAID")
          .reduce((paymentTotal, payment) => paymentTotal + toNumber(payment.amount), 0),
      0,
    );

    return { active, completed, estimated, paid, total: treatments.length };
  }, [treatments]);

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

  async function loadTreatments(patientId: string) {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiGet<ApiTreatment[]>(
        `/treatments?patientId=${encodeURIComponent(patientId)}`,
        token,
      );
      setTreatments(response);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(form: TreatmentForm) {
    setError(null);

    const payload = {
      description: form.description.trim() || undefined,
      estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
      name: form.name.trim(),
      patientId: form.patientId,
      status: form.status,
      toothNumber: form.toothNumber ? Number(form.toothNumber) : undefined,
    };

    await apiPost<ApiTreatment>("/treatments", payload, token);
    setIsCreateOpen(false);
    setSelectedPatientId(form.patientId);
    await loadTreatments(form.patientId);
  }

  async function handleStatusChange(id: string, status: TreatmentStatus) {
    setError(null);

    try {
      await apiPatch<ApiTreatment>(`/treatments/${id}`, { status }, token);

      if (selectedPatientId) {
        await loadTreatments(selectedPatientId);
      }
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Eliminar este tratamiento?")) {
      return;
    }

    setError(null);

    try {
      await apiDelete<{ id: string }>(`/treatments/${id}`, token);

      if (selectedPatientId) {
        await loadTreatments(selectedPatientId);
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
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            Plan clinico
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Tratamientos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planifica, controla avance y revisa pagos asociados por paciente.
          </p>
        </div>
        <Button
          disabled={!patients.length}
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nuevo tratamiento
        </Button>
      </section>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={ClipboardList} label="Total" value={String(stats.total)} />
        <MetricCard icon={PlayCircle} label="En progreso" value={String(stats.active)} />
        <MetricCard icon={CheckCircle2} label="Finalizados" value={String(stats.completed)} />
        <MetricCard
          icon={DollarSign}
          label="Pagado / estimado"
          value={`${formatCurrency(stats.paid)} / ${formatCurrency(stats.estimated)}`}
        />
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
                  ? `Plan de ${formatPatientName(selectedPatient)}`
                  : "Plan de tratamiento"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Estados clinicos y avance por pieza dental.
              </p>
            </div>
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tratamiento o pieza"
                value={query}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <ListSkeleton />}

            {!isLoading && filteredTreatments.length === 0 && (
              <EmptyState onCreate={() => setIsCreateOpen(true)} />
            )}

            {!isLoading &&
              filteredTreatments.map((treatment, index) => (
                <TreatmentRow
                  key={treatment.id}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  treatment={treatment}
                  index={index}
                />
              ))}
          </CardContent>
        </Card>
      </section>

      {isCreateOpen && (
        <TreatmentModal
          initialPatientId={selectedPatientId}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
          patients={patients}
        />
      )}
    </div>
  );
}

function TreatmentRow({
  index,
  onDelete,
  onStatusChange,
  treatment,
}: {
  index: number;
  onDelete: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: TreatmentStatus) => Promise<void>;
  treatment: ApiTreatment;
}) {
  const paid = treatment.payments
    .filter((payment) => payment.status === "PAID")
    .reduce((total, payment) => total + toNumber(payment.amount), 0);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_150px_170px_150px]"
      initial={{ opacity: 0, y: 8 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-bold text-foreground">
            {treatment.name}
          </div>
          <Badge variant={statusTone[treatment.status]}>
            {statusLabels[treatment.status]}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
          <span>{formatPatientName(treatment.patient)}</span>
          <span>{treatment.toothNumber ? `Pieza ${treatment.toothNumber}` : "Sin pieza"}</span>
          <span>{treatment.doctor?.fullName ?? "Sin odontologo asignado"}</span>
        </div>
        {treatment.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {treatment.description}
          </p>
        )}
      </div>

      <MiniInfo
        label="Estimado"
        value={formatCurrency(toNumber(treatment.estimatedCost))}
      />
      <MiniInfo label="Pagado" value={formatCurrency(paid)} />

      <div className="flex items-center justify-end gap-2">
        {treatment.status !== "IN_PROGRESS" && (
          <Button
            aria-label="Iniciar tratamiento"
            onClick={() => void onStatusChange(treatment.id, "IN_PROGRESS")}
            size="icon"
            variant="outline"
          >
            <PlayCircle className="h-4 w-4" />
          </Button>
        )}
        {treatment.status !== "COMPLETED" && (
          <Button
            aria-label="Finalizar tratamiento"
            onClick={() => void onStatusChange(treatment.id, "COMPLETED")}
            size="icon"
            variant="outline"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          aria-label="Eliminar tratamiento"
          onClick={() => void onDelete(treatment.id)}
          size="icon"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </motion.div>
  );
}

function TreatmentModal({
  initialPatientId,
  onClose,
  onCreate,
  patients,
}: {
  initialPatientId: string | null;
  onClose: () => void;
  onCreate: (form: TreatmentForm) => Promise<void>;
  patients: ApiPatient[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TreatmentForm>({
    description: "",
    estimatedCost: "",
    name: "",
    patientId: initialPatientId ?? patients[0]?.id ?? "",
    status: "PLANNED",
    toothNumber: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.patientId || !form.name.trim()) {
      setError("Paciente y nombre del tratamiento son obligatorios");
      return;
    }

    if (form.estimatedCost && Number(form.estimatedCost) <= 0) {
      setError("El costo estimado debe ser mayor a cero");
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el tratamiento",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof TreatmentForm>(
    field: K,
    value: TreatmentForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[760px] rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              Nuevo tratamiento
            </div>
            <div className="text-sm text-muted-foreground">
              Plan clinico y presupuesto inicial
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
            <Field label="Estado">
              <Select
                onChange={(value) =>
                  updateField("status", value as TreatmentStatus)
                }
                value={form.status}
              >
                {(Object.keys(statusLabels) as TreatmentStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nombre">
              <Input
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Endodoncia, limpieza, resina..."
                value={form.name}
              />
            </Field>
            <Field label="Pieza dental">
              <Input
                max={48}
                min={11}
                onChange={(event) => updateField("toothNumber", event.target.value)}
                placeholder="Ej. 26"
                type="number"
                value={form.toothNumber}
              />
            </Field>
            <Field label="Costo estimado">
              <Input
                min="0"
                onChange={(event) =>
                  updateField("estimatedCost", event.target.value)
                }
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.estimatedCost}
              />
            </Field>
            <Field className="md:col-span-2" label="Descripcion">
              <textarea
                className="min-h-28 w-full resize-none rounded-lg border border-border bg-card px-3 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Diagnostico, alcance, materiales o notas del plan..."
                value={form.description}
              />
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
              {isSubmitting ? "Guardando..." : "Guardar tratamiento"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-extrabold text-foreground">
            {value}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary/10 text-primary">
          <Clock3 className="h-7 w-7" />
        </div>
        <div className="mt-4 text-base font-bold text-foreground">
          Sin tratamientos registrados
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Crea un plan para comenzar el seguimiento clinico.
        </p>
        <Button className="mt-5" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Nuevo tratamiento
        </Button>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="grid animate-pulse gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_150px_170px_150px]"
          key={index}
        >
          <div className="space-y-3">
            <div className="h-4 w-56 rounded bg-muted" />
            <div className="h-3 w-72 rounded bg-muted" />
          </div>
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
        </div>
      ))}
    </>
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-EC", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
