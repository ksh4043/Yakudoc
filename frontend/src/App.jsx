import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute, ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import CompanyListPage from '@/pages/CompanyListPage'
import CompanyDetailPage from '@/pages/CompanyDetailPage'
import RecordResultPage from '@/pages/RecordResultPage'
import AdminUsersPage from '@/pages/AdminUsersPage'
import TeamManagementPage from '@/pages/TeamManagementPage'
import AssignmentBoardPage from '@/pages/AssignmentBoardPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<CompanyListPage />} />
        <Route path="/companies/:id" element={<CompanyDetailPage />} />
        <Route path="/records/:id" element={<RecordResultPage />} />
        <Route path="/teams/:id/board" element={<AssignmentBoardPage />} />

        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/teams" element={<TeamManagementPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
