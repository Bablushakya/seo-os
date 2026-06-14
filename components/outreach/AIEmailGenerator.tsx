'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sparkles,
  Copy,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
  Mail,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import type { OutreachProspect } from '@/lib/types'

interface AIEmailGeneratorProps {
  prospect: OutreachProspect
  onSaveNote: () => void
}

export function AIEmailGenerator({ prospect, onSaveNote }: AIEmailGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal'>('professional')
  const [proposedTopic, setProposedTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const handleGenerate = async () => {
    setGenerating(true)
    setSubject('')
    setBody('')
    setCopied(false)

    try {
      const res = await fetch('/api/ai/outreach-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_name: prospect.site_name,
          niche: prospect.niche || 'General',
          contact_name: prospect.contact_name || 'Site Editor',
          proposed_topic: proposedTopic,
          tone: tone,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to generate email pitch')
      }

      setSubject(result.data.subject)
      setBody(result.data.body)
      toast.success('Outreach email pitch generated!')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error generating email pitch')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    const fullText = `Subject: ${subject}\n\n${body}`
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    toast.success('Copied email text to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveAsNote = async () => {
    if (!subject || !body || saving) return
    setSaving(true)

    try {
      const res = await fetch(`/api/outreach/${prospect.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Subject: ${subject}\n\n${body}`,
          note_type: 'ai_generated',
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save note')
      }

      toast.success('Saved email pitch to interaction feed')
      onSaveNote() // Refresh notes list
      setSubject('')
      setBody('')
      setProposedTopic('')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error saving email pitch')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Panel Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Gemini Outreach Email Generator
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Draft personalized outreach email pitches with AI.
            </p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {/* Panel Body */}
      {isOpen && (
        <div className="border-t border-border/60 p-5 space-y-4 bg-background/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-tone" className="text-xs font-bold text-muted-foreground uppercase">
                Email Tone
              </Label>
              <Select value={tone} onValueChange={(val: any) => setTone(val)}>
                <SelectTrigger id="email-tone" className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border rounded-md shadow-lg">
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly / Warm</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-topic" className="text-xs font-bold text-muted-foreground uppercase">
                Proposed Topic Idea (Optional)
              </Label>
              <Input
                id="email-topic"
                placeholder="e.g. 7 Hidden Gems in South India"
                value={proposedTopic}
                onChange={(e) => setProposedTopic(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? 'Generating pitch...' : 'Generate Pitch'}
            </Button>
          </div>

          {/* Generated Result Container */}
          {(subject || body || generating) && (
            <div className="border border-border/80 rounded-lg p-4 bg-background/50 space-y-3.5 mt-4">
              {generating ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <p>Gemini is writing your personalized email pitch...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Subject Line
                    </Label>
                    <div className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground font-semibold">
                      {subject}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Email Body
                    </Label>
                    <textarea
                      readOnly
                      rows={8}
                      value={body}
                      className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:outline-none resize-none font-medium leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border/40 pt-3 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="flex items-center gap-1 h-8"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveAsNote}
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 h-8"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? 'Saving...' : 'Save as Note'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
