import type { User } from "@/types/meeting";
import { apiRequest } from "./client";

export const usersApi = {
  me: () => apiRequest<User>("/users/me"),
};
