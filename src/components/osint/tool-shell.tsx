"use client";

import { ReactNode } from "react";

interface ToolShellProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function ToolShell({ title, description, icon, children }: ToolShellProps) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          {icon ? (
            <span className="text-foreground/70">{icon}</span>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}
