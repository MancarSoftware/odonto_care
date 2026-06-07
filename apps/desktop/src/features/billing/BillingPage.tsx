import { motion } from "framer-motion";
import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
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

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "INSURANCE" | "OTHER";
type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "VOID";
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
  status: TreatmentStatus;
  estimatedCost: number | string | null;
};

type ApiPayment = {
  id: string;
  amount: number | string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  patient: ApiPatient;
  treatment: { id: string; name: string; status: TreatmentStatus } | null;
};

type PaymentForm = {
  amount: string;
  method: PaymentMethod;
  notes: string;
  patientId: string;
  reference: string;
  status: PaymentStatus;
  treatmentId: string;
};

type BillingPageProps = {
  openCreate: boolean;
  onUnauthorized: () => void;
  patientContextId: string | null;
  token: string;
};

const methodLabels: Record<PaymentMethod, string> = {
  CARD: "Tarjeta",
  CASH: "Efectivo",
  INSURANCE: "Seguro",
  OTHER: "Otro",
  TRANSFER: "Transferencia",
};

const statusLabels: Record<PaymentStatus, string> = {
  PAID: "Pagado",
  PARTIAL: "Abono",
  PENDING: "Pendiente",
  VOID: "Anulado",
};

const statusTone: Record<PaymentStatus, "default" | "success" | "warning" | "danger"> = {
  PAID: "success",
  PARTIAL: "default",
  PENDING: "warning",
  VOID: "danger",
};

