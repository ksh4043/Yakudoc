import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute, ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import CompanyListPage from '@/pages/CompanyListPage'
import CompanyDetailPage from '@/pages/CompanyDetailPage'
import RecordResultPage from '@/pages/RecordResultPage'
import AdminUsersPage from '@/pages/AdminUsersPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<CompanyListPage />} />
        <Route path="/companies/:id" element={<CompanyDetailPage />} />
        <Route path="/records/:id" element={<RecordResultPage />} />

        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
