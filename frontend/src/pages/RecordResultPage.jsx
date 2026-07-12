import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, LogOut } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SECTIONS = [
  { type: 'summary', title: '① 문서 전체 요약' },
  { type: 'risk', title: '② 주의해야 할 리스크 포인트' },
  { type: 'mail_draft', title: '③ 메일 초안' },
]

export default function RecordResultPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const { data: record, isLoading, isError, error } = useQuery({
    queryKey: ['record', id],
    queryFn: async () => (await api.get(`/api/records/${id}`)).data,
    // processing 중이면 2초 간격 폴링, done/failed면 중단
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 2000 : false,
  })

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
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={handleBack}
        >
          <ArrowLeft />
          업체 상세
        </Button>

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
          SECTIONS.map((section) => {
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
          })
        ) : null}
      </main>
    </div>
  )
}
