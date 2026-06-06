import {
  Bell,
  ChevronDown,
  Command,
  FileImage,
  LoaderCircle,
  Menu,
  Moon,
  Search,
  SmilePlus,
  Stethoscope,
  Sun,
  LogOut,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthenticatedUser } from "@/features/auth/types";
import { appSections, type AppSectionId } from "@/features/navigation/sections";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

type GlobalSearchResult = {
  id: string;
  kind: "appointment" | "media" | "patient" | "payment" | "treatment";
  patientId: string;
  section: AppSectionId;
  subtitle: string;
  title: string;
};

type AppShellProps = {
  activeSection: AppSectionId;
  children: ReactNode;
  darkMode: boolean;
  onLogout: () => void;
  onSectionChange: (section: AppSectionId, patientId?: string) => void;
  onToggleTheme: () => void;
  token: string;
  user: AuthenticatedUser;
};

export function AppShell({
  activeSection,
  children,
  darkMode,
  onLogout,
  onSectionChange,
  onToggleTheme,
  token,
  user,
}: AppShellProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const normalized = searchQuery.trim();

    if (!normalized) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        setSearchResults(
          await apiGet<GlobalSearchResult[]>(
            `/search?q=${encodeURIComponent(normalized)}`,
            token,
          ),
        );
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : "No se pudo realizar la busqueda",
        );
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, token]);

  function openSearchResult(result: GlobalSearchResult) {
    onSectionChange(result.section, result.patientId);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchFocused(false);
  }

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
                autoComplete="off"
                className="h-12 rounded-lg bg-card pl-12 pr-24"
                onBlur={() => {
                  window.setTimeout(() => setIsSearchFocused(false), 120);
                }}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Buscar pacientes, citas, tratamientos..."
                ref={searchInputRef}
                spellCheck={false}
                value={searchQuery}
              />
              {searchQuery ? (
                <button
                  aria-label="Limpiar busqueda"
                  className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  <Command className="h-3.5 w-3.5" />
                  K
                </div>
              )}

              {isSearchFocused && searchQuery.trim() && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-[460px] w-full overflow-auto rounded-lg border border-border bg-card p-2 shadow-soft">
                  {isSearching && (
                    <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Buscando...
                    </div>
                  )}

                  {!isSearching && searchError && (
                    <div className="px-4 py-6 text-center text-sm font-semibold text-danger">
                      {searchError}
                    </div>
                  )}

                  {!isSearching &&
                    !searchError &&
                    searchResults.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No se encontraron resultados.
                      </div>
                    )}

                  {!isSearching &&
                    searchResults.map((result) => (
                      <button
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                        key={`${result.kind}-${result.id}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => openSearchResult(result)}
                        type="button"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <SearchResultIcon kind={result.kind} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-foreground">
                            {result.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {result.subtitle}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
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

function SearchResultIcon({
  kind,
}: {
  kind: GlobalSearchResult["kind"];
}) {
  const icons = {
    appointment: CalendarDays,
    media: FileImage,
    patient: UserRound,
    payment: CircleDollarSign,
    treatment: ClipboardList,
  };
  const Icon = icons[kind];

  return <Icon className="h-4 w-4" />;
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
