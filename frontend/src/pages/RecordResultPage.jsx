import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LogOut, Plus, Trash2, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SECTIONS = [
  { type: 'summary', title: '① 문서 전체 요약' },
  { type: 'risk', title: '② 주의해야 할 리스크 포인트' },
  { type: 'mail_draft', title: '③ 메일 초안' },
]

export default function RecordResultPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()

  const [tagName, setTagName] = useState('')
  const [tagError, setTagError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const { data: record, isLoading, isError, error } = useQuery({
    queryKey: ['record', id],
    queryFn: async () => (await api.get(`/api/records/${id}`)).data,
    // processing 중이면 2초 간격 폴링, done/failed면 중단
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 2000 : false,
  })

  const isDone = record?.status === 'done'

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/api/tags')).data.tags,
    enabled: isDone,
  })

  const connectMutation = useMutation({
    mutationFn: (tagId) =>
      api.post(`/api/records/${id}/tags`, { tag_id: tagId }),
    onSuccess: () => {
      setTagError(null)
      queryClient.invalidateQueries({ queryKey: ['record', id] })
    },
    onError: (err) => {
      // 이미 연결된 태그(409)는 조용히 무시하고 최신 상태로 동기화
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['record', id] })
        return
      }
      setTagError(err.response?.data?.error ?? '태그 연결에 실패했습니다')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: (tagId) => api.delete(`/api/records/${id}/tags/${tagId}`),
    onSuccess: () => {
      setTagError(null)
      queryClient.invalidateQueries({ queryKey: ['record', id] })
    },
    onError: (err) => {
      setTagError(err.response?.data?.error ?? '태그 해제에 실패했습니다')
    },
  })

  // 이름으로 태그 추가: 기존 태그면 연결, 없으면 생성 후 연결(순차). 생성 409면 재조회로 대체.
  const addTagMutation = useMutation({
    mutationFn: async (name) => {
      const tags = (await api.get('/api/tags')).data.tags
      let match = tags.find((t) => t.name === name)
      if (!match) {
        try {
          match = (await api.post('/api/tags', { name })).data
        } catch (err) {
          if (err.response?.status === 409) {
            const refetched = (await api.get('/api/tags')).data.tags
            match = refetched.find((t) => t.name === name)
          }
          if (!match) throw err
        }
      }
      try {
        await api.post(`/api/records/${id}/tags`, { tag_id: match.id })
      } catch (err) {
        // 이미 연결된 태그(409)는 정상 처리로 간주
        if (err.response?.status !== 409) throw err
      }
      return match
    },
    onSuccess: () => {
      setTagName('')
      setTagError(null)
      queryClient.invalidateQueries({ queryKey: ['record', id] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
    onError: (err) => {
      setTagError(err.response?.data?.error ?? '태그 추가에 실패했습니다')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/records/${id}`),
    onSuccess: () => {
      setConfirmOpen(false)
      if (record?.company_id) {
        navigate(`/companies/${record.company_id}`)
      } else {
        navigate(-1)
      }
    },
    onError: (err) => {
      setDeleteError(err.response?.data?.error ?? '삭제에 실패했습니다')
    },
  })

  const tagBusy =
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    addTagMutation.isPending

  const connectedTags = record?.tags ?? []
  const availableTags = (tagsQuery.data ?? []).filter(
    (t) => !connectedTags.some((ct) => ct.id === t.id),
  )

  function handleAddTag(e) {
    e.preventDefault()
    const name = tagName.trim()
    if (!name) return
    addTagMutation.mutate(name)
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handleBack() {
    if (record?.company_id) {
      navigate(`/companies/${record.company_id}`)
    } else {
      navigate(-1)
    }
  }

  function findContent(type) {
    return record?.results?.find((r) => r.result_type === type)?.content
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">Yakudoc</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut />
            로그아웃
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft />
            업체 상세
          </Button>
          {record && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteError(null)
                setConfirmOpen(true)
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 />
              삭제
            </Button>
          )}
        </div>

        {/* isLoading → isError → processing → failed → done 순으로 배타적 분기 */}
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            불러오는 중…
          </p>
        ) : isError ? (
          <p className="py-16 text-center text-sm text-destructive">
            {error?.response?.data?.error ?? '결과를 불러오지 못했습니다'}
          </p>
        ) : record?.status === 'processing' ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">분석 중입니다…</p>
            <p className="text-sm text-muted-foreground">
              완료되면 자동으로 결과가 표시됩니다.
            </p>
          </div>
        ) : record?.status === 'failed' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">분석 실패</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {record.error ?? '분석 중 오류가 발생했습니다'}
              </p>
            </CardContent>
          </Card>
        ) : record?.status === 'done' ? (
          <>
            {SECTIONS.map((section) => {
              const content = findContent(section.type)
              return (
                <Card key={section.type}>
                  <CardHeader>
                    <CardTitle>{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {content ?? '내용이 없습니다.'}
                    </p>
                  </CardContent>
                </Card>
              )
            })}

            {/* 태그 */}
            <Card>
              <CardHeader>
                <CardTitle>태그</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {connectedTags.length > 0 ? (
                    connectedTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-primary"
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => disconnectMutation.mutate(tag.id)}
                          disabled={tagBusy}
                          className="rounded-full p-0.5 transition-colors hover:bg-primary/20 disabled:opacity-50"
                          aria-label={`${tag.name} 태그 제거`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      연결된 태그가 없습니다
                    </span>
                  )}
                </div>

                {availableTags.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">기존 태그</span>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map((tag) => (
                        <Button
                          key={tag.id}
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => connectMutation.mutate(tag.id)}
                          disabled={tagBusy}
                        >
                          {tag.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleAddTag} className="flex gap-2">
                  <Input
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="새 태그 입력 후 추가"
                    disabled={tagBusy}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={tagBusy || !tagName.trim()}
                  >
                    <Plus />
                    추가
                  </Button>
                </form>

                {tagError && (
                  <p className="text-sm text-destructive" role="alert">
                    {tagError}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>기록을 삭제할까요?</DialogTitle>
            <DialogDescription>
              이 분석 기록이 목록에서 사라집니다. 되돌릴 수 없습니다.
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
              onClick={() => setConfirmOpen(false)}
              disabled={deleteMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
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
