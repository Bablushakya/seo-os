'use client'

import React from 'react'
import Link from 'next/link'

interface OutreachPipelineChartProps {
  data: Record<string, number>
}

const STAGES = [
  { key: 'identified', label: 'Identified', color: '#6b7280', bgClass: 'bg-[#6b7280]' },
  { key: 'contacted', label: 'Contacted', color: '#3b82f6', bgClass: 'bg-[#3b82f6]' },
  { key: 'followed_up', label: 'Followed Up', color: '#a855f7', bgClass: 'bg-[#a855f7]' },
  { key: 'negotiating', label: 'Negotiating', color: '#f97316', bgClass: 'bg-[#f97316]' },
  { key: 'placed', label: 'Placed', color: '#22c55e', bgClass: 'bg-[#22c55e]' },
  { key: 'rejected', label: 'Rejected', color: '#ef4444', bgClass: 'bg-[#ef4444]' },
]

export function OutreachPipelineChart({ data }: OutreachPipelineChartProps) {
  // Find maximum count for scaling
  const counts = Object.values(data)
  const maxCount = Math.max(...counts, 1) // Avoid division by zero
  const total = counts.reduce((acc, val) => acc + val, 0)

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Outreach Pipeline
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active prospects by pipeline stage ({total} total)
          </p>
        </div>
      </div>

      <div className="space-y-4 my-auto">
        {STAGES.map((stage) => {
          const count = data[stage.key] || 0
          const percentage = Math.round((count / maxCount) * 100)

          return (
            <Link
              key={stage.key}
              href={`/outreach?stage=${stage.key}`}
              className="group flex items-center gap-3 w-full cursor-pointer"
            >
              {/* Label */}
              <span className="w-24 text-xs font-semibold text-muted-foreground truncate group-hover:text-foreground transition-colors">
                {stage.label}
              </span>

              {/* Bar Container */}
              <div className="flex-1 bg-border/40 h-7 rounded-md overflow-hidden relative border border-border/10">
                <div
                  className={`h-full ${stage.bgClass} opacity-80 group-hover:opacity-100 transition-all duration-300 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
                <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-foreground">
                  {count}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
