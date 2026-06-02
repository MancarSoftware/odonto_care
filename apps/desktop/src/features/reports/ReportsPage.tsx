import { motion } from "framer-motion";
import {
  Activity,
  CalendarX2,
  CircleDollarSign,
  FileBarChart,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "INSURANCE" | "OTHER";
type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "VOID";
type TreatmentStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type ApiReportSummary = {
  appointmentStatus: Record<AppointmentStatus, number>;
  metrics: {
    attendanceRate: number;
    cancelledAppointments: number;
    collectedRevenue: number;
    completedAppointments: number;
    completedTreatments: number;
    mediaAssets: number;
    newPatients: number;
    pendingRevenue: number;
    patientsSeen: number;
    totalAppointments: number;
    totalPayments: number;
    totalTreatments: number;
    voidPayments: number;
  };
  paymentMethods: Record<PaymentMethod, number>;
  range: {
    from: string;
    to: string;
  };
  recentPayments: Array<{
    amount: number;
    method: PaymentMethod;
    paidAt: string;
    patient: {
      code: string;
      firstName: string;
      id: string;
      lastName: string;
    };
    reference: string | null;
    status: PaymentStatus;
    treatment: { id: string; name: string } | null;
  }>;
  revenueByDay: Array<{
    date: string;
    payments: number;
    total: number;
  }>;
  topTreatments: Array<{
    estimatedTotal: number;
    name: string;
    total: number;
  }>;
  treatmentStatus: Record<TreatmentStatus, number>;
};

type ReportsPageProps = {
  onUnauthorized: () => void;
  token: string;
};

const appointmentLabels: Record<AppointmentStatus, string> = {
  CANCELLED: "Canceladas",
  COMPLETED: "Atendidas",
  CONFIRMED: "Confirmadas",
  PENDING: "Pendientes",
};

const treatmentLabels: Record<TreatmentStatus, string> = {
  CANCELLED: "Cancelados",
  COMPLETED: "Finalizados",
  IN_PROGRESS: "En progreso",
  PLANNED: "Planificados",
};

const methodLabels: Record<PaymentMethod, string> = {
  CARD: "Tarjeta",
  CASH: "Efectivo",
  INSURANCE: "Seguro",
  OTHER: "Otro",
  TRANSFER: "Transferencia",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PAID: "Pagado",
  PARTIAL: "Abono",
  PENDING: "Pendiente",
  VOID: "Anulado",
};

const paymentStatusTone: Record<
  PaymentStatus,
  "default" | "success" | "warning" | "danger"
> = {
  PAID: "success",
  PARTIAL: "default",
  PENDING: "warning",
  VOID: "danger",
};

export function ReportsPage({ onUnauthorized, token }: ReportsPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => toDateInput(addDays(new Date(), -29)));
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<ApiReportSummary | null>(null);
  const [to, setTo] = useState(() => toDateInput(new Date()));

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, token]);

  const maxRevenue = useMemo(() => {
    if (!report?.revenueByDay.length) {
      return 1;
    }

    return Math.max(...report.revenueByDay.map((day) => day.total), 1);
  }, [report]);

  async function loadReport() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiGet<ApiReportSummary>(
        `/reports/summary?from=${from}&to=${to}`,
        token,
      );
      setReport(response);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(days: number) {
    const today = new Date();
    setFrom(toDateInput(addDays(today, -(days - 1))));
    setTo(toDateInput(today));
  }

  function applyCurrentMonth() {
    const today = new Date();
    setFrom(toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
    setTo(toDateInput(today));
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
            <FileBarChart className="h-3.5 w-3.5 text-primary" />
            Analitica clinica
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Reportes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresos, citas, pacientes atendidos y tratamientos frecuentes.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <DateField label="Desde" onChange={setFrom} value={from} />
          <DateField label="Hasta" onChange={setTo} value={to} />
          <Button onClick={() => void loadReport()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => applyPreset(7)} size="sm" variant="outline">
          7 dias
        </Button>
        <Button onClick={() => applyPreset(30)} size="sm" variant="outline">
          30 dias
        </Button>
        <Button onClick={applyCurrentMonth} size="sm" variant="outline">
          Este mes
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      {isLoading && <ReportsSkeleton />}

      {!isLoading && report && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CircleDollarSign}
              label="Ingresos cobrados"
              tone="text-success bg-success/10"
              value={formatCurrency(report.metrics.collectedRevenue)}
            />
            <MetricCard
              icon={UsersRound}
              label="Pacientes atendidos"
              tone="text-primary bg-primary/10"
              value={String(report.metrics.patientsSeen)}
            />
            <MetricCard
              icon={Stethoscope}
              label="Tratamientos finalizados"
              tone="text-violet-500 bg-violet-500/10"
              value={String(report.metrics.completedTreatments)}
            />
            <MetricCard
              icon={CalendarX2}
              label="Citas canceladas"
              tone="text-danger bg-danger/10"
              value={String(report.metrics.cancelledAppointments)}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <Card>
              <CardHeader className="justify-between">
                <div>
                  <CardTitle>Ingresos por dia</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(report.range.from)} - {formatDate(report.range.to)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-foreground">
                    {formatCurrency(report.metrics.collectedRevenue)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {report.metrics.totalPayments} movimientos
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <RevenueBars
                  maxRevenue={maxRevenue}
                  revenueByDay={report.revenueByDay}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen operativo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressRow
                  label="Tasa de atencion"
                  value={report.metrics.attendanceRate}
                />
                <SummaryLine
                  label="Citas totales"
                  value={String(report.metrics.totalAppointments)}
                />
                <SummaryLine
                  label="Pacientes nuevos"
                  value={String(report.metrics.newPatients)}
                />
                <SummaryLine
                  label="Archivos subidos"
                  value={String(report.metrics.mediaAssets)}
                />
                <SummaryLine
                  label="Pendiente por cobrar"
                  value={formatCurrency(report.metrics.pendingRevenue)}
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <DistributionCard
              labels={appointmentLabels}
              title="Estado de citas"
              values={report.appointmentStatus}
            />
            <DistributionCard
              labels={treatmentLabels}
              title="Estado de tratamientos"
              values={report.treatmentStatus}
            />
            <PaymentMethodsCard values={report.paymentMethods} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <TopTreatmentsCard treatments={report.topTreatments} />
            <RecentPaymentsCard payments={report.recentPayments} />
          </section>
        </>
      )}
    </div>
  );
}

