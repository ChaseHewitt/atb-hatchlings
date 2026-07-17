import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

export const AuthUserContext = createContext<User | null>(null);

export function useAuthenticatedUser(): User {
  const user = useContext(AuthUserContext);
  if (!user) throw new Error("useAuthenticatedUser must be used inside AuthGate.");
  return user;
}
