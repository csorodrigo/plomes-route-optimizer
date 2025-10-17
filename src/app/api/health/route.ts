import { NextResponse } from "next/server";
import { env } from "@/lib/env.server";

export async function GET() {
  try {
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: "1.0.0",
      services: {
        supabase: !!env.SUPABASE_URL,
        ploome: !!env.PLOOME_API_KEY,
        geocoding: {
          google: !!env.GOOGLE_MAPS_API_KEY,
          positionstack: !!env.POSITIONSTACK_API_KEY,
          mapbox: !!env.MAPBOX_API_KEY,
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}