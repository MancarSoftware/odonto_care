import { Clock3 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { sectionLabels, type AppSectionId } from "@/features/navigation/sections";

type PlaceholderPageProps = {
  sectionId: AppSectionId;
};

export function PlaceholderPage({ sectionId }: PlaceholderPageProps) {
  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-5">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">
          {sectionLabels[sectionId]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta seccion se construira en el siguiente bloque de trabajo.
        </p>
      </div>
      <Card>
        <CardContent className="flex min-h-[360px] items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary/10 text-primary">
              <Clock3 className="h-7 w-7" />
            </div>
            <div className="mt-5 text-lg font-bold text-foreground">
              Modulo preparado
            </div>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              La arquitectura ya reconoce esta seccion; iremos activando sus
              pantallas una por una.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
