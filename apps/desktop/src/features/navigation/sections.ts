import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Package,
  Settings,
  SmilePlus,
  UsersRound,
} from "lucide-react";

export const appSections = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "patients", label: "Pacientes", icon: UsersRound },
  { id: "appointments", label: "Agenda", icon: CalendarDays },
  { id: "odontogram", label: "Odontograma", icon: SmilePlus },
  { id: "treatments", label: "Tratamientos", icon: ClipboardList },
  { id: "billing", label: "Pagos", icon: CircleDollarSign },
  { id: "inventory", label: "Inventario", icon: Package },
  { id: "reports", label: "Reportes", icon: FileBarChart },
  { id: "settings", label: "Configuracion", icon: Settings },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  icon: LucideIcon;
}>;

export type AppSectionId = (typeof appSections)[number]["id"];

export const sectionLabels = Object.fromEntries(
  appSections.map((section) => [section.id, section.label]),
) as Record<AppSectionId, string>;
