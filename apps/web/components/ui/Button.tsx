import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none tracking-tight rounded-sm";

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5 font-mono",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    const variantStyles = {
      primary:
        "bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 font-semibold border border-white",
      secondary:
        "bg-[#18181b] text-neutral-100 border border-[#27272a] hover:bg-[#27272a] hover:border-neutral-700 active:bg-[#3f3f46]",
      outline:
        "bg-transparent text-neutral-200 border border-[#27272a] hover:border-neutral-400 hover:text-white active:bg-neutral-900",
      ghost:
        "bg-transparent text-neutral-400 hover:text-neutral-100 hover:bg-[#18181b] active:bg-[#27272a]",
      danger:
        "bg-neutral-900 text-red-400 border border-red-900/40 hover:border-red-600 hover:bg-red-950/30 active:bg-red-950/60",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        transition={{ duration: 0.1 }}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2 font-mono text-xs">
            <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            <span>PROCESSING...</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
