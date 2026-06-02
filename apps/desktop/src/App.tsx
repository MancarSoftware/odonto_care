import { useEffect, useState } from "react";

import { AppShell } from "./components/layout/AppShell";
import { AppointmentsPage } from "./features/appointments/AppointmentsPage";
import { LoginPage } from "./features/auth/LoginPage";
import type { AuthenticatedUser, LoginResponse } from "./features/auth/types";
import { BillingPage } from "./features/billing/BillingPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { MediaPage } from "./features/media/MediaPage";
import type { AppSectionId } from "./features/navigation/sections";
import { OdontogramPage } from "./features/odontogram/OdontogramPage";
import { PatientsPage } from "./features/patients/PatientsPage";
import { PlaceholderPage } from "./features/placeholder/PlaceholderPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { TreatmentsPage } from "./features/treatments/TreatmentsPage";

const TOKEN_STORAGE_KEY = "odontocare.accessToken";
const USER_STORAGE_KEY = "odontocare.user";

export function App() {
  const [activeSection, setActiveSection] =
    useState<AppSectionId>("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [patientContextId, setPatientContextId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthenticatedUser) : null;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  function handleLogin(response: LoginResponse) {
    localStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
    setToken(response.accessToken);
    setUser(response.user);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setActiveSection("dashboard");
    setPatientContextId(null);
  }

  function handleSectionChange(section: AppSectionId, patientId?: string) {
    if (patientId) {
      setPatientContextId(patientId);
    }

    setActiveSection(section);
  }

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AppShell
      activeSection={activeSection}
      darkMode={darkMode}
      onLogout={handleLogout}
      onSectionChange={(section) => handleSectionChange(section)}
      onToggleTheme={() => setDarkMode((v) => !v)}
      user={user}
    >
      {activeSection === "dashboard" && <DashboardPage />}
      {activeSection === "patients" && (
        <PatientsPage
          onNavigate={handleSectionChange}
          onUnauthorized={handleLogout}
          token={token}
        />
      )}
      {activeSection === "appointments" && (
        <AppointmentsPage
          onUnauthorized={handleLogout}
          patientContextId={patientContextId}
          token={token}
        />
      )}
      {activeSection === "odontogram" && (
        <OdontogramPage
          onUnauthorized={handleLogout}
          patientContextId={patientContextId}
          token={token}
        />
      )}
      {activeSection === "treatments" && (
        <TreatmentsPage
          onUnauthorized={handleLogout}
          patientContextId={patientContextId}
          token={token}
        />
      )}
      {activeSection === "billing" && (
        <BillingPage
          onUnauthorized={handleLogout}
          patientContextId={patientContextId}
          token={token}
        />
      )}
      {activeSection === "media" && (
        <MediaPage
          onUnauthorized={handleLogout}
          patientContextId={patientContextId}
          token={token}
        />
      )}
      {activeSection === "reports" && (
        <ReportsPage onUnauthorized={handleLogout} token={token} />
      )}
      {activeSection !== "dashboard" &&
        activeSection !== "patients" &&
        activeSection !== "appointments" &&
        activeSection !== "odontogram" &&
        activeSection !== "treatments" &&
        activeSection !== "billing" &&
        activeSection !== "media" &&
        activeSection !== "reports" && (
        <PlaceholderPage sectionId={activeSection} />
      )}
    </AppShell>
  );
}
