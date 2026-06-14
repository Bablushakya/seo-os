'use client'

import React, { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { LoadingSpinner, TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProspectForm } from '@/components/outreach/ProspectForm'
import { AIEmailGenerator } from '@/components/outreach/AIEmailGenerator'
import {
  Mail,
  Phone,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  Calendar,
  User as UserIcon,
  Trash2,
  Edit,
  Send,
  Plus,
  Clock,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { OUTREACH_STAGE_LABELS, OUTREACH_STAGE_COLORS } from '@/lib/constants'
import type { OutreachProspect, OutreachPipelineStage, OutreachNote, User } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

const NOTE_TYPE_ICONS = {
  email: Mail,
  call: Phone,
  general: MessageSquare,
  ai_generated: Sparkles,
}

const NOTE_TYPE_COLORS = {
  email: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  call: 'bg-green-500/10 text-green-400 border-green-500/20',
  general: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  ai_generated: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

export default function ProspectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()

  // SWR hooks
  const { data: prospect, error: prospectError, mutate: mutateProspect } = useSWR<OutreachProspect>(
    `/api/outreach/${id}`,
    fetcher
  )

  const { data: notes, error: notesError, mutate: mutateNotes } = useSWR<OutreachNote[]>(
    `/api/outreach/${id}/notes`,
    fetcher
  )

  const { data: users } = useSWR<User[]>('/api/users', fetcher)

  // Local forms state
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState<'email' | 'call' | 'general'>('general')

  // Placed Prospect modal state
  const [isPlacedModalOpen, setIsPlacedModalOpen] = useState(false)

  const isOverdue = () => {
    if (!prospect || !prospect.next_followup_date) return false
    const todayStr = new Date().toISOString().split('T')[0] || ''
    return (
      prospect.next_followup_date < todayStr &&
      prospect.pipeline_stage !== 'placed' &&
      prospect.pipeline_stage !== 'rejected'
    )
  }

  const handleStageChange = async (newStage: OutreachPipelineStage) => {
    if (!prospect) return
    const previous = prospect

    // Optimistic update
    mutateProspect({ ...prospect, pipeline_stage: newStage }, false)

    try {
      const res = await fetch(`/api/outreach/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: newStage }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update stage')
      }

      toast.success(`Stage updated to ${OUTREACH_STAGE_LABELS[newStage]}`)
      mutateProspect()
      mutateNotes() // Auto note is inserted on stage change
      mutate('/api/outreach/stats')
      mutate('/api/dashboard/stats')

      if (newStage === 'placed') {
        setIsPlacedModalOpen(true)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating stage')
      mutateProspect(previous, false)
    }
  }

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!prospect) return
    const targetValue = newAssigneeId === 'unassigned' ? null : newAssigneeId
    const previous = prospect

    // Find assignee user in memory for UI representation
    const newAssigneeUser = users?.find((u) => u.id === targetValue)

    // Optimistic update
    mutateProspect(
      {
        ...prospect,
        assigned_to: targetValue,
        assignee: newAssigneeUser ? { id: newAssigneeUser.id, full_name: newAssigneeUser.full_name, avatar_url: newAssigneeUser.avatar_url } : undefined,
      },
      false
    )

    try {
      const res = await fetch(`/api/outreach/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: targetValue }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update assignee')
      }

      toast.success('Assignee updated successfully')
      mutateProspect()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating assignee')
      mutateProspect(previous, false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim() || isSubmittingNote) return

    setIsSubmittingNote(true)
    try {
      const res = await fetch(`/api/outreach/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: noteContent,
          note_type: noteType,
        }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to add note')
      }

      toast.success('Interaction note added')
      setNoteContent('')
      setNoteType('general')
      mutateNotes()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error adding note')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  const handleDeleteProspect = async () => {
    if (!prospect) return
    if (!window.confirm('Are you sure you want to delete this prospect? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/outreach/${id}`, { method: 'DELETE' })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to delete prospect')
      }

      toast.success('Prospect deleted successfully')
      router.push('/outreach')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting prospect')
    }
  }

  const handleCreateGuestPostRedirect = () => {
    setIsPlacedModalOpen(false)
    if (prospect) {
      router.push(`/guest-posts?new=true&prospect_id=${prospect.id}&site_name=${encodeURIComponent(prospect.site_name)}&da=${prospect.domain_authority}&url=${encodeURIComponent(prospect.url)}`)
    }
  }

  if (prospectError) {
    return (
      <EmptyState
        title="Prospect not found"
        description="The outreach prospect you are trying to view does not exist or has been deleted."
        actionLabel="Back to Outreach"
        onAction={() => router.push('/outreach')}
      />
    )
  }

  if (!prospect) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" className="border-t-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading prospect details...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back to Outreach */}
      <div>
        <Link
          href="/outreach"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Outreach
        </Link>
      </div>

      {/* Detail Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{prospect.site_name}</h1>
            <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded">
              DA {prospect.domain_authority}
            </span>
            {prospect.niche && (
              <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                {prospect.niche}
              </span>
            )}
          </div>
          <a
            href={prospect.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {prospect.url}
          </a>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditFormOpen(true)}
            className="border-border hover:bg-accent hover:text-accent-foreground text-sm font-medium"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Prospect
          </Button>
          {user?.role === 'admin' && (
            <Button
              variant="outline"
              onClick={handleDeleteProspect}
              className="border-border text-red-500 hover:bg-red-500/10 hover:text-red-500 text-sm font-medium"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Prospect
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Meta Panel */}
        <div className="space-y-6 lg:col-span-1">
          {/* Status & Assignment */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Status & Assignee</h3>

            <div className="space-y-1.5">
              <Label htmlFor="pipeline_stage_detail">Pipeline Stage</Label>
              <Select value={prospect.pipeline_stage} onValueChange={handleStageChange}>
                <SelectTrigger id="pipeline_stage_detail" className="bg-background border-input">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  {Object.entries(OUTREACH_STAGE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: OUTREACH_STAGE_COLORS[k as OutreachPipelineStage] }}
                        />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assigned_to_detail">Assignee</Label>
              <Select
                value={prospect.assigned_to || 'unassigned'}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger id="assigned_to_detail" className="bg-background border-input">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates & Followups */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Schedule</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground block">Last Contact</span>
                <span className="text-sm font-medium text-foreground">
                  {prospect.last_contact_date || 'Never contacted'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Next Follow-Up</span>
                <span className={cn(
                  "text-sm font-medium flex items-center gap-1.5",
                  isOverdue() ? "text-red-500 font-bold" : "text-foreground"
                )}>
                  {prospect.next_followup_date || 'No follow-up set'}
                  {isOverdue() && (
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </span>
              </div>
            </div>

            {isOverdue() && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md text-xs font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Follow-up action is currently overdue! Please reach out to the contact.</span>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Contact Info</h3>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted-foreground block">Contact Person</span>
                <span className="text-sm font-medium text-foreground">{prospect.contact_name || 'No contact name'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Contact Email</span>
                {prospect.contact_email ? (
                  <a
                    href={`mailto:${prospect.contact_email}`}
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {prospect.contact_email}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">No contact email</span>
                )}
              </div>
            </div>
          </div>

          {/* Creator & Meta */}
          {prospect.creator && (
            <div className="bg-card border border-border rounded-lg p-5 text-xs text-muted-foreground flex items-center justify-between">
              <div>
                <span>Added by **{prospect.creator?.full_name}**</span>
                <span className="block mt-0.5">on {new Date(prospect.created_at).toLocaleDateString()}</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold">
                {(prospect.creator?.full_name?.[0] || '?').toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Notes & Interaction Timeline */}
        <div className="space-y-6 lg:col-span-2">
          {/* Notes Log Form */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-4">Log Interaction</h3>

            <form onSubmit={handleAddNote} className="space-y-4">
              <div className="flex gap-4">
                <div className="w-1/3">
                  <Label htmlFor="note_type_detail">Interaction Type</Label>
                  <Select
                    value={noteType}
                    onValueChange={(val: 'email' | 'call' | 'general') => setNoteType(val)}
                  >
                    <SelectTrigger id="note_type_detail" className="bg-background border-input mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      <SelectItem value="general">General Note</SelectItem>
                      <SelectItem value="email">Email Sent/Received</SelectItem>
                      <SelectItem value="call">Phone Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-2/3 flex flex-col justify-end">
                  <span className="text-xs text-muted-foreground mb-1 block">
                    Logs audit trail in outreach notes.
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note_content_detail">Interaction details</Label>
                <textarea
                  id="note_content_detail"
                  rows={3}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Record summary of email sent, response details, pricing agreements, pitch details..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmittingNote || !noteContent.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
                >
                  {isSubmittingNote ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2 border-t-primary-foreground" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Log Note
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          <AIEmailGenerator prospect={prospect} onSaveNote={mutateNotes} />

          {/* Timeline Feed */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Interaction History</h3>

            {notesError ? (
              <div className="p-4 border border-border bg-card rounded-lg text-center text-sm text-red-400">
                Failed to load notes.
              </div>
            ) : !notes ? (
              <div className="space-y-3">
                <div className="h-16 bg-muted animate-pulse rounded-lg" />
                <div className="h-16 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : notes.length === 0 ? (
              <div className="p-8 border border-dashed border-border bg-card/40 rounded-lg text-center text-sm text-muted-foreground">
                No interaction logged yet. Use the form above to add notes, send-outs, or log calls.
              </div>
            ) : (
              <div className="relative border-l border-border/80 ml-4 pl-6 space-y-6">
                {notes.map((note) => {
                  const Icon = NOTE_TYPE_ICONS[note.note_type] || MessageSquare
                  const initials = note.creator?.full_name
                    ? note.creator.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : '?'

                  return (
                    <div key={note.id} className="relative group">
                      {/* Timeline Dot Indicator */}
                      <span className="absolute -left-[35px] top-1 flex items-center justify-center h-6 w-6 rounded-full border border-background bg-card text-muted-foreground shadow-sm">
                        <Icon className="h-3 w-3" />
                      </span>

                      {/* Content Card */}
                      <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {/* Author */}
                            <span className="font-semibold text-xs text-foreground">
                              {note.creator?.full_name || 'System / Auto'}
                            </span>
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border",
                              NOTE_TYPE_COLORS[note.note_type]
                            )}>
                              {note.note_type}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prospect Edit Form Sheet */}
      <ProspectForm
        prospect={prospect}
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        onSuccess={() => {
          mutateProspect()
          mutate('/api/outreach')
          mutate('/api/outreach/stats')
        }}
      />

      {/* Placed Guest Post Prompt Modal */}
      <Dialog open={isPlacedModalOpen} onOpenChange={setIsPlacedModalOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500 mb-2">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Prospect Placement Placed!</DialogTitle>
            <DialogDescription className="text-center text-sm mt-1">
              Would you like to create a **Guest Post** record for this placement at **{prospect.site_name}**?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPlacedModalOpen(false)}
              className="border-border hover:bg-accent hover:text-accent-foreground w-24"
            >
              No
            </Button>
            <Button
              type="button"
              onClick={handleCreateGuestPostRedirect}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-24"
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
