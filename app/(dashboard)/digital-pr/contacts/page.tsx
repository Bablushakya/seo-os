'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ContactForm } from '@/components/digital-pr/ContactForm'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Users,
  Mail,
  Calendar,
  Building,
  Tag,
  ArrowUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PRContact } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function MediaContactsPage() {
  const { user } = useAuth()
  const router = useRouter()

  // State
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Form & Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<PRContact | null>(null)

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Build query string
  const queryParts = [
    `page=${page}`,
    `limit=${limit}`,
    sortBy ? `sortBy=${sortBy}` : '',
    sortOrder ? `sortOrder=${sortOrder}` : '',
    debouncedSearch ? `search=${encodeURIComponent(debouncedSearch)}` : '',
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR Hook
  const { data: listData, error: listError, mutate: mutateList } = useSWR(
    `/api/digital-pr/contacts?${queryString}`,
    fetcher
  )

  const contacts = listData?.data || []
  const meta = listData?.meta || { total: 0, total_pages: 1 }
  const isLoading = !listData && !listError

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const handleAddClick = () => {
    setSelectedContact(null)
    setIsFormOpen(true)
  }

  const handleEditClick = (e: React.MouseEvent, contact: PRContact) => {
    e.stopPropagation()
    setSelectedContact(contact)
    setIsFormOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const isAdminUser = user?.role === 'admin'
    if (!isAdminUser) {
      toast.error('Only administrators can delete media contacts.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this media contact? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/digital-pr/contacts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error?.message || 'Failed to delete contact')
      }

      toast.success('Media contact deleted successfully')
      mutateList()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting media contact')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your ongoing relationships with journalists, editors, and reporters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            onClick={handleAddClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Tabs / Subnavigation */}
      <div className="border-b border-border flex gap-4">
        <Link
          href="/digital-pr"
          className="border-b-2 border-transparent pb-2 px-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
        >
          Campaigns
        </Link>
        <Link
          href="/digital-pr/contacts"
          className="border-b-2 border-primary pb-2 px-1 text-sm font-medium text-foreground transition-all"
        >
          Media Contacts
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end">
        {/* Search */}
        <div className="space-y-1.5 flex-1 w-full">
          <Label htmlFor="search" className="text-xs font-medium">Search Contacts</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              type="text"
              placeholder="Search by journalist name, email, publication, or beat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-background border-input w-full"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border">
                <TableHead>Journalist</TableHead>
                <TableHead>Publication</TableHead>
                <TableHead>Beat / Specialty</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last Contacted</TableHead>
                <TableHead>Response Rate</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBodySkeleton columns={7} rows={5} />
          </Table>
        ) : contacts.length === 0 ? (
          <EmptyState
            title="No media contacts yet."
            description="Build a directory of editors and reporters to pitching your data studies and news hooks."
            actionLabel="+ Add Media Contact"
            onAction={handleAddClick}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1.5">
                      Journalist Name
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('publication')}>
                    <div className="flex items-center gap-1.5">
                      Publication
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('beat')}>
                    <div className="flex items-center gap-1.5">
                      Beat / Specialty
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('last_contact_date')}>
                    <div className="flex items-center gap-1.5">
                      Last Contacted
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('response_rate')}>
                    <div className="flex items-center gap-1.5">
                      Response Rate
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c: PRContact) => (
                  <TableRow
                    key={c.id}
                    className="border-b border-border hover:bg-muted/10 transition-colors"
                  >
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                          {c.name.substring(0, 2)}
                        </div>
                        {c.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.publication ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Building className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.publication}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.beat ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium border border-border">
                            <Tag className="h-3 w-3 mr-1 text-muted-foreground" />
                            {c.beat}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1.5 text-blue-500 hover:underline text-sm font-medium"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.last_contact_date ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {c.last_contact_date}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 w-[120px]">
                        <div className="flex justify-between text-xs font-medium">
                          <span>{c.response_rate}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.response_rate >= 75 ? 'bg-emerald-500' :
                              c.response_rate >= 50 ? 'bg-blue-500' :
                              c.response_rate >= 25 ? 'bg-amber-500' :
                              'bg-rose-500'
                            }`}
                            style={{ width: `${c.response_rate}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEditClick(e, c)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground text-xs"
                        >
                          Edit
                        </Button>
                        {user?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDelete(e, c.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Section */}
        {!isLoading && meta.total_pages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} contacts
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 border-border"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
                disabled={page === meta.total_pages}
                className="h-8 border-border"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Form Sheet */}
      <ContactForm
        contact={selectedContact}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={mutateList}
      />
    </div>
  )
}
