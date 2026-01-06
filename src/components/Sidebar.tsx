
import React from 'react';
import { NavLink } from 'react-router-dom';
import { User } from '../types';

interface SidebarProps {
    isOpen: boolean;
    user: User;
    onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, user, onLogout }) => {
    // Map path to permission id
    const getPermissionId = (path: string) => {
        const map: Record<string, string> = {
            '/dashboard': 'dashboard',
            '/schools': 'schools',
            '/staff': 'staff',
            '/students': 'students',
            '/allotment': 'allotment',
            '/reports': 'reports', // Assume reports access
            '/access': 'admin',
            '/system': 'admin'
        };
        return map[path];
    };

    const hasPermission = (path: string) => {
        // Normaliza o papel do usuário para minúsculas para comparação segura
        const userRole = user.role?.toLowerCase() || '';

        // Permite acesso total se for admin em qualquer variação ou tiver permissão explicita
        const isAdmin = userRole === 'admin' ||
            userRole === 'superadmin' ||
            userRole === 'gestor' || // Adicionado por segurança
            user.permissions?.includes('admin');

        if (isAdmin) return true;

        if (!user.permissions || user.permissions.length === 0) {
            // Se não houver permissões definidas, e não for admin, 
            // no momento bloqueia tudo. 
            // TODO: Definir comportamento padrão para usuários sem role/perm
            return false;
        }

        const id = getPermissionId(path);

        if (path === '/reports') return true;

        return id ? user.permissions.includes(id) : true;
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { path: '/schools', label: 'Escolas', icon: 'school' },
        { path: '/staff', label: 'Profissionais', icon: 'badge' },
        { path: '/students', label: 'Estudantes', icon: 'accessibility_new' },
        { path: '/allotment', label: 'Lotação', icon: 'location_on' },
        { path: '/reports', label: 'Relatórios', icon: 'description' },
    ]; // .filter(item => hasPermission(item.path));

    const configItems = [
        { path: '/access', label: 'Acesso & Permissões', icon: 'settings_accessibility' },
        { path: '/system', label: 'Sistema', icon: 'settings' },
    ]; // .filter(item => hasPermission(item.path));

    return (
        <aside className={`flex flex-col bg-primary text-white transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
            <div className="flex h-16 items-center px-6 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded bg-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white">school</span>
                    </div>
                    {isOpen && <h1 className="text-xl font-bold tracking-tight">EducaLota</h1>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 no-scrollbar">
                <nav className="flex flex-col gap-1 px-3">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors group ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                                }`
                            }
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                        </NavLink>
                    ))}

                    <div className="my-2 border-t border-white/10"></div>
                    {isOpen && (
                        <div className="px-3 py-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">Configurações</span>
                        </div>
                    )}

                    {configItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors group ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                                }`
                            }
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="p-4 border-t border-white/10 shrink-0">
                <div className={`flex items-center gap-3 rounded-lg bg-white/10 p-2 ${!isOpen && 'justify-center'}`}>
                    <img src={user.avatar} alt={user.name} className="size-10 rounded-full object-cover shrink-0" />
                    {isOpen && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="truncate text-sm font-medium">{user.name}</span>
                            <span className="truncate text-xs text-blue-200">{user.email}</span>
                        </div>
                    )}
                </div>
                <button
                    onClick={onLogout}
                    className="mt-2 flex w-full items-center gap-3 px-3 py-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <span className="material-symbols-outlined">logout</span>
                    {isOpen && <span className="text-sm font-medium">Sair</span>}
                </button>
            </div>
        </aside>
    );
};
