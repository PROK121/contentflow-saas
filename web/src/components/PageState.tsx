"use client";

import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { tr } from "@/lib/i18n";

export function LoadingState({
  label = tr("common", "loading"),
}: {
  label?: string;
}) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </p>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card p-10 text-center">
      {icon ? <div className="mx-auto mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md border border-destructive/30 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/5"
          >
            {tr("common", "retry")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
