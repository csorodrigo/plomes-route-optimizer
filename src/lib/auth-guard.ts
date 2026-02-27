import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

type JwtPayload = {
  userId: number;
  email: string;
  role?: string;
};

function normalizeRole(role: string | null | undefined) {
  if (role === "user" || role === "usuario") return "usuario_padrao";
  return role ?? null;
}

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Returns the decoded payload or null if missing/invalid.
 */
export function getAuthUser(request: NextRequest): JwtPayload | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const JWT_SECRET =
    process.env.JWT_SECRET || "fallback-secret-key-for-development-only";

  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true only if the request carries a valid admin JWT.
 */
export function isAdmin(request: NextRequest): boolean {
  const user = getAuthUser(request);
  return normalizeRole(user?.role) === "admin";
}
