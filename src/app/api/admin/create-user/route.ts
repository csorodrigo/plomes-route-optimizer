import { NextRequest, NextResponse } from "next/server";
import bcrypt from 'bcryptjs';
import { supabaseServer } from "@/lib/supabase-server";

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  adminKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateUserRequest = await request.json();
    const { email, password, name, adminKey } = body;

    // Validação básica de segurança - apenas para desenvolvimento
    if (adminKey !== 'create-user-admin-2025') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: 'Email, password and name are required' },
        { status: 400 }
      );
    }

    console.log(`🔨 Creating user: ${email}`);

    // Hash da senha
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log(`🔐 Password hash generated (${passwordHash.length} chars)`);

    // SQL para inserir ou atualizar usuário
    const sql = `
      INSERT INTO users (email, name, password_hash, role, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, email, name, role, created_at;
    `;

    const values = [
      email.toLowerCase(),
      name,
      passwordHash,
      'admin',
      new Date().toISOString()
    ];

    const result = await supabaseServer.sql(sql, values);

    if (result.error) {
      console.error('❌ Error creating user:', result.error);
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 500 }
      );
    }

    const user = (result.data as any[])[0];
    console.log('✅ User created successfully:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
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
        role: user.role,
        created_at: user.created_at
      },
      passwordValidation: validPassword
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
    usage: 'POST with { email, password, name, adminKey }'
  });
}