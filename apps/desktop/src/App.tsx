import { useEffect, useState } from "react";

import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./features/dashboard/DashboardPage";

export function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <AppShell darkMode={darkMode} onToggleTheme={() => setDarkMode((v) => !v)}>
      <DashboardPage />
    </AppShell>
  );
}
