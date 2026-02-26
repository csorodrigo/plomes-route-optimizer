import { ploomesClient } from "@/lib/ploomes-client";

type PloomesUserRow = {
  Id: number;
  Name?: string;
  Email?: string;
};

export type PloomesUserMatch = {
  id: number;
  name: string | null;
  email: string | null;
};

function normalizeEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

export async function findPloomesUserByEmail(email: string): Promise<PloomesUserMatch | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  try {
    const response = await ploomesClient.request<PloomesUserRow>('/Users?$select=Id,Name,Email');
    const match = (response.value || []).find((user) => normalizeEmail(user.Email) === normalizedEmail);

    if (!match || !Number.isInteger(match.Id)) {
      return null;
    }

    return {
      id: match.Id,
      name: match.Name || null,
      email: match.Email || null,
    };
  } catch (error) {
    console.warn('[PLOOMES LINK] Auto-link by email failed:', error);
    return null;
  }
}
