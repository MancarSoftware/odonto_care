import { useEffect, useState } from "react";

import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import type { AppSectionId } from "./features/navigation/sections";
import { PatientsPage } from "./features/patients/PatientsPage";
import { PlaceholderPage } from "./features/placeholder/PlaceholderPage";

export function App() {
  const [activeSection, setActiveSection] =
    useState<AppSectionId>("dashboard");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <AppShell
      activeSection={activeSection}
      darkMode={darkMode}
      onSectionChange={setActiveSection}
      onToggleTheme={() => setDarkMode((v) => !v)}
    >
      {activeSection === "dashboard" && <DashboardPage />}
      {activeSection === "patients" && <PatientsPage />}
      {activeSection !== "dashboard" && activeSection !== "patients" && (
        <PlaceholderPage sectionId={activeSection} />
      )}
    </AppShell>
  );
}
