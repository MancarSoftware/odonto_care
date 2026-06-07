import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
  Clock3,
  FileBarChart,
  PackageSearch,
  RefreshCcw,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthenticatedUser } from "@/features/auth/types";
import type { AppSectionId } from "@/features/navigation/sections";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

export type DashboardCreateTarget =
  | "appointment"
  | "patient"
  | "payment"
  | "treatment";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

type DashboardSummary = {
  alerts: {
    activeTreatments: number;
    lowStock: number;
    outOfStock: number;
    pendingAppointments: number;
    pendingPaymentAmount: number;
    pendingPaymentPatients: number;
  };
  calendar: {
    days: Array<{ cancelled: number; date: string; total: number }>;
    month: string;
  };
  currency: string;
  metrics: {
    activeTreatments: number;
    appointmentsToday: number;
    currentMonthRevenue: number;
    inProgressTreatments: number;
    newPatientsThisMonth: number;
    patientCount: number;
    pendingAppointments: number;
    revenueChangePercent: number;
  };
  monthlyTrend: Array<{
    appointments: number;
    expenses: number;
    key: string;
    label: string;
    newPatients: number;
    newTreatments: number;
    revenue: number;
  }>;
  todayAppointments: Array<{
    doctor: { fullName: string; id: string } | null;
    endsAt: string;
    id: string;
    patient: {
      code: string;
      firstName: string;
      id: string;
      lastName: string;
    };
    startsAt: string;
    status: AppointmentStatus;
    title: string;
  }>;
  topTreatments: Array<{
    name: string;
    percentage: number;
    total: number;
  }>;
};

type DashboardPageProps = {
  onCreate: (target: DashboardCreateTarget) => void;
  onNavigate: (section: AppSectionId) => void;
  onUnauthorized: () => void;
  token: string;
  user: AuthenticatedUser;
};

const statusLabels: Record<AppointmentStatus, string> = {
  CANCELLED: "Cancelada",
  COMPLETED: "Atendida",
  CONFIRMED: "Confirmada",
  PENDING: "Pendiente",
};

const statusTones: Record<
  AppointmentStatus,
  "danger" | "default" | "success" | "warning"
> = {
  CANCELLED: "danger",
  COMPLETED: "success",
  CONFIRMED: "default",
  PENDING: "warning",
};

const chartColors = [
  "hsl(var(--success))",
  "hsl(var(--primary))",
  "#6366f1",
  "hsl(var(--warning))",
  "#ec4899",
];

