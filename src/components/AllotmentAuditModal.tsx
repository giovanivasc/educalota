import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';

interface AuditError {
    id: string; // id da lotacao ou staff (pra key do react e navegacao)
    staffName: string;
    schoolName: string;
    type: 'Órfão' | 'Carga Horária';
    description: string;
    staffId: string;
}

interface AllotmentAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFix: (staffId: string) => void;
}

export const AllotmentAuditModal: React.FC<AllotmentAuditModalProps> = ({ isOpen, onClose, onFix }) => {
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<AuditError[]>([]);
    const [hasRun, setHasRun] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setErrors([]);
            setHasRun(false);
        }
    }, [isOpen]);

    const runAudit = async () => {
        setLoading(true);
        setErrors([]);

        try {
            // Pegar todos os staffs
            const { data: staffsData, error: staffErr } = await supabase.from('staff').select('id, name, hours_total');
            if (staffErr) throw staffErr;

            // Paginacao para pegar TODAS lotações ativas e seus relacoes
            let allAllotments: any[] = [];
            let hasMore = true;
            let from = 0;
            const limit = 1000;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('allotments')
                    .select(`
                        id,
                        staff_id,
                        class_id,
                        staff_name,
                        school_id,
                        staff_role,
                        schools ( name ),
                        classes ( id, shift )
                    `)
                    .eq('status', 'Ativo')
                    .range(from, from + limit - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allAllotments = [...allAllotments, ...data];
                    if (data.length < limit) hasMore = false;
                    else from += limit;
                } else {
                    hasMore = false;
                }
            }

            const foundErrors: AuditError[] = [];

            // Agrupando horas por servidor e checando orfãos
            const staffHoursSum: Record<string, number> = {};

            allAllotments.forEach(a => {
                const schoolName = a.schools?.name || 'Escola não vinculada';
                const staffId = a.staff_id;

                // Checagem Erro Tipo 1: Cadastro Órfão
                if (!a.class_id || !a.classes) {
                    foundErrors.push({
                        id: a.id,
                        staffName: a.staff_name || 'Desconhecido',
                        schoolName,
                        type: 'Órfão',
                        description: 'Lotação ativa com vínculo perdido (Turma ou Turno inexistente/deletado).',
                        staffId
                    });
                }

                // Somatorio de horas para o Erro 2
                if (staffId) {
                    let hours = 0;
                    if (a.staff_role && a.staff_role.includes(' - ')) {
                        const hStr = a.staff_role.split(' - ')[1].replace('h', '').trim();
                        hours = parseInt(hStr, 10) || 0;
                    } else if (staffsData) {
                        const stf = staffsData.find(s => s.id === staffId);
                        if (stf) hours = stf.hours_total;
                    }
                    staffHoursSum[staffId] = (staffHoursSum[staffId] || 0) + hours;
                }
            });

            // Checagem Erro Tipo 2: Diferença de Carga Horária
            if (staffsData) {
                staffsData.forEach(stf => {
                    const sum = staffHoursSum[stf.id] || 0;
                    if (sum > 0 && sum !== stf.hours_total) {
                        foundErrors.push({
                            id: `hr-${stf.id}`,
                            staffName: stf.name,
                            schoolName: '-',
                            type: 'Carga Horária',
                            description: `Divergência: Servidor tem ${stf.hours_total}h base, mas a soma de suas lotações ativas está em ${sum}h.`,
                            staffId: stf.id
                        });
                    }
                });
            }

            setErrors(foundErrors);
            setHasRun(true);

        } catch (error) {
            console.error('Erro na auditoria:', error);
            alert('Falha ao processar a auditoria.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined font-bold">stethoscope</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Auditoria de Lotações</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <p className="text-sm text-slate-500 max-w-2xl">
                            Esta ferramenta varre o banco de dados e analisa as lotações ativas à procura de inconsistências que afetam exportações e cálculos de Carga Horária.
                        </p>
                        <Button onClick={runAudit} isLoading={loading} disabled={loading} className="shrink-0 px-6">
                            Executar Varredura
                        </Button>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-500">
                            <span className="material-symbols-outlined animate-spin text-4xl">sync</span>
                            <p className="font-medium animate-pulse">Analisando milhares de registros e cruzamentos...</p>
                        </div>
                    ) : hasRun ? (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300">
                                    Resultados da Verificação
                                </h4>
                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${errors.length > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'}`}>
                                    {errors.length} erro(s) encontrado(s)
                                </span>
                            </div>

                            {errors.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-[100vw] shadow-sm rounded-lg">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-4 py-3">Servidor</th>
                                                <th className="px-4 py-3">Escola / Relacionamento</th>
                                                <th className="px-4 py-3">Problema Identificado</th>
                                                <th className="px-4 py-3 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {errors.map(err => (
                                                <tr key={err.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-3 border-l-4 border-l-red-500">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight">{err.staffName}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{err.schoolName}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 mb-1 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 uppercase">
                                                            {err.type}
                                                        </span>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{err.description}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Button
                                                            variant="outline"
                                                            className="h-8 text-xs px-3"
                                                            onClick={() => {
                                                                onClose();
                                                                onFix(err.staffId);
                                                            }}
                                                        >
                                                            Corrigir
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-800/40 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-green-800 dark:text-green-400">Banco de Dados Saudável</h3>
                                        <p className="text-green-600 dark:text-green-500 text-sm mt-1 max-w-sm">
                                            Nenhuma inconsistência relacional ou divergência de carga horária foi encontrada nas lotações ativas.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center">
                            <span className="material-symbols-outlined text-6xl mb-4">analytics</span>
                            <p className="text-sm font-medium">Aguardando comando para iniciar varredura.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
