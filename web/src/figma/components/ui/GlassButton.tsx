import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";

interface GlassButtonProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  className?: string;
}

export function GlassButton({
  children,
  icon: Icon,
  variant = "primary",
  onClick,
  className = ""
}: GlassButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg border font-semibold transition-all duration-200 ${className}`}
      style={
        isPrimary
          ? {
              background: "#4a8b83",
              borderColor: "#4a8b83",
              color: "#ffffff",
            }
          : {
              background: "rgba(255, 255, 255, 0.95)",
              borderColor: "rgba(30, 51, 48, 0.12)",
              color: "#1e3330",
            }
      }
    >
      {Icon && <Icon size={18} />}
      <span>{children}</span>
    </motion.button>
  );
}
