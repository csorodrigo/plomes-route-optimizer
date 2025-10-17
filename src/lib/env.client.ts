/**
 * Client-side environment variables validation
 * Only NEXT_PUBLIC_* variables are available on the client
 */

// Function to get the correct API URL based on environment
function getApiUrl(): string {
  // If explicitly set, use that
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In browser (client-side), use current origin
  if (typeof window !== "undefined") {
    // Always use the current origin (same port as the frontend)
    // This works for both localhost and production
    return window.location.origin;
  }

  // Default for local development (SSR) - use frontend port 3003
  return "http://localhost:3003";
}

export const clientEnv = {
  API_URL: getApiUrl(),
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yxwokryybudwygtemfmu.supabase.co",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg",
} as const;

// Validation function that runs at build time
function validateClientEnv() {
  const errors: string[] = [];

  // NEXT_PUBLIC_API_URL is optional, defaults to localhost
  if (clientEnv.API_URL && !clientEnv.API_URL.startsWith("http")) {
    errors.push("NEXT_PUBLIC_API_URL must be a valid URL starting with http/https");
  }

  // Supabase validation
  if (!clientEnv.SUPABASE_URL || !clientEnv.SUPABASE_URL.startsWith("https://")) {
    errors.push("SUPABASE_URL must be a valid HTTPS URL");
  }

  if (!clientEnv.SUPABASE_ANON_KEY) {
    errors.push("SUPABASE_ANON_KEY is required");
  }

  if (errors.length > 0) {
    throw new Error(`❌ Invalid client environment variables:\n${errors.join("\n")}`);
  }

  return clientEnv;
}

export const env = validateClientEnv();