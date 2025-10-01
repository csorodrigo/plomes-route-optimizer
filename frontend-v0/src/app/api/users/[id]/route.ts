import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";
import bcrypt from 'bcryptjs';

/**
 * Update user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    console.log(`👥 Users API - UPDATE user ${userId}`);

    const body = await request.json();
    const { email, name, password, role } = body;

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    // Build update object
    const updates: any = {};
    if (email) updates.email = email;
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }
    updates.updated_at = new Date().toISOString();

    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, role, updated_at')
      .single();

    if (error) {
      console.error('[USERS API] Error updating user:', error);
      throw error;
    }

    console.log(`[USERS API] ✅ User updated:`, updatedUser.email);

    return NextResponse.json({
      success: true,
      data: updatedUser,
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
 * Delete user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
