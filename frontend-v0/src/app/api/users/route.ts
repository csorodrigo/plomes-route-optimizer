import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";
import bcrypt from 'bcryptjs';

/**
 * Get all users
 */
export async function GET(request: NextRequest) {
  try {
    console.log('👥 Users API - GET all users');

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[USERS API] Error:', error);
      throw error;
    }

    console.log(`[USERS API] ✅ Found ${users?.length || 0} users`);

    return NextResponse.json({
      success: true,
      data: users
    });

  } catch (error: unknown) {
    console.error('💥 Users API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in users API',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Create new user
 */
export async function POST(request: NextRequest) {
  try {
    console.log('👥 Users API - CREATE new user');

    const body = await request.json();
    const { email, name, password, role = 'user' } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { success: false, message: 'Email, name and password are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email,
        name,
        password_hash,
        role
      })
      .select('id, email, name, role, created_at')
      .single();

    if (error) {
      console.error('[USERS API] Error creating user:', error);
      throw error;
    }

    console.log(`[USERS API] ✅ User created:`, newUser.email);

    return NextResponse.json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    });

  } catch (error: unknown) {
    console.error('💥 Users API create error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error creating user',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
