import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronUp, LogOut, Plus, X } from 'lucide-react'
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

const TEAM_ROLE_LABEL = { member: '팀원', lead: '리드' }

const SELECT_CLASS =
  'h-8 rounded-lg border border-border bg-background px-2 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

export default function TeamManagementPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()

  const [createOpen, setCreateOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [createError, setCreateError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [newMemberId, setNewMemberId] = useState('')
  const [memberError, setMemberError] = useState(null)

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: async () => (await api.get('/api/teams')).data.teams,
  })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/api/users')).data.users,
  })

  const membersQuery = useQuery({
    queryKey: ['teams', expandedId, 'members'],
    queryFn: async () => (await api.get(`/api/teams/${expandedId}/members`)).data.members,
    enabled: !!expandedId,
  })

  const createMutation = useMutation({
    mutationFn: (name) => api.post('/api/teams', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setCreateOpen(false)
      setTeamName('')
      setCreateError(null)
    },
    onError: (err) => {
      setCreateError(err.response?.data?.error ?? '팀 생성에 실패했습니다')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setDeleteTarget(null)
      setDeleteError(null)
      setExpandedId((prev) => (prev === deleteTarget?.id ? null : prev))
    },
    onError: (err) => {
      setDeleteError(err.response?.data?.error ?? '팀 삭제에 실패했습니다')
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }) =>
      api.post(`/api/teams/${teamId}/members`, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', expandedId, 'members'] })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setNewMemberId('')
      setMemberError(null)
    },
    onError: (err) => {
      setMemberError(err.response?.data?.error ?? '팀원 편성에 실패했습니다')
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ teamId, userId, teamRole }) =>
      api.patch(`/api/teams/${teamId}/members/${userId}`, { team_role: teamRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', expandedId, 'members'] })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }) => api.delete(`/api/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', expandedId, 'members'] })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })

  const teamMemberIds = new Set((membersQuery.data ?? []).map((m) => m.user_id))
  const addableUsers = (usersQuery.data ?? []).filter(
    (u) => u.status === 'active' && !teamMemberIds.has(u.id),
  )

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function toggleExpand(teamId) {
    setExpandedId((prev) => (prev === teamId ? null : teamId))
    setNewMemberId('')
    setMemberError(null)
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
        <Button variant="ghost" size="sm" className="self-start" onClick={() => navigate('/')}>
          <ArrowLeft />
          업체 목록
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>팀 관리</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setCreateError(null)
                  setTeamName('')
                  setCreateOpen(true)
                }}
              >
                <Plus />
                팀 생성
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {teamsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            )}
            {teamsQuery.isError && (
              <p className="text-sm text-destructive">팀 목록을 불러오지 못했습니다</p>
            )}
            {teamsQuery.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                등록된 팀이 없습니다
              </p>
            )}
            {teamsQuery.data?.map((team) => {
              const expanded = expandedId === team.id
              return (
                <div key={team.id} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(team.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{team.name}</span>
                        <span className="text-xs text-muted-foreground">
                          팀원 {team.member_count}명 · 리드 {team.lead_count}명 · 생성{' '}
                          {formatDate(team.created_at)}
                        </span>
                      </div>
                    </button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleteTarget(team)
                      }}
                    >
                      삭제
                    </Button>
                  </div>

                  {expanded && (
                    <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
                      {membersQuery.isLoading && (
                        <p className="text-sm text-muted-foreground">불러오는 중…</p>
                      )}
                      {membersQuery.data?.length === 0 && (
                        <p className="text-sm text-muted-foreground">소속 팀원이 없습니다</p>
                      )}
                      {membersQuery.data?.map((member) => (
                        <div
                          key={member.user_id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span>{member.name}</span>
                            <span className="text-xs text-muted-foreground">{member.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className={SELECT_CLASS}
                              value={member.team_role}
                              disabled={roleMutation.isPending}
                              onChange={(e) =>
                                roleMutation.mutate({
                                  teamId: team.id,
                                  userId: member.user_id,
                                  teamRole: e.target.value,
                                })
                              }
                            >
                              <option value="member">{TEAM_ROLE_LABEL.member}</option>
                              <option value="lead">{TEAM_ROLE_LABEL.lead}</option>
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={removeMemberMutation.isPending}
                              onClick={() =>
                                removeMemberMutation.mutate({
                                  teamId: team.id,
                                  userId: member.user_id,
                                })
                              }
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-2 border-t border-border pt-3">
                        <select
                          className={`${SELECT_CLASS} flex-1`}
                          value={newMemberId}
                          onChange={(e) => setNewMemberId(e.target.value)}
                        >
                          <option value="">편성할 사용자를 선택하세요</option>
                          {addableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={!newMemberId || addMemberMutation.isPending}
                          onClick={() =>
                            addMemberMutation.mutate({ teamId: team.id, userId: newMemberId })
                          }
                        >
                          편성
                        </Button>
                      </div>
                      {memberError && (
                        <p className="text-sm text-destructive" role="alert">
                          {memberError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </main>

      <Dialog open={createOpen} onOpenChange={(next) => { if (!createMutation.isPending) setCreateOpen(next) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀 생성</DialogTitle>
            <DialogDescription>새 팀을 만듭니다.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate(teamName.trim())
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-name">팀명</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={createMutation.isPending}
                required
              />
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
                onClick={() => setCreateOpen(false)}
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
            <DialogTitle>팀을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} 팀이 삭제되고, 소속 팀원은 팀에서 해제됩니다.
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
              {deleteMutation.isPending ? '삭제 중…' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
