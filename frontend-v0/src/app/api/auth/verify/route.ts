import { NextRequest, NextResponse } from "next/server";
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

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-for-development-only";

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      return NextResponse.json({
        success: true,
        user: {
          id: decoded.userId,
          email: decoded.email,
          name: "Gustavo Canuto"
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