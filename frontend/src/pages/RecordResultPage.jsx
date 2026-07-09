import { useParams } from 'react-router-dom'

export default function RecordResultPage() {
  const { id } = useParams()

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">결과 화면 ({id})</h1>
    </div>
  )
}
