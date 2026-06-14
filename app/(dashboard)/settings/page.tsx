'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingSpinner, TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Settings, Users, Target, Save, Edit, Key, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { USER_ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // Guard settings page - redirect non-admins
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      router.replace('/dashboard')
      toast.error('Access Denied. Admin role required.')
    }
  }, [user, authLoading, router])

  // KPI Targets SWR
  const { data: targetsData, error: targetsError, isLoading: targetsLoading, mutate: mutateTargets } = useSWR(
    '/api/settings/kpi-targets?period=all',
    fetcher
  )

  // Users SWR
  const { data: usersData = [], error: usersError, isLoading: usersLoading, mutate: mutateUsers } = useSWR<any[]>(
    '/api/settings/users',
    fetcher
  )

  // Local Targets state for inline editing
  const [localTargets, setLocalTargets] = useState<{
    weekly: Record<string, number>
    monthly: Record<string, number>
  } | null>(null)

  const [savingTargets, setSavingTargets] = useState(false)

  // User Edit Modal state
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('seo_specialist')
  const [savingUser, setSavingUser] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)

  useEffect(() => {
    if (targetsData) {
      setLocalTargets(targetsData)
    }
  }, [targetsData])

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Handle KPI target changes locally
  const handleTargetChange = (metric: string, period: 'weekly' | 'monthly', value: number) => {
    if (isNaN(value) || value < 0) return
    setLocalTargets((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [period]: {
          ...prev[period],
          [metric]: value,
        },
      }
    })
  }

  // Save KPI Targets to API
  const handleSaveTargets = async () => {
    if (!localTargets) return
    setSavingTargets(true)

    const targetsPayload = []
    for (const [metric, value] of Object.entries(localTargets.monthly)) {
      targetsPayload.push({ metric_name: metric, target_value: value, period: 'monthly' })
    }
    for (const [metric, value] of Object.entries(localTargets.weekly)) {
      targetsPayload.push({ metric_name: metric, target_value: value, period: 'weekly' })
    }

    try {
      const res = await fetch('/api/settings/kpi-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: targetsPayload }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save KPI targets')
      }

      toast.success('KPI targets saved successfully!')
      mutateTargets()
      // Bust dashboard stats/kpi cache by calling the flat endpoint
      fetch('/api/settings/kpi-targets')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error saving KPI targets')
    } finally {
      setSavingTargets(false)
    }
  }

  // User edit opening
  const handleEditUserClick = (u: any) => {
    setSelectedUser(u)
    setEditName(u.full_name)
    setEditRole(u.role)
    setIsEditOpen(true)
  }

  // Save modified user profile
  const handleSaveUser = async () => {
    if (!selectedUser) return
    setSavingUser(true)

    try {
      const res = await fetch(`/api/settings/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: editName, role: editRole }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update user profile')
      }

      toast.success('User profile updated successfully!')
      mutateUsers()
      setIsEditOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating user profile')
    } finally {
      setSavingUser(false)
    }
  }

  // Reset user password
  const handleResetPassword = async (u: any) => {
    if (!window.confirm(`Are you sure you want to send a password reset email to ${u.email}?`)) {
      return
    }
    setResettingId(u.id)

    try {
      const res = await fetch(`/api/settings/users/${u.id}/reset-password`, {
        method: 'POST',
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to trigger reset email')
      }

      toast.success(`Password reset email sent to ${u.email}`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error triggering reset email')
    } finally {
      setResettingId(null)
    }
  }

  const formatLastLogin = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-500" />
          System Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure operations, edit KPI target thresholds, and manage user roles.
        </p>
      </div>

      <Tabs defaultValue="kpis" className="w-full">
        <TabsList className="bg-muted border border-border rounded-lg p-1 max-w-md grid grid-cols-2 mb-6">
          <TabsTrigger value="kpis" className="flex items-center justify-center gap-1.5 py-2">
            <Target className="h-4 w-4" />
            KPI Targets
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center justify-center gap-1.5 py-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
        </TabsList>

        {/* KPI TARGETS TAB */}
        <TabsContent value="kpis" className="space-y-4">
          <div className="rounded-lg border border-border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">Operational KPI Targets</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Adjust target performance targets for weekly and monthly aggregation audits.
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveTargets}
                disabled={savingTargets || !localTargets}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Save className="h-4 w-4" />
                {savingTargets ? 'Saving...' : 'Save Targets'}
              </Button>
            </div>

            {targetsLoading || !localTargets ? (
              <div className="py-6 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-muted-foreground py-3">Core SEO Metric</TableHead>
                      <TableHead className="font-semibold text-muted-foreground text-center">Weekly Target Goal</TableHead>
                      <TableHead className="font-semibold text-muted-foreground text-center">Monthly Target Goal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { key: 'citations', label: 'Citations (Live)' },
                      { key: 'guest_posts', label: 'Guest Posts Placed' },
                      { key: 'pr_placements', label: 'PR Placements' },
                      { key: 'gbp_posts', label: 'GBP Posts Published' },
                    ].map((metric) => (
                      <TableRow key={metric.key} className="hover:bg-muted/10 border-b border-border/40">
                        <td className="p-4 font-medium text-foreground">{metric.label}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center">
                            <Input
                              type="number"
                              min="0"
                              value={localTargets.weekly[metric.key] ?? 0}
                              onChange={(e) =>
                                handleTargetChange(metric.key, 'weekly', parseInt(e.target.value, 10))
                              }
                              className="w-24 text-center h-9 focus:border-indigo-500 bg-background/50 border-border/50 font-semibold text-foreground"
                            />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center">
                            <Input
                              type="number"
                              min="0"
                              value={localTargets.monthly[metric.key] ?? 0}
                              onChange={(e) =>
                                handleTargetChange(metric.key, 'monthly', parseInt(e.target.value, 10))
                              }
                              className="w-24 text-center h-9 focus:border-indigo-500 bg-background/50 border-border/50 font-semibold text-foreground"
                            />
                          </div>
                        </td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* USER MANAGEMENT TAB */}
        <TabsContent value="users" className="space-y-4">
          <div className="rounded-lg border border-border bg-card shadow-sm p-6">
            <div className="border-b border-border pb-4 mb-6">
              <h2 className="text-lg font-bold text-foreground">User Directory & Roles</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage roles and trigger credential resets for team members.
              </p>
            </div>

            {usersLoading ? (
              <div className="py-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Log In</TableHead>
                      <TableHead className="w-40"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBodySkeleton columns={5} rows={3} />
                </Table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-muted-foreground py-3">Team Member</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Email</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">System Role</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Last Login Timestamp</TableHead>
                      <TableHead className="w-44"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.map((u) => (
                      <TableRow key={u.id} className="hover:bg-muted/10 border-b border-border/40">
                        <td className="p-4 font-bold text-foreground">{u.full_name}</td>
                        <td className="p-4 text-muted-foreground">{u.email}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                            {USER_ROLE_LABELS[u.role as UserRole] || u.role}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground text-sm">{formatLastLogin(u.last_login)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUserClick(u)}
                              className="flex items-center gap-1 h-8"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={resettingId === u.id}
                              onClick={() => handleResetPassword(u)}
                              className="flex items-center gap-1 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 h-8"
                            >
                              <Key className="h-3.5 w-3.5" />
                              Reset
                            </Button>
                          </div>
                        </td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* USER EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-card border border-border rounded-lg shadow-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
              Modify User Profile
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-bold text-muted-foreground uppercase">Display Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-background focus:border-indigo-500 border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-role" className="text-xs font-bold text-muted-foreground uppercase">System Role</Label>
                {selectedUser.id === user.id ? (
                  <div className="space-y-1">
                    <Input disabled value="Admin (Own profile role locked)" className="bg-muted border-border cursor-not-allowed" />
                    <p className="text-[10px] text-amber-500 font-semibold flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      Self role modification is disabled to prevent system lockouts.
                    </p>
                  </div>
                ) : (
                  <Select value={editRole} onValueChange={(val: UserRole) => setEditRole(val)}>
                    <SelectTrigger id="edit-role" className="bg-background focus:border-indigo-500 border-border">
                      <SelectValue placeholder="Select system role" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border rounded-md shadow-lg">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="seo_specialist">SEO Specialist</SelectItem>
                      <SelectItem value="data_specialist">Data Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveUser}
              disabled={savingUser || editName.trim().length < 2}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {savingUser ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
