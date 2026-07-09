import { useParams } from 'react-router-dom'

export default function CompanyDetailPage() {
  const { id } = useParams()

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">업체 상세 ({id})</h1>
    </div>
  )
}
