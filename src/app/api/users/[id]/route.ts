import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";
import bcrypt from 'bcryptjs';
import { isAdmin } from "@/lib/auth-guard";

function normalizeRole(role: string | null | undefined) {
  if (role === 'user' || role === 'usuario') return 'usuario_padrao';
  return role ?? 'usuario_padrao';
}

/**
 * Update user — admin only
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
  }

  try {
    const params = await context.params;
    const userId = params.id;
    console.log(`👥 Users API - UPDATE user ${userId}`);

    const body = await request.json();
    const { email, name, password, role, ploomes_person_id } = body;

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    // Build update object
    const updates: any = {};
    if (email) updates.email = email;
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (Object.prototype.hasOwnProperty.call(body, 'ploomes_person_id')) {
      updates.ploomes_person_id = ploomes_person_id ? Number(ploomes_person_id) : null;
    }
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }
    updates.updated_at = new Date().toISOString();

    // Update user
    let updatedUser: any = null;
    let error: any = null;

    const primaryUpdate = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, role, ploomes_person_id, updated_at')
      .single();

    updatedUser = primaryUpdate.data;
    error = primaryUpdate.error;

    if (error?.code === '42703' || error?.code === 'PGRST204') {
      const { ploomes_person_id: _ignored, ...fallbackUpdates } = updates;

      if (role === 'usuario_vendedor') {
        return NextResponse.json(
          { success: false, message: 'Migration pendente: coluna users.ploomes_person_id não existe' },
          { status: 503 }
        );
      }

      const fallbackUpdate = await supabase
        .from('users')
        .update(fallbackUpdates)
        .eq('id', userId)
        .select('id, email, name, role, updated_at')
        .single();

      updatedUser = fallbackUpdate.data ? { ...fallbackUpdate.data, ploomes_person_id: null } : null;
      error = fallbackUpdate.error;
    }

    if (error?.code === '23514' && role === 'usuario_padrao') {
      const { ploomes_person_id: _ignored, ...fallbackUpdates } = updates;
      (fallbackUpdates as any).role = 'user';

      const fallbackCompat = await supabase
        .from('users')
        .update(fallbackUpdates)
        .eq('id', userId)
        .select('id, email, name, role, updated_at')
        .single();

      updatedUser = fallbackCompat.data ? { ...fallbackCompat.data, ploomes_person_id: null } : null;
      error = fallbackCompat.error;
    }

    if (error) {
      console.error('[USERS API] Error updating user:', error);
      throw error;
    }

    console.log(`[USERS API] ✅ User updated:`, updatedUser.email);

    return NextResponse.json({
      success: true,
      data: { ...updatedUser, role: normalizeRole(updatedUser.role) },
      message: 'User updated successfully'
    });

  } catch (error: unknown) {
    console.error('💥 Users API update error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error updating user',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Delete user — admin only
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });
  }

  try {
    const params = await context.params;
    const userId = params.id;
    console.log(`👥 Users API - DELETE user ${userId}`);

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    // Don't allow deleting the main admin user (id: 1)
    if (userId === '1') {
      return NextResponse.json(
        { success: false, message: 'Cannot delete main admin user' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('[USERS API] Error deleting user:', error);
      throw error;
    }

    console.log(`[USERS API] ✅ User deleted: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error: unknown) {
    console.error('💥 Users API delete error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error deleting user',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
