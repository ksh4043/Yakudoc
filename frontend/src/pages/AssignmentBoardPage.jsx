import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LogOut, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PERMISSION_LABEL = { read: '읽기 전용', edit: '편집 가능' }

const SELECT_CLASS =
  'h-8 rounded-lg border border-border bg-background px-2 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

export default function AssignmentBoardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()

  const [selections, setSelections] = useState({})
  const [rowErrors, setRowErrors] = useState({})

  const boardQuery = useQuery({
    queryKey: ['teams', id, 'board'],
    queryFn: async () => (await api.get(`/api/teams/${id}/board`)).data,
  })

  const assignMutation = useMutation({
    mutationFn: ({ companyId, userId, permission }) =>
      api.post(`/api/companies/${companyId}/assignees`, { user_id: userId, permission }),
    onSuccess: (_data, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams', id, 'board'] })
      setRowErrors((prev) => ({ ...prev, [companyId]: null }))
      setSelections((prev) => ({ ...prev, [companyId]: { userId: '', permission: 'read' } }))
    },
    onError: (err, { companyId }) => {
      setRowErrors((prev) => ({
        ...prev,
        [companyId]: err.response?.data?.error ?? '배정에 실패했습니다',
      }))
    },
  })

  const unassignMutation = useMutation({
    mutationFn: ({ companyId, userId }) =>
      api.delete(`/api/companies/${companyId}/assignees/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', id, 'board'] })
    },
  })

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const board = boardQuery.data
  const forbidden = boardQuery.isError && boardQuery.error?.response?.status === 403

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

        {boardQuery.isLoading && (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        )}
        {forbidden && (
          <p className="text-sm text-destructive">이 팀의 업무 배정 권한이 없습니다</p>
        )}
        {boardQuery.isError && !forbidden && (
          <p className="text-sm text-destructive">업무 배정 정보를 불러오지 못했습니다</p>
        )}

        {board && (
          <>
            <h2 className="text-xl font-semibold">{board.team.name} — 업무 배정</h2>

            <Card>
              <CardHeader>
                <CardTitle>팀원</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {board.members.length === 0 && (
                  <p className="text-sm text-muted-foreground">소속 팀원이 없습니다</p>
                )}
                {board.members.map((m) => (
                  <span
                    key={m.user_id}
                    className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                  >
                    {m.name} {m.team_role === 'lead' ? '(리드)' : ''}
                  </span>
                ))}
              </CardContent>
            </Card>

            {board.companies.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                팀 범위 업체가 없습니다
              </p>
            )}

            {board.companies.map((company) => {
              const assignedIds = new Set(company.assignees.map((a) => a.user_id))
              const candidates = board.members.filter((m) => !assignedIds.has(m.user_id))
              const selection = selections[company.id] ?? { userId: '', permission: 'read' }
              return (
                <Card key={company.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{company.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {company.assignees.length === 0 && (
                      <p className="text-sm text-muted-foreground">배정된 담당자가 없습니다</p>
                    )}
                    {company.assignees.map((assignee) => (
                      <div
                        key={assignee.user_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {assignee.name}{' '}
                          <span className="text-xs text-muted-foreground">
                            ({PERMISSION_LABEL[assignee.permission] ?? assignee.permission})
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={unassignMutation.isPending}
                          onClick={() =>
                            unassignMutation.mutate({
                              companyId: company.id,
                              userId: assignee.user_id,
                            })
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}

                    {candidates.length > 0 && (
                      <div className="flex items-center gap-2 border-t border-border pt-3">
                        <select
                          className={`${SELECT_CLASS} flex-1`}
                          value={selection.userId}
                          onChange={(e) =>
                            setSelections((prev) => ({
                              ...prev,
                              [company.id]: { ...selection, userId: e.target.value },
                            }))
                          }
                        >
                          <option value="">팀원을 선택하세요</option>
                          {candidates.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className={SELECT_CLASS}
                          value={selection.permission}
                          onChange={(e) =>
                            setSelections((prev) => ({
                              ...prev,
                              [company.id]: { ...selection, permission: e.target.value },
                            }))
                          }
                        >
                          <option value="read">{PERMISSION_LABEL.read}</option>
                          <option value="edit">{PERMISSION_LABEL.edit}</option>
                        </select>
                        <Button
                          size="sm"
                          disabled={!selection.userId || assignMutation.isPending}
                          onClick={() =>
                            assignMutation.mutate({
                              companyId: company.id,
                              userId: selection.userId,
                              permission: selection.permission,
                            })
                          }
                        >
                          배정
                        </Button>
                      </div>
                    )}
                    {rowErrors[company.id] && (
                      <p className="text-sm text-destructive" role="alert">
                        {rowErrors[company.id]}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
