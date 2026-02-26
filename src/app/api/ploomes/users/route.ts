import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { env } from "@/lib/env.server";
import { ploomesClient } from "@/lib/ploomes-client";

type JwtPayload = {
  userId: number;
  email: string;
  name?: string;
};

type PloomesUserRow = {
  Id: number;
  Name?: string;
  Email?: string;
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
      .select('role')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return {
        ok: false as const,
        response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
      };
    }

    if (normalizeRole(user.role) !== 'admin') {
      return {
        ok: false as const,
        response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
      };
    }

    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 }),
    };
  }
}

function normalizeUsers(items: PloomesUserRow[]) {
  return items
    .filter((item) => Number.isFinite(item.Id))
    .map((item) => ({
      id: item.Id,
      name: item.Name || `Usuário ${item.Id}`,
      email: item.Email || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function GET(request: NextRequest) {
  try {
    const adminAuth = await requireAdmin(request);
    if (!adminAuth.ok) {
      return adminAuth.response;
    }

    try {
      const response = await ploomesClient.request<PloomesUserRow>('/Users?$select=Id,Name,Email');
      return NextResponse.json({
        success: true,
        data: normalizeUsers(response.value || []),
        source: 'ploomes_users',
      });
    } catch (usersError) {
      console.warn('[PLOOMES USERS] /Users unavailable, trying fallback via deals/persons', usersError);
    }

    const dealsResponse = await ploomesClient.request<{ OwnerId?: number }>('/Deals?$top=300&$select=OwnerId');
    const ownerIds = Array.from(
      new Set(
        (dealsResponse.value || [])
          .map((deal) => deal.OwnerId)
          .filter((id): id is number => Number.isInteger(id))
      )
    );

    if (ownerIds.length === 0) {
      return NextResponse.json({ success: true, data: [], source: 'deals_fallback' });
    }

    try {
      const personsResponse = await ploomesClient.request<PloomesUserRow>('/Persons?$top=300&$select=Id,Name,Email');
      const allowed = new Set(ownerIds);
      const users = normalizeUsers((personsResponse.value || []).filter((person) => allowed.has(person.Id)));
      return NextResponse.json({ success: true, data: users, source: 'persons_fallback' });
    } catch (personsError) {
      console.warn('[PLOOMES USERS] /Persons fallback failed, returning ids only', personsError);
      return NextResponse.json({
        success: true,
        data: ownerIds.sort((a, b) => a - b).map((id) => ({ id, name: `Usuário ${id}`, email: null })),
        source: 'owner_ids_fallback',
      });
    }
  } catch (error) {
    console.error('[PLOOMES USERS] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Ploomes users',
      },
      { status: 500 }
    );
  }
}
