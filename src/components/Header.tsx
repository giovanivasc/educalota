import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CalendarDays, Bell, X, Check, ExternalLink } from 'lucide-react';

interface HeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ sidebarOpen, setSidebarOpen, isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user?.id,
        refetchInterval: 30000 // Refresh every 30s
    });

    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    const markAsRead = async (notification: any) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notification.id);
            if (error) throw error;
            
            queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
            
            if (notification.link) {
                navigate(notification.link);
                setIsNotificationsOpen(false);
            }
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    return (
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark px-4 sm:px-8 shrink-0 z-40 w-full relative">
            <div className="flex items-center gap-2 sm:gap-4">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="hidden md:block p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
                    <span className="hover:text-primary cursor-pointer" onClick={() => navigate('/dashboard')}>EducaLota</span>
                    <span>/</span>
                    <span className="text-primary">Visão Geral</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
                {/* Botão Calendário */}
                <button 
                  onClick={() => navigate('/calendario-cees')}
                  className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Calendário da Equipe"
                >
                    <CalendarDays className="w-5 h-5" />
                </button>

                {/* Botão Notificações */}
                <div className="relative">
                    <button 
                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                        className={`relative rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isNotificationsOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white dark:border-surface-dark animate-in zoom-in">
                                {unreadCount > 9 ? '+9' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Dropdown de Notificações */}
                    {isNotificationsOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 overflow-hidden z-50">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Notificações</h3>
                                <button onClick={() => setIsNotificationsOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
                            </div>
                            <div className="max-h-96 overflow-y-auto no-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500">Nenhuma notificação por aqui.</p>
                                    </div>
                                ) : (
                                    notifications.map((n: any) => (
                                        <button 
                                            key={n.id}
                                            onClick={() => markAsRead(n)}
                                            className={`w-full p-4 text-left border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex gap-3 group ${!n.is_read ? 'bg-primary/5' : ''}`}
                                        >
                                            <div className={`mt-1 size-2 rounded-full shrink-0 ${!n.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                                            <div className="flex-1 space-y-1">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className={`text-xs font-bold leading-tight ${!n.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{n.title}</p>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(n.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                                                {n.link && (
                                                    <span className="text-[10px] text-primary font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Ver detalhes <ExternalLink className="w-3 h-3" />
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                            {notifications.length > 0 && unreadCount > 0 && (
                                <button 
                                    className="w-full py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                    onClick={async () => {
                                        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
                                        queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
                                    }}
                                >
                                    Marcar todas como lidas
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors pr-2">
                    <span className="material-symbols-outlined text-xl">help</span>
                    <span className="hidden sm:inline">Ajuda</span>
                </button>
            </div>
        </header>
    );
};
