import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthenticatedUser } from "@/features/auth/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
type CalendarView = "day" | "week" | "month";

type ApiPatient = {
  code: string;
  firstName: string;
  id: string;
  lastName: string;
};

type ApiDoctor = {
  fullName: string;
  id: string;
  role: "ADMIN" | "DENTIST";
};

type ApiAppointment = {
  billingSummary?: {
    hasPendingBalance: boolean;
    pendingAmount: number;
    pendingPayments: number;
  };
  color: string | null;
  doctor: { fullName: string; id: string } | null;
  endsAt: string;
  id: string;
  notes: string | null;
  patient: ApiPatient;
  startsAt: string;
  status: AppointmentStatus;
  title: string;
};

type AppointmentForm = {
  color: string;
  date: string;
  doctorId: string;
  endsAt: string;
  notes: string;
  patientId: string;
  startsAt: string;
  status: AppointmentStatus;
  title: string;
};

type InitialSlot = {
  date: string;
  time: string;
};

type TimedAppointmentLayout = {
  appointment: ApiAppointment;
  column: number;
  columns: number;
};

type AppointmentsPageProps = {
  currentUser: AuthenticatedUser;
  openCreate: boolean;
  onUnauthorized: () => void;
  patientContextId: string | null;
  token: string;
};

const START_HOUR = 7;
const END_HOUR = 20;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 42;
const TIME_COLUMN_WIDTH = 72;

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

const viewLabels: Record<CalendarView, string> = {
  day: "Dia",
  month: "Mes",
  week: "Semana",
};

const appointmentColors = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
];