export function DashboardPage({
  onCreate,
  onNavigate,
  onUnauthorized,
  token,
  user,
}: DashboardPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadSummary() {
    setError(null);
    setIsLoading(true);

    try {
      setSummary(await apiGet<DashboardSummary>("/dashboard/summary", token));
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar el dashboard";

      if (message.includes("401") || message.toLowerCase().includes("sesion")) {
        onUnauthorized();
        return;
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const date = new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-5">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Resumen operativo
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            {greeting()}, {firstName(user.fullName)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Actividad real de la clinica y pendientes prioritarios.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium capitalize text-muted-foreground">
            {date}
          </div>
          <Button
            aria-label="Actualizar dashboard"
            onClick={() => void loadSummary()}
            size="icon"
            title="Actualizar dashboard"
            variant="outline"
          >
            <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          <span>{error}</span>
          <Button onClick={() => void loadSummary()} size="sm" variant="outline">
            Reintentar
          </Button>
        </div>
      )}

      {isLoading && !summary ? (
        <DashboardSkeleton />
      ) : summary ? (
        <>
          <MetricsGrid onNavigate={onNavigate} summary={summary} />

          <section className="grid gap-4 xl:grid-cols-[1.08fr_1.12fr_0.92fr]">
            <AppointmentsPanel
              appointments={summary.todayAppointments}
              onNavigate={() => onNavigate("appointments")}
            />
            <RevenuePanel summary={summary} />
            <CalendarPanel
              calendar={summary.calendar}
              onNavigate={() => onNavigate("appointments")}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <TreatmentsPanel
              onNavigate={() => onNavigate("treatments")}
              treatments={summary.topTreatments}
            />
            <AlertsPanel onNavigate={onNavigate} summary={summary} />
          </section>

          <QuickActions onCreate={onCreate} onNavigate={onNavigate} />
        </>
      ) : null}
    </div>
  );
}

function MetricsGrid({
  onNavigate,
  summary,
}: {
  onNavigate: (section: AppSectionId) => void;
  summary: DashboardSummary;
}) {
  const trend = summary.monthlyTrend;
  const metrics: Array<{
    detail: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    spark: number[];
    tone: string;
    value: string;
  }> = [
    {
      detail: `${summary.metrics.newPatientsThisMonth} nuevos este mes`,
      icon: UsersRound,
      label: "Pacientes totales",
      onClick: () => onNavigate("patients"),
      spark: trend.map((month) => month.newPatients),
      tone: "bg-primary/10 text-primary",
      value: formatNumber(summary.metrics.patientCount),
    },
    {
      detail: `${summary.metrics.pendingAppointments} por confirmar`,
      icon: CalendarPlus,
      label: "Citas de hoy",
      onClick: () => onNavigate("appointments"),
      spark: trend.map((month) => month.appointments),
      tone: "bg-success/10 text-success",
      value: String(summary.metrics.appointmentsToday),
    },
    {
      detail: formatRevenueChange(summary.metrics.revenueChangePercent),
      icon: CircleDollarSign,
      label: "Ingresos del mes",
      onClick: () => onNavigate("billing"),
      spark: trend.map((month) => month.revenue),
      tone: "bg-violet-500/10 text-violet-500",
      value: formatCurrency(
        summary.metrics.currentMonthRevenue,
        summary.currency,
      ),
    },
    {
      detail: `${summary.metrics.inProgressTreatments} en progreso`,
      icon: SmilePlus,
      label: "Tratamientos activos",
      onClick: () => onNavigate("treatments"),
      spark: trend.map((month) => month.newTreatments),
      tone: "bg-warning/15 text-warning",
      value: String(summary.metrics.activeTreatments),
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          className="text-left"
          initial={{ opacity: 0, y: 8 }}
          key={metric.label}
          onClick={metric.onClick}
          transition={{ delay: index * 0.04, duration: 0.22 }}
          type="button"
        >
          <Card className="h-full min-h-[138px] transition-colors hover:border-primary/35 hover:bg-muted/20">
            <CardContent className="flex h-full items-center justify-between gap-3 p-5">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-lg",
                    metric.tone,
                  )}
                >
                  <metric.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {metric.label}
                  </div>
                  <div className="mt-2 truncate text-2xl font-extrabold text-foreground">
                    {metric.value}
                  </div>
                  <div className="mt-2 truncate text-xs font-semibold text-muted-foreground">
                    {metric.detail}
                  </div>
                </div>
              </div>
              <Sparkline values={metric.spark} />
            </CardContent>
          </Card>
        </motion.button>
      ))}
    </section>
  );
}

