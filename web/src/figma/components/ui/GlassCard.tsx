import { motion } from "motion/react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className = "", hover = true }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-6 transition-all duration-200 ${hover ? 'hover:shadow-md' : ''} ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(15, 23, 42, 0.1)',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
      }}
    >
      {children}
    </motion.div>
  );
}
