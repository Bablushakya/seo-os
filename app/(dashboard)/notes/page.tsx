'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  StickyNote,
  Plus,
  X,
  Pin,
  PinOff,
  Trash2,
  Edit2,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import type { TeamNote, NoteColor } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json().then(j => j.data))

// ============================================================
// Color System
// ============================================================
const NOTE_COLORS: Record<NoteColor, { bg: string; border: string; text: string; badge: string; label: string }> = {
  yellow:  { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30', text: 'text-yellow-100', badge: 'bg-yellow-400', label: 'Yellow' },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',   text: 'text-blue-100',   badge: 'bg-blue-400',   label: 'Blue'   },
  green:   { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',text: 'text-emerald-100',badge: 'bg-emerald-400',label: 'Green'  },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/30',   text: 'text-pink-100',   badge: 'bg-pink-400',   label: 'Pink'   },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30', text: 'text-purple-100', badge: 'bg-purple-400', label: 'Purple' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30', text: 'text-orange-100', badge: 'bg-orange-400', label: 'Orange' },
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(dateStr).toLocaleDateString()
}

// ============================================================
// Single Note Card
// ============================================================
function NoteCard({ note, currentUserId, currentUserRole, onDelete, onTogglePin, onEdit }: {
  note: TeamNote
  currentUserId: string
  currentUserRole: string
  onDelete: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
  onEdit: (note: TeamNote) => void
}) {
  const colors = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
  const canEdit = note.created_by === currentUserId || currentUserRole === 'admin'

  return (
    <div className={`relative flex flex-col rounded-xl border ${colors.bg} ${colors.border} p-4 transition-all hover:shadow-md group min-h-[160px]`}>
      {/* Pin badge */}
      {note.is_pinned && (
        <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
          <Pin className="h-2.5 w-2.5 text-white fill-white" />
        </div>
      )}

      {/* Content */}
      <p className="text-sm text-foreground leading-relaxed flex-1 whitespace-pre-wrap break-words">
        {note.content}
      </p>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center text-[9px] font-bold text-foreground/60">
            {getInitials(note.author?.full_name || 'U')}
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">{note.author?.full_name || 'Unknown'}</p>
            <p className="text-[9px] text-muted-foreground/60">{timeAgo(note.created_at)}</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onTogglePin(note.id, !note.is_pinned)}
              className="p-1 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
              title={note.is_pinned ? 'Unpin' : 'Pin to top'}
            >
              {note.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onEdit(note)}
              className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Edit note"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Add / Edit Note Modal
// ============================================================
function NoteForm({ editNote, onClose, onSuccess }: {
  editNote?: TeamNote | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [content, setContent] = useState(editNote?.content || '')
  const [color, setColor] = useState<NoteColor>(editNote?.color || 'yellow')
  const [isPinned, setIsPinned] = useState(editNote?.is_pinned || false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = !!editNote

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Note content is required')
      return
    }

    setIsSubmitting(true)
    try {
      const url = isEdit ? `/api/team-notes/${editNote!.id}` : '/api/team-notes'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), color, is_pinned: isPinned }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error?.message || 'Failed to save note')

      toast.success(isEdit ? 'Note updated!' : 'Note added to board!')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error saving note')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Note' : 'Add Sticky Note'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Content */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Note Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={5}
              maxLength={2000}
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
            <p className="text-right text-xs text-muted-foreground mt-1">{content.length}/2000</p>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Note Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.keys(NOTE_COLORS) as NoteColor[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${NOTE_COLORS[c].badge} ${color === c ? 'border-foreground scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  title={NOTE_COLORS[c].label}
                />
              ))}
            </div>
          </div>

          {/* Pin toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPinned(p => !p)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors ${
                isPinned
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                  : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-amber-500' : ''}`} />
              {isPinned ? 'Pinned to top' : 'Pin to top'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="border-border">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSubmitting ? (
              <><LoadingSpinner size="sm" className="mr-2 border-t-white" />Saving...</>
            ) : isEdit ? (
              <><Check className="h-4 w-4 mr-2" />Save Changes</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" />Add Note</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Notes Board Page
// ============================================================
export default function NotesPage() {
  const { user } = useAuth()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<TeamNote | null>(null)

  const { data: notes = [], mutate, isLoading } = useSWR<TeamNote[]>(
    '/api/team-notes',
    fetcher
  )

  const pinnedNotes = notes.filter(n => n.is_pinned)
  const unpinnedNotes = notes.filter(n => !n.is_pinned)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return
    try {
      const res = await fetch(`/api/team-notes/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error?.message || 'Failed to delete')
      toast.success('Note deleted')
      mutate()
    } catch (err: any) {
      toast.error(err.message || 'Error deleting note')
    }
  }

  const handleTogglePin = async (id: string, is_pinned: boolean) => {
    try {
      const res = await fetch(`/api/team-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error?.message)
      toast.success(is_pinned ? 'Note pinned to top' : 'Note unpinned')
      mutate()
    } catch (err: any) {
      toast.error(err.message || 'Error updating note')
    }
  }

  const handleEdit = (note: TeamNote) => {
    setEditingNote(note)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingNote(null)
  }

  const cardProps = {
    currentUserId: user?.id || '',
    currentUserRole: user?.role || '',
    onDelete: handleDelete,
    onTogglePin: handleTogglePin,
    onEdit: handleEdit,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
            <StickyNote className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Team Notes</h1>
            <p className="text-sm text-muted-foreground">
              Quick notes and reminders visible to the whole team.
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setEditingNote(null); setIsFormOpen(true) }}
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <LoadingSpinner size="lg" className="border-t-amber-500" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-xl">
          <StickyNote className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-semibold text-muted-foreground">No notes yet</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">Add a sticky note to share quick info with the team.</p>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />Add First Note
          </Button>
        </div>
      ) : (
        <>
          {/* Pinned section */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-500">Pinned</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pinnedNotes.map(note => (
                  <NoteCard key={note.id} note={note} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {/* All notes */}
          {unpinnedNotes.length > 0 && (
            <div className="space-y-3">
              {pinnedNotes.length > 0 && (
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">All Notes</h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {unpinnedNotes.map(note => (
                  <NoteCard key={note.id} note={note} {...cardProps} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <NoteForm
          editNote={editingNote}
          onClose={handleFormClose}
          onSuccess={mutate}
        />
      )}
    </div>
  )
}
