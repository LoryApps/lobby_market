import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ id: null }, { status: 200 })
    return NextResponse.json({ id: user.id, email: user.email }, { status: 200 })
  } catch {
    return NextResponse.json({ id: null }, { status: 200 })
  }
}