function RevenueBars({
  maxRevenue,
  revenueByDay,
}: {
  maxRevenue: number;
  revenueByDay: ApiReportSummary["revenueByDay"];
}) {
  if (!revenueByDay.length) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-lg border border-dashed border-border bg-muted/35 text-sm font-semibold text-muted-foreground">
        Sin ingresos en el rango seleccionado.
      </div>
    );
  }

  return (
    <div className="flex min-h-[280px] items-end gap-2 rounded-lg border border-border bg-muted/25 p-4">
      {revenueByDay.map((day, index) => {
        const height = Math.max((day.total / maxRevenue) * 100, day.total > 0 ? 8 : 2);

        return (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex min-w-3 flex-1 flex-col items-center gap-2"
            initial={{ opacity: 0, y: 8 }}
            key={day.date}
            transition={{ delay: index * 0.01, duration: 0.2 }}
          >
            <div className="flex h-48 w-full items-end">
              <div
                className={cn(
                  "w-full rounded-t-md transition-colors",
                  day.total > 0 ? "bg-primary" : "bg-border",
                )}
                style={{ height: `${height}%` }}
                title={`${day.date}: ${formatCurrency(day.total)}`}
              />
            </div>
            {index % Math.ceil(revenueByDay.length / 6) === 0 && (
              <div className="text-[10px] font-semibold text-muted-foreground">
                {formatCompactDate(day.date)}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function DistributionCard<T extends string>({
  labels,
  title,
  values,
}: {
  labels: Record<T, string>;
  title: string;
  values: Record<T, number>;
}) {
  const keys = Object.keys(values) as T[];
  const total = keys.reduce((sum, key) => sum + values[key], 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {keys.map((key) => {
          const value = values[key];
          const percent = total > 0 ? Math.round((value / total) * 100) : 0;

          return (
            <div key={key}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-foreground">{labels[key]}</span>
                <span className="text-muted-foreground">{value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PaymentMethodsCard({
  values,
}: {
  values: Record<PaymentMethod, number>;
}) {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metodos de pago</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(values) as PaymentMethod[]).map((method) => {
          const value = values[method];
          const percent = total > 0 ? Math.round((value / total) * 100) : 0;

          return (
            <div key={method}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-foreground">
                  {methodLabels[method]}
                </span>
                <span className="text-muted-foreground">
                  {formatCurrency(value)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TopTreatmentsCard({
  treatments,
}: {
  treatments: ApiReportSummary["topTreatments"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tratamientos frecuentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {treatments.length === 0 && (
          <EmptyMiniState text="Sin tratamientos en este rango." />
        )}
        {treatments.map((treatment, index) => (
          <div
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
            key={treatment.name}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-sm font-extrabold text-primary">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-foreground">
                  {treatment.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(treatment.estimatedTotal)} estimado
                </div>
              </div>
            </div>
            <Badge>{treatment.total}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentPaymentsCard({
  payments,
}: {
  payments: ApiReportSummary["recentPayments"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos recientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {payments.length === 0 && <EmptyMiniState text="Sin pagos recientes." />}
        {payments.map((payment, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-3 rounded-lg border border-border bg-card px-4 py-3 md:grid-cols-[1fr_140px_110px]"
            initial={{ opacity: 0, y: 6 }}
            key={`${payment.patient.id}-${payment.paidAt}-${index}`}
            transition={{ delay: index * 0.025, duration: 0.2 }}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">
                {formatPatientName(payment.patient)}
              </div>
              <div className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                {payment.treatment?.name ?? methodLabels[payment.method]}
              </div>
            </div>
            <div>
              <div className="text-sm font-extrabold text-foreground">
                {formatCurrency(payment.amount)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatCompactDate(payment.paidAt)}
              </div>
            </div>
            <div className="flex items-center justify-end">
              <Badge variant={paymentStatusTone[payment.status]}>
                {paymentStatusLabels[payment.status]}
              </Badge>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof FileBarChart;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("grid h-12 w-12 place-items-center rounded-lg", tone)}>
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

function DateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <Input
        className="w-[160px]"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-bold text-primary">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/35 px-3 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}

function EmptyMiniState({ text }: { text: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-border bg-muted/35 text-sm font-semibold text-muted-foreground">
      {text}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex animate-pulse items-center gap-4 p-5">
              <div className="h-12 w-12 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-28 rounded bg-muted" />
                <div className="h-3 w-36 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="h-[360px] animate-pulse p-5">
          <div className="h-full rounded-lg bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPatientName(patient: { firstName: string; lastName: string }) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-EC", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCompactDate(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}
