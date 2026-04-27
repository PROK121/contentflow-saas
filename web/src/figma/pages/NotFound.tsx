"use client";

import { motion } from "motion/react";
import { Home, Search } from "lucide-react";
import Link from "next/link";
import { tr } from "@/lib/i18n";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 max-w-md"
      >
        <motion.div
          initial={{ scale: 0.96 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring" }}
          className="text-7xl font-bold text-primary"
        >
          404
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{tr("notFound", "title")}</h1>
          <p className="text-muted-foreground">
            {tr("notFound", "description")}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Home size={20} />
            <span>{tr("common", "home")}</span>
          </Link>
          <Link
            href="/content"
            className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-5 py-2.5 font-medium transition hover:bg-muted"
          >
            <Search size={20} />
            <span>{tr("notFound", "goContent")}</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
