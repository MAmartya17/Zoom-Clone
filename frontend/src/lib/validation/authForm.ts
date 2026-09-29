// Mirrors backend/app/schemas/auth.py.
export const PASSWORD_MIN = 8;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface AuthFormValues {
  name: string;
  email: string;
  password: string;
}

export type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>;

export function validateAuthForm(values: AuthFormValues, mode: "login" | "signup"): AuthFormErrors {
  const errors: AuthFormErrors = {};
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Please enter a valid email address.";

  if (mode === "login") {
    if (!values.password) errors.password = "Please enter your password.";
    return errors;
  }

  if (!values.name.trim()) errors.name = "Please enter your name.";
  else if (values.name.trim().length > 100) errors.name = "Name must be 100 characters or fewer.";
  if (values.password.length < PASSWORD_MIN) errors.password = `Password must be at least ${PASSWORD_MIN} characters.`;
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = "Password must contain at least one letter and one number.";
  }
  return errors;
}
