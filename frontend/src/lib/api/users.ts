import type { AuthResponse, User } from "@/types/meeting";
import { apiRequest } from "./client";

export const usersApi = {
  me: () => apiRequest<User>("/users/me"),
};

export const authApi = {
  signup: (name: string, email: string, password: string) =>
    apiRequest<AuthResponse>("/auth/signup", { method: "POST", body: { name, email, password } }),
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
};
