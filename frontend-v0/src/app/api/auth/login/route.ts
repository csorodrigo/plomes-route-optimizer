import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env.server";
import { getSupabaseClient, hasSupabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email format"
        },
        { status: 400 }
      );
    }

    console.log(`🔐 Login attempt for: ${email}`);

    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('legacy_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      console.log(`❌ User not found: ${email}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password"
        },
        { status: 401 }
      );
    }

    // Verify password - handle both bcrypt and legacy hash formats
    let validPassword = false;

    // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$ and is ~60 chars)
    if (user.password_hash.startsWith('$2') && user.password_hash.length === 60) {
      console.log(`🔐 Using bcrypt verification for: ${email}`);
      validPassword = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy hash format - try multiple common formats
      console.log(`🔐 Using legacy verification for: ${email} (hash length: ${user.password_hash.length})`);

      // Try common legacy formats
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');
      const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');

      // Check against various possible formats
      validPassword =
        user.password_hash === password || // Plain text (not recommended but possible)
        user.password_hash === md5Hash ||
        user.password_hash === sha1Hash ||
        user.password_hash === sha256Hash ||
        user.password_hash.toLowerCase() === md5Hash ||
        user.password_hash.toLowerCase() === sha1Hash ||
        user.password_hash.toLowerCase() === sha256Hash;

      console.log(`🔍 Legacy hash check: ${validPassword ? 'VALID' : 'INVALID'}`);
    }

    if (!validPassword) {
      console.log(`❌ Invalid password for: ${email}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password"
        },
        { status: 401 }
      );
    }

    // Update last login
    await supabase
      .from('legacy_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ Login successful for: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastLogin: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Login endpoint error:', error);
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