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
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PatientStatus = "active" | "follow-up" | "alert";

type Patient = {
  id: string;
  code: string;
  name: string;
  documentId: string;
  age: number;
  phone: string;
  email: string;
  address: string;
  lastVisit: string;
  nextAppointment: string;
  status: PatientStatus;
  treatment: string;
  balance: number;
  alerts: string[];
};

const patients: Patient[] = [
  {
    id: "1",
    code: "PAC-20260601-0001",
    name: "Maria Gonzalez",
    documentId: "0912456789",
    age: 34,
    phone: "+593 98 340 1120",
    email: "maria.gonzalez@email.com",
    address: "Av. Amazonas y Naciones Unidas",
    lastVisit: "28 mayo 2026",
    nextAppointment: "Hoy, 09:00",
    status: "active",
    treatment: "Limpieza dental",
    balance: 0,
    alerts: ["Sin alergias registradas"],
  },
  {
    id: "2",
    code: "PAC-20260531-0004",
    name: "Juan Perez",
    documentId: "1720453381",
    age: 41,
    phone: "+593 99 120 4588",
    email: "juan.perez@email.com",
    address: "La Carolina, Quito",
    lastVisit: "24 mayo 2026",
    nextAppointment: "Hoy, 10:00",
    status: "follow-up",
    treatment: "Resina compuesta",
    balance: 120,
    alerts: ["Seguimiento de restauracion"],
  },
  {
    id: "3",
    code: "PAC-20260525-0011",
    name: "Ana Martinez",
    documentId: "0955123401",
    age: 29,
    phone: "+593 96 830 4120",
    email: "ana.martinez@email.com",
    address: "Samborondon",
    lastVisit: "18 mayo 2026",
    nextAppointment: "Hoy, 11:00",
    status: "alert",
    treatment: "Endodoncia",
    balance: 280,
    alerts: ["Alergia a penicilina", "Dolor persistente"],
  },
  {
    id: "4",
    code: "PAC-20260520-0007",
    name: "Luis Rodriguez",
    documentId: "1102837465",
    age: 46,
    phone: "+593 97 455 3901",
    email: "luis.rodriguez@email.com",
    address: "Centro historico",
    lastVisit: "15 mayo 2026",
    nextAppointment: "Hoy, 14:00",
    status: "active",
    treatment: "Ortodoncia",
    balance: 0,
    alerts: ["Control mensual"],
  },
  {
    id: "5",
    code: "PAC-20260512-0015",
    name: "Carla Suarez",
    documentId: "0922109450",
    age: 37,
    phone: "+593 99 501 7718",
    email: "carla.suarez@email.com",
    address: "Urdesa Central",
    lastVisit: "12 mayo 2026",
    nextAppointment: "Hoy, 15:00",
    status: "follow-up",
    treatment: "Blanqueamiento",
    balance: 80,
    alerts: ["Sensibilidad dental"],
  },
];

const statusMeta: Record<
  PatientStatus,
  { label: string; tone: "default" | "success" | "warning" | "danger" }
> = {
  active: { label: "Activo", tone: "success" },
  alert: { label: "Alerta clinica", tone: "danger" },
  "follow-up": { label: "Seguimiento", tone: "warning" },
};

export function PatientsPage() {
  const [query, setQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id);

  const filteredPatients = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return patients;
    }

    return patients.filter((patient) =>
      [
        patient.name,
        patient.code,
        patient.documentId,
        patient.phone,
        patient.treatment,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query]);

  const selectedPatient =
    patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];

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
          <Button variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </Button>
          <Button>
            <Plus className="h-4 w-4" />
            Nuevo paciente
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <PatientStat
          icon={UsersRound}
          label="Pacientes activos"
          tone="text-primary bg-primary/10"
          value="1,248"
        />
        <PatientStat
          icon={CalendarPlus}
          label="Citas de hoy"
          tone="text-success bg-success/10"
          value="12"
        />
        <PatientStat
          icon={AlertTriangle}
          label="Alertas clinicas"
          tone="text-danger bg-danger/10"
          value="8"
        />
        <PatientStat
          icon={Activity}
          label="Seguimientos"
          tone="text-warning bg-warning/15"
          value="34"
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
                placeholder="Buscar por nombre, cedula o tratamiento"
                value={query}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredPatients.map((patient, index) => {
              const isSelected = patient.id === selectedPatient?.id;
              const meta = statusMeta[patient.status];

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
                  onClick={() => setSelectedPatientId(patient.id)}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-sm font-bold text-foreground">
                      {getInitials(patient.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">
                        {patient.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{patient.code}</span>
                        <span>CI {patient.documentId}</span>
                        <span>{patient.age} anos</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Tratamiento
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-foreground">
                      {patient.treatment}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Proxima cita
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {patient.nextAppointment}
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

        {selectedPatient && <PatientSummary patient={selectedPatient} />}
      </section>
    </div>
  );
}

type PatientStatProps = {
  icon: typeof UsersRound;
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

function PatientSummary({ patient }: { patient: Patient }) {
  const meta = statusMeta[patient.status];

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
              {getInitials(patient.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-extrabold text-foreground">
                {patient.name}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {patient.code}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm">
            <InfoRow icon={UserRound} label="Documento" value={patient.documentId} />
            <InfoRow icon={Phone} label="Telefono" value={patient.phone} />
            <InfoRow icon={Mail} label="Email" value={patient.email} />
            <InfoRow icon={MapPin} label="Direccion" value={patient.address} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniPanel label="Ultima visita" value={patient.lastVisit} />
          <MiniPanel label="Proxima cita" value={patient.nextAppointment} />
          <MiniPanel label="Tratamiento" value={patient.treatment} />
          <MiniPanel
            label="Saldo"
            value={patient.balance > 0 ? `$${patient.balance}.00` : "$0.00"}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">Alertas</div>
            <ShieldCheck className="h-4 w-4 text-success" />
          </div>
          <div className="space-y-2">
            {patient.alerts.map((alert) => (
              <div
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground"
                key={alert}
              >
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    patient.status === "alert" ? "text-danger" : "text-warning",
                  )}
                />
                {alert}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <Button variant="outline">
            <FileText className="h-4 w-4" />
            Historial
          </Button>
          <Button variant="outline">
            <SmilePlus className="h-4 w-4" />
            Odontograma
          </Button>
          <Button variant="outline">
            <ClipboardList className="h-4 w-4" />
            Tratamientos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
