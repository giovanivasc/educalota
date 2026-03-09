import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { generateRhExcel } from '../lib/reports';

interface RhReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RhReportModal: React.FC<RhReportModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [vinculoFilter, setVinculoFilter] = useState('');

    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [availableVinculos, setAvailableVinculos] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchFilters();
            // Reset filters when opening
            setStartDate('');
            setEndDate('');
            setRoleFilter('');
            setVinculoFilter('');
        }
    }, [isOpen]);

    const fetchFilters = async () => {
        try {
            // Get unique roles and vinculos
            const { data: staffData } = await supabase.from('staff').select('role, contract_type').range(0, 4999);
            if (staffData) {
                const roles = Array.from(new Set(staffData.map(s => s.role).filter(Boolean)));
                const vinculos = Array.from(new Set(staffData.map(s => s.contract_type).filter(Boolean)));

                // Also get roles from allocations to be safe
                const { data: allocations } = await supabase.from('allotments').select('staff_role').range(0, 4999);
                if (allocations) {
                    allocations.forEach(a => {
                        if (a.staff_role) {
                            const r = a.staff_role.split(' - ')[0];
                            if (r && !roles.includes(r)) roles.push(r);
                        }
                    });
                }

                setAvailableRoles(roles.sort());
                setAvailableVinculos(vinculos.sort());
            }
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        await generateRhExcel({ startDate, endDate, role: roleFilter, contract_type: vinculoFilter });
        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">Relatório RH</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-500 mb-4">
                        Gera uma planilha XLSX contendo todos os servidores com suas respectivas lotações, listados linha a linha.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Data de lotação (Início)</label>
                            <input
                                type="date"
                                title="Data de Lotação (Início)"
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none text-sm"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Data de lotação (Fim)</label>
                            <input
                                type="date"
                                title="Data de Lotação (Fim)"
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none text-sm"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Cargo/Função</label>
                        <select
                            title="Filtrar por Cargo/Função"
                            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none text-sm"
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Vínculo</label>
                        <select
                            title="Filtrar por Vínculo"
                            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none text-sm"
                            value={vinculoFilter}
                            onChange={e => setVinculoFilter(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {availableVinculos.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>

                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleExport} disabled={loading} isLoading={loading} icon="download">
                        Exportar para Excel (XLSX)
                    </Button>
                </div>
            </div>
        </div>
    );
};
