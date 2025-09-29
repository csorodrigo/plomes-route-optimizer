import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env.server";
import { getSupabaseClient, hasSupabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: "Authorization token required"
        },
        { status: 401 }
      );
    }

    if (!hasSupabase()) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication service not available"
        },
        { status: 503 }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed"
        },
        { status: 503 }
      );
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

      // Get current user data from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, name, last_login')
        .eq('id', decoded.userId)
        .single();

      if (error || !user) {
        console.log(`❌ Token verification failed - user not found: ${decoded.email}`);
        return NextResponse.json(
          {
            success: false,
            error: "Invalid token"
          },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          lastLogin: user.last_login
        }
      });

    } catch (jwtError) {
      console.log('❌ JWT verification failed:', jwtError);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid token"
        },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during token verification'
      },
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