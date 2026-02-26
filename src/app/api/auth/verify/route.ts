import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";

function normalizeRole(role: string | undefined | null) {
  if (role === 'user' || role === 'usuario') return 'usuario_padrao';
  return role ?? 'usuario_padrao';
}

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
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        email: string;
        name?: string;
        role?: string;
        ploomesPersonId?: number | null;
      };

      // Fetch user details from database
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
      let user: any = null;
      let error: any = null;

      const primaryQuery = await supabase
        .from('users')
        .select('id, email, name, role, ploomes_person_id')
        .eq('id', decoded.userId)
        .single();

      user = primaryQuery.data;
      error = primaryQuery.error;

      if (error?.code === '42703' || error?.code === 'PGRST204') {
        const fallbackQuery = await supabase
          .from('users')
          .select('id, email, name, role')
          .eq('id', decoded.userId)
          .single();

        user = fallbackQuery.data ? { ...fallbackQuery.data, ploomes_person_id: null } : null;
        error = fallbackQuery.error;
      }

      if (error || !user) {
        console.error('Error fetching user details:', error);
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
          name: user.name,
          role: normalizeRole(user.role || decoded.role),
          ploomesPersonId: user.ploomes_person_id ?? decoded.ploomesPersonId ?? null
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
