import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    className={cn(
      "flex h-11 w-full cursor-text select-text rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground caret-primary shadow-sm outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
      className,
    )}
    ref={ref}
    type={type}
    {...props}
  />
));

Input.displayName = "Input";
