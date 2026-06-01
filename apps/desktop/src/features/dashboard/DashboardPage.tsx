import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarPlus,
  CircleDollarSign,
  Clock3,
  FileBarChart,
  ShieldAlert,
  SmilePlus,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const metricCards = [
  {
    label: "Pacientes totales",
    value: "1,248",
    detail: "+12 este mes",
    icon: UsersRound,
    tone: "text-primary bg-primary/10",
    spark: "M2 34 C18 30, 22 12, 36 24 S52 32, 66 10 S82 18, 94 4",
  },
  {
    label: "Citas de hoy",
    value: "12",
    detail: "2 pendientes",
    icon: CalendarPlus,
    tone: "text-success bg-success/10",
    spark: "M2 30 C16 12, 26 20, 34 26 S52 35, 64 16 S82 14, 94 8",
  },
  {
    label: "Ingresos del mes",
    value: "$4,350.00",
    detail: "+18% vs mes anterior",
    icon: CircleDollarSign,
    tone: "text-violet-500 bg-violet-500/10",
    spark: "M2 36 C14 26, 22 18, 34 25 S48 35, 60 14 S76 20, 94 4",
  },
  {
    label: "Tratamientos activos",
    value: "28",
    detail: "5 por finalizar",
    icon: SmilePlus,
    tone: "text-warning bg-warning/15",
    spark: "M2 28 C14 6, 26 34, 40 18 S58 26, 70 12 S86 20, 94 8",
  },
];

const appointments = [
  ["09:00 AM", "Maria Gonzalez", "Limpieza dental", "Confirmada"],
  ["10:00 AM", "Juan Perez", "Resina compuesta", "Confirmada"],
  ["11:00 AM", "Ana Martinez", "Endodoncia", "Pendiente"],
  ["02:00 PM", "Luis Rodriguez", "Ortodoncia", "Confirmada"],
  ["03:00 PM", "Carla Suarez", "Blanqueamiento", "Confirmada"],
];

const alerts: Array<{
  title: string;
  detail: string;
  meta: string;
  icon: LucideIcon;
}> = [
  {
    title: "Pagos pendientes",
    detail: "3 pacientes por revisar",
    meta: "$780.00",
    icon: CircleDollarSign,
  },
  {
    title: "Citas por confirmar",
    detail: "2 citas para hoy",
    meta: "Recepcion",
    icon: Clock3,
  },
  {
    title: "Tratamientos abiertos",
    detail: "5 requieren seguimiento",
    meta: "Clinico",
    icon: ShieldAlert,
  },
];

const quickActions: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Nuevo paciente", icon: UsersRound },
  { label: "Nueva cita", icon: CalendarPlus },
  { label: "Registrar pago", icon: CircleDollarSign },
  { label: "Nuevo tratamiento", icon: SmilePlus },
  { label: "Ver reportes", icon: FileBarChart },
];

