import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LogOut, Plus } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ROLE_LABEL = { user: '일반', admin: '관리자' }

const STATUS_LABEL = {
  active: '활성',
  inactive: '비활성',
  suspended: '정지',
}

const STATUS_CLASS = {
  active: 'bg-primary/10 text-primary',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-destructive/10 text-destructive',
}

const SELECT_CLASS =
  'h-8 rounded-lg border border-border bg-background px-2 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

const EMPTY_FORM = { name: '', email: '', password: '', role: 'user' }

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user: currentUser, logout } = useAuth()

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState(null)
  const [rowErrors, setRowErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/api/users')).data.users,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setCreateError(null)
    },
    onError: (err) => {
      setCreateError(err.response?.data?.error ?? '계정 생성에 실패했습니다')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => api.patch(`/api/users/${id}`, patch),
    onSuccess: (_data, { id }) => {
      setRowErrors((prev) => ({ ...prev, [id]: null }))
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err, { id }) => {
      setRowErrors((prev) => ({
        ...prev,
        [id]: err.response?.data?.error ?? '변경에 실패했습니다',
      }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (err) => {
      setDeleteError(err.response?.data?.error ?? '비활성화에 실패했습니다')
    },
  })

  function handleFieldChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleCreate(e) {
    e.preventDefault()
    setCreateError(null)
    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    })
  }

  function handleCreateOpenChange(next) {
    if (createMutation.isPending) return
    setCreateOpen(next)
    if (!next) {
      setForm(EMPTY_FORM)
      setCreateError(null)
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
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut />
            로그아웃
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => navigate('/')}
        >
          <ArrowLeft />
          업체 목록
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>계정 관리</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setCreateError(null)
                  setForm(EMPTY_FORM)
                  setCreateOpen(true)
                }}
              >
                <Plus />
                계정 생성
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {usersQuery.isLoading && (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            )}
            {usersQuery.isError && (
              <p className="text-sm text-destructive">
                사용자 목록을 불러오지 못했습니다
              </p>
            )}
            {usersQuery.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                등록된 사용자가 없습니다
              </p>
            )}
            {usersQuery.data?.map((u) => {
              const isSelf = u.id === currentUser?.id
              const rowPending =
                updateMutation.isPending && updateMutation.variables?.id === u.id
              return (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{u.name}</span>
                        {isSelf && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            나
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[u.status] ?? ''}`}
                        >
                          {STATUS_LABEL[u.status] ?? u.status}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {u.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        가입 {formatDate(u.created_at)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        등급
                        <select
                          className={SELECT_CLASS}
                          value={u.role}
                          disabled={isSelf || rowPending}
                          onChange={(e) =>
                            updateMutation.mutate({
                              id: u.id,
                              patch: { role: e.target.value },
                            })
                          }
                        >
                          <option value="user">{ROLE_LABEL.user}</option>
                          <option value="admin">{ROLE_LABEL.admin}</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        상태
                        <select
                          className={SELECT_CLASS}
                          value={u.status}
                          disabled={isSelf || rowPending}
                          onChange={(e) =>
                            updateMutation.mutate({
                              id: u.id,
                              patch: { status: e.target.value },
                            })
                          }
                        >
                          <option value="active">{STATUS_LABEL.active}</option>
                          <option value="inactive">
                            {STATUS_LABEL.inactive}
                          </option>
                          <option value="suspended">
                            {STATUS_LABEL.suspended}
                          </option>
                        </select>
                      </label>

                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isSelf || deleteMutation.isPending}
                        onClick={() => {
                          setDeleteError(null)
                          setDeleteTarget(u)
                        }}
                      >
                        비활성화
                      </Button>
                    </div>
                  </div>

                  {rowErrors[u.id] && (
                    <p className="text-sm text-destructive" role="alert">
                      {rowErrors[u.id]}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </main>

      {/* 계정 생성 */}
      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정 생성</DialogTitle>
            <DialogDescription>새 담당자 계정을 만듭니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">이름</Label>
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
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleFieldChange}
                disabled={createMutation.isPending}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleFieldChange}
                disabled={createMutation.isPending}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">등급</Label>
              <select
                id="role"
                name="role"
                className={SELECT_CLASS}
                value={form.role}
                onChange={handleFieldChange}
                disabled={createMutation.isPending}
              >
                <option value="user">{ROLE_LABEL.user}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
              </select>
            </div>
            {createError && (
              <p className="text-sm text-destructive" role="alert">
                {createError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCreateOpenChange(false)}
                disabled={createMutation.isPending}
              >
                취소
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '생성 중…' : '생성'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 비활성화 확인 */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (deleteMutation.isPending) return
          if (!next) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정을 비활성화할까요?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} ({deleteTarget?.email}) 계정이 목록에서
              사라집니다.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteError(null)
              }}
              disabled={deleteMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '처리 중…' : '비활성화'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
