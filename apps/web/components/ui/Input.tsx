import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftElement,
      rightElement,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-neutral-300 tracking-tight">
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftElement && (
            <div className="absolute left-3 text-neutral-500 pointer-events-none flex items-center">
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`w-full h-10 bg-[#121212] text-neutral-100 placeholder:text-neutral-600 text-sm border rounded-sm transition-all focus:outline-none focus:bg-[#161616] ${
              leftElement ? "pl-9" : "pl-3"
            } ${rightElement ? "pr-9" : "pr-3"} ${
              error
                ? "border-red-800/80 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                : "border-[#27272a] focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400/20"
            } ${className}`}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-3 text-neutral-500 flex items-center">
              {rightElement}
            </div>
          )}
        </div>

        {error ? (
          <span className="text-xs text-red-400 font-medium">
            {error}
          </span>
        ) : hint ? (
          <span className="text-xs text-neutral-500">{hint}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
