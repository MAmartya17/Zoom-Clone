import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-zoom-blue text-white hover:bg-zoom-blue-hover disabled:bg-zoom-blue/50",
  secondary: "bg-white text-ink border border-line hover:bg-surface disabled:text-ink-muted",
  danger: "bg-zoom-red text-white hover:bg-zoom-red-hover disabled:bg-zoom-red/50",
  ghost: "bg-transparent text-zoom-blue hover:bg-zoom-blue-soft disabled:text-ink-muted",
  success: "bg-zoom-green text-white hover:brightness-95 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zoom-blue disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});