export function AppointmentsPage({
  currentUser,
  openCreate,
  onUnauthorized,
  patientContextId,
  token,
}: AppointmentsPageProps) {
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(
    null,
  );
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [editingAppointment, setEditingAppointment] =
    useState<ApiAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialSlot, setInitialSlot] = useState<InitialSlot | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<CalendarView>("week");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const visibleRange = useMemo(
    () => getVisibleRange(currentDate, view),
    [currentDate, view],
  );

  useEffect(() => {
    void loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange.from.getTime(), visibleRange.to.getTime(), token]);

  useEffect(() => {
    if (openCreate && patients.length > 0) {
      setInitialSlot({
        date: toDateInput(currentDate),
        time: nextHalfHour(new Date()),
      });
      setIsCreateOpen(true);
    }
    // currentDate is intentionally read only when the quick-create request opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreate, patients.length]);

  const filteredAppointments = useMemo(() => {
    const search = query.trim().toLowerCase();

    return appointments.filter((appointment) => {
      if (
        doctorFilter !== "all" &&
        appointment.doctor?.id !== doctorFilter
      ) {
        return false;
      }

      if (!search) return true;

      return [
        appointment.title,
        appointment.notes ?? "",
        appointment.patient.firstName,
        appointment.patient.lastName,
        appointment.patient.code,
        appointment.doctor?.fullName ?? "",
        statusLabels[appointment.status],
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [appointments, doctorFilter, query]);

  const stats = useMemo(
    () => ({
      cancelled: filteredAppointments.filter(
        (item) => item.status === "CANCELLED",
      ).length,
      completed: filteredAppointments.filter(
        (item) => item.status === "COMPLETED",
      ).length,
      confirmed: filteredAppointments.filter(
        (item) => item.status === "CONFIRMED",
      ).length,
      pending: filteredAppointments.filter(
        (item) => item.status === "PENDING",
      ).length,
      total: filteredAppointments.length,
    }),
    [filteredAppointments],
  );

  const activeAppointment =
    appointments.find((appointment) => appointment.id === activeAppointmentId) ??
    null;

  async function loadReferenceData() {
    setError(null);

    try {
      const [patientResponse, doctorResponse] = await Promise.all([
        apiGet<ApiPatient[]>("/patients", token),
        apiGet<ApiDoctor[]>("/appointments/doctors", token),
      ]);
      setPatients(patientResponse);
      setDoctors(doctorResponse);
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function loadAppointments() {
    setError(null);
    setIsLoading(true);

    try {
      setAppointments(
        await apiGet<ApiAppointment[]>(
          `/appointments?from=${encodeURIComponent(
            visibleRange.from.toISOString(),
          )}&to=${encodeURIComponent(visibleRange.to.toISOString())}`,
          token,
        ),
      );
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
      appointmentPayload(form, startsAt, endsAt),
      token,
    );

    setIsCreateOpen(false);
    setInitialSlot(null);
    setCurrentDate(startOfDay(new Date(startsAt)));
    await loadAppointments();
  }

  async function handleUpdate(form: AppointmentForm) {
    if (!editingAppointment) return;

    const startsAt = toLocalIso(form.date, form.startsAt);
    const endsAt = toLocalIso(form.date, form.endsAt);

    await apiPatch<ApiAppointment>(
      `/appointments/${editingAppointment.id}`,
      appointmentPayload(form, startsAt, endsAt),
      token,
    );

    setEditingAppointment(null);
    setCurrentDate(startOfDay(new Date(startsAt)));
    await loadAppointments();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Eliminar esta cita?")) return;

    try {
      await apiDelete<{ id: string }>(`/appointments/${id}`, token);
      setEditingAppointment(null);
      await loadAppointments();
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveAppointmentId(null);

    if (!event.over) return;

    const appointment = appointments.find(
      (item) => event.active.id === draggableId(item.id),
    );
    if (!appointment) return;

    const target = parseDropTarget(String(event.over.id));
    if (!target) return;

    const previousAppointments = appointments;
    const duration =
      new Date(appointment.endsAt).getTime() -
      new Date(appointment.startsAt).getTime();
    const originalStart = new Date(appointment.startsAt);
    const targetTime = target.time || toTimeInput(originalStart);
    const startsAt = toLocalIso(target.date, targetTime);
    const endsAt = new Date(new Date(startsAt).getTime() + duration).toISOString();

    if (startsAt === appointment.startsAt) return;

    setAppointments((current) =>
      current.map((item) =>
        item.id === appointment.id ? { ...item, endsAt, startsAt } : item,
      ),
    );
    setError(null);

    try {
      await apiPatch<ApiAppointment>(
        `/appointments/${appointment.id}`,
        { endsAt, startsAt },
        token,
      );
      setCurrentDate(startOfDay(new Date(startsAt)));
      await loadAppointments();
    } catch (requestError) {
      setAppointments(previousAppointments);
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

  function openCreateAt(date: Date, time = "09:00") {
    setInitialSlot({ date: toDateInput(date), time });
    setIsCreateOpen(true);
  }

  function navigate(direction: -1 | 1) {
    setCurrentDate((date) => {
      if (view === "day") return addDays(date, direction);
      if (view === "week") return addDays(date, direction * 7);
      return addMonths(date, direction);
    });
  }

  return (
    <DndContext
      onDragCancel={() => setActiveAppointmentId(null)}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragStart={(event: DragStartEvent) => {
        const id = String(event.active.id).replace("appointment:", "");
        setActiveAppointmentId(id);
      }}
      sensors={sensors}
    >
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
              Programa, edita y reubica citas en tiempo real.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setCurrentDate(startOfDay(new Date()))}
              variant="outline"
            >
              <RotateCcw className="h-4 w-4" />
              Hoy
            </Button>
            <Button
              disabled={!patients.length}
              onClick={() => openCreateAt(currentDate, nextHalfHour(new Date()))}
            >
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Citas visibles" value={String(stats.total)} />
          <MetricCard label="Pendientes" value={String(stats.pending)} />
          <MetricCard label="Confirmadas" value={String(stats.confirmed)} />
          <MetricCard label="Atendidas" value={String(stats.completed)} />
          <MetricCard label="Canceladas" value={String(stats.cancelled)} />
        </section>

        <Card className="min-h-[720px] overflow-hidden">
          <CardHeader className="flex-col items-stretch gap-4 border-b border-border lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button
                aria-label="Periodo anterior"
                onClick={() => navigate(-1)}
                size="icon"
                title="Periodo anterior"
                variant="outline"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Periodo siguiente"
                onClick={() => navigate(1)}
                size="icon"
                title="Periodo siguiente"
                variant="outline"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-2 min-w-0">
                <CardTitle className="capitalize">
                  {formatRangeLabel(currentDate, view)}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Arrastra una cita para reprogramarla.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 xl:flex-row">
              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-11"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Paciente, cita u odontologo"
                  value={query}
                />
              </div>
              <Select
                className="min-w-[190px]"
                onChange={setDoctorFilter}
                value={doctorFilter}
              >
                <option value="all">Todos los odontologos</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </Select>
              <div className="flex rounded-lg border border-border bg-muted/40 p-1">
                {(Object.keys(viewLabels) as CalendarView[]).map((option) => (
                  <button
                    className={cn(
                      "h-8 min-w-16 rounded-md px-3 text-xs font-semibold transition-colors",
                      view === option
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    key={option}
                    onClick={() => {
                      setView(option);
                      setCurrentDate(startOfDay(currentDate));
                    }}
                    type="button"
                  >
                    {viewLabels[option]}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <CalendarSkeleton view={view} />
            ) : view === "month" ? (
              <MonthView
                appointments={filteredAppointments}
                currentDate={currentDate}
                onCreate={openCreateAt}
                onEdit={setEditingAppointment}
              />
            ) : (
              <TimeGrid
                appointments={filteredAppointments}
                days={
                  view === "day"
                    ? [startOfDay(currentDate)]
                    : buildWeek(currentDate)
                }
                onCreate={openCreateAt}
                onEdit={setEditingAppointment}
                view={view}
              />
            )}
          </CardContent>
        </Card>

        {isCreateOpen && (
          <AppointmentModal
            currentUser={currentUser}
            doctors={doctors}
            initialPatientId={patientContextId}
            initialSlot={initialSlot}
            onClose={() => {
              setInitialSlot(null);
              setIsCreateOpen(false);
            }}
            onSubmit={handleCreate}
            patients={patients}
          />
        )}

        {editingAppointment && (
          <AppointmentModal
            appointment={editingAppointment}
            currentUser={currentUser}
            doctors={doctors}
            onClose={() => setEditingAppointment(null)}
            onDelete={() => handleDelete(editingAppointment.id)}
            onSubmit={handleUpdate}
            patients={patients}
          />
        )}
      </div>

      <DragOverlay>
        {activeAppointment ? (
          <AppointmentPreview appointment={activeAppointment} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function TimeGrid({
  appointments,
  days,
  onCreate,
  onEdit,
  view,
}: {
  appointments: ApiAppointment[];
  days: Date[];
  onCreate: (date: Date, time?: string) => void;
  onEdit: (appointment: ApiAppointment) => void;
  view: Exclude<CalendarView, "month">;
}) {
  const slots = buildTimeSlots();
  const bodyHeight = slots.length * SLOT_HEIGHT;
  const minWidth = view === "week" ? 1060 : 640;

  return (
    <div className="overflow-auto">
      <div style={{ minWidth }}>
        <div
          className="sticky top-0 z-10 grid border-b border-border bg-card"
          style={{
            gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="border-r border-border" />
          {days.map((day) => (
            <button
              className="flex h-16 items-center justify-center gap-2 border-r border-border px-3 text-center last:border-r-0 hover:bg-muted"
              key={toDateInput(day)}
              onClick={() => onCreate(day)}
              type="button"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {formatWeekDay(day)}
              </span>
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg text-sm font-extrabold",
                  isSameDate(day, new Date())
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {day.getDate()}
              </span>
            </button>
          ))}
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="relative border-r border-border" style={{ height: bodyHeight }}>
            {slots.map((slot, index) => (
              <div
                className="absolute left-0 right-0 -translate-y-2 pr-3 text-right text-[11px] font-semibold text-muted-foreground"
                key={slot}
                style={{ top: index * SLOT_HEIGHT }}
              >
                {slot.endsWith(":00") ? slot : ""}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <TimeDayColumn
              appointments={appointments.filter((appointment) =>
                isSameDate(new Date(appointment.startsAt), day),
              )}
              day={day}
              key={toDateInput(day)}
              onCreate={onCreate}
              onEdit={onEdit}
              slots={slots}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeDayColumn({
  appointments,
  day,
  onCreate,
  onEdit,
  slots,
}: {
  appointments: ApiAppointment[];
  day: Date;
  onCreate: (date: Date, time?: string) => void;
  onEdit: (appointment: ApiAppointment) => void;
  slots: string[];
}) {
  const height = slots.length * SLOT_HEIGHT;
  const appointmentLayouts = layoutDayAppointments(appointments);

  return (
    <div
      className="relative border-r border-border bg-card/40 last:border-r-0"
      style={{ height }}
    >
      {slots.map((slot, index) => (
        <TimeSlot
          date={day}
          key={slot}
          onCreate={onCreate}
          slot={slot}
          style={{ height: SLOT_HEIGHT, top: index * SLOT_HEIGHT }}
        />
      ))}

      {appointmentLayouts.map((layout) => (
        <TimedAppointmentCard
          appointment={layout.appointment}
          key={layout.appointment.id}
          layout={layout}
          onEdit={onEdit}
        />
      ))}

      {isSameDate(day, new Date()) && <CurrentTimeLine />}
    </div>
  );
}

function TimeSlot({
  date,
  onCreate,
  slot,
  style,
}: {
  date: Date;
  onCreate: (date: Date, time?: string) => void;
  slot: string;
  style: CSSProperties;
}) {
  const id = slotDropId(toDateInput(date), slot);
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <button
      className={cn(
        "absolute left-0 right-0 border-b border-border/70 text-left transition-colors hover:bg-primary/5",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/30",
      )}
      onClick={() => onCreate(date, slot)}
      ref={setNodeRef}
      style={style}
      title={`Crear cita a las ${slot}`}
      type="button"
    />
  );
}

function TimedAppointmentCard({
  appointment,
  layout,
  onEdit,
}: {
  appointment: ApiAppointment;
  layout: TimedAppointmentLayout;
  onEdit: (appointment: ApiAppointment) => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      disabled: appointment.status === "COMPLETED",
      id: draggableId(appointment.id),
    });
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const visibleStart = START_HOUR * 60;
  const visibleEnd = END_HOUR * 60;

  if (endMinutes <= visibleStart || startMinutes >= visibleEnd) {
    return null;
  }

  const top =
    ((Math.max(startMinutes, visibleStart) - visibleStart) / SLOT_MINUTES) *
    SLOT_HEIGHT;
  const duration = Math.max(
    Math.min(endMinutes, visibleEnd) - Math.max(startMinutes, visibleStart),
    25,
  );
  const height = Math.max((duration / SLOT_MINUTES) * SLOT_HEIGHT - 4, 38);
  const color = appointment.color || "#3b82f6";
  const columnWidth = 100 / layout.columns;

  return (
    <div
      className={cn(
        "absolute z-[2] overflow-hidden rounded-md border bg-card shadow-sm transition-shadow hover:z-[3] hover:shadow-panel",
        isDragging && "opacity-35",
      )}
      ref={setNodeRef}
      style={{
        borderColor: `${color}55`,
        height,
        left: `calc(${layout.column * columnWidth}% + 6px)`,
        top: top + 2,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        width: `calc(${columnWidth}% - 9px)`,
      }}
    >
      <button
        className="flex h-full w-full gap-1.5 overflow-hidden p-2 text-left"
        onClick={() => onEdit(appointment)}
        type="button"
      >
        <span
          className="h-full w-1 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-1">
            <span className="truncate text-xs font-extrabold text-foreground">
              {appointment.title}
            </span>
            {appointment.status !== "COMPLETED" && (
              <span
                {...attributes}
                {...listeners}
                aria-label="Arrastrar cita"
                className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                onClick={(event) => event.stopPropagation()}
                role="button"
                tabIndex={0}
                title="Arrastrar para reprogramar"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
          <span className="mt-1 block truncate text-[11px] font-semibold text-muted-foreground">
            {formatClock(appointment.startsAt)} /{" "}
            {formatPatientName(appointment.patient)}
          </span>
          {height >= 66 && (
            <span className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              <UserRound className="h-3 w-3 shrink-0" />
              {appointment.doctor?.fullName ?? "Sin odontologo"}
            </span>
          )}
          {height >= 88 && appointment.billingSummary?.hasPendingBalance && (
            <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-warning">
              <CircleDollarSign className="h-3 w-3" />
              {formatCurrency(appointment.billingSummary.pendingAmount)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function CurrentTimeLine() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = START_HOUR * 60;
  const end = END_HOUR * 60;

  if (minutes < start || minutes > end) return null;

  const top = ((minutes - start) / SLOT_MINUTES) * SLOT_HEIGHT;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-[4] h-px bg-danger"
      style={{ top }}
    >
      <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger" />
    </div>
  );
}

function MonthView({
  appointments,
  currentDate,
  onCreate,
  onEdit,
}: {
  appointments: ApiAppointment[];
  currentDate: Date;
  onCreate: (date: Date, time?: string) => void;
  onEdit: (appointment: ApiAppointment) => void;
}) {
  const days = buildMonthGrid(currentDate);

  return (
    <div className="min-w-[920px] overflow-x-auto">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((day) => (
          <div
            className="border-r border-border px-3 py-2 text-center text-xs font-bold uppercase text-muted-foreground last:border-r-0"
            key={day}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <MonthDay
            appointments={appointments.filter((appointment) =>
              isSameDate(new Date(appointment.startsAt), day.date),
            )}
            day={day}
            key={toDateInput(day.date)}
            onCreate={onCreate}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

function MonthDay({
  appointments,
  day,
  onCreate,
  onEdit,
}: {
  appointments: ApiAppointment[];
  day: { date: Date; inCurrentMonth: boolean };
  onCreate: (date: Date, time?: string) => void;
  onEdit: (appointment: ApiAppointment) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: dateDropId(toDateInput(day.date)),
  });

  return (
    <div
      className={cn(
        "min-h-[142px] border-b border-r border-border p-2 transition-colors",
        !day.inCurrentMonth && "bg-muted/20 text-muted-foreground/55",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/30",
      )}
      ref={setNodeRef}
    >
      <button
        className={cn(
          "mb-2 grid h-7 w-7 place-items-center rounded-md text-xs font-extrabold hover:bg-muted",
          isSameDate(day.date, new Date()) &&
            "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        onClick={() => onCreate(day.date)}
        type="button"
      >
        {day.date.getDate()}
      </button>
      <div className="space-y-1">
        {appointments.slice(0, 3).map((appointment) => (
          <MonthAppointment
            appointment={appointment}
            key={appointment.id}
            onEdit={onEdit}
          />
        ))}
        {appointments.length > 3 && (
          <button
            className="w-full px-1 text-left text-[11px] font-semibold text-primary"
            onClick={() => onEdit(appointments[3]!)}
            type="button"
          >
            +{appointments.length - 3} citas
          </button>
        )}
      </div>
    </div>
  );
}

function MonthAppointment({
  appointment,
  onEdit,
}: {
  appointment: ApiAppointment;
  onEdit: (appointment: ApiAppointment) => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      disabled: appointment.status === "COMPLETED",
      id: draggableId(appointment.id),
    });
  const color = appointment.color || "#3b82f6";

  return (
    <button
      {...attributes}
      {...listeners}
      className={cn(
        "flex h-7 w-full touch-none items-center gap-1.5 overflow-hidden rounded-md border bg-card px-1.5 text-left text-[11px] shadow-sm",
        appointment.status !== "COMPLETED" && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-35",
      )}
      onClick={() => onEdit(appointment)}
      ref={setNodeRef}
      style={{
        borderColor: `${color}44`,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      title={`${formatTimeRange(appointment.startsAt, appointment.endsAt)} - ${formatPatientName(appointment.patient)}`}
      type="button"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="shrink-0 font-bold text-muted-foreground">
        {formatClock(appointment.startsAt)}
      </span>
      <span className="truncate font-semibold text-foreground">
        {formatPatientName(appointment.patient)}
      </span>
    </button>
  );
}

function AppointmentModal({
  appointment,
  currentUser,
  doctors,
  initialPatientId,
  initialSlot,
  onClose,
  onDelete,
  onSubmit,
  patients,
}: {
  appointment?: ApiAppointment;
  currentUser: AuthenticatedUser;
  doctors: ApiDoctor[];
  initialPatientId?: string | null;
  initialSlot?: InitialSlot | null;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onSubmit: (form: AppointmentForm) => Promise<void>;
  patients: ApiPatient[];
}) {
  const defaultDate = appointment
    ? new Date(appointment.startsAt)
    : initialSlot
      ? new Date(`${initialSlot.date}T${initialSlot.time}:00`)
      : new Date();
  const defaultDoctor =
    appointment?.doctor?.id ??
    doctors.find((doctor) => doctor.id === currentUser.id)?.id ??
    doctors[0]?.id ??
    "";
  const startTime = appointment
    ? toTimeInput(new Date(appointment.startsAt))
    : initialSlot?.time ?? nextHalfHour(new Date());
  const endTime = appointment
    ? toTimeInput(new Date(appointment.endsAt))
    : addMinutesToTime(startTime, 30);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AppointmentForm>({
    color: appointment?.color ?? appointmentColors[0]!,
    date: toDateInput(defaultDate),
    doctorId: defaultDoctor,
    endsAt: endTime,
    notes: appointment?.notes ?? "",
    patientId:
      appointment?.patient.id ?? initialPatientId ?? patients[0]?.id ?? "",
    startsAt: startTime,
    status: appointment?.status ?? "PENDING",
    title: appointment?.title ?? "Consulta odontologica",
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.patientId || !form.title.trim()) {
      setError("Paciente y titulo son obligatorios");
      return;
    }

    if (
      toLocalIso(form.date, form.endsAt) <=
      toLocalIso(form.date, form.startsAt)
    ) {
      setError("La hora final debe ser posterior a la hora inicial");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar la cita",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  }

  function update<K extends keyof AppointmentForm>(
    field: K,
    value: AppointmentForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="my-auto w-full max-w-[760px] rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-extrabold text-foreground">
              {appointment ? <Pencil className="h-5 w-5 text-primary" /> : null}
              {appointment ? "Editar cita" : "Nueva cita"}
            </div>
            <div className="text-sm text-muted-foreground">
              Horario, responsable y estado de atencion
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
                onChange={(value) => update("patientId", value)}
                value={form.patientId}
              >
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {formatPatientName(patient)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Odontologo">
              <Select
                onChange={(value) => update("doctorId", value)}
                value={form.doctorId}
              >
                <option value="">Sin asignar</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Titulo">
              <Input
                autoFocus
                onChange={(event) => update("title", event.target.value)}
                value={form.title}
              />
            </Field>
            <Field label="Estado">
              <Select
                onChange={(value) =>
                  update("status", value as AppointmentStatus)
                }
                value={form.status}
              >
                {(Object.keys(statusLabels) as AppointmentStatus[]).map(
                  (status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field label="Fecha">
              <Input
                onChange={(event) => update("date", event.target.value)}
                type="date"
                value={form.date}
              />
            </Field>
            <Field label="Color en agenda">
              <div className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-3">
                {appointmentColors.map((color) => (
                  <button
                    aria-label={`Seleccionar color ${color}`}
                    className={cn(
                      "h-6 w-6 rounded-md transition-transform hover:scale-110",
                      form.color === color &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-card",
                    )}
                    key={color}
                    onClick={() => update("color", color)}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
            </Field>
            <Field label="Inicio">
              <Input
                onChange={(event) => update("startsAt", event.target.value)}
                step="900"
                type="time"
                value={form.startsAt}
              />
            </Field>
            <Field label="Fin">
              <Input
                onChange={(event) => update("endsAt", event.target.value)}
                step="900"
                type="time"
                value={form.endsAt}
              />
            </Field>
            <Field className="md:col-span-2" label="Notas">
              <textarea
                className="min-h-24 w-full resize-y rounded-lg border border-border bg-card px-3 py-3 text-sm leading-6 text-foreground caret-primary outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Motivo, preparacion o informacion adicional..."
                value={form.notes}
              />
            </Field>
          </div>

          {appointment?.billingSummary?.hasPendingBalance && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-foreground">
              <CircleDollarSign className="h-5 w-5 text-warning" />
              Saldo pendiente:{" "}
              <strong>
                {formatCurrency(appointment.billingSummary.pendingAmount)}
              </strong>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
            <div>
              {appointment && onDelete && (
                <Button
                  disabled={isDeleting || isSubmitting}
                  onClick={() => void handleDelete()}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                  {isDeleting ? "Eliminando..." : "Eliminar"}
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={onClose} type="button" variant="outline">
                Cancelar
              </Button>
              <Button disabled={isSubmitting || isDeleting} type="submit">
                {isSubmitting ? "Guardando..." : "Guardar cita"}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AppointmentPreview({
  appointment,
}: {
  appointment: ApiAppointment;
}) {
  return (
    <div className="w-64 rotate-1 rounded-lg border border-primary/30 bg-card p-3 shadow-soft">
      <div className="text-sm font-extrabold text-foreground">
        {appointment.title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatTimeRange(appointment.startsAt, appointment.endsAt)}
      </div>
      <div className="mt-2 truncate text-xs font-semibold text-foreground">
        {formatPatientName(appointment.patient)}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xl font-extrabold text-foreground">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function CalendarSkeleton({ view }: { view: CalendarView }) {
  return (
    <div
      className={cn(
        "grid gap-3 p-5",
        view === "month" ? "grid-cols-7" : "grid-cols-4",
      )}
    >
      {Array.from({ length: view === "month" ? 28 : 12 }).map((_, index) => (
        <div
          className="h-28 animate-pulse rounded-lg border border-border bg-muted/45"
          key={index}
        />
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
  className,
  onChange,
  value,
}: {
  children: ReactNode;
  className?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
        className,
      )}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function appointmentPayload(
  form: AppointmentForm,
  startsAt: string,
  endsAt: string,
) {
  return {
    color: form.color || null,
    doctorId: form.doctorId || null,
    endsAt,
    notes: form.notes.trim() || null,
    patientId: form.patientId,
    startsAt,
    status: form.status,
    title: form.title.trim(),
  };
}

function layoutDayAppointments(
  appointments: ApiAppointment[],
): TimedAppointmentLayout[] {
  const sorted = [...appointments].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  const groups: ApiAppointment[][] = [];
  let currentGroup: ApiAppointment[] = [];
  let groupEnd = 0;

  for (const appointment of sorted) {
    const startsAt = new Date(appointment.startsAt).getTime();
    const endsAt = new Date(appointment.endsAt).getTime();

    if (currentGroup.length > 0 && startsAt >= groupEnd) {
      groups.push(currentGroup);
      currentGroup = [];
      groupEnd = 0;
    }

    currentGroup.push(appointment);
    groupEnd = Math.max(groupEnd, endsAt);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups.flatMap((group) => {
    const activeColumns: Array<{ column: number; endsAt: number }> = [];
    const placements = group.map((appointment) => {
      const startsAt = new Date(appointment.startsAt).getTime();

      for (let index = activeColumns.length - 1; index >= 0; index -= 1) {
        if ((activeColumns[index]?.endsAt ?? Number.POSITIVE_INFINITY) <= startsAt) {
          activeColumns.splice(index, 1);
        }
      }

      const usedColumns = new Set(activeColumns.map((item) => item.column));
      let column = 0;

      while (usedColumns.has(column)) {
        column += 1;
      }

      activeColumns.push({
        column,
        endsAt: new Date(appointment.endsAt).getTime(),
      });

      return { appointment, column };
    });
    const columns =
      Math.max(...placements.map((placement) => placement.column)) + 1;

    return placements.map((placement) => ({ ...placement, columns }));
  });
}

function getVisibleRange(date: Date, view: CalendarView) {
  if (view === "day") {
    const from = startOfDay(date);
    return { from, to: addDays(from, 1) };
  }

  if (view === "week") {
    const from = startOfWeek(date);
    return { from, to: addDays(from, 7) };
  }

  const days = buildMonthGrid(date);
  const from = startOfDay(days[0]?.date ?? startOfMonth(date));
  return { from, to: addDays(from, 42) };
}

function buildWeek(date: Date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function buildMonthGrid(date: Date) {
  const monthStart = startOfMonth(date);
  const gridStart = startOfWeek(monthStart);

  return Array.from({ length: 42 }, (_, index) => {
    const gridDate = addDays(gridStart, index);
    return {
      date: gridDate,
      inCurrentMonth: gridDate.getMonth() === date.getMonth(),
    };
  });
}

function buildTimeSlots() {
  const slots: string[] = [];
  for (
    let minutes = START_HOUR * 60;
    minutes < END_HOUR * 60;
    minutes += SLOT_MINUTES
  ) {
    slots.push(minutesToTime(minutes));
  }
  return slots;
}

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function toLocalIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function nextHalfHour(date: Date) {
  const minutes = date.getMinutes();
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(minutes < 30 ? 30 : 60);
  return toTimeInput(rounded);
}

function addMinutesToTime(time: string, minutes: number) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return minutesToTime(hour * 60 + minute + minutes);
}

function minutesToTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
}

function formatPatientName(
  patient: Pick<ApiPatient, "firstName" | "lastName">,
) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function formatRangeLabel(date: Date, view: CalendarView) {
  if (view === "day") {
    return new Intl.DateTimeFormat("es-EC", {
      day: "numeric",
      month: "long",
      weekday: "long",
      year: "numeric",
    }).format(date);
  }

  if (view === "month") {
    return new Intl.DateTimeFormat("es-EC", {
      month: "long",
      year: "numeric",
    }).format(date);
  }

  const week = buildWeek(date);
  return `${formatShortDate(week[0]!)} - ${formatShortDate(week[6]!)}`;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatWeekDay(date: Date) {
  return new Intl.DateTimeFormat("es-EC", { weekday: "short" }).format(date);
}

function formatTimeRange(startsAt: string, endsAt: string) {
  return `${formatClock(startsAt)} - ${formatClock(endsAt)}`;
}

function formatClock(value: string) {
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

function draggableId(id: string) {
  return `appointment:${id}`;
}

function slotDropId(date: string, time: string) {
  return `slot:${date}:${time}`;
}

function dateDropId(date: string) {
  return `date:${date}`;
}

function parseDropTarget(value: string): InitialSlot | null {
  if (value.startsWith("date:")) {
    return { date: value.slice(5), time: "" };
  }

  if (!value.startsWith("slot:")) return null;
  const match = /^slot:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})$/.exec(value);
  return match ? { date: match[1]!, time: match[2]! } : null;
}
