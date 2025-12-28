
import React from 'react';

interface HeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ sidebarOpen, setSidebarOpen }) => {
    return (
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark px-8 shrink-0 z-10">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
                    <span className="hover:text-primary cursor-pointer">Admin</span>
                    <span>/</span>
                    <span className="text-primary">Visão Geral</span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <span className="material-symbols-outlined">notifications</span>
                    <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-red-500 border-2 border-white dark:border-surface-dark"></span>
                </button>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
                <button className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">help</span>
                    <span>Ajuda</span>
                </button>
            </div>
        </header>
    );
};
