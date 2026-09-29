import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-ink-muted/70 transition-colors " +
  "focus:border-zoom-blue focus:outline-none focus:ring-2 focus:ring-zoom-blue/20 disabled:bg-surface";

function controlClass(error?: string | null, className?: string) {
  return cn(controlBase, error ? "border-zoom-red" : "border-line", className);
}

interface FieldProps {
  label?: string;
  error?: string | null;
  hint?: ReactNode;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}

/** Label + control + error message wiring (ids / aria) shared by all inputs. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-ink">
          {label}
        </label>
      )}
      {children(id, error || hint ? messageId : undefined)}
      {error ? (
        <p id={messageId} role="alert" className="text-xs text-zoom-red">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null; hint?: ReactNode };

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={controlClass(error, cn("h-10", className))}
          {...rest}
        />
      )}
    </Field>
  );
});

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string | null };

export function TextArea({ label, error, className, ...rest }: TextAreaProps) {
  return (
    <Field label={label} error={error}>
      {(id, describedBy) => (
        <textarea
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={controlClass(error, cn("min-h-20 resize-y py-2", className))}
          {...rest}
        />
      )}
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string | null };

export function Select({ label, error, className, children, ...rest }: SelectProps) {
  return (
    <Field label={label} error={error}>
      {(id, describedBy) => (
        <select
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={controlClass(error, cn("h-10 pr-8", className))}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded accent-zoom-blue"
      />
      {label}
    </label>
  );
}

interface RadioGroupProps<T extends string> {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function RadioGroup<T extends string>({ name, value, options, onChange }: RadioGroupProps<T>) {
  return (
    <div className="flex gap-5">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="size-4 accent-zoom-blue"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
