import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    display_name?: string | null
    bio?: string | null
    avatar_url?: string | null
    social_links?: { twitter?: string; github?: string; website?: string } | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: {
    display_name?: string | null
    bio?: string | null
    avatar_url?: string | null
    social_links?: { twitter?: string; github?: string; website?: string } | null
  } = {}

  if ('display_name' in body) {
    if (
      body.display_name !== null &&
      (typeof body.display_name !== 'string' || body.display_name.length > 64)
    ) {
      return NextResponse.json(
        { error: 'display_name must be a string up to 64 characters' },
        { status: 400 }
      )
    }
    update.display_name = body.display_name
  }

  if ('bio' in body) {
    if (
      body.bio !== null &&
      (typeof body.bio !== 'string' || body.bio.length > 280)
    ) {
      return NextResponse.json(
        { error: 'bio must be a string up to 280 characters' },
        { status: 400 }
      )
    }
    update.bio = body.bio
  }

  if ('avatar_url' in body) {
    if (body.avatar_url !== null && typeof body.avatar_url !== 'string') {
      return NextResponse.json(
        { error: 'avatar_url must be a string or null' },
        { status: 400 }
      )
    }
    update.avatar_url = body.avatar_url
  }

  if ('social_links' in body) {
    if (body.social_links !== null && typeof body.social_links !== 'object') {
      return NextResponse.json(
        { error: 'social_links must be an object or null' },
        { status: 400 }
      )
    }
    // Sanitize: only keep known keys and ensure string values
    if (body.social_links !== null) {
      const { twitter, github, website } = body.social_links
      update.social_links = {
        ...(twitter && typeof twitter === 'string' ? { twitter: twitter.trim() } : {}),
        ...(github && typeof github === 'string' ? { github: github.trim() } : {}),
        ...(website && typeof website === 'string' ? { website: website.trim() } : {}),
      }
    } else {
      update.social_links = null
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({ profile })
}
