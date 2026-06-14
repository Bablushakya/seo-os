'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles,
  Loader2,
  Plus,
  BookOpen,
  ArrowLeft,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import type { GuestPost } from '@/lib/types'

interface TopicIdea {
  title: string
  angle: string
  target_keyword: string
  suggestedWordCount: number
}

interface AITopicGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (post: GuestPost) => void
}

export function AITopicGenerator({ isOpen, onClose, onSuccess }: AITopicGeneratorProps) {
  const [niche, setNiche] = useState('')
  const [targetSite, setTargetSite] = useState('')
  const [existingTopicsText, setExistingTopicsText] = useState('')
  
  const [generating, setGenerating] = useState(false)
  const [ideas, setIdeas] = useState<TopicIdea[]>([])
  const [creatingId, setCreatingId] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!niche.trim() || !targetSite.trim()) {
      toast.error('Niche and Target Site are required')
      return
    }

    setGenerating(true)
    setIdeas([])

    const existingTopics = existingTopicsText
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      const res = await fetch('/api/ai/topic-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          target_site: targetSite,
          existing_topics: existingTopics,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to generate topic ideas')
      }

      setIdeas(result.data)
      toast.success('Successfully brainstormed 5 topic ideas!')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error generating topic ideas')
    } finally {
      setGenerating(false)
    }
  }

  const handleCreatePost = async (idea: TopicIdea, index: number) => {
    setCreatingId(index)
    try {
      const res = await fetch('/api/guest-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: idea.title,
          target_site: targetSite,
          topic: idea.angle,
          target_keyword: idea.target_keyword,
          word_count: idea.suggestedWordCount,
          status: 'pitching',
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to create guest post')
      }

      toast.success('Guest post listing created successfully!')
      onSuccess(result.data)
      handleReset()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error creating guest post')
    } finally {
      setCreatingId(null)
    }
  }

  const handleReset = () => {
    setNiche('')
    setTargetSite('')
    setExistingTopicsText('')
    setIdeas([])
    setCreatingId(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleReset()
        onClose()
      }
    }}>
      <DialogContent className={`bg-card text-card-foreground border-border ${ideas.length > 0 ? 'max-w-4xl' : 'max-w-lg'} transition-all duration-300`}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
            <DialogTitle className="text-xl font-bold tracking-tight">
              AI Guest Post Topic Brainstormer
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {ideas.length > 0 
              ? `Brainstormed topics for niche "${niche}" targeting ${targetSite}`
              : 'Enter details below to brainstorm 5 highly-relevant, optimized topic pitches with Google Gemini.'}
          </DialogDescription>
        </DialogHeader>

        {ideas.length === 0 ? (
          /* Form Step */
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="topic-niche" className="text-xs font-bold text-muted-foreground uppercase">
                  Website Niche
                </Label>
                <Input
                  id="topic-niche"
                  placeholder="e.g. Travel, Tech, Fitness"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topic-site" className="text-xs font-bold text-muted-foreground uppercase">
                  Target Website
                </Label>
                <Input
                  id="topic-site"
                  placeholder="e.g. lonelyplanet.com"
                  value={targetSite}
                  onChange={(e) => setTargetSite(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic-existing" className="text-xs font-bold text-muted-foreground uppercase">
                Existing Topics (one per line, optional)
              </Label>
              <textarea
                id="topic-existing"
                placeholder="Topic A&#10;Topic B&#10;Topic C"
                rows={4}
                value={existingTopicsText}
                onChange={(e) => setExistingTopicsText(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-medium leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                variant="outline"
                onClick={() => {
                  handleReset()
                  onClose()
                }}
                className="border-border hover:bg-accent hover:text-accent-foreground text-sm font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !niche.trim() || !targetSite.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Brainstorming...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Brainstorm Topics
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Ideas Output Step */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1 py-1">
              {ideas.map((idea, idx) => (
                <div
                  key={idx}
                  className="border border-border/80 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 group relative bg-background/50 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-foreground text-base leading-tight group-hover:text-indigo-400 transition-colors">
                        {idea.title}
                      </h4>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      {idea.angle}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {idea.target_keyword && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                          <Search className="h-3 w-3" />
                          {idea.target_keyword}
                        </div>
                      )}
                      {idea.suggestedWordCount && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          <BookOpen className="h-3 w-3" />
                          {idea.suggestedWordCount} words
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border/40 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleCreatePost(idea, idx)}
                      disabled={creatingId !== null}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1 h-8 rounded-lg shadow-sm"
                    >
                      {creatingId === idx ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {creatingId === idx ? 'Creating...' : 'Create Guest Post'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-border/40">
              <Button
                variant="ghost"
                onClick={() => setIdeas([])}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Form
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
                className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-sm font-semibold flex items-center gap-1.5"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Regenerate Ideas
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
