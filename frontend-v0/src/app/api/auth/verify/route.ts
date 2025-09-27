import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Usuários hardcoded para simplificar
const USERS = [
  {
    id: 1,
    email: 'gustavo.canuto@ciaramaquinas.com.br',
    name: 'Gustavo Canuto'
  }
];

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

      // Buscar usuário
      const user = USERS.find(u => u.id === decoded.userId);

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Usuário não encontrado' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Token válido',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          lastLogin: new Date().toISOString()
        }
      });

    } catch (jwtError) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Verify API error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
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