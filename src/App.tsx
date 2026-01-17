
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
// import { MOCK_USER } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import StaffPage from './pages/Staff';
import Allotment from './pages/Allotment';
import Access from './pages/Access';
import Login from './pages/Login';
import Students from './pages/Students';
import Reports from './pages/Reports';

const ProtectedRoute = () => {
  const { session, loading } = useAuth();

  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
};

const AppRoutes = () => {
  const { user } = useAuth();
  // Use real user data if available, otherwise fallback to mock (or partial real data)
  // Note: MOCK_USER has extra fields like 'role', 'avatar'. 
  // Supabase user metadata can store these. For now we might mix them.
  const currentUser = user ? {
    id: user.id,
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
    email: user.email || '',
    role: user.user_metadata?.role || 'Admin', // Default role for now
    permissions: user.user_metadata?.permissions || [],
    avatar: user.user_metadata?.avatar_url || 'https://i.pravatar.cc/150?u=' + user.id
  } : {
    id: 'guest',
    name: 'Convidado',
    email: 'guest@educalota.com',
    role: 'Visitante',
    avatar: ''
  };

  return (
    <Routes>
      {/* Rota inicial redireciona para o login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Rota de Login sem o Layout */}
      <Route path="/login" element={<Login />} />

      {/* Rotas protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={
          <Layout user={currentUser}>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="schools" element={<Schools />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="allotment" element={<Allotment />} />
              <Route path="students" element={<Students />} />
              <Route path="reports" element={<Reports />} />
              <Route path="access" element={<Access />} />
              <Route path="system" element={<div className="p-8 text-center text-slate-500">Configurações do Sistema (Em desenvolvimento)</div>} />
              {/* Catch-all dentro do app redireciona para dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        } />
      </Route>
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
