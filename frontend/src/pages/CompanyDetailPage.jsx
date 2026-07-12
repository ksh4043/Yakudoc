import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LogOut, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const LANGUAGES = [
  { value: 'en', label: '영문' },
  { value: 'ja', label: '일문' },
]

const INPUT_TYPES = [
  { value: 'text', label: '텍스트' },
  { value: 'file', label: '파일' },
  { value: 'image', label: '이미지' },
]

const STATUS_LABEL = {
  processing: '분석 중',
  done: '완료',
  failed: '실패',
}

const STATUS_CLASS = {
  processing: 'bg-muted text-muted-foreground',
  done: 'bg-primary/10 text-primary',
  failed: 'bg-destructive/10 text-destructive',
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export default function CompanyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()

  const [language, setLanguage] = useState('en')
  const [inputType, setInputType] = useState('text')
  const [content, setContent] = useState('')
  const [file, setFile] = useState(null)
  const [formError, setFormError] = useState(null)
  const [pollingId, setPollingId] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const companyQuery = useQuery({
    queryKey: ['company', id],
    queryFn: async () => (await api.get(`/api/companies/${id}`)).data,
  })

  const recordsQuery = useQuery({
    queryKey: ['companies', id, 'records'],
    queryFn: async () =>
      (await api.get(`/api/companies/${id}/records`)).data.records,
  })

  // 분석 요청 후 status가 done/failed가 될 때까지 2초 간격 폴링
  const pollingQuery = useQuery({
    queryKey: ['record', pollingId],
    queryFn: async () => (await api.get(`/api/records/${pollingId}`)).data,
    enabled: !!pollingId,
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 2000 : false,
  })

  useEffect(() => {
    const record = pollingQuery.data
    if (!record) return
    if (record.status === 'done' || record.status === 'failed') {
      setPollingId(null)
      queryClient.invalidateQueries({ queryKey: ['companies', id, 'records'] })
      navigate(`/records/${record.id}`)
    }
  }, [pollingQuery.data, id, navigate, queryClient])

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('input_type', inputType)
      fd.append('language', language)
      if (inputType === 'text') {
        fd.append('content', content.trim())
      } else {
        fd.append('file', file)
      }
      const { data } = await api.post(`/api/companies/${id}/records`, fd)
      return data
    },
    onSuccess: (data) => {
      setContent('')
      setFile(null)
      setFormError(null)
      queryClient.invalidateQueries({ queryKey: ['companies', id, 'records'] })
      setPollingId(data.record_id)
    },
    onError: (err) => {
      setFormError(err.response?.data?.error ?? '분석 요청에 실패했습니다')
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (recordIds) =>
      api.post('/api/records/bulk-delete', { record_ids: recordIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', id, 'records'] })
      exitSelection()
      setConfirmOpen(false)
    },
    onError: (err) => {
      setDeleteError(err.response?.data?.error ?? '삭제에 실패했습니다')
    },
  })

  const isProcessing = createMutation.isPending || !!pollingId

  function exitSelection() {
    setSelectionMode(false)
    setSelectedIds([])
  }

  function toggleSelect(recordId) {
    setSelectedIds((prev) =>
      prev.includes(recordId)
        ? prev.filter((x) => x !== recordId)
        : [...prev, recordId],
    )
  }

  function handleRecordClick(record) {
    if (selectionMode) {
      toggleSelect(record.id)
    } else {
      navigate(`/records/${record.id}`)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (inputType === 'text' && !content.trim()) {
      setFormError('분석할 텍스트를 입력하세요')
      return
    }
    if (inputType !== 'text' && !file) {
      setFormError('분석할 파일을 선택하세요')
      return
    }
    createMutation.mutate()
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const company = companyQuery.data

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

        {/* 업체 정보 */}
        {companyQuery.isLoading && (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        )}
        {companyQuery.isError && (
          <p className="text-sm text-destructive">
            업체 정보를 불러오지 못했습니다
          </p>
        )}
        {company && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{company.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex gap-6">
                <span className="text-muted-foreground">업종</span>
                <span>{company.industry}</span>
              </div>
              <div className="flex gap-6">
                <span className="text-muted-foreground">국가</span>
                <span>{company.country}</span>
              </div>
              {company.memo && (
                <div className="flex gap-6">
                  <span className="text-muted-foreground">메모</span>
                  <span className="whitespace-pre-wrap">{company.memo}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 문서 분석 요청 */}
        <Card>
          <CardHeader>
            <CardTitle>문서 분석 요청</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>회신 메일 언어</Label>
                <div className="flex gap-2">
                  {LANGUAGES.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={language === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLanguage(opt.value)}
                      disabled={isProcessing}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>입력 타입</Label>
                <div className="flex gap-2">
                  {INPUT_TYPES.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={inputType === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setInputType(opt.value)
                        setFormError(null)
                      }}
                      disabled={isProcessing}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {inputType === 'text' ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content">문서 내용</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="계약서 텍스트나 메일 본문을 붙여넣으세요"
                    className="min-h-40"
                    disabled={isProcessing}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="file">
                    {inputType === 'image' ? '이미지 파일' : '문서 파일'}
                  </Label>
                  <Input
                    id="file"
                    type="file"
                    accept={inputType === 'image' ? 'image/*' : '.doc,.docx,.pdf'}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={isProcessing}
                  />
                </div>
              )}

              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}

              <Button type="submit" disabled={isProcessing} className="self-start">
                {isProcessing ? '분석 중…' : '분석 요청'}
              </Button>

              {isProcessing && (
                <p className="text-sm text-muted-foreground">
                  분석이 진행 중입니다. 완료되면 결과 화면으로 이동합니다…
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* 기록 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>분석 기록</CardTitle>
              {recordsQuery.data?.length > 0 &&
                (selectionMode ? (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null)
                        setConfirmOpen(true)
                      }}
                      disabled={
                        selectedIds.length === 0 || bulkDeleteMutation.isPending
                      }
                    >
                      선택 삭제
                      {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exitSelection}
                      disabled={bulkDeleteMutation.isPending}
                    >
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionMode(true)}
                  >
                    <Trash2 />
                    삭제하기
                  </Button>
                ))}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recordsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            )}
            {recordsQuery.isError && (
              <p className="text-sm text-destructive">
                기록을 불러오지 못했습니다
              </p>
            )}
            {recordsQuery.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                분석 기록이 없습니다
              </p>
            )}
            {recordsQuery.data?.map((record) => {
              const selected = selectedIds.includes(record.id)
              return (
                <div
                  key={record.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRecordClick(record)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleRecordClick(record)
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      tabIndex={-1}
                      className="pointer-events-none size-4 accent-primary"
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">
                          {formatDate(record.created_at)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {record.language === 'ja' ? '일문' : '영문'}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[record.status] ?? ''}`}
                      >
                        {STATUS_LABEL[record.status] ?? record.status}
                      </span>
                    </div>
                    {record.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {record.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!bulkDeleteMutation.isPending) setConfirmOpen(next)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>선택한 기록을 삭제할까요?</DialogTitle>
            <DialogDescription>
              선택한 {selectedIds.length}건이 목록에서 사라집니다. 되돌릴 수
              없습니다.
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
              disabled={bulkDeleteMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? '삭제 중…' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
