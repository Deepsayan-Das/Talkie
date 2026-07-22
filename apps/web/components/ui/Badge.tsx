import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "mono" | "active" | "subtle" | "danger" | "inverted";
  size?: "sm" | "md";
  dot?: boolean;
  dotColor?: "emerald" | "amber" | "red" | "neutral";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "mono",
  size = "sm",
  dot = false,
  dotColor,
  className = "",
  ...props
}) => {
  const sizeStyles = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
  };

  const variantStyles = {
    mono: "bg-[#18181b] text-neutral-300 border border-[#27272a] font-mono",
    active: "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 font-mono",
    subtle: "bg-neutral-900/60 text-neutral-400 border border-neutral-800 font-mono",
    danger: "bg-red-950/40 text-red-400 border border-red-900/40 font-mono",
    inverted: "bg-white text-black font-mono font-semibold",
  };

  const getDotClass = () => {
    if (dotColor === "emerald") return "bg-emerald-400";
    if (dotColor === "amber") return "bg-amber-400";
    if (dotColor === "red") return "bg-red-400";
    if (dotColor === "neutral") return "bg-neutral-400";
    if (variant === "active") return "bg-emerald-400 animate-pulse";
    if (variant === "danger") return "bg-red-400";
    return "bg-neutral-400";
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xs tracking-wider uppercase select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${getDotClass()}`} />}
      <span>{children}</span>
    </span>
  );
};
