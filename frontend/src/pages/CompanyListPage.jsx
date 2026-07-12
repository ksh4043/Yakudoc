import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Plus, Users } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const EMPTY_FORM = { name: '', industry: '', country: '', memo: '' }

export default function CompanyListPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)

  const {
    data: companies,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await api.get('/api/companies')
      return data.companies
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/companies', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setOpen(false)
      setForm(EMPTY_FORM)
      setFormError(null)
    },
    onError: (err) => {
      setFormError(err.response?.data?.error ?? '업체 등록에 실패했습니다')
    },
  })

  function handleFieldChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    const payload = {
      name: form.name.trim(),
      industry: form.industry.trim(),
      country: form.country.trim(),
    }
    if (form.memo.trim()) payload.memo = form.memo.trim()
    createMutation.mutate(payload)
  }

  function handleOpenChange(next) {
    setOpen(next)
    if (!next) {
      setForm(EMPTY_FORM)
      setFormError(null)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">Yakudoc</h1>
          <div className="flex items-center gap-2">
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/users')}
              >
                <Users />
                계정 관리
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">업체 목록</h2>
          <Button onClick={() => setOpen(true)}>
            <Plus />
            업체 등록
          </Button>
        </div>

        {isLoading && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            불러오는 중…
          </p>
        )}

        {isError && (
          <p className="py-16 text-center text-sm text-destructive">
            업체 목록을 불러오지 못했습니다
          </p>
        )}

        {!isLoading && !isError && companies?.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            등록된 업체가 없습니다
          </p>
        )}

        {!isLoading && !isError && companies?.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {companies.map((company) => (
              <Card
                key={company.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/companies/${company.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/companies/${company.id}`)
                  }
                }}
                className="cursor-pointer gap-2 py-4 transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <CardContent className="flex flex-col gap-1">
                  <span className="font-medium">{company.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {company.industry} · {company.country}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업체 등록</DialogTitle>
            <DialogDescription>새 거래처 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">업체명 *</Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={handleFieldChange}
                disabled={createMutation.isPending}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="industry">업종 *</Label>
              <Input
                id="industry"
                name="industry"
                value={form.industry}
                onChange={handleFieldChange}
                disabled={createMutation.isPending}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="country">국가 *</Label>
              <Input
                id="country"
                name="country"
                value={form.country}
                onChange={handleFieldChange}
                disabled={createMutation.isPending}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="memo">메모</Label>
              <Input
                id="memo"
                name="memo"
                value={form.memo}
                onChange={handleFieldChange}
                disabled={createMutation.isPending}
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createMutation.isPending}
              >
                취소
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중…' : '등록'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
