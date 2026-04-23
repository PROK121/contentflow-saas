"use client";

import { motion } from "motion/react";
import { Home, Search } from "lucide-react";
import Link from "next/link";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 max-w-md"
      >
        <div className="relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="text-[120px] font-bold bg-gradient-to-br from-primary via-chart-2 to-chart-3 bg-clip-text text-transparent"
          >
            404
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="absolute inset-0 blur-3xl bg-gradient-to-br from-primary/20 via-chart-2/20 to-chart-3/20 -z-10"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Page Not Found</h1>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-lg font-bold"
            style={{ background: 'linear-gradient(135deg, #e88b8d 0%, #ffb88c 100%)' }}
          >
            <Home size={20} />
            <span>Back to Dashboard</span>
          </Link>
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-border/50 rounded-2xl hover:bg-secondary/30 hover:border-primary/25 transition-all font-semibold">
            <Search size={20} />
            <span>Search</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
