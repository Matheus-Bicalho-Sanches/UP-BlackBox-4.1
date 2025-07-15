import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { locked } = await req.json();
  if (typeof locked !== 'boolean') {
    return NextResponse.json({ error: 'locked deve ser boolean' }, { status: 400 });
  }
  try {
    const ref = doc(db, 'backtests', id);
    await updateDoc(ref, { locked });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar lock', details: String(e) }, { status: 500 });
  }
} 