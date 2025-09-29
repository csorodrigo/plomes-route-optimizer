/**
 * Server-side environment variables validation
 * These variables are only available on the server (API routes, etc.)
 */

export const serverEnv = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PLOOME_API_KEY: process.env.PLOOMES_API_KEY ?? "",
  PLOOME_BASE_URL: process.env.PLOOMES_BASE_URL ?? "https://public-api2.ploomes.com",
  CLIENT_TAG_ID: process.env.CLIENT_TAG_ID ?? "40006184",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  SUPABASE_URL: process.env.SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ?? "",
  MAPBOX_API_KEY: process.env.MAPBOX_API_KEY ?? "",
  POSITIONSTACK_API_KEY: process.env.POSITIONSTACK_API_KEY ?? "",
  OPENROUTE_API_KEY: process.env.OPENROUTE_API_KEY ?? "",
  GEOCODING_DELAY_MS: process.env.GEOCODING_DELAY_MS ?? "500",
  DATABASE_URL: process.env.DATABASE_URL ?? "sqlite:./tmp/app.db"
} as const;

// Validation function that runs at runtime on server
function validateServerEnv() {
  const errors: string[] = [];

  // Critical variables that MUST be present in production (runtime only, not build time)
  if (serverEnv.NODE_ENV === "production" && typeof window === "undefined" && process.env.SKIP_ENV_VALIDATION !== "true") {
    if (!serverEnv.PLOOME_API_KEY) {
      console.warn("PLOOMES_API_KEY is missing - some features may not work");
    }

    if (!serverEnv.JWT_SECRET || serverEnv.JWT_SECRET.length < 32) {
      console.warn("JWT_SECRET must be at least 32 characters long - authentication may not work");
    }

    if (!serverEnv.SUPABASE_URL) {
      console.warn("SUPABASE_URL is missing - database features may not work");
    }

    if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is missing - admin features may not work");
    }
  }

  // URL validation
  if (serverEnv.PLOOME_BASE_URL && !serverEnv.PLOOME_BASE_URL.startsWith("https://")) {
    errors.push("PLOOME_BASE_URL must be a valid HTTPS URL");
  }

  if (serverEnv.SUPABASE_URL && !serverEnv.SUPABASE_URL.startsWith("https://")) {
    errors.push("SUPABASE_URL must be a valid HTTPS URL");
  }

  // Numeric validation
  const geocodingDelay = parseInt(serverEnv.GEOCODING_DELAY_MS);
  if (isNaN(geocodingDelay) || geocodingDelay < 0) {
    errors.push("GEOCODING_DELAY_MS must be a valid positive number");
  }

  if (errors.length > 0) {
    throw new Error(`❌ Invalid server environment variables:\n${errors.join("\n")}`);
  }

  return serverEnv;
}

export const env = validateServerEnv();