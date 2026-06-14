'use client'

import React from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  title: string
  value: number | string
  sublabel: string
  trend?: {
    value: number
    isPositive: boolean
  } | null
  color?: string
  emoji?: string
  href: string
}

export function KPICard({
  title,
  value,
  sublabel,
  trend,
  color = 'var(--foreground)',
  emoji,
  href,
}: KPICardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-lg border border-border bg-card p-5 hover:border-border/80 hover:bg-accent/10 transition-all duration-150 group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        {emoji && (
          <span className="text-lg group-hover:scale-110 transition-transform duration-150" role="img" aria-hidden="true">
            {emoji}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mt-auto">
        <p
          className="text-3xl font-extrabold tabular-nums tracking-tight"
          style={{ color }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>

        {trend && (
          <div
            className={`flex items-center gap-0.5 text-xs font-semibold ml-2 ${
              trend.isPositive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2">{sublabel}</p>
    </Link>
  )
}
