"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export function HolderAuthLayout({
  title,
  subtitle,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  maxWidth?: "max-w-md" | "max-w-lg";
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className={`w-full ${maxWidth} rounded-xl border border-border/40 bg-card p-8 shadow-sm`}>
        <div className="mb-6 flex justify-center">
          <Link
            href="/holder"
            className="rounded-lg border border-black/10 bg-white px-3 py-2 shadow-sm"
          >
            <Image
              src="/brand/growix-logo.png"
              alt="GROWIX"
              width={220}
              height={62}
              className="h-9 w-auto object-contain"
              priority
            />
          </Link>
        </div>
        <h1 className="mb-1 text-center text-xl font-semibold">{title}</h1>
        {subtitle ? (
          <p className="mb-6 text-center text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
