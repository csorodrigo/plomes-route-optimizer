import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: "No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-for-development-only";

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; name?: string };

      // Fetch user details from database
      const result = await supabaseServer.sql<{id: number; email: string; name: string; role: string}>(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      const user = result.data?.[0];
      if (result.error || !user) {
        console.error('Error fetching user details:', result.error);
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { success: false, error: "Token verification failed" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}