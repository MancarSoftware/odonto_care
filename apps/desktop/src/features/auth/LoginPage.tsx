import { LockKeyhole, Mail, SmilePlus } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";

import type { LoginResponse } from "./types";

type LoginPageProps = {
  onLogin: (response: LoginResponse) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("admin@odontocare.local");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("Admin12345!");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiPost<LoginResponse>("/auth/login", {
        email,
        password,
      });
      onLogin(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo iniciar sesion",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/12 text-primary">
            <SmilePlus className="h-7 w-7" />
          </div>
          <div>
            <div className="text-2xl font-extrabold">OdontoCare</div>
            <div className="text-sm text-muted-foreground">
              Sistema Odontologico
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-foreground"
                  htmlFor="email"
                >
                  Correo
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoComplete="email"
                    className="pl-11"
                    id="email"
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    value={email}
                  />
                </div>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-foreground"
                  htmlFor="password"
                >
                  Contrasena
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoComplete="current-password"
                    className="pl-11"
                    id="password"
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    value={password}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                  {error}
                </div>
              )}

              <Button className="w-full" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
