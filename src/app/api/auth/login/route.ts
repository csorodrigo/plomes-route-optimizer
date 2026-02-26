import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";

interface LoginRequestBody {
  email: string;
  password: string;
}

function normalizeRole(role: string | null | undefined) {
  if (role === 'user' || role === 'usuario') return 'usuario_padrao';
  return role ?? 'usuario_padrao';
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
    console.log(`🔧 Environment check - SUPABASE_URL: ${env.SUPABASE_URL ? 'Set' : 'Missing'}`);
    console.log(`🔧 Environment check - SUPABASE_ANON_KEY: ${env.SUPABASE_ANON_KEY ? 'Set' : 'Missing'}`);

    // Query user from Supabase database
    const supabase = createClient(
      env.SUPABASE_URL || 'https://yxwokryybudwygtemfmu.supabase.co',
      env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg'
    );

    let user: any = null;
    let dbError: any = null;

    const primaryQuery = await supabase
      .from('users')
      .select('id, email, name, password_hash, role, ploomes_person_id')
      .eq('email', email.toLowerCase())
      .single();

    user = primaryQuery.data;
    dbError = primaryQuery.error;

    if (dbError?.code === '42703' || dbError?.code === 'PGRST204') {
      const fallbackQuery = await supabase
        .from('users')
        .select('id, email, name, password_hash, role')
        .eq('email', email.toLowerCase())
        .single();

      user = fallbackQuery.data ? { ...fallbackQuery.data, ploomes_person_id: null } : null;
      dbError = fallbackQuery.error;
    }

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
    console.log(`🔐 Password hash from DB: ${user.password_hash}`);
    console.log(`🔐 Password hash length: ${user.password_hash?.length}`);
    console.log(`🔐 Password received: ${password}`);
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

    // Generate JWT token with user details
    const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-for-development-only";
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: normalizeRole(user.role),
        ploomesPersonId: user.ploomes_person_id ?? null
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
        role: normalizeRole(user.role),
        ploomesPersonId: user.ploomes_person_id ?? null,
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