export function DashboardPage() {
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
            Clinica activa
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Buenos dias, Dr. Carlos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui tienes el resumen operativo de tu clinica.
          </p>
        </div>
        <div className="text-sm font-medium capitalize text-muted-foreground">
          {date}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 10 }}
            key={metric.label}
            transition={{ delay: index * 0.05, duration: 0.28 }}
          >
            <Card className="min-h-[146px] overflow-hidden">
              <CardContent className="flex h-full items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className={cn("grid h-14 w-14 place-items-center rounded-lg", metric.tone)}>
                    <metric.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {metric.label}
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-foreground">
                      {metric.value}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-success">
                      {metric.detail}
                    </div>
                  </div>
                </div>
                <svg className="h-14 w-24 text-accent" viewBox="0 0 96 42">
                  <path
                    d={metric.spark}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                </svg>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1.12fr_1fr]">
        <AppointmentsPanel />
        <RevenuePanel />
        <CalendarPanel />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <TreatmentsPanel />
        <AlertsPanel />
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Acciones rapidas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {quickActions.map(({ icon: Icon, label }) => (
            <button
              className="flex h-14 items-center gap-3 rounded-lg border border-border bg-card px-4 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              key={label}
              type="button"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentsPanel() {
  return (
    <Card className="min-h-[430px]">
      <CardHeader className="justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <CardTitle>Agenda de hoy</CardTitle>
        </div>
        <Button size="sm" variant="subtle">
          Ver agenda
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4 pl-2">
          <div className="absolute left-[4.35rem] top-3 h-[calc(100%-1.5rem)] w-px bg-primary/25" />
          {appointments.map(([time, patient, treatment, status]) => (
            <div className="grid grid-cols-[5.2rem_1fr_auto] items-center gap-4" key={time}>
              <div className="text-sm font-bold text-primary">{time}</div>
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {patient}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {treatment}
                  </div>
                </div>
              </div>
              <Badge variant={status === "Pendiente" ? "warning" : "default"}>
                {status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RevenuePanel() {
  return (
    <Card className="min-h-[430px]">
      <CardHeader className="justify-between">
        <CardTitle>Ingresos vs gastos</CardTitle>
        <Button size="sm" variant="outline">
          Este mes
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-3xl font-extrabold">$4,350.00</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
              Ingresos
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">$1,250.00</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-danger" />
              Gastos
            </div>
          </div>
        </div>
        <svg className="mt-8 h-56 w-full" viewBox="0 0 620 240">
          {[40, 90, 140, 190].map((y) => (
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
          <path
            d="M10 170 C60 146, 70 112, 125 138 S205 171, 260 119 S335 107, 390 146 S470 178, 520 124 S580 104, 610 98"
            fill="none"
            stroke="hsl(var(--success))"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M10 212 C65 200, 78 176, 126 190 S190 218, 252 180 S325 166, 390 198 S468 204, 520 182 S580 188, 610 184"
            fill="none"
            stroke="hsl(var(--danger))"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      </CardContent>
    </Card>
  );
}

function CalendarPanel() {
  const days = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
  }).format(today);
  const dates = buildCalendarDates(today);

  return (
    <Card className="min-h-[430px]">
      <CardHeader className="justify-between">
        <CardTitle>Calendario</CardTitle>
        <Button size="sm" variant="outline">
          Hoy
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-sm font-bold capitalize text-foreground">
          {monthLabel}
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2 text-center">
          {days.map((day) => (
            <div className="text-[11px] font-bold text-muted-foreground" key={day}>
              {day}
            </div>
          ))}
          {dates.map((date) => {
            const isActive =
              date.inCurrentMonth && date.day === today.getDate();

            return (
              <div
                className={cn(
                  "grid aspect-square place-items-center rounded-lg text-sm font-semibold",
                  !date.inCurrentMonth && "text-muted-foreground/55",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-panel"
                    : "text-foreground hover:bg-muted",
                )}
                key={date.key}
              >
                {date.day}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TreatmentsPanel() {
  const items = [
    ["Limpieza dental", "35% (45)", "bg-success"],
    ["Resina compuesta", "25% (32)", "bg-cyan-500"],
    ["Endodoncia", "20% (26)", "bg-indigo-500"],
    ["Ortodoncia", "15% (19)", "bg-primary"],
    ["Blanqueamiento", "5% (6)", "bg-violet-500"],
  ];

  return (
    <Card className="min-h-[260px]">
      <CardHeader>
        <CardTitle>Tratamientos mas realizados</CardTitle>
      </CardHeader>
      <CardContent className="grid items-center gap-8 md:grid-cols-[220px_1fr]">
        <div className="relative grid h-40 w-40 place-items-center justify-self-center rounded-full bg-[conic-gradient(hsl(var(--success))_0_35%,#22c6d2_35%_60%,#6366f1_60%_80%,hsl(var(--primary))_80%_95%,#8b5cf6_95%_100%)]">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-card text-center shadow-sm">
            <div>
              <div className="text-2xl font-extrabold">128</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {items.map(([label, value, color]) => (
            <div className="flex items-center justify-between gap-4" key={label}>
              <div className="flex items-center gap-3 text-sm font-medium">
                <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
                {label}
              </div>
              <div className="text-sm font-semibold text-muted-foreground">
                {value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsPanel() {
  return (
    <Card className="min-h-[260px]">
      <CardHeader className="justify-between">
        <CardTitle>Alertas y pendientes</CardTitle>
        <Button size="sm" variant="ghost">
          Ver todas
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map(({ detail, icon: Icon, meta, title }, index) => (
          <div className="flex items-center gap-4" key={title}>
            <div
              className={cn(
                "grid h-11 w-11 place-items-center rounded-lg",
                index === 0 && "bg-warning/15 text-warning",
                index === 1 && "bg-primary/10 text-primary",
                index === 2 && "bg-danger/10 text-danger",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="truncate text-sm text-muted-foreground">
                {detail}
              </div>
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              {meta}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function buildCalendarDates(referenceDate: Date): Array<{
  day: number;
  inCurrentMonth: boolean;
  key: string;
}> {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      key: date.toISOString(),
    };
  });
}
