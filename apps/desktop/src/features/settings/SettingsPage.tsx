import { motion } from "framer-motion";
import {
  Building2,
  Check,
  History,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthenticatedUser } from "@/features/auth/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

type SettingsTab = "clinic" | "users" | "audit";
type UserRole = AuthenticatedUser["role"];

type ClinicSettings = {
  address: string | null;
  appointmentDurationMin: number;
  clinicName: string;
  currency: string;
  email: string | null;
  id: string;
  phone: string | null;
  taxId: string | null;
  timezone: string;
  updatedAt: string;
};

type ApiUser = {
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  isActive: boolean;
  lastLoginAt: string | null;
  role: UserRole;
  updatedAt: string;
};

type AuditLog = {
  action: string;
  actor: {
    email: string;
    fullName: string;
    id: string;
    role: UserRole;
  } | null;
  after: unknown;
  before: unknown;
  createdAt: string;
  entity: string;
  entityId: string | null;
  id: string;
};

type UserForm = {
  email: string;
  fullName: string;
  isActive: boolean;
  password: string;
  role: UserRole;
};

type SettingsPageProps = {
  currentUser: AuthenticatedUser;
  onUnauthorized: () => void;
  token: string;
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  DENTIST: "Odontologo",
  RECEPTION: "Recepcion",
};

const actionLabels: Record<string, string> = {
  CREATE: "Creo",
  DELETE: "Elimino",
  EXPORT: "Exporto",
  LOGIN: "Inicio sesion",
  LOGOUT: "Cerro sesion",
  RESTORE: "Restauro",
  UPDATE: "Actualizo",
};