export function BillingPage({
  openCreate,
  onUnauthorized,
  patientContextId,
  token,
}: BillingPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
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
      setPayments([]);
      setTreatments([]);
      return;
    }

    void loadBillingContext(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, token]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const filteredPayments = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return payments;
    }

    return payments.filter((payment) =>
      [
        methodLabels[payment.method],
        payment.reference ?? "",
        payment.treatment?.name ?? "",
        payment.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [payments, query]);

  const stats = useMemo(() => {
    const paid = payments
      .filter((payment) => payment.status === "PAID")
      .reduce((total, payment) => total + toNumber(payment.amount), 0);
    const partial = payments
      .filter((payment) => payment.status === "PARTIAL")
      .reduce((total, payment) => total + toNumber(payment.amount), 0);
    const estimated = treatments.reduce(
      (total, treatment) => total + toNumber(treatment.estimatedCost),
      0,
    );
    const balance = Math.max(estimated - paid - partial, 0);

    return { balance, estimated, paid, partial };
  }, [payments, treatments]);

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

  async function loadBillingContext(patientId: string) {
    setError(null);
    setIsLoading(true);

    try {
      const [paymentResponse, treatmentResponse] = await Promise.all([
        apiGet<ApiPayment[]>(
          `/billing/payments?patientId=${encodeURIComponent(patientId)}`,
          token,
        ),
        apiGet<ApiTreatment[]>(
          `/treatments?patientId=${encodeURIComponent(patientId)}`,
          token,
        ),
      ]);
      setPayments(paymentResponse);
      setTreatments(treatmentResponse);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(form: PaymentForm) {
    await apiPost<ApiPayment>(
      "/billing/payments",
      {
        amount: Number(form.amount),
        method: form.method,
        notes: form.notes.trim() || undefined,
        patientId: form.patientId,
        reference: form.reference.trim() || undefined,
        status: form.status,
        treatmentId: form.treatmentId || undefined,
      },
      token,
    );

    setIsCreateOpen(false);
    setSelectedPatientId(form.patientId);
    await loadBillingContext(form.patientId);
  }

  async function handleStatusChange(id: string, status: PaymentStatus) {
    setError(null);

    try {
      await apiPatch<ApiPayment>(`/billing/payments/${id}`, { status }, token);

      if (selectedPatientId) {
        await loadBillingContext(selectedPatientId);
      }
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Eliminar este pago?")) {
      return;
    }

    setError(null);

    try {
      await apiDelete<{ id: string }>(`/billing/payments/${id}`, token);

      if (selectedPatientId) {
        await loadBillingContext(selectedPatientId);
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
            <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
            Control financiero
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Pagos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra abonos, revisa saldos y vincula pagos con tratamientos.
          </p>
        </div>
        <Button
          disabled={!patients.length}
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Registrar pago
        </Button>
      </section>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={ReceiptText} label="Tratamientos" value={formatCurrency(stats.estimated)} />
        <MetricCard icon={Banknote} label="Pagado" value={formatCurrency(stats.paid)} />
        <MetricCard icon={WalletCards} label="Abonos" value={formatCurrency(stats.partial)} />
        <MetricCard icon={CreditCard} label="Pendiente" value={formatCurrency(stats.balance)} />
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
                  ? `Cuenta de ${formatPatientName(selectedPatient)}`
                  : "Cuenta del paciente"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Historial financiero local de la clinica.
              </p>
            </div>
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar pago, referencia..."
                value={query}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <PaymentSkeleton />}

            {!isLoading && filteredPayments.length === 0 && (
              <EmptyState onCreate={() => setIsCreateOpen(true)} />
            )}

            {!isLoading &&
              filteredPayments.map((payment, index) => (
                <PaymentRow
                  index={index}
                  key={payment.id}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  payment={payment}
                />
              ))}
          </CardContent>
        </Card>
      </section>

      {isCreateOpen && (
        <PaymentModal
          initialPatientId={selectedPatientId}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
          patients={patients}
          treatments={treatments}
        />
      )}
    </div>
  );
}

function PaymentRow({
  index,
  onDelete,
  onStatusChange,
  payment,
}: {
  index: number;
  onDelete: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: PaymentStatus) => Promise<void>;
  payment: ApiPayment;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_150px_150px_120px]"
      initial={{ opacity: 0, y: 8 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-base font-extrabold text-foreground">
            {formatCurrency(toNumber(payment.amount))}
          </div>
          <Badge variant={statusTone[payment.status]}>
            {statusLabels[payment.status]}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
          <span>{methodLabels[payment.method]}</span>
          <span>{payment.treatment?.name ?? "Sin tratamiento"}</span>
          <span>{payment.reference || "Sin referencia"}</span>
        </div>
        {payment.notes && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {payment.notes}
          </p>
        )}
      </div>

      <MiniInfo label="Paciente" value={formatPatientName(payment.patient)} />
      <MiniInfo label="Fecha" value={formatDate(payment.paidAt)} />

      <div className="flex items-center justify-end gap-2">
        {payment.status !== "PAID" && (
          <Button
            aria-label="Marcar pagado"
            onClick={() => void onStatusChange(payment.id, "PAID")}
            size="icon"
            variant="outline"
          >
            <CircleDollarSign className="h-4 w-4" />
          </Button>
        )}
        {payment.status !== "VOID" && (
          <Button
            aria-label="Anular pago"
            onClick={() => void onStatusChange(payment.id, "VOID")}
            size="icon"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button
          aria-label="Eliminar pago"
          onClick={() => void onDelete(payment.id)}
          size="icon"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </motion.div>
  );
}

function PaymentModal({
  initialPatientId,
  onClose,
  onCreate,
  patients,
  treatments,
}: {
  initialPatientId: string | null;
  onClose: () => void;
  onCreate: (form: PaymentForm) => Promise<void>;
  patients: ApiPatient[];
  treatments: ApiTreatment[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentForm>({
    amount: "",
    method: "CASH",
    notes: "",
    patientId: initialPatientId ?? patients[0]?.id ?? "",
    reference: "",
    status: "PAID",
    treatmentId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.patientId || !form.amount || Number(form.amount) <= 0) {
      setError("Paciente y monto valido son obligatorios");
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar el pago",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof PaymentForm>(
    field: K,
    value: PaymentForm[K],
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
              Registrar pago
            </div>
            <div className="text-sm text-muted-foreground">
              Pago, abono o saldo pendiente
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
            <Field label="Tratamiento">
              <Select
                onChange={(value) => updateField("treatmentId", value)}
                value={form.treatmentId}
              >
                <option value="">Sin tratamiento</option>
                {treatments.map((treatment) => (
                  <option key={treatment.id} value={treatment.id}>
                    {treatment.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Monto">
              <Input
                min="0"
                onChange={(event) => updateField("amount", event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.amount}
              />
            </Field>
            <Field label="Metodo">
              <Select
                onChange={(value) => updateField("method", value as PaymentMethod)}
                value={form.method}
              >
                {(Object.keys(methodLabels) as PaymentMethod[]).map((method) => (
                  <option key={method} value={method}>
                    {methodLabels[method]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estado">
              <Select
                onChange={(value) => updateField("status", value as PaymentStatus)}
                value={form.status}
              >
                {(Object.keys(statusLabels) as PaymentStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Referencia">
              <Input
                onChange={(event) => updateField("reference", event.target.value)}
                value={form.reference}
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
              {isSubmitting ? "Guardando..." : "Guardar pago"}
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
  icon: typeof ReceiptText;
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
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary/10 text-primary">
          <CircleDollarSign className="h-7 w-7" />
        </div>
        <div className="mt-4 text-base font-bold text-foreground">
          Sin pagos registrados
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Registra el primer pago o abono del paciente.
        </p>
        <Button className="mt-5" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Registrar pago
        </Button>
      </div>
    </div>
  );
}

function PaymentSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="grid animate-pulse gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_150px_150px_120px]"
          key={index}
        >
          <div className="space-y-3">
            <div className="h-5 w-36 rounded bg-muted" />
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
