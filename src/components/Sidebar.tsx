
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ClipboardCheck, ChevronDown, ChevronRight, Inbox, UserCheck, Calendar } from 'lucide-react';
import { User } from '../types';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import dashboardIcon from '../assets/icons/dashboard-icon.png';

import schoolsIcon from '../assets/icons/schools-icon.png';
import staffIcon from '../assets/icons/staff-icon.png';
import studentsIcon from '../assets/icons/students-icon.png';
import reportsIcon from '../assets/icons/reports-icon.png';
import allotmentIcon from '../assets/icons/allotment-icon.png';


interface SidebarProps {
    isOpen: boolean;
    isMobileOpen?: boolean;
    onMobileClose?: () => void;
    user: User;
    onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, isMobileOpen, onMobileClose, user, onLogout }) => {
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isAvaliacoesOpen, setIsAvaliacoesOpen] = useState(false);

    // Map path to permission id

    const getPermissionId = (path: string) => {
        const map: Record<string, string> = {
            '/dashboard': 'dashboard',
            '/schools': 'schools',
            '/staff': 'staff',
            '/students': 'students',
            '/allotment': 'allotment',
            '/reports': 'reports', // Assume reports access
            '/gestao-cees': 'cees', // Acesso para CEES
            '/assessor': 'assessor', // Meu painel
            '/calendario-cees': 'cees', // Mesmo acesso da Gestão
            '/consulta-equipe': 'consulta', // Consulta Equipe Pública Local
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
        if (userRole === 'assessor' && (path === '/assessor' || path === '/dashboard')) return true;

        if (!user.permissions || user.permissions.length === 0) {
            // Se não houver permissões definidas, e não for admin, 
            // no momento bloqueia tudo. 
            // TODO: Definir comportamento padrão para usuários sem role/perm
            return false;
        }

        const id = getPermissionId(path);

        return id ? user.permissions.includes(id) : true;
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: dashboardIcon, isImage: true },
        { path: '/consulta-equipe', label: 'Consulta Equipe', icon: 'search', isImage: false, isLucide: false },
        { path: '/schools', label: 'Escolas', icon: schoolsIcon, isImage: true },
        { path: '/staff', label: 'Profissionais', icon: staffIcon, isImage: true },
        { path: '/students', label: 'Estudantes', icon: studentsIcon, isImage: true },
        { path: '/allotment', label: 'Lotação', icon: allotmentIcon, isImage: true },
        { path: '/reports', label: 'Relatórios', icon: reportsIcon, isImage: true },
    ].filter(item => hasPermission(item.path));

    const configItems = [
        { path: '/access', label: 'Acesso & Permissões', icon: 'settings_accessibility' },
        { path: '/system', label: 'Sistema', icon: 'settings' },
    ].filter(item => hasPermission(item.path));

    return (
        <>
            {/* Mobile Backdrop */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onMobileClose}
                />
            )}
            <aside className={`fixed inset-y-0 left-0 z-50 md:relative flex flex-col bg-primary text-white transition-transform duration-300 md:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} ${isOpen ? 'w-64' : 'w-20'}`}>
                <div className="flex h-16 items-center justify-between px-6 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded bg-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">school</span>
                        </div>
                        {(isOpen || isMobileOpen) && <h1 className="text-xl font-bold tracking-tight">EducaLota</h1>}
                    </div>
                    {isMobileOpen && (
                        <button onClick={onMobileClose} className="md:hidden p-1 rounded-lg text-white hover:bg-white/10">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
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
                            {/* @ts-ignore */}
                            {(item as any).isImage ? (
                                <img src={item.icon as string} alt={item.label} className="w-6 h-6 object-contain" />
                            ) : (item as any).isLucide ? (
                                React.createElement(item.icon, { className: "w-6 h-6" })
                            ) : (
                                <span className="material-symbols-outlined">{item.icon as string}</span>
                            )}
                            {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                        </NavLink>
                    ))}

                    {/* Avaliações CEES Menu Dropdown */}
                    {(hasPermission('/gestao-cees') || hasPermission('/assessor')) && (
                        <>
                            <button
                                onClick={() => setIsAvaliacoesOpen(!isAvaliacoesOpen)}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors text-blue-100 hover:bg-white/10 hover:text-white group w-full text-left"
                            >
                                <ClipboardCheck className="w-6 h-6 shrink-0" />
                                {isOpen && (
                                    <>
                                        <span className="text-sm font-medium flex-1">Avaliações CEES</span>
                                        {isAvaliacoesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </>
                                )}
                            </button>
                            
                            {isAvaliacoesOpen && isOpen && (
                                <div className="flex flex-col gap-1 pl-8 mb-2 animate-in slide-in-from-top-2">
                                    {hasPermission('/gestao-cees') && (
                                        <NavLink
                                            to="/gestao-cees"
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
                                            }
                                        >
                                            <Inbox className="w-4 h-4" />
                                            <span className="text-sm">Solicitações</span>
                                        </NavLink>
                                    )}
                                    {hasPermission('/gestao-cees') && (
                                        <NavLink
                                            to="/calendario-cees"
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
                                            }
                                        >
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-sm">Calendário</span>
                                        </NavLink>
                                    )}
                                    {hasPermission('/assessor') && (
                                        <NavLink
                                            to="/assessor"
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
                                            }
                                        >
                                            <UserCheck className="w-4 h-4" />
                                            <span className="text-sm">Minhas Avaliações</span>
                                        </NavLink>
                                    )}
                                </div>
                            )}
                        </>
                    )}

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
                            {/* @ts-ignore */}
                            {(item as any).isImage ? (
                                <img src={item.icon as string} alt={item.label} className="w-6 h-6 object-contain" />
                            ) : (item as any).isLucide ? (
                                React.createElement(item.icon as any, { className: "w-6 h-6" })
                            ) : (
                                <span className="material-symbols-outlined">{item.icon as string}</span>
                            )}
                            {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="p-4 border-t border-white/10 shrink-0">
                <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className={`flex items-center gap-3 rounded-lg bg-white/10 p-2 w-full text-left transition-colors hover:bg-white/20 ${!isOpen && 'justify-center'}`}
                >
                    <img src={user.avatar} alt={user.name} className="size-10 rounded-full object-cover shrink-0" />
                    {isOpen && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="truncate text-sm font-medium">{user.name}</span>
                            <span className="truncate text-xs text-blue-200">{user.email}</span>
                        </div>
                    )}
                </button>
                <button
                    onClick={onLogout}
                    className="mt-2 flex w-full items-center gap-3 px-3 py-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <span className="material-symbols-outlined">logout</span>
                    {isOpen && <span className="text-sm font-medium">Sair</span>}
                </button>
            </div>

            <ProfileSettingsModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                user={user}
                onUpdateUser={(updates) => {
                    // Update user logic here would normally update global context
                    // For now, we rely on the App wrapper or a reload to reflect global changes
                    // but the modal updates its own internal state or triggers a callback
                    console.log('User updated:', updates);
                    window.location.reload(); // Simple way to refresh user data from session
                }}
            />
        </aside>
        </>
    );
};
