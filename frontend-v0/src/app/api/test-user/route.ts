import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "No Supabase connection" }, { status: 503 });
    }

    const email = "gustavo.canuto@ciaramaquinas.com.br";

    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('legacy_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return NextResponse.json({
        error: "User not found",
        email,
        dbError: error?.message
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHashLength: user.password_hash?.length || 0,
        passwordHashPrefix: user.password_hash?.substring(0, 10) + "...",
        isBcrypt: user.password_hash?.startsWith('$2') && user.password_hash?.length === 60
      }
    });

  } catch (error) {
    console.error('Test user endpoint error:', error);
    return NextResponse.json({
      error: 'Error testing user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}