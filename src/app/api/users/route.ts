import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";
import bcrypt from 'bcryptjs';
import { findPloomesUserByEmail } from "@/lib/ploomes-user-link";
import { isAdmin } from "@/lib/auth-guard";

function normalizeRole(role: string | null | undefined) {
  if (role === 'user' || role === 'usuario') return 'usuario_padrao';
  return role ?? 'usuario_padrao';
}

/**
 * Get all users — admin only
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
  }

  try {
    console.log('👥 Users API - GET all users');

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    let users: any[] | null = null;
    let error: any = null;

    const primaryQuery = await supabase
      .from('users')
      .select('id, email, name, role, ploomes_person_id, created_at, updated_at')
      .order('created_at', { ascending: false });

    users = primaryQuery.data as any[] | null;
    error = primaryQuery.error;

    if (error?.code === '42703' || error?.code === 'PGRST204') {
      const fallbackQuery = await supabase
        .from('users')
        .select('id, email, name, role, created_at, updated_at')
        .order('created_at', { ascending: false });

      users = (fallbackQuery.data as any[] | null)?.map((u) => ({ ...u, ploomes_person_id: null })) ?? null;
      error = fallbackQuery.error;
    }

    if (error) {
      console.error('[USERS API] Error:', error);
      throw error;
    }

    console.log(`[USERS API] ✅ Found ${users?.length || 0} users`);

    return NextResponse.json({
      success: true,
      data: (users || []).map((user: any) => ({ ...user, role: normalizeRole(user.role) }))
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
    const { email, name, password, role = 'usuario_padrao', ploomes_person_id = null } = body;

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

    const providedPloomesPersonId =
      ploomes_person_id == null ? null : Number(ploomes_person_id);
    const autoLinkedPloomesUser =
      providedPloomesPersonId == null || !Number.isInteger(providedPloomesPersonId) || providedPloomesPersonId <= 0
        ? await findPloomesUserByEmail(email)
        : null;
    const resolvedPloomesPersonId =
      Number.isInteger(providedPloomesPersonId) && (providedPloomesPersonId as number) > 0
        ? (providedPloomesPersonId as number)
        : (autoLinkedPloomesUser?.id ?? null);

    if (role === 'usuario_vendedor' && !resolvedPloomesPersonId) {
      return NextResponse.json(
        { success: false, message: 'ploomes_person_id é obrigatório para usuario_vendedor (sem match automático por email)' },
        { status: 400 }
      );
    }

    // Create user
    let newUser: any = null;
    let error: any = null;

    const primaryInsert = await supabase
      .from('users')
      .insert({
        email,
        name,
        password_hash,
        role,
        ploomes_person_id: resolvedPloomesPersonId
      })
      .select('id, email, name, role, ploomes_person_id, created_at')
      .single();

    newUser = primaryInsert.data;
    error = primaryInsert.error;

    if (error?.code === '42703' || error?.code === 'PGRST204') {
      if (role === 'usuario_vendedor') {
        return NextResponse.json(
          { success: false, message: 'Migration pendente: coluna users.ploomes_person_id não existe' },
          { status: 503 }
        );
      }

      const fallbackInsert = await supabase
        .from('users')
        .insert({
          email,
          name,
          password_hash,
          role
        })
        .select('id, email, name, role, created_at')
        .single();

      newUser = fallbackInsert.data ? { ...fallbackInsert.data, ploomes_person_id: null } : null;
      error = fallbackInsert.error;
    }

    if (error?.code === '23514' && role === 'usuario_padrao') {
      const fallbackCompat = await supabase
        .from('users')
        .insert({
          email,
          name,
          password_hash,
          role: 'user'
        })
        .select('id, email, name, role, created_at')
        .single();

      newUser = fallbackCompat.data ? { ...fallbackCompat.data, ploomes_person_id: null } : null;
      error = fallbackCompat.error;
    }

    if (error) {
      console.error('[USERS API] Error creating user:', error);
      throw error;
    }

    console.log(`[USERS API] ✅ User created:`, newUser.email);
    if (autoLinkedPloomesUser) {
      console.log(`[USERS API] 🔗 Auto-linked Ploomes user for ${email}:`, autoLinkedPloomesUser);
    }

    return NextResponse.json({
      success: true,
      data: { ...newUser, role: normalizeRole(newUser.role) },
      message: 'User created successfully',
      autoLinkedPloomesUser
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
