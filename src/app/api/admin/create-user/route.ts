import { NextRequest, NextResponse } from "next/server";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";
import { findPloomesUserByEmail } from "@/lib/ploomes-user-link";

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'usuario_padrao' | 'usuario_vendedor';
  ploomes_person_id?: number | null;
}

type JwtPayload = {
  userId: number;
  email: string;
  name?: string;
  role?: string;
};

function normalizeRole(role: string | null | undefined) {
  if (role === 'user' || role === 'usuario') return 'usuario_padrao';
  return role ?? 'usuario_padrao';
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const token = authHeader.slice(7);
  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-for-development-only";

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return {
        ok: false as const,
        response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
      };
    }

    if (user.role !== 'admin') {
      return {
        ok: false as const,
        response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
      };
    }

    return { ok: true as const, user };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 }),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminAuth = await requireAdmin(request);
    if (!adminAuth.ok) {
      return adminAuth.response;
    }

    const body: CreateUserRequest = await request.json();
    const { email, password, name } = body;
    const role = body.role ?? 'usuario_padrao';
    const validRoles = new Set(['admin', 'usuario_padrao', 'usuario_vendedor']);

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: 'Email, password and name are required' },
        { status: 400 }
      );
    }

    if (!validRoles.has(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    const providedPloomesPersonId =
      body.ploomes_person_id == null ? null : Number(body.ploomes_person_id);
    const autoLinkedPloomesUser =
      providedPloomesPersonId == null || !Number.isInteger(providedPloomesPersonId) || providedPloomesPersonId <= 0
        ? await findPloomesUserByEmail(email)
        : null;
    const ploomesPersonId =
      Number.isInteger(providedPloomesPersonId) && (providedPloomesPersonId as number) > 0
        ? (providedPloomesPersonId as number)
        : (autoLinkedPloomesUser?.id ?? null);

    if (
      role === 'usuario_vendedor' &&
      (ploomesPersonId == null || !Number.isInteger(ploomesPersonId) || ploomesPersonId <= 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'ploomes_person_id is required for usuario_vendedor' },
        { status: 400 }
      );
    }

    console.log(`🔨 Creating user: ${email}`);
    if (autoLinkedPloomesUser) {
      console.log('🔗 Auto-linked user to Ploomes by email:', {
        email,
        ploomesPersonId: autoLinkedPloomesUser.id,
        ploomesName: autoLinkedPloomesUser.name
      });
    }

    // Hash da senha
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log(`🔐 Password hash generated (${passwordHash.length} chars)`);

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const timestamp = new Date().toISOString();
    let user: any = null;
    let error: any = null;

    const primaryWrite = await supabase
      .from('users')
      .upsert(
        {
          email: email.toLowerCase(),
          name,
          password_hash: passwordHash,
          role,
          ploomes_person_id: ploomesPersonId,
          created_at: timestamp,
          updated_at: timestamp,
        },
        { onConflict: 'email' }
      )
      .select('id, email, name, role, ploomes_person_id, created_at')
      .single();

    user = primaryWrite.data;
    error = primaryWrite.error;

    if (error?.code === '42703' || error?.code === 'PGRST204') {
      if (role === 'usuario_vendedor') {
        return NextResponse.json(
          { success: false, error: 'Migration pendente: coluna users.ploomes_person_id não existe' },
          { status: 503 }
        );
      }

      const fallbackWrite = await supabase
        .from('users')
        .upsert(
          {
            email: email.toLowerCase(),
            name,
            password_hash: passwordHash,
            role,
            created_at: timestamp,
            updated_at: timestamp,
          },
          { onConflict: 'email' }
        )
        .select('id, email, name, role, created_at')
        .single();

      user = fallbackWrite.data ? { ...fallbackWrite.data, ploomes_person_id: null } : null;
      error = fallbackWrite.error;
    }

    if (error?.code === '23514' && role === 'usuario_padrao') {
      const fallbackCompat = await supabase
        .from('users')
        .upsert(
          {
            email: email.toLowerCase(),
            name,
            password_hash: passwordHash,
            role: 'user',
            created_at: timestamp,
            updated_at: timestamp,
          },
          { onConflict: 'email' }
        )
        .select('id, email, name, role, created_at')
        .single();

      user = fallbackCompat.data ? { ...fallbackCompat.data, ploomes_person_id: null } : null;
      error = fallbackCompat.error;
    }

    if (error || !user) {
      console.error('❌ Error creating user:', error);
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to create user' },
        { status: 500 }
      );
    }
    console.log('✅ User created successfully:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      ploomes_person_id: user.ploomes_person_id
    });

    // Testar login imediatamente
    const validPassword = await bcrypt.compare(password, passwordHash);
    console.log(`🧪 Password validation test: ${validPassword}`);

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: normalizeRole(user.role),
        ploomes_person_id: user.ploomes_person_id,
        created_at: user.created_at
      },
      passwordValidation: validPassword,
      autoLinkedPloomesUser
    });

  } catch (error) {
    console.error('❌ Create user endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while creating user'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'User creation endpoint',
    usage: 'POST with Bearer token and { email, password, name, role, ploomes_person_id? }'
  });
}
