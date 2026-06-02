import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CalendarPlus,
  ChevronRight,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SmilePlus,
  Stethoscope,
  Trash2,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AppSectionId } from "@/features/navigation/sections";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

type PatientStatus = "active" | "follow-up" | "alert";
type PatientFilter = "all" | "clinical-alerts" | "with-contact" | "missing-contact";
type DetailPanel = "summary" | "history";
type ClinicalEntryType =
  | "CONSULTATION"
  | "EVOLUTION"
  | "PRESCRIPTION"
  | "PROCEDURE"
  | "NOTE";

type ApiPatient = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  birthDate: string | null;
  gender: "FEMALE" | "MALE" | "OTHER" | "UNSPECIFIED";
  phone: string | null;
  email: string | null;
  address: string | null;
  allergies: string | null;
  medicalAlerts: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiClinicalEntry = {
  author: {
    fullName: string;
    id: string;
    role: string;
  } | null;
  id: string;
  title: string;
  type: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type ApiPatientDetail = ApiPatient & {
  occupation: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  clinicalEntries: ApiClinicalEntry[];
};

type PatientFormState = {
  address: string;
  allergies: string;
  birthDate: string;
  documentId: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  firstName: string;
  gender: ApiPatient["gender"];
  lastName: string;
  medicalAlerts: string;
  notes: string;
  occupation: string;
  phone: string;
};

type ClinicalEntryFormState = {
  notes: string;
  title: string;
  type: ClinicalEntryType;
};

type PatientsPageProps = {
  onNavigate: (section: AppSectionId, patientId?: string) => void;
  onUnauthorized: () => void;
  token: string;
};

const emptyPatientForm: PatientFormState = {
  address: "",
  allergies: "",
  birthDate: "",
  documentId: "",
  email: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  firstName: "",
  gender: "UNSPECIFIED",
  lastName: "",
  medicalAlerts: "",
  notes: "",
  occupation: "",
  phone: "",
};

const emptyClinicalEntryForm: ClinicalEntryFormState = {
  notes: "",
  title: "",
  type: "EVOLUTION",
};

const statusMeta: Record<
  PatientStatus,
  { label: string; tone: "default" | "success" | "warning" | "danger" }
> = {
  active: { label: "Activo", tone: "success" },
  alert: { label: "Alerta clinica", tone: "danger" },
  "follow-up": { label: "Seguimiento", tone: "warning" },
};

const filterLabels: Record<PatientFilter, string> = {
  all: "Todos",
  "clinical-alerts": "Alertas clinicas",
  "missing-contact": "Contacto incompleto",
  "with-contact": "Con contacto",
};

const clinicalEntryLabels: Record<ClinicalEntryType, string> = {
  CONSULTATION: "Consulta",
  EVOLUTION: "Evolucion",
  NOTE: "Nota",
  PRESCRIPTION: "Prescripcion",
  PROCEDURE: "Procedimiento",
};

export function PatientsPage({
  onNavigate,
  onUnauthorized,
  token,
}: PatientsPageProps) {
  const [activeFilter, setActiveFilter] = useState<PatientFilter>("all");
  const [detailPanel, setDetailPanel] = useState<DetailPanel>("summary");
  const [error, setError] = useState<string | null>(null);
  const [isClinicalEntryOpen, setIsClinicalEntryOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] =
    useState<ApiPatientDetail | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPatients(query);
    }, 260);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token]);

  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatient(null);
      return;
    }

    void loadPatientDetail(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, token]);

  const filteredPatients = useMemo(
    () => patients.filter((patient) => passesFilter(patient, activeFilter)),
    [activeFilter, patients],
  );

  const stats = useMemo(() => {
    const alertCount = patients.filter((patient) => getPatientStatus(patient) === "alert").length;
    const missingContact = patients.filter(
      (patient) => !patient.phone && !patient.email,
    ).length;

    return {
      active: patients.length,
      alerts: alertCount,
      missingContact,
      followUps: patients.filter((patient) => getPatientStatus(patient) === "follow-up").length,
    };
  }, [patients]);

  async function loadPatients(search: string) {
    setError(null);
    setIsLoading(true);

    try {
      const path = search.trim()
        ? `/patients?q=${encodeURIComponent(search.trim())}`
        : "/patients";
      const response = await apiGet<ApiPatient[]>(path, token);
      setPatients(response);

      if (!response.length) {
        setSelectedPatientId(null);
        setSelectedPatient(null);
      } else if (!selectedPatientId || !response.some((p) => p.id === selectedPatientId)) {
        setSelectedPatientId(response[0]?.id ?? null);
      }
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPatientDetail(id: string) {
    setError(null);

    try {
      const response = await apiGet<ApiPatientDetail>(`/patients/${id}`, token);
      setSelectedPatient(response);
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleCreatePatient(form: PatientFormState) {
    setError(null);

    const createdPatient = await apiPost<ApiPatient>(
      "/patients",
      normalizePatientForm(form),
      token,
    );

    setIsCreateOpen(false);
    await loadPatients(query);
    setSelectedPatientId(createdPatient.id);
  }

  async function handleCreateClinicalEntry(form: ClinicalEntryFormState) {
    if (!selectedPatientId) {
      return;
    }

    setError(null);

    await apiPost<ApiClinicalEntry>(
      `/patients/${selectedPatientId}/clinical-history`,
      {
        notes: form.notes.trim(),
        title: form.title.trim(),
        type: form.type,
      },
      token,
    );

    setIsClinicalEntryOpen(false);
    setDetailPanel("history");
    await loadPatientDetail(selectedPatientId);
  }

  async function handleDeleteClinicalEntry(entryId: string) {
    if (!selectedPatientId) {
      return;
    }

    const confirmed = window.confirm("Eliminar esta entrada del historial clinico?");

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await apiDelete<{ id: string }>(
        `/patients/${selectedPatientId}/clinical-history/${entryId}`,
        token,
      );
      await loadPatientDetail(selectedPatientId);
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
            <UsersRound className="h-3.5 w-3.5 text-primary" />
            Gestion clinica
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Pacientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta, filtra y revisa el contexto clinico principal de cada
            paciente.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setIsFilterOpen((value) => !value)}
            variant="outline"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filterLabels[activeFilter]}
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo paciente
          </Button>
        </div>
      </section>

      {isFilterOpen && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-4">
            {(Object.keys(filterLabels) as PatientFilter[]).map((filter) => (
              <Button
                key={filter}
                onClick={() => {
                  setActiveFilter(filter);
                  setIsFilterOpen(false);
                }}
                size="sm"
                variant={activeFilter === filter ? "default" : "outline"}
              >
                {filterLabels[filter]}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <PatientStat
          icon={UsersRound}
          label="Pacientes activos"
          tone="text-primary bg-primary/10"
          value={String(stats.active)}
        />
        <PatientStat
          icon={CalendarPlus}
          label="Citas de hoy"
          tone="text-success bg-success/10"
          value="0"
        />
        <PatientStat
          icon={AlertTriangle}
          label="Alertas clinicas"
          tone="text-danger bg-danger/10"
          value={String(stats.alerts)}
        />
        <PatientStat
          icon={Activity}
          label="Contacto incompleto"
          tone="text-warning bg-warning/15"
          value={String(stats.missingContact)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.85fr]">
        <Card className="min-h-[620px]">
          <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Listado de pacientes</CardTitle>
            <div className="relative w-full sm:w-[360px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, cedula o telefono"
                value={query}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <PatientsSkeleton />}

            {!isLoading && filteredPatients.length === 0 && (
              <EmptyPatients onCreate={() => setIsCreateOpen(true)} />
            )}

            {!isLoading &&
              filteredPatients.map((patient, index) => {
                const status = getPatientStatus(patient);
                const isSelected = patient.id === selectedPatientId;
                const meta = statusMeta[status];

                return (
                  <motion.button
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "grid w-full gap-4 rounded-lg border p-4 text-left transition-colors md:grid-cols-[1fr_150px_150px_44px]",
                      isSelected
                        ? "border-primary/35 bg-primary/5"
                        : "border-border bg-card hover:bg-muted/60",
                    )}
                    initial={{ opacity: 0, y: 8 }}
                    key={patient.id}
                    onClick={() => {
                      setDetailPanel("summary");
                      setSelectedPatientId(patient.id);
                    }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    type="button"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-sm font-bold text-foreground">
                        {getInitials(formatPatientName(patient))}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-foreground">
                          {formatPatientName(patient)}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{patient.code}</span>
                          <span>{patient.documentId ? `CI ${patient.documentId}` : "Sin documento"}</span>
                          <span>{formatAge(patient.birthDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Contacto
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-foreground">
                        {patient.phone || patient.email || "Pendiente"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Actualizado
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatShortDate(patient.updatedAt)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <Badge variant={meta.tone}>{meta.label}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </motion.button>
                );
              })}
          </CardContent>
        </Card>

        {selectedPatient ? (
          <PatientSummary
            detailPanel={detailPanel}
            onCreateClinicalEntry={() => setIsClinicalEntryOpen(true)}
            onDeleteClinicalEntry={handleDeleteClinicalEntry}
            onDetailPanelChange={setDetailPanel}
            onNavigate={onNavigate}
            patient={selectedPatient}
          />
        ) : (
          <Card className="min-h-[620px]">
            <CardContent className="grid h-full place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <UserRound className="h-7 w-7" />
                </div>
                <div className="mt-4 text-base font-bold">Sin paciente activo</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Crea o selecciona un paciente para ver su ficha.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {isCreateOpen && (
        <CreatePatientModal
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreatePatient}
        />
      )}

      {isClinicalEntryOpen && selectedPatient && (
        <ClinicalEntryModal
          onClose={() => setIsClinicalEntryOpen(false)}
          onCreate={handleCreateClinicalEntry}
          patientName={formatPatientName(selectedPatient)}
        />
      )}
    </div>
  );
}

type PatientStatProps = {
  icon: LucideIcon;
  label: string;
  tone: string;
  value: string;
};

function PatientStat({ icon: Icon, label, tone, value }: PatientStatProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("grid h-12 w-12 place-items-center rounded-lg", tone)}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-extrabold text-foreground">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PatientSummary({
  detailPanel,
  onCreateClinicalEntry,
  onDeleteClinicalEntry,
  onDetailPanelChange,
  onNavigate,
  patient,
}: {
  detailPanel: DetailPanel;
  onCreateClinicalEntry: () => void;
  onDeleteClinicalEntry: (entryId: string) => Promise<void>;
  onDetailPanelChange: (panel: DetailPanel) => void;
  onNavigate: (section: AppSectionId, patientId?: string) => void;
  patient: ApiPatientDetail;
}) {
  const status = getPatientStatus(patient);
  const meta = statusMeta[status];

  return (
    <Card className="min-h-[620px]">
      <CardHeader className="justify-between">
        <CardTitle>Ficha rapida</CardTitle>
        <Badge variant={meta.tone}>{meta.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/45 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-lg bg-primary/10 text-lg font-extrabold text-primary">
              {getInitials(formatPatientName(patient))}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-extrabold text-foreground">
                {formatPatientName(patient)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {patient.code}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm">
            <InfoRow
              icon={UserRound}
              label="Documento"
              value={patient.documentId ?? "Pendiente"}
            />
            <InfoRow icon={Phone} label="Telefono" value={patient.phone ?? "Pendiente"} />
            <InfoRow icon={Mail} label="Email" value={patient.email ?? "Pendiente"} />
            <InfoRow
              icon={MapPin}
              label="Direccion"
              value={patient.address ?? "Pendiente"}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniPanel label="Edad" value={formatAge(patient.birthDate)} />
          <MiniPanel label="Genero" value={formatGender(patient.gender)} />
          <MiniPanel
            label="Ocupacion"
            value={patient.occupation || "Pendiente"}
          />
          <MiniPanel
            label="Saldo"
            value="$0.00"
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">
              {detailPanel === "summary" ? "Alertas" : "Historial clinico"}
            </div>
            {detailPanel === "history" ? (
              <Button onClick={onCreateClinicalEntry} size="sm" variant="outline">
                <Plus className="h-4 w-4" />
                Nueva evolucion
              </Button>
            ) : (
              <ShieldCheck className="h-4 w-4 text-success" />
            )}
          </div>

          {detailPanel === "summary" ? (
            <AlertsList patient={patient} />
          ) : (
            <ClinicalHistory
              entries={patient.clinicalEntries}
              onDelete={onDeleteClinicalEntry}
            />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <Button
            onClick={() => onDetailPanelChange("history")}
            variant={detailPanel === "history" ? "default" : "outline"}
          >
            <FileText className="h-4 w-4" />
            Historial
          </Button>
          <Button onClick={() => onNavigate("odontogram", patient.id)} variant="outline">
            <SmilePlus className="h-4 w-4" />
            Odontograma
          </Button>
          <Button onClick={() => onNavigate("treatments", patient.id)} variant="outline">
            <ClipboardList className="h-4 w-4" />
            Tratamientos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsList({ patient }: { patient: ApiPatientDetail }) {
  const alerts = [
    patient.allergies ? `Alergias: ${patient.allergies}` : null,
    patient.medicalAlerts ? `Alertas: ${patient.medicalAlerts}` : null,
    patient.notes ? `Notas: ${patient.notes}` : null,
  ].filter(Boolean) as string[];

  if (!alerts.length) {
    alerts.push("Sin alertas clinicas registradas");
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground"
          key={alert}
        >
          <AlertTriangle
            className={cn(
              "h-4 w-4 shrink-0",
              patient.allergies || patient.medicalAlerts
                ? "text-danger"
                : "text-success",
            )}
          />
          {alert}
        </div>
      ))}
    </div>
  );
}

function ClinicalHistory({
  entries,
  onDelete,
}: {
  entries: ApiClinicalEntry[];
  onDelete: (entryId: string) => Promise<void>;
}) {
  if (!entries.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Stethoscope className="h-5 w-5" />
        </div>
        Sin evoluciones clinicas registradas.
      </div>
    );
  }

  return (
    <div className="relative space-y-3">
      <div className="absolute left-4 top-3 h-[calc(100%-1.5rem)] w-px bg-border" />
      {entries.map((entry) => (
        <div
          className="relative ml-9 rounded-lg border border-border bg-card px-3 py-3"
          key={entry.id}
        >
          <div className="absolute -left-[2.12rem] top-4 h-3 w-3 rounded-full border-2 border-card bg-primary" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">
                {entry.title}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
                <span className="text-primary">
                  {formatClinicalEntryType(entry.type)}
                </span>
                <span>{formatShortDate(entry.createdAt)}</span>
                <span>{entry.author?.fullName ?? "Sin autor"}</span>
              </div>
            </div>
            <Button
              aria-label="Eliminar entrada"
              onClick={() => void onDelete(entry.id)}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {entry.notes}
          </p>
        </div>
      ))}
    </div>
  );
}

function CreatePatientModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (form: PatientFormState) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PatientFormState>(emptyPatientForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Nombre y apellido son obligatorios");
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el paciente",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof PatientFormState>(
    field: K,
    value: PatientFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-h-[92vh] w-full max-w-[860px] overflow-auto rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              Nuevo paciente
            </div>
            <div className="text-sm text-muted-foreground">
              Registro clinico inicial
            </div>
          </div>
          <Button aria-label="Cerrar" onClick={onClose} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <Input
                onChange={(event) => updateField("firstName", event.target.value)}
                value={form.firstName}
              />
            </Field>
            <Field label="Apellido">
              <Input
                onChange={(event) => updateField("lastName", event.target.value)}
                value={form.lastName}
              />
            </Field>
            <Field label="Documento">
              <Input
                onChange={(event) => updateField("documentId", event.target.value)}
                value={form.documentId}
              />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input
                onChange={(event) => updateField("birthDate", event.target.value)}
                type="date"
                value={form.birthDate}
              />
            </Field>
            <Field label="Genero">
              <select
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                onChange={(event) =>
                  updateField("gender", event.target.value as ApiPatient["gender"])
                }
                value={form.gender}
              >
                <option value="UNSPECIFIED">No especificado</option>
                <option value="FEMALE">Femenino</option>
                <option value="MALE">Masculino</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>
            <Field label="Telefono">
              <Input
                onChange={(event) => updateField("phone", event.target.value)}
                value={form.phone}
              />
            </Field>
            <Field label="Email">
              <Input
                onChange={(event) => updateField("email", event.target.value)}
                type="email"
                value={form.email}
              />
            </Field>
            <Field label="Ocupacion">
              <Input
                onChange={(event) => updateField("occupation", event.target.value)}
                value={form.occupation}
              />
            </Field>
            <Field className="md:col-span-2" label="Direccion">
              <Input
                onChange={(event) => updateField("address", event.target.value)}
                value={form.address}
              />
            </Field>
            <Field label="Contacto de emergencia">
              <Input
                onChange={(event) =>
                  updateField("emergencyContactName", event.target.value)
                }
                value={form.emergencyContactName}
              />
            </Field>
            <Field label="Telefono emergencia">
              <Input
                onChange={(event) =>
                  updateField("emergencyContactPhone", event.target.value)
                }
                value={form.emergencyContactPhone}
              />
            </Field>
            <Field label="Alergias">
              <Input
                onChange={(event) => updateField("allergies", event.target.value)}
                value={form.allergies}
              />
            </Field>
            <Field label="Alertas medicas">
              <Input
                onChange={(event) =>
                  updateField("medicalAlerts", event.target.value)
                }
                value={form.medicalAlerts}
              />
            </Field>
            <Field className="md:col-span-2" label="Notas">
              <Input
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
              {isSubmitting ? "Guardando..." : "Guardar paciente"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ClinicalEntryModal({
  onClose,
  onCreate,
  patientName,
}: {
  onClose: () => void;
  onCreate: (form: ClinicalEntryFormState) => Promise<void>;
  patientName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ClinicalEntryFormState>(emptyClinicalEntryForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.notes.trim()) {
      setError("Titulo y observacion son obligatorios");
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar la evolucion",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof ClinicalEntryFormState>(
    field: K,
    value: ClinicalEntryFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[680px] rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              Nueva evolucion clinica
            </div>
            <div className="text-sm text-muted-foreground">{patientName}</div>
          </div>
          <Button aria-label="Cerrar" onClick={onClose} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <Field label="Tipo">
              <select
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                onChange={(event) =>
                  updateField("type", event.target.value as ClinicalEntryType)
                }
                value={form.type}
              >
                {(Object.keys(clinicalEntryLabels) as ClinicalEntryType[]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {clinicalEntryLabels[type]}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Titulo">
              <Input
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Control, evolucion, procedimiento..."
                value={form.title}
              />
            </Field>
          </div>

          <Field label="Observacion clinica">
            <textarea
              className="min-h-36 w-full resize-none rounded-lg border border-border bg-card px-3 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Describe hallazgos, evolucion, conducta clinica y recomendaciones..."
              value={form.notes}
            />
          </Field>

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
              {isSubmitting ? "Guardando..." : "Guardar evolucion"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function Field({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
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

function EmptyPatients({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary/10 text-primary">
          <UsersRound className="h-7 w-7" />
        </div>
        <div className="mt-4 text-base font-bold text-foreground">
          No hay pacientes registrados
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Crea el primer registro clinico para comenzar.
        </p>
        <Button className="mt-5" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Nuevo paciente
        </Button>
      </div>
    </div>
  );
}

function PatientsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="grid animate-pulse gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_150px_150px_44px]"
          key={index}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted" />
            </div>
          </div>
          <div className="h-8 rounded bg-muted" />
          <div className="h-8 rounded bg-muted" />
          <div className="h-8 rounded bg-muted" />
        </div>
      ))}
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MiniPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function getPatientStatus(patient: ApiPatient): PatientStatus {
  if (patient.allergies || patient.medicalAlerts) {
    return "alert";
  }

  if (!patient.phone || !patient.email) {
    return "follow-up";
  }

  return "active";
}

function passesFilter(patient: ApiPatient, filter: PatientFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "clinical-alerts") {
    return getPatientStatus(patient) === "alert";
  }

  if (filter === "with-contact") {
    return Boolean(patient.phone || patient.email);
  }

  return !patient.phone || !patient.email;
}

function normalizePatientForm(form: PatientFormState): Record<string, string> {
  return Object.fromEntries(
    Object.entries(form)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
}

function formatPatientName(patient: Pick<ApiPatient, "firstName" | "lastName">) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function formatAge(birthDate: string | null): string {
  if (!birthDate) {
    return "Edad pendiente";
  }

  const date = new Date(birthDate);

  if (Number.isNaN(date.getTime())) {
    return "Edad pendiente";
  }

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDelta = today.getMonth() - date.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return `${age} anos`;
}

function formatGender(gender: ApiPatient["gender"]): string {
  const labels: Record<ApiPatient["gender"], string> = {
    FEMALE: "Femenino",
    MALE: "Masculino",
    OTHER: "Otro",
    UNSPECIFIED: "No especificado",
  };

  return labels[gender];
}

function formatClinicalEntryType(type: string): string {
  return clinicalEntryLabels[type as ClinicalEntryType] ?? type;
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
