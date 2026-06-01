import {
  Bell,
  ChevronDown,
  Command,
  Menu,
  Moon,
  Search,
  SmilePlus,
  Stethoscope,
  Sun,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthenticatedUser } from "@/features/auth/types";
import { appSections, type AppSectionId } from "@/features/navigation/sections";
import { cn } from "@/lib/utils";

type AppShellProps = {
  activeSection: AppSectionId;
  children: ReactNode;
  darkMode: boolean;
  onLogout: () => void;
  onSectionChange: (section: AppSectionId) => void;
  onToggleTheme: () => void;
  user: AuthenticatedUser;
};

export function AppShell({
  activeSection,
  children,
  darkMode,
  onLogout,
  onSectionChange,
  onToggleTheme,
  user,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-[248px] shrink-0 border-r border-border bg-card/82 px-4 py-6 backdrop-blur-xl lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/12 text-primary">
            <SmilePlus className="h-7 w-7" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">
              OdontoCare
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Sistema Odontologico
            </div>
          </div>
        </div>

        <nav className="mt-9 space-y-1.5">
          {appSections.map((item) => (
            <button
              className={cn(
                "flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors",
                activeSection === item.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted hover:text-foreground",
              )}
              key={item.label}
              onClick={() => onSectionChange(item.id)}
              type="button"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-12 rounded-lg border border-border bg-muted/45 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-lg bg-accent/12 text-accent">
            <Stethoscope className="h-8 w-8" />
          </div>
          <div className="mt-5 text-base font-bold leading-6 text-foreground">
            Tu clinica, siempre en orden
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Gestiona pacientes, citas y tratamientos con precision clinica.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border bg-background/86 px-6 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-4">
            <Button aria-label="Menu" size="icon" variant="ghost">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative hidden w-[430px] max-w-[44vw] xl:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 rounded-lg bg-card pl-12 pr-24"
                placeholder="Buscar pacientes, citas, tratamientos..."
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                <Command className="h-3.5 w-3.5" />
                K
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              aria-label="Cambiar tema"
              onClick={onToggleTheme}
              size="icon"
              variant="outline"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button aria-label="Notificaciones" size="icon" variant="ghost">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="ml-1 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/12 text-sm font-bold text-accent">
                {getInitials(user.fullName)}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-foreground">
                  {user.fullName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRole(user.role)}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button aria-label="Cerrar sesion" onClick={onLogout} size="icon" variant="ghost">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
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

function formatRole(role: AuthenticatedUser["role"]): string {
  const labels: Record<AuthenticatedUser["role"], string> = {
    ADMIN: "Administrador",
    DENTIST: "Odontologo",
    RECEPTION: "Recepcion",
  };

  return labels[role];
}
