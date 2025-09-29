import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

interface LoginRequestBody {
  email: string;
  password: string;
}

// Hardcoded user data for fallback authentication
const FALLBACK_USERS = [
  {
    id: 1,
    email: "gustavo.canuto@ciaramaquinas.com.br",
    name: "Gustavo Canuto",
    // bcrypt hash for "ciara123@"
    password_hash: "$2b$10$2shIPK5DUiVUeF4y0y8o6ezsKeY7FZTClbdCv16/59xmO1nMn6Bve"
  },
  {
    id: 2,
    email: "test@test.com",
    name: "Test User",
    // bcrypt hash for "123456"
    password_hash: "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
  }
];

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

    console.log(`🔐 Fallback login attempt for: ${email}`);

    // Find user in fallback data
    const user = FALLBACK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.log(`❌ Fallback user not found: ${email}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password"
        },
        { status: 401 }
      );
    }

    // Verify password with bcrypt
    const validPassword = await bcrypt.compare(password, user.password_hash);

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