function AppointmentsPanel({
  appointments,
  onNavigate,
}: {
  appointments: DashboardSummary["todayAppointments"];
  onNavigate: () => void;
}) {
  return (
    <Card className="min-h-[430px]">
      <CardHeader className="justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Agenda de hoy</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {appointments.length} citas programadas
            </p>
          </div>
        </div>
        <Button onClick={onNavigate} size="sm" variant="subtle">
          Ver agenda
        </Button>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <EmptyPanel
            description="No hay citas programadas para hoy."
            icon={CalendarDays}
            title="Agenda libre"
          />
        ) : (
          <div className="space-y-2">
            {appointments.slice(0, 6).map((appointment) => (
              <button
                className="grid w-full grid-cols-[3.7rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted"
                key={appointment.id}
                onClick={onNavigate}
                type="button"
              >
                <div className="text-xs font-extrabold text-primary">
                  {formatTime(appointment.startsAt)}
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-xs font-extrabold text-foreground">
                  {initials(
                    `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">
                    {appointment.patient.firstName} {appointment.patient.lastName}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {appointment.title}
                    {appointment.doctor
                      ? ` / ${appointment.doctor.fullName}`
                      : ""}
                  </div>
                </div>
                <Badge variant={statusTones[appointment.status]}>
                  {statusLabels[appointment.status]}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RevenuePanel({ summary }: { summary: DashboardSummary }) {
  const latest =
    summary.monthlyTrend[summary.monthlyTrend.length - 1] ??
    ({ expenses: 0, revenue: 0 } as const);
  const maxValue = Math.max(
    1,
    ...summary.monthlyTrend.flatMap((month) => [
      month.expenses,
      month.revenue,
    ]),
  );
  const revenuePath = linePath(
    summary.monthlyTrend.map((month) => month.revenue),
    maxValue,
  );
  const expensePath = linePath(
    summary.monthlyTrend.map((month) => month.expenses),
    maxValue,
  );

  return (
    <Card className="min-h-[430px]">
      <CardHeader className="justify-between">
        <div>
          <CardTitle>Ingresos y abastecimiento</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ultimos seis meses
          </p>
        </div>
        <Badge>Datos reales</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <ValueLegend
            color="bg-success"
            label="Ingresos"
            value={formatCurrency(latest.revenue, summary.currency)}
          />
          <ValueLegend
            color="bg-warning"
            label="Compras de inventario"
            value={formatCurrency(latest.expenses, summary.currency)}
          />
        </div>

        <div className="mt-7">
          <svg
            aria-label="Tendencia de ingresos y compras"
            className="h-48 w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 620 190"
          >
            {[20, 70, 120, 170].map((y) => (
              <line
                key={y}
                stroke="currentColor"
                strokeOpacity="0.09"
                x1="0"
                x2="620"
                y1={y}
                y2={y}
              />
            ))}
            {summary.monthlyTrend.length > 1 && (
              <>
                <path
                  d={revenuePath}
                  fill="none"
                  stroke="hsl(var(--success))"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={expensePath}
                  fill="none"
                  stroke="hsl(var(--warning))"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </svg>
          <div className="mt-2 grid grid-cols-6 text-center text-[11px] font-semibold capitalize text-muted-foreground">
            {summary.monthlyTrend.map((month) => (
              <span key={month.key}>{month.label}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarPanel({
  calendar,
  onNavigate,
}: {
  calendar: DashboardSummary["calendar"];
  onNavigate: () => void;
}) {
  const reference = parseMonth(calendar.month);
  const monthLabel = new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
  }).format(reference);
  const counts = new Map(calendar.days.map((day) => [day.date, day]));
  const dates = buildCalendarDates(reference);

  return (
    <Card className="min-h-[430px]">
      <CardHeader className="justify-between">
        <div>
          <CardTitle>Calendario</CardTitle>
          <p className="mt-1 text-xs capitalize text-muted-foreground">
            {monthLabel}
          </p>
        </div>
        <Button onClick={onNavigate} size="sm" variant="outline">
          Abrir
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"].map((day) => (
            <div
              className="pb-2 text-[10px] font-bold text-muted-foreground"
              key={day}
            >
              {day}
            </div>
          ))}
          {dates.map((date) => {
            const activity = counts.get(date.key);
            const activeAppointments = activity
              ? activity.total - activity.cancelled
              : 0;

            return (
              <button
                className={cn(
                  "relative grid aspect-square min-h-9 place-items-center rounded-md text-xs font-semibold transition-colors",
                  !date.inCurrentMonth && "text-muted-foreground/45",
                  date.isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
                key={date.key}
                onClick={onNavigate}
                title={
                  activity
                    ? `${activity.total} citas, ${activity.cancelled} canceladas`
                    : undefined
                }
                type="button"
              >
                {date.day}
                {date.inCurrentMonth && activeAppointments > 0 && (
                  <span
                    className={cn(
                      "absolute bottom-1 h-1 w-1 rounded-full",
                      date.isToday ? "bg-primary-foreground" : "bg-success",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TreatmentsPanel({
  onNavigate,
  treatments,
}: {
  onNavigate: () => void;
  treatments: DashboardSummary["topTreatments"];
}) {
  const total = treatments.reduce((sum, treatment) => sum + treatment.total, 0);

  return (
    <Card className="min-h-[290px]">
      <CardHeader className="justify-between">
        <div>
          <CardTitle>Tratamientos mas realizados</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Distribucion historica activa
          </p>
        </div>
        <Button onClick={onNavigate} size="sm" variant="ghost">
          Ver tratamientos
        </Button>
      </CardHeader>
      <CardContent>
        {treatments.length === 0 ? (
          <EmptyPanel
            description="Los tratamientos registrados apareceran aqui."
            icon={SmilePlus}
            title="Sin actividad clinica"
          />
        ) : (
          <div className="grid items-center gap-8 md:grid-cols-[180px_1fr]">
            <div
              className="relative grid h-36 w-36 place-items-center justify-self-center rounded-full"
              style={{ background: conicGradient(treatments) }}
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-center shadow-sm">
                <div>
                  <div className="text-xl font-extrabold">{total}</div>
                  <div className="text-[11px] text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {treatments.map((treatment, index) => (
                <button
                  className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-1 text-left hover:bg-muted"
                  key={treatment.name}
                  onClick={onNavigate}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-3 text-sm font-medium">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          chartColors[index % chartColors.length],
                      }}
                    />
                    <span className="truncate">{treatment.name}</span>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-muted-foreground">
                    {treatment.percentage}% ({treatment.total})
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsPanel({
  onNavigate,
  summary,
}: {
  onNavigate: (section: AppSectionId) => void;
  summary: DashboardSummary;
}) {
  const alerts: Array<{
    detail: string;
    icon: LucideIcon;
    meta: string;
    section: AppSectionId;
    title: string;
    tone: string;
  }> = [
    {
      detail: `${summary.alerts.pendingPaymentPatients} pacientes por revisar`,
      icon: CircleDollarSign,
      meta: formatCurrency(
        summary.alerts.pendingPaymentAmount,
        summary.currency,
      ),
      section: "billing",
      title: "Pagos pendientes",
      tone: "bg-warning/15 text-warning",
    },
    {
      detail: "Programadas para hoy",
      icon: Clock3,
      meta: String(summary.alerts.pendingAppointments),
      section: "appointments",
      title: "Citas por confirmar",
      tone: "bg-primary/10 text-primary",
    },
    {
      detail: "Planificados o en progreso",
      icon: ShieldCheck,
      meta: String(summary.alerts.activeTreatments),
      section: "treatments",
      title: "Tratamientos activos",
      tone: "bg-success/10 text-success",
    },
    {
      detail: `${summary.alerts.outOfStock} productos agotados`,
      icon: PackageSearch,
      meta: String(summary.alerts.lowStock),
      section: "inventory",
      title: "Inventario por reponer",
      tone: "bg-danger/10 text-danger",
    },
  ];

  return (
    <Card className="min-h-[290px]">
      <CardHeader className="justify-between">
        <CardTitle>Alertas y pendientes</CardTitle>
        <span className="text-xs font-semibold text-muted-foreground">
          Actualizado ahora
        </span>
      </CardHeader>
      <CardContent className="space-y-1">
        {alerts.map((alert) => (
          <button
            className="flex w-full items-center gap-4 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted"
            key={alert.title}
            onClick={() => onNavigate(alert.section)}
            type="button"
          >
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                alert.tone,
              )}
            >
              <alert.icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{alert.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {alert.detail}
              </div>
            </div>
            <div className="max-w-24 truncate text-sm font-extrabold text-foreground">
              {alert.meta}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function QuickActions({
  onCreate,
  onNavigate,
}: {
  onCreate: (target: DashboardCreateTarget) => void;
  onNavigate: (section: AppSectionId) => void;
}) {
  const actions: Array<{
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    tone: string;
  }> = [
    {
      icon: UsersRound,
      label: "Nuevo paciente",
      onClick: () => onCreate("patient"),
      tone: "bg-primary/10 text-primary",
    },
    {
      icon: CalendarPlus,
      label: "Nueva cita",
      onClick: () => onCreate("appointment"),
      tone: "bg-success/10 text-success",
    },
    {
      icon: CircleDollarSign,
      label: "Registrar pago",
      onClick: () => onCreate("payment"),
      tone: "bg-violet-500/10 text-violet-500",
    },
    {
      icon: SmilePlus,
      label: "Nuevo tratamiento",
      onClick: () => onCreate("treatment"),
      tone: "bg-warning/15 text-warning",
    },
    {
      icon: FileBarChart,
      label: "Ver reportes",
      onClick: () => onNavigate("reports"),
      tone: "bg-cyan-500/10 text-cyan-600",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Acciones rapidas</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {actions.map((action) => (
          <button
            className="flex h-14 min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-4 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-muted"
            key={action.label}
            onClick={action.onClick}
            type="button"
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                action.tone,
              )}
            >
              <action.icon className="h-5 w-5" />
            </span>
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const path = smallLinePath(values, max);

  return (
    <svg
      aria-hidden="true"
      className="hidden h-12 w-20 shrink-0 text-accent 2xl:block"
      viewBox="0 0 80 40"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function ValueLegend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xl font-extrabold text-foreground">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
        {label}
      </div>
    </div>
  );
}

function EmptyPanel({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="grid min-h-[270px] place-items-center rounded-lg border border-dashed border-border bg-muted/25 p-6 text-center">
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-4 text-sm font-bold text-foreground">{title}</div>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-[138px] animate-pulse rounded-lg border border-border bg-muted/45"
            key={index}
          />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="h-[430px] animate-pulse rounded-lg border border-border bg-muted/45"
            key={index}
          />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            className="h-[290px] animate-pulse rounded-lg border border-border bg-muted/45"
            key={index}
          />
        ))}
      </section>
    </>
  );
}

function linePath(values: number[], max: number) {
  if (values.length < 2) return "";
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 600 + 10;
      const y = 170 - (value / max) * 145;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function smallLinePath(values: number[], max: number) {
  if (!values.length) return "M2 36 L78 36";
  if (values.length === 1) return "M2 36 L78 36";

  return values
    .map((value, index) => {
      const x = 2 + (index / (values.length - 1)) * 76;
      const y = 36 - (value / max) * 31;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function conicGradient(treatments: DashboardSummary["topTreatments"]) {
  let accumulated = 0;
  const stops = treatments.map((treatment, index) => {
    const start = accumulated;
    accumulated += treatment.percentage;
    return `${chartColors[index % chartColors.length]} ${start}% ${accumulated}%`;
  });

  if (accumulated < 100) {
    stops.push(`hsl(var(--muted)) ${accumulated}% 100%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}

function buildCalendarDates(referenceDate: Date) {
  const firstDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    1 - startOffset,
  );
  const today = new Date();

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === referenceDate.getMonth(),
      isToday:
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate(),
      key: dateKey(date),
    };
  });
}

function parseMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year ?? new Date().getFullYear(), (month ?? 1) - 1, 1);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-EC").format(value);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("es-EC", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatRevenueChange(value: number) {
  if (value === 0) return "Sin variacion vs mes anterior";
  return `${value > 0 ? "+" : ""}${value}% vs mes anterior`;
}