export function SettingsPage({
  currentUser,
  onUnauthorized,
  token,
}: SettingsPageProps) {
  const isAdmin = currentUser.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<SettingsTab>("clinic");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [clinicForm, setClinicForm] = useState<ClinicSettings | null>(null);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingClinic, setIsSavingClinic] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<ApiUser | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);

  useEffect(() => {
    void loadClinic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    if (activeTab === "users") {
      void loadUsers();
    }

    if (activeTab === "audit") {
      void loadAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin, token]);

  const userStats = useMemo(
    () => ({
      active: users.filter((user) => user.isActive).length,
      admins: users.filter((user) => user.role === "ADMIN").length,
      dentists: users.filter((user) => user.role === "DENTIST").length,
      total: users.length,
    }),
    [users],
  );

  async function loadClinic() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiGet<ClinicSettings>("/settings/clinic", token);
      setClinic(response);
      setClinicForm(response);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsers() {
    setError(null);
    setIsLoading(true);

    try {
      setUsers(await apiGet<ApiUser[]>("/users", token));
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAudit() {
    setError(null);
    setIsLoading(true);

    try {
      setAuditLogs(await apiGet<AuditLog[]>("/audit?limit=60", token));
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveClinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clinicForm || !isAdmin) {
      return;
    }

    setError(null);
    setIsSavingClinic(true);

    try {
      const response = await apiPatch<ClinicSettings>(
        "/settings/clinic",
        {
          address: clinicForm.address ?? "",
          appointmentDurationMin: Number(clinicForm.appointmentDurationMin),
          clinicName: clinicForm.clinicName.trim(),
          currency: clinicForm.currency.trim(),
          email: clinicForm.email ?? "",
          phone: clinicForm.phone ?? "",
          taxId: clinicForm.taxId ?? "",
          timezone: clinicForm.timezone.trim(),
        },
        token,
      );
      setClinic(response);
      setClinicForm(response);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setIsSavingClinic(false);
    }
  }

  async function handleCreateUser(form: UserForm) {
    await apiPost<ApiUser>(
      "/users",
      {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        role: form.role,
      },
      token,
    );
    setIsUserModalOpen(false);
    await loadUsers();
  }

  async function handleUpdateUser(form: UserForm) {
    if (!editingUser) {
      return;
    }

    await apiPatch<ApiUser>(
      `/users/${editingUser.id}`,
      {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        isActive: form.isActive,
        role: form.role,
      },
      token,
    );
    setEditingUser(null);
    await loadUsers();
  }

  async function handleChangePassword(password: string) {
    if (!passwordUser) {
      return;
    }

    await apiPatch<{ id: string }>(
      `/users/${passwordUser.id}/password`,
      { password },
      token,
    );
    setPasswordUser(null);
    await loadAudit();
  }

  async function handleDeleteUser(user: ApiUser) {
    if (!window.confirm(`Eliminar la cuenta de ${user.fullName}?`)) {
      return;
    }

    setError(null);

    try {
      await apiDelete<{ id: string }>(`/users/${user.id}`, token);
      await loadUsers();
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

  const tabs: Array<{
    id: SettingsTab;
    icon: typeof Settings;
    label: string;
    restricted?: boolean;
  }> = [
    { id: "clinic", icon: Building2, label: "Clinica" },
    { id: "users", icon: UsersRound, label: "Usuarios", restricted: true },
    { id: "audit", icon: History, label: "Auditoria", restricted: true },
  ];

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-5">
      <section>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
          <Settings className="h-3.5 w-3.5 text-primary" />
          Administracion del sistema
        </div>
        <h1 className="mt-3 text-3xl font-extrabold text-foreground">
          Configuracion
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona la identidad de la clinica, accesos y trazabilidad.
        </p>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => {
          const disabled = Boolean(tab.restricted && !isAdmin);

          return (
            <Button
              disabled={disabled}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant={activeTab === tab.id ? "default" : "ghost"}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      {activeTab === "clinic" && (
        <ClinicPanel
          clinic={clinic}
          form={clinicForm}
          isAdmin={isAdmin}
          isLoading={isLoading}
          isSaving={isSavingClinic}
          onChange={setClinicForm}
          onSubmit={handleSaveClinic}
        />
      )}

      {activeTab === "users" && isAdmin && (
        <UsersPanel
          currentUserId={currentUser.id}
          isLoading={isLoading}
          onChangePassword={setPasswordUser}
          onCreate={() => setIsUserModalOpen(true)}
          onDelete={handleDeleteUser}
          onEdit={setEditingUser}
          stats={userStats}
          users={users}
        />
      )}

      {activeTab === "audit" && isAdmin && (
        <AuditPanel isLoading={isLoading} logs={auditLogs} />
      )}

      {isUserModalOpen && (
        <UserModal
          onClose={() => setIsUserModalOpen(false)}
          onSubmit={handleCreateUser}
          title="Nuevo usuario"
        />
      )}

      {editingUser && (
        <UserModal
          initialUser={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={handleUpdateUser}
          title="Editar usuario"
        />
      )}

      {passwordUser && (
        <PasswordModal
          onClose={() => setPasswordUser(null)}
          onSubmit={handleChangePassword}
          user={passwordUser}
        />
      )}
    </div>
  );
}

function ClinicPanel({
  clinic,
  form,
  isAdmin,
  isLoading,
  isSaving,
  onChange,
  onSubmit,
}: {
  clinic: ClinicSettings | null;
  form: ClinicSettings | null;
  isAdmin: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onChange: (settings: ClinicSettings) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  if (isLoading || !form) {
    return <SettingsSkeleton />;
  }

  function update<K extends keyof ClinicSettings>(
    field: K,
    value: ClinicSettings[K],
  ) {
    onChange({ ...form!, [field]: value });
  }

  return (
    <form className="grid gap-5 xl:grid-cols-[1fr_360px]" onSubmit={onSubmit}>
      <Card>
        <CardHeader className="justify-between">
          <div>
            <CardTitle>Datos de la clinica</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Informacion operativa utilizada por el sistema.
            </p>
          </div>
          {!isAdmin && <Badge variant="warning">Solo lectura</Badge>}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre comercial">
            <Input
              disabled={!isAdmin}
              onChange={(event) => update("clinicName", event.target.value)}
              value={form.clinicName}
            />
          </Field>
          <Field label="RUC / identificacion fiscal">
            <Input
              disabled={!isAdmin}
              onChange={(event) => update("taxId", event.target.value)}
              value={form.taxId ?? ""}
            />
          </Field>
          <Field label="Telefono">
            <Input
              disabled={!isAdmin}
              onChange={(event) => update("phone", event.target.value)}
              value={form.phone ?? ""}
            />
          </Field>
          <Field label="Correo">
            <Input
              disabled={!isAdmin}
              onChange={(event) => update("email", event.target.value)}
              type="email"
              value={form.email ?? ""}
            />
          </Field>
          <Field className="md:col-span-2" label="Direccion">
            <Input
              disabled={!isAdmin}
              onChange={(event) => update("address", event.target.value)}
              value={form.address ?? ""}
            />
          </Field>
          <Field label="Moneda">
            <Select
              disabled={!isAdmin}
              onChange={(value) => update("currency", value)}
              value={form.currency}
            >
              <option value="USD">USD - Dolar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="COP">COP - Peso colombiano</option>
            </Select>
          </Field>
          <Field label="Zona horaria">
            <Select
              disabled={!isAdmin}
              onChange={(value) => update("timezone", value)}
              value={form.timezone}
            >
              <option value="America/Guayaquil">America/Guayaquil</option>
              <option value="America/Bogota">America/Bogota</option>
              <option value="America/Lima">America/Lima</option>
              <option value="America/Mexico_City">America/Mexico City</option>
            </Select>
          </Field>
          <Field label="Duracion predeterminada de cita">
            <Input
              disabled={!isAdmin}
              max={240}
              min={10}
              onChange={(event) =>
                update("appointmentDurationMin", Number(event.target.value))
              }
              type="number"
              value={form.appointmentDurationMin}
            />
          </Field>

          {isAdmin && (
            <div className="flex justify-end border-t border-border pt-5 md:col-span-2">
              <Button disabled={isSaving} type="submit">
                <Save className="h-4 w-4" />
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-5">
            <div className="grid h-14 w-14 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="mt-4 text-xl font-extrabold text-foreground">
              {form.clinicName}
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <InfoLine icon={Phone} value={form.phone || "Sin telefono"} />
              <InfoLine icon={Mail} value={form.email || "Sin correo"} />
              <InfoLine icon={MapPin} value={form.address || "Sin direccion"} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-success" />
              <div className="font-bold text-foreground">Configuracion local</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Estos datos se almacenan en PostgreSQL dentro de la instalacion de
              la clinica.
            </p>
            {clinic && (
              <div className="mt-3 text-xs font-semibold text-muted-foreground">
                Actualizado: {formatDateTime(clinic.updatedAt)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function UsersPanel({
  currentUserId,
  isLoading,
  onChangePassword,
  onCreate,
  onDelete,
  onEdit,
  stats,
  users,
}: {
  currentUserId: string;
  isLoading: boolean;
  onChangePassword: (user: ApiUser) => void;
  onCreate: () => void;
  onDelete: (user: ApiUser) => Promise<void>;
  onEdit: (user: ApiUser) => void;
  stats: { active: number; admins: number; dentists: number; total: number };
  users: ApiUser[];
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Usuarios" value={stats.total} />
        <Metric label="Activos" value={stats.active} />
        <Metric label="Odontologos" value={stats.dentists} />
        <Metric label="Administradores" value={stats.admins} />
      </section>

      <Card>
        <CardHeader className="justify-between">
          <div>
            <CardTitle>Cuentas y permisos</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Los permisos se aplican en la API segun el rol asignado.
            </p>
          </div>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <SettingsSkeleton compact />}
          {!isLoading &&
            users.map((user, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_160px_150px_150px]"
                initial={{ opacity: 0, y: 6 }}
                key={user.id}
                transition={{ delay: index * 0.025, duration: 0.2 }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-extrabold text-primary">
                    {getInitials(user.fullName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-bold text-foreground">
                        {user.fullName}
                      </div>
                      {user.id === currentUserId && <Badge>Tu cuenta</Badge>}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Rol
                  </div>
                  <div className="mt-2 text-sm font-bold text-foreground">
                    {roleLabels[user.role]}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Estado
                  </div>
                  <div className="mt-2">
                    <Badge variant={user.isActive ? "success" : "danger"}>
                      {user.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    aria-label="Editar usuario"
                    onClick={() => onEdit(user)}
                    size="icon"
                    title="Editar usuario"
                    variant="ghost"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Cambiar contrasena"
                    onClick={() => onChangePassword(user)}
                    size="icon"
                    title="Cambiar contrasena"
                    variant="ghost"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Eliminar usuario"
                    disabled={user.id === currentUserId}
                    onClick={() => void onDelete(user)}
                    size="icon"
                    title="Eliminar usuario"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </motion.div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditPanel({
  isLoading,
  logs,
}: {
  isLoading: boolean;
  logs: AuditLog[];
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Actividad reciente</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro de cambios sensibles realizados en el sistema.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <SettingsSkeleton compact />}
        {!isLoading && logs.length === 0 && (
          <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border bg-muted/35 text-sm text-muted-foreground">
            No hay eventos de auditoria.
          </div>
        )}
        {!isLoading &&
          logs.map((log, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-3 rounded-lg border border-border bg-card px-4 py-3 md:grid-cols-[1fr_180px]"
              initial={{ opacity: 0, y: 6 }}
              key={log.id}
              transition={{ delay: index * 0.015, duration: 0.2 }}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <History className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground">
                    {actionLabels[log.action] ?? log.action} {formatEntity(log.entity)}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {log.actor?.fullName ?? "Sistema"} · {log.actor?.email ?? "Proceso interno"}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs font-semibold text-muted-foreground">
                {formatDateTime(log.createdAt)}
              </div>
            </motion.div>
          ))}
      </CardContent>
    </Card>
  );
}

function UserModal({
  initialUser,
  onClose,
  onSubmit,
  title,
}: {
  initialUser?: ApiUser;
  onClose: () => void;
  onSubmit: (form: UserForm) => Promise<void>;
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>({
    email: initialUser?.email ?? "",
    fullName: initialUser?.fullName ?? "",
    isActive: initialUser?.isActive ?? true,
    password: "",
    role: initialUser?.role ?? "RECEPTION",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Nombre y correo son obligatorios");
      return;
    }

    if (!initialUser && form.password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(form);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar el usuario",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function update<K extends keyof UserForm>(field: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <ModalShell onClose={onClose} subtitle="Cuenta local con permisos por rol" title={title}>
      <form className="space-y-5 p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre completo">
            <Input
              onChange={(event) => update("fullName", event.target.value)}
              value={form.fullName}
            />
          </Field>
          <Field label="Correo">
            <Input
              onChange={(event) => update("email", event.target.value)}
              type="email"
              value={form.email}
            />
          </Field>
          <Field label="Rol">
            <Select
              onChange={(value) => update("role", value as UserRole)}
              value={form.role}
            >
              {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </Select>
          </Field>
          {!initialUser && (
            <Field label="Contrasena inicial">
              <Input
                onChange={(event) => update("password", event.target.value)}
                type="password"
                value={form.password}
              />
            </Field>
          )}
          {initialUser && (
            <label className="flex h-11 items-center gap-3 self-end rounded-lg border border-border px-3">
              <input
                checked={form.isActive}
                className="h-4 w-4 accent-primary"
                onChange={(event) => update("isActive", event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm font-semibold text-foreground">
                Usuario activo
              </span>
            </label>
          )}
        </div>
        {error && <ErrorMessage message={error} />}
        <ModalActions
          isSubmitting={isSubmitting}
          onClose={onClose}
          submitLabel="Guardar usuario"
        />
      </form>
    </ModalShell>
  );
}

function PasswordModal({
  onClose,
  onSubmit,
  user,
}: {
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  user: ApiUser;
}) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(password);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cambiar la contrasena",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      onClose={onClose}
      subtitle={user.fullName}
      title="Cambiar contrasena"
    >
      <form className="space-y-5 p-6" onSubmit={handleSubmit}>
        <Field label="Nueva contrasena">
          <Input
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </Field>
        <Field label="Confirmar contrasena">
          <Input
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            value={confirmPassword}
          />
        </Field>
        {error && <ErrorMessage message={error} />}
        <ModalActions
          isSubmitting={isSubmitting}
          onClose={onClose}
          submitLabel="Actualizar contrasena"
        />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8 backdrop-blur-sm">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[720px] rounded-lg border border-border bg-card shadow-soft"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-lg font-extrabold text-foreground">{title}</div>
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          </div>
          <Button aria-label="Cerrar" onClick={onClose} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function ModalActions({
  isSubmitting,
  onClose,
  submitLabel,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-border pt-5">
      <Button onClick={onClose} type="button" variant="outline">
        Cancelar
      </Button>
      <Button disabled={isSubmitting} type="submit">
        <Check className="h-4 w-4" />
        {isSubmitting ? "Guardando..." : submitLabel}
      </Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-2xl font-extrabold text-foreground">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function InfoLine({
  icon: Icon,
  value,
}: {
  icon: typeof Phone;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-muted-foreground">{value}</span>
    </div>
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
  disabled,
  onChange,
  value,
}: {
  children: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
      {message}
    </div>
  );
}

function SettingsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
        <div
          className="h-16 animate-pulse rounded-lg border border-border bg-muted"
          key={index}
        />
      ))}
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEntity(entity: string): string {
  const labels: Record<string, string> = {
    Appointment: "una cita",
    ClinicSettings: "la configuracion de la clinica",
    ClinicalEntry: "el historial clinico",
    MediaAsset: "un archivo clinico",
    Patient: "un paciente",
    Payment: "un pago",
    ToothEvent: "el odontograma",
    Treatment: "un tratamiento",
    User: "un usuario",
    UserPassword: "una contrasena",
  };

  return labels[entity] ?? entity;
}
