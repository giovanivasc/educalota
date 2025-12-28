import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
}

const Layout: React.FC<LayoutProps> = ({ children, user }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar
        isOpen={isSidebarOpen}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header
          sidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth no-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
