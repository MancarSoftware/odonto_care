import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  History,
  Save,
  Search,
  SmilePlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet, apiPut } from "@/lib/api";
import { cn } from "@/lib/utils";

type ToothStatus =
  | "HEALTHY"
  | "CARIES"
  | "RESTORATION"
  | "EXTRACTION"
  | "IMPLANT"
  | "COMPLETED_TREATMENT";

type ApiPatient = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  phone: string | null;
};

type ApiToothState = {
  id: string;
  patientId: string;
  toothNumber: number;
  status: ToothStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiToothEvent = {
  author: {
    fullName: string;
    id: string;
    role: string;
  } | null;
  createdAt: string;
  id: string;
  notes: string | null;
  status: ToothStatus;
  toothNumber: number;
  treatment: {
    id: string;
    name: string;
    status: string;
  } | null;
};

type OdontogramPageProps = {
  patientContextId: string | null;
  onUnauthorized: () => void;
  token: string;
};

const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const statusMeta: Record<
  ToothStatus,
  { color: string; label: string; ring: string; text: string }
> = {
  CARIES: {
    color: "#fee2e2",
    label: "Caries",
    ring: "border-red-200 bg-red-50",
    text: "text-red-600",
  },
  COMPLETED_TREATMENT: {
    color: "#dcfce7",
    label: "Tratamiento finalizado",
    ring: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-600",
  },
  EXTRACTION: {
    color: "#e2e8f0",
    label: "Extraccion",
    ring: "border-slate-300 bg-slate-100",
    text: "text-slate-600",
  },
  HEALTHY: {
    color: "#f8fafc",
    label: "Sano",
    ring: "border-slate-200 bg-white",
    text: "text-slate-600",
  },
  IMPLANT: {
    color: "#ede9fe",
    label: "Implante",
    ring: "border-violet-200 bg-violet-50",
    text: "text-violet-600",
  },
  RESTORATION: {
    color: "#dbeafe",
    label: "Restauracion",
    ring: "border-blue-200 bg-blue-50",
    text: "text-blue-600",
  },
};

export function OdontogramPage({
  onUnauthorized,
  patientContextId,
  token,
}: OdontogramPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ApiToothEvent[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingTeeth, setIsLoadingTeeth] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    patientContextId,
  );
  const [selectedStatus, setSelectedStatus] = useState<ToothStatus>("HEALTHY");
  const [selectedTooth, setSelectedTooth] = useState<number>(11);
  const [toothStates, setToothStates] = useState<ApiToothState[]>([]);

  const statesByTooth = useMemo(() => {
    return new Map(toothStates.map((state) => [state.toothNumber, state]));
  }, [toothStates]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const selectedState = statesByTooth.get(selectedTooth);

  useEffect(() => {
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (patientContextId) {
      setSelectedPatientId(patientContextId);
    }
  }, [patientContextId]);

  useEffect(() => {
    if (!selectedPatientId) {
      setToothStates([]);
      setEvents([]);
      return;
    }

    void loadOdontogram(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, token]);

  useEffect(() => {
    const state = statesByTooth.get(selectedTooth);
    setSelectedStatus(state?.status ?? "HEALTHY");
    setNotes(state?.notes ?? "");

    if (selectedPatientId) {
      void loadToothEvents(selectedPatientId, selectedTooth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTooth, selectedPatientId, statesByTooth]);

  async function loadPatients() {
    setError(null);
    setIsLoadingPatients(true);

    try {
      const response = await apiGet<ApiPatient[]>("/patients", token);
      setPatients(response);

      if (!selectedPatientId && response[0]) {
        setSelectedPatientId(response[0].id);
      }
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoadingPatients(false);
    }
  }

  async function loadOdontogram(patientId: string) {
    setError(null);
    setIsLoadingTeeth(true);

    try {
      const response = await apiGet<ApiToothState[]>(
        `/patients/${patientId}/odontogram`,
        token,
      );
      setToothStates(response);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoadingTeeth(false);
    }
  }

  async function loadToothEvents(patientId: string, toothNumber: number) {
    try {
      const response = await apiGet<ApiToothEvent[]>(
        `/patients/${patientId}/odontogram/teeth/${toothNumber}/events`,
        token,
      );
      setEvents(response);
    } catch (requestError) {
      handleRequestError(requestError);
    }
  }

  async function handleSaveTooth() {
    if (!selectedPatientId) {
      setError("Selecciona un paciente antes de guardar");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const updatedState = await apiPut<ApiToothState>(
        `/patients/${selectedPatientId}/odontogram/teeth/${selectedTooth}`,
        {
          notes: notes.trim(),
          status: selectedStatus,
        },
        token,
      );

      setToothStates((current) => [
        ...current.filter((state) => state.toothNumber !== selectedTooth),
        updatedState,
      ]);
      await loadToothEvents(selectedPatientId, selectedTooth);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsSaving(false);
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

  const filteredPatients = patients.filter((patient) => {
    const normalized = patientSearch.trim().toLowerCase();

    if (!normalized) {
      return true;
    }

    return [
      patient.firstName,
      patient.lastName,
      patient.code,
      patient.documentId ?? "",
      patient.phone ?? "",
    ].some((value) => value.toLowerCase().includes(normalized));
  });

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-5">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
            <SmilePlus className="h-3.5 w-3.5 text-primary" />
            Odontograma SVG
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            Odontograma
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra estados por pieza dental y consulta su historial clinico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusMeta).map(([status, meta]) => (
            <div
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold",
                meta.ring,
                meta.text,
              )}
              key={status}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-current"
                style={{ backgroundColor: meta.color }}
              />
              {meta.label}
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
        <Card className="min-h-[640px]">
          <CardHeader>
            <CardTitle>Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setPatientSearch(event.target.value)}
                placeholder="Buscar paciente"
                value={patientSearch}
              />
            </div>

            <div className="space-y-2">
              {isLoadingPatients ? (
                <PatientListSkeleton />
              ) : (
                filteredPatients.map((patient) => {
                  const active = patient.id === selectedPatientId;

                  return (
                    <button
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                        active
                          ? "border-primary/35 bg-primary/5"
                          : "border-border bg-card hover:bg-muted",
                      )}
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      type="button"
                    >
                      <div className="truncate text-sm font-bold text-foreground">
                        {formatPatientName(patient)}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {patient.code}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[640px] overflow-hidden">
          <CardHeader className="justify-between">
            <div>
              <CardTitle>
                {selectedPatient
                  ? formatPatientName(selectedPatient)
                  : "Sin paciente seleccionado"}
              </CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                Pieza activa: {selectedTooth}
              </div>
            </div>
            <Badge variant={selectedState ? "default" : "success"}>
              {statusMeta[selectedStatus].label}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-muted/35 p-3">
              <OdontogramSvg
                isLoading={isLoadingTeeth}
                onSelectTooth={setSelectedTooth}
                selectedTooth={selectedTooth}
                statesByTooth={statesByTooth}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[640px]">
          <CardHeader>
            <CardTitle>Detalle de pieza</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/45 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">
                    Pieza dental
                  </div>
                  <div className="mt-1 text-4xl font-extrabold text-foreground">
                    {selectedTooth}
                  </div>
                </div>
                <CircleDot className={cn("h-9 w-9", statusMeta[selectedStatus].text)} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Estado
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(statusMeta) as ToothStatus[]).map((status) => (
                  <button
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors",
                      selectedStatus === status
                        ? `${statusMeta[status].ring} ${statusMeta[status].text}`
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    type="button"
                  >
                    {statusMeta[status].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Nota clinica
              </label>
              <textarea
                className="min-h-28 w-full resize-none rounded-lg border border-border bg-card px-3 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observacion asociada a la pieza dental..."
                value={notes}
              />
            </div>

            <Button
              className="w-full"
              disabled={isSaving || !selectedPatientId}
              onClick={() => void handleSaveTooth()}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar estado"}
            </Button>

            <div className="border-t border-border pt-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <History className="h-4 w-4 text-primary" />
                Historial de pieza
              </div>
              <div className="space-y-2">
                {events.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card px-3 py-4 text-sm text-muted-foreground">
                    Sin eventos registrados para esta pieza.
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      className="rounded-lg border border-border bg-card px-3 py-3"
                      key={event.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-foreground">
                          {statusMeta[event.status].label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatShortDate(event.createdAt)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {event.author?.fullName ?? "Sin autor"}
                      </div>
                      {event.notes && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {event.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function OdontogramSvg({
  isLoading,
  onSelectTooth,
  selectedTooth,
  statesByTooth,
}: {
  isLoading: boolean;
  onSelectTooth: (toothNumber: number) => void;
  selectedTooth: number;
  statesByTooth: Map<number, ApiToothState>;
}) {
  return (
    <svg
      aria-label="Odontograma interactivo"
      className={cn("h-auto min-h-[390px] w-full", isLoading && "animate-pulse opacity-60")}
      role="img"
      viewBox="0 0 780 390"
    >
      <rect fill="transparent" height="390" rx="16" width="780" />
      <path
        d="M92 160 C210 116, 300 104, 390 104 C480 104, 570 116, 688 160"
        fill="none"
        stroke="hsl(var(--border))"
        strokeDasharray="8 10"
        strokeWidth="2"
      />
      <path
        d="M92 230 C210 274, 300 286, 390 286 C480 286, 570 274, 688 230"
        fill="none"
        stroke="hsl(var(--border))"
        strokeDasharray="8 10"
        strokeWidth="2"
      />
      <TextLabel x={390} y={34} value="Maxilar superior" />
      <TextLabel x={390} y={372} value="Mandibula inferior" />
      {upperTeeth.map((toothNumber, index) => (
        <ToothShape
          index={index}
          key={toothNumber}
          onSelectTooth={onSelectTooth}
          row="upper"
          selected={selectedTooth === toothNumber}
          state={statesByTooth.get(toothNumber)}
          toothNumber={toothNumber}
        />
      ))}
      {lowerTeeth.map((toothNumber, index) => (
        <ToothShape
          index={index}
          key={toothNumber}
          onSelectTooth={onSelectTooth}
          row="lower"
          selected={selectedTooth === toothNumber}
          state={statesByTooth.get(toothNumber)}
          toothNumber={toothNumber}
        />
      ))}
    </svg>
  );
}

function ToothShape({
  index,
  onSelectTooth,
  row,
  selected,
  state,
  toothNumber,
}: {
  index: number;
  onSelectTooth: (toothNumber: number) => void;
  row: "upper" | "lower";
  selected: boolean;
  state: ApiToothState | undefined;
  toothNumber: number;
}) {
  const x = 36 + index * 46;
  const y = row === "upper" ? 62 : 238;
  const status = state?.status ?? "HEALTHY";
  const meta = statusMeta[status];
  const isMolar = [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(toothNumber);
  const isCanine = [13, 23, 33, 43].includes(toothNumber);
  const crownWidth = isMolar ? 34 : 28;
  const crownHeight = isCanine ? 38 : 34;
  const crownX = (42 - crownWidth) / 2;
  const crownTop = row === "upper" ? 30 : 0;
  const crownBottom = crownTop + crownHeight;
  const rootStart = row === "upper" ? crownTop + 2 : crownBottom - 2;

  return (
    <g
      className="cursor-pointer outline-none"
      onClick={() => onSelectTooth(toothNumber)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onSelectTooth(toothNumber);
        }
      }}
      role="button"
      tabIndex={0}
      transform={`translate(${x} ${y})`}
    >
      <title>{`Pieza ${toothNumber}: ${meta.label}`}</title>
      <motion.g
        animate={{ scale: selected ? 1.07 : 1 }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {isMolar ? (
          <>
            <path
              d={
                row === "upper"
                  ? `M14 ${rootStart} C8 20, 8 8, 13 1`
                  : `M14 ${rootStart} C8 46, 8 58, 13 67`
              }
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeLinecap="round"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
            <path
              d={
                row === "upper"
                  ? `M28 ${rootStart} C34 20, 34 8, 29 1`
                  : `M28 ${rootStart} C34 46, 34 58, 29 67`
              }
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeLinecap="round"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
          </>
        ) : (
          <path
            d={
              row === "upper"
                ? `M21 ${rootStart} C21 19, 20 8, 21 1`
                : `M21 ${rootStart} C21 46, 20 58, 21 67`
            }
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeLinecap="round"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
        )}
        <path
          d={
            isCanine
              ? `M${crownX + 3} ${crownTop + 12} C${crownX + 4} ${crownTop + 1}, ${crownX + crownWidth - 4} ${crownTop + 1}, ${crownX + crownWidth - 3} ${crownTop + 12} L${crownX + crownWidth / 2} ${crownBottom} Z`
              : `M${crownX + 4} ${crownTop + 10} C${crownX + 7} ${crownTop}, ${crownX + crownWidth - 7} ${crownTop}, ${crownX + crownWidth - 4} ${crownTop + 10} L${crownX + crownWidth - 2} ${crownTop + 28} C${crownX + crownWidth - 4} ${crownBottom}, ${crownX + 4} ${crownBottom}, ${crownX + 2} ${crownTop + 28} Z`
          }
          fill={meta.color}
          stroke={selected ? "hsl(var(--primary))" : "hsl(var(--border))"}
          strokeWidth={selected ? 3 : 2}
        />
        {status === "EXTRACTION" && (
          <path
            d={`M10 ${crownTop + 6} L32 ${crownBottom - 3} M32 ${crownTop + 6} L10 ${crownBottom - 3}`}
            stroke="#ef4444"
            strokeLinecap="round"
            strokeWidth="3"
          />
        )}
        {status === "IMPLANT" && (
          <path
            d={`M21 ${crownTop + 7} L21 ${crownBottom - 3} M15 ${crownTop + 19} L27 ${crownTop + 19}`}
            stroke="#7c3aed"
            strokeLinecap="round"
            strokeWidth="3"
          />
        )}
        {status === "CARIES" && <circle cx="21" cy={crownTop + 18} fill="#ef4444" r="4" />}
        {status === "COMPLETED_TREATMENT" && (
          <CheckCircle2 color="#059669" height="12" width="12" x="15" y={crownTop + 12} />
        )}
        <text
          fill="hsl(var(--muted-foreground))"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          x="21"
          y={row === "upper" ? 82 : -12}
        >
          {toothNumber}
        </text>
      </motion.g>
    </g>
  );
}

function TextLabel({ value, x, y }: { value: string; x: number; y: number }) {
  return (
    <text
      fill="hsl(var(--muted-foreground))"
      fontSize="13"
      fontWeight="700"
      textAnchor="middle"
      x={x}
      y={y}
    >
      {value}
    </text>
  );
}

function PatientListSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="h-16 animate-pulse rounded-lg border border-border bg-muted"
          key={index}
        />
      ))}
    </>
  );
}

function formatPatientName(patient: Pick<ApiPatient, "firstName" | "lastName">) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
