import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Plus,
  RotateCcw,
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

type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

type ApiPatient = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
};

type ApiAppointment = {
  id: string;
  title: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  color: string | null;
  notes: string | null;
  billingSummary?: {
    hasPendingBalance: boolean;
    pendingAmount: number;
    pendingPayments: number;
  };
  patient: ApiPatient;
  doctor: { fullName: string; id: string } | null;
};

type AppointmentForm = {
  date: string;
  endsAt: string;
  notes: string;
  patientId: string;
  startsAt: string;
  status: AppointmentStatus;
  title: string;
};

type AppointmentsPageProps = {
  onUnauthorized: () => void;
  patientContextId: string | null;
  token: string;
};

const statusLabels: Record<AppointmentStatus, string> = {
  CANCELLED: "Cancelada",
  COMPLETED: "Atendida",
  CONFIRMED: "Confirmada",
  PENDING: "Pendiente",
};

const statusTone: Record<
  AppointmentStatus,
  "default" | "success" | "warning" | "danger"
> = {
  CANCELLED: "danger",
  COMPLETED: "success",
  CONFIRMED: "default",
  PENDING: "warning",
};

export function AppointmentsPage({
  onUnauthorized,
  patientContextId,
  token,
}: AppointmentsPageProps) {
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [currentDate, setCurrentDate] = useState(() => startOfWeek(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [query, setQuery] = useState("");

  const weekDays = useMemo(() => buildWeek(currentDate), [currentDate]);
  const firstWeekDay = weekDays[0] ?? currentDate;
  const lastWeekDay = weekDays[6] ?? currentDate;
  const rangeLabel = `${formatShortDate(firstWeekDay)} - ${formatShortDate(lastWeekDay)}`;

  useEffect(() => {
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, token]);

  const stats = useMemo(
    () => ({
      cancelled: appointments.filter((item) => item.status === "CANCELLED").length,
      completed: appointments.filter((item) => item.status === "COMPLETED").length,
      confirmed: appointments.filter((item) => item.status === "CONFIRMED").length,
      pending: appointments.filter((item) => item.status === "PENDING").length,
      total: appointments.length,
    }),
    [appointments],
  );

  const filteredAppointments = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return appointments;
    }

    return appointments.filter((appointment) =>
      [
        appointment.title,
        appointment.notes ?? "",
        appointment.status,
        appointment.patient.firstName,
        appointment.patient.lastName,
        appointment.patient.code,
        formatTimeRange(appointment.startsAt, appointment.endsAt),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [appointments, query]);

  async function loadPatients() {
    setError(null);

    try {
      const response = await apiGet<ApiPatient[]>("/patients", token);
      setPatients(response);
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function loadAppointments() {
    setError(null);
    setIsLoading(true);

    const from = toDateInput(firstWeekDay);
    const to = toDateInput(addDays(lastWeekDay, 1));

    try {
      const response = await apiGet<ApiAppointment[]>(
        `/appointments?from=${from}&to=${to}`,
        token,
      );
      setAppointments(response);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(form: AppointmentForm) {
    const startsAt = toLocalIso(form.date, form.startsAt);
    const endsAt = toLocalIso(form.date, form.endsAt);

    await apiPost<ApiAppointment>(
      "/appointments",
      {
        endsAt,
        notes: form.notes.trim() || undefined,
        patientId: form.patientId,
        startsAt,
        status: form.status,
        title: form.title.trim(),
      },
      token,
    );

    setIsCreateOpen(false);
    setCurrentDate(startOfWeek(new Date(startsAt)));
    await loadAppointments();
  }

  async function handleStatusChange(id: string, status: AppointmentStatus) {
    setError(null);

    try {
      await apiPatch<ApiAppointment>(`/appointments/${id}`, { status }, token);
      await loadAppointments();
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Eliminar esta cita?")) {
      return;
    }

    setError(null);

    try {
      await apiDelete<{ id: string }>(`/appointments/${id}`, token);
      await loadAppointments();
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
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            Agenda clinica
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organiza citas por semana, confirma asistencia y registra atencion.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setCurrentDate(startOfWeek(new Date()))}
            variant="outline"
          >
            <RotateCcw className="h-4 w-4" />
            Hoy
          </Button>
          <Button disabled={!patients.length} onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva cita
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Citas" value={String(stats.total)} />
        <MetricCard label="Pendientes" value={String(stats.pending)} />
        <MetricCard label="Confirmadas" value={String(stats.confirmed)} />
        <MetricCard label="Atendidas" value={String(stats.completed)} />
        <MetricCard label="Canceladas" value={String(stats.cancelled)} />
      </section>

      <Card className="min-h-[680px]">
        <CardHeader className="flex-col items-stretch gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Semana</CardTitle>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {rangeLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cita o paciente"
                value={query}
              />
            </div>
            <Button
              onClick={() => setCurrentDate((date) => addDays(date, -7))}
              variant="outline"
            >
              Anterior
            </Button>
            <Button
              onClick={() => setCurrentDate((date) => addDays(date, 7))}
              variant="outline"
            >
              Siguiente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-5">
          {isLoading ? (
            <CalendarSkeleton />
          ) : (
            <div className="grid min-w-[1120px] grid-cols-7 gap-3">
              {weekDays.map((day) => (
                <DayColumn
                  appointments={filteredAppointments.filter((appointment) =>
                    isSameDate(new Date(appointment.startsAt), day),
                  )}
                  day={day}
                  key={day.toISOString()}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isCreateOpen && (
        <AppointmentModal
          initialPatientId={patientContextId}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
          patients={patients}
        />
      )}
    </div>
  );
}

function DayColumn({
  appointments,
  day,
  onDelete,
  onStatusChange,
}: {
  appointments: ApiAppointment[];
  day: Date;
  onDelete: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<void>;
}) {
  return (
    <div className="min-h-[540px] min-w-0 rounded-lg border border-border bg-muted/25 p-3">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs font-bold uppercase text-muted-foreground">
          {formatWeekDay(day)}
        </div>
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg text-sm font-extrabold",
            isSameDate(day, new Date())
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground",
          )}
        >
          {day.getDate()}
        </div>
      </div>

      <div className="space-y-2">
        {appointments.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/60 px-3 py-8 text-center text-xs font-semibold text-muted-foreground">
            Sin citas
          </div>
        )}

        {appointments.map((appointment, index) => {
          const hasPendingBalance =
            appointment.billingSummary?.hasPendingBalance ?? false;

          return (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/30"
              initial={{ opacity: 0, y: 8 }}
              key={appointment.id}
              transition={{ delay: index * 0.025, duration: 0.2 }}
            >
              <div className="space-y-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-extrabold leading-5 text-foreground">
                    {appointment.title}
                  </div>
                  <div className="mt-2 inline-flex whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                    {formatTimeRange(appointment.startsAt, appointment.endsAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusTone[appointment.status]}>
                    {statusLabels[appointment.status]}
                  </Badge>
                  {hasPendingBalance && (
                    <Badge variant="warning">
                      <CircleDollarSign className="mr-1 h-3.5 w-3.5" />
                      {formatCurrency(
                        appointment.billingSummary?.pendingAmount ?? 0,
                      )}
                    </Badge>
                  )}
                </div>

                <div className="truncate text-xs font-bold text-foreground">
                  {formatPatientName(appointment.patient)}
                </div>
                {appointment.notes && (
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {appointment.notes}
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-1 border-t border-border pt-3">
                {appointment.status !== "CONFIRMED" && (
                  <Button
                    aria-label="Confirmar cita"
                    className="h-8 w-8"
                    onClick={() =>
                      void onStatusChange(appointment.id, "CONFIRMED")
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
                {appointment.status !== "COMPLETED" && (
                  <Button
                    aria-label="Marcar atendida"
                    className="h-8 w-8"
                    onClick={() =>
                      void onStatusChange(appointment.id, "COMPLETED")
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <Clock3 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  aria-label="Eliminar cita"
                  className="h-8 w-8"
                  onClick={() => void onDelete(appointment.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentModal({
  initialPatientId,
  onClose,
  onCreate,
  patients,
}: {
  initialPatientId: string | null;
  onClose: () => void;
  onCreate: (form: AppointmentForm) => Promise<void>;
  patients: ApiPatient[];
}) {
  const now = new Date();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AppointmentForm>({
    date: toDateInput(now),
    endsAt: "10:30",
    notes: "",
    patientId: initialPatientId ?? patients[0]?.id ?? "",
    startsAt: "10:00",
    status: "PENDING",
    title: "Consulta odontologica",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.patientId || !form.title.trim()) {
      setError("Paciente y titulo son obligatorios");
      return;
    }

    if (toLocalIso(form.date, form.endsAt) <= toLocalIso(form.date, form.startsAt)) {
      setError("La hora final debe ser posterior a la hora inicial");
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear la cita",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof AppointmentForm>(
    field: K,
    value: AppointmentForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[720px] rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              Nueva cita
            </div>
            <div className="text-sm text-muted-foreground">
              Reserva rapida para agenda semanal
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
                  updateField("status", value as AppointmentStatus)
                }
                value={form.status}
              >
                {(Object.keys(statusLabels) as AppointmentStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Titulo">
              <Input
                onChange={(event) => updateField("title", event.target.value)}
                value={form.title}
              />
            </Field>
            <Field label="Fecha">
              <Input
                onChange={(event) => updateField("date", event.target.value)}
                type="date"
                value={form.date}
              />
            </Field>
            <Field label="Inicio">
              <Input
                onChange={(event) => updateField("startsAt", event.target.value)}
                type="time"
                value={form.startsAt}
              />
            </Field>
            <Field label="Fin">
              <Input
                onChange={(event) => updateField("endsAt", event.target.value)}
                type="time"
                value={form.endsAt}
              />
            </Field>
            <Field className="md:col-span-2" label="Notas">
              <textarea
                className="min-h-24 w-full resize-none rounded-lg border border-border bg-card px-3 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                onChange={(event) => updateField("notes", event.target.value)}
                value={form.notes}
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
              {isSubmitting ? "Guardando..." : "Guardar cita"}
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

function CalendarSkeleton() {
  return (
    <div className="grid min-w-[1120px] grid-cols-7 gap-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          className="min-h-[520px] animate-pulse rounded-lg border border-border bg-muted/35 p-3"
          key={index}
        >
          <div className="h-9 w-16 rounded bg-muted" />
          <div className="mt-4 h-24 rounded bg-card" />
          <div className="mt-3 h-28 rounded bg-card" />
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

function buildWeek(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatPatientName(patient: Pick<ApiPatient, "firstName" | "lastName">) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatWeekDay(date: Date): string {
  return new Intl.DateTimeFormat("es-EC", { weekday: "short" }).format(date);
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatClock(startsAt)} - ${formatClock(endsAt)}`;
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-EC", {
    currency: "USD",
    style: "currency",
  }).format(value);
}
