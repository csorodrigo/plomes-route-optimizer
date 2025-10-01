import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";

interface LoginRequestBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequestBody = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Email and password are required"
        },
        { status: 400 }
      );
    }

    console.log(`🔐 Login attempt for: ${email}`);

    // Query user from Supabase database
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('id, email, name, password_hash, role')
      .eq('email', email.toLowerCase())
      .single();

    if (dbError || !user) {
      console.log(`❌ User not found: ${email}`, dbError);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password"
        },
        { status: 401 }
      );
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`🔐 Verifying password...`);

    // Verify password using bcrypt
    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log(`🔐 Password validation result: ${validPassword}`);

    if (!validPassword) {
      console.log(`❌ Password validation failed for: ${email}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password"
        },
        { status: 401 }
      );
    }

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-for-development-only";
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ Fallback login successful for: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Login successful (fallback mode)',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastLogin: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Fallback login endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during login'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}