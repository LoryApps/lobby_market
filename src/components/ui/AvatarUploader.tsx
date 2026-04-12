'use client'

/**
 * AvatarUploader
 *
 * A click-to-upload avatar widget that:
 *  1. Shows the current avatar (image URL or initials fallback)
 *  2. On click, opens a native file picker (JPEG / PNG / WebP / GIF, ≤ 2 MB)
 *  3. Previews the selection locally immediately
 *  4. Uploads to the `avatars` Supabase Storage bucket at `{userId}/{timestamp}.{ext}`
 *  5. PATCHes /api/profile with the resulting public URL
 *  6. Calls onUpload(url) so the parent can update its state
 *
 * The component is self-contained — it manages its own loading / error / success
 * states without requiring any prop changes from the parent.
 */

import { useRef, useState } from 'react'
import { Camera, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/gif'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface AvatarUploaderProps {
  /** Authenticated user's Supabase UID — used as the storage folder */
  userId: string
  /** Current avatar URL (may be null / empty when no avatar is set) */
  currentUrl: string | null | undefined
  /** Used for the initials fallback (prefers displayName, then username) */
  displayName?: string | null
  username?: string | null
  /** Called once the upload + profile PATCH both succeed, with the new public URL */
  onUpload: (url: string) => void
  className?: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AvatarUploader({
  userId,
  currentUrl,
  displayName,
  username,
  onUpload,
  className,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // The image we actually display: local preview → server URL → nothing
  const displayUrl = preview ?? currentUrl ?? null

  // Initials for the fallback circle
  const initials = (displayName?.trim() || username?.trim() || '?')
    .charAt(0)
    .toUpperCase()

  // ── File selection handler ────────────────────────────────────────────────

  async function handleFile(file: File) {
    // Validate type
    if (!ALLOWED_TYPES.has(file.type)) {
      setErrorMsg('Only JPEG, PNG, WebP, or GIF images are accepted.')
      setStatus('error')
      return
    }
    // Validate size
    if (file.size > MAX_BYTES) {
      setErrorMsg('Image must be smaller than 2 MB.')
      setStatus('error')
      return
    }

    setErrorMsg(null)
    setStatus('uploading')

    // Show a local preview immediately so the UI feels instant
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    try {
      const supabase = createClient()

      // Build a unique path: {userId}/{unix_ms}.{ext}
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      const path = `${userId}/${Date.now()}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Derive the public URL (no sign needed — bucket is public)
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      // Persist the new URL on the profile record
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl }),
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? 'Failed to save avatar URL')
      }

      setStatus('success')
      onUpload(publicUrl)

      // Revert success ring after 2.5 s
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setErrorMsg(msg)
      setStatus('error')
      // Revert the preview to whatever was there before
      setPreview(null)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file triggers onChange again if re-selected
    e.target.value = ''
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isUploading = status === 'uploading'
  const isSuccess = status === 'success'

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* ── Avatar circle ──────────────────────────────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !isUploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          disabled={isUploading}
          aria-label="Change avatar photo"
          className={cn(
            'relative group h-24 w-24 rounded-full overflow-hidden flex-shrink-0',
            'border-2 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-for-500/50 focus:ring-offset-2 focus:ring-offset-surface-100',
            isUploading
              ? 'cursor-wait border-surface-400'
              : isSuccess
              ? 'border-emerald cursor-pointer'
              : 'border-surface-300 hover:border-for-500 cursor-pointer',
          )}
        >
          {/* Background: image or initials */}
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={displayName ?? username ?? 'Avatar'}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-surface-200 text-white font-mono text-2xl font-bold select-none">
              {initials}
            </div>
          )}

          {/* Hover / loading overlay */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-1',
              'bg-black/55 transition-opacity duration-200',
              isUploading
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100',
            )}
            aria-hidden="true"
          >
            {isUploading ? (
              <Loader2 className="h-7 w-7 text-white animate-spin" />
            ) : (
              <>
                <Camera className="h-5 w-5 text-white" />
                <span className="text-[10px] font-mono font-semibold text-white/80 uppercase tracking-wider mt-0.5">
                  Change
                </span>
              </>
            )}
          </div>
        </button>

        {/* Success badge */}
        {isSuccess && (
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-surface-100 border border-surface-300 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* ── Status copy ───────────────────────────────────────────────────── */}
      <div className="text-center space-y-1">
        {!isUploading && status !== 'success' && (
          <p className="text-[11px] font-mono text-surface-500">
            Click or drag to upload · JPEG / PNG / WebP · max 2 MB
          </p>
        )}

        {isUploading && (
          <p className="text-[11px] font-mono text-surface-500 animate-pulse">
            Uploading…
          </p>
        )}

        {isSuccess && (
          <p className="text-[11px] font-mono text-emerald font-semibold">
            Avatar updated
          </p>
        )}

        {status === 'error' && errorMsg && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-against-400">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  )
}
