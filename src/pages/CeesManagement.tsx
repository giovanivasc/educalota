import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { EvaluationRequest } from '../types';

export default function CeesManagement() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

    // Action states
    const [actionType, setActionType] = useState<'NONE' | 'RETURN' | 'SCHEDULE'>('NONE');
    const [returnReason, setReturnReason] = useState('');
    const [evaluationDate, setEvaluationDate] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // Filtrando para mostrar apenas os pendentes ou agendados, do mais antigo para o mais recente.
            const { data, error } = await supabase
                .from('evaluation_requests')
                .select('*, schools(name)')
                .in('status', ['PENDING_CEES', 'SCHEDULED'])
                .order('created_at', { ascending: true });

            if (error) throw error;
            setRequests(data || []);
        } catch (err) {
            console.error('Erro ao buscar solicitações:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleReturn = async () => {
        if (!returnReason.trim()) {
            return alert("Preencha o motivo da devolução.");
        }

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'RETURNED',
                    return_reason: returnReason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            alert('Solicitação devolvida para correção.');
            closeModal();
            fetchRequests();
        } catch (err) {
            console.error(err);
            alert('Erro ao devolver solicitação.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSchedule = async () => {
        if (!evaluationDate) {
            return alert("Preencha a data e hora do agendamento.");
        }

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'SCHEDULED',
                    evaluation_date: evaluationDate,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            alert('Avaliação agendada com sucesso.');
            closeModal();
            fetchRequests();
        } catch (err) {
            console.error(err);
            alert('Erro ao agendar avaliação.');
        } finally {
            setActionLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setActionType('NONE');
        setReturnReason('');
        setEvaluationDate('');
    };

    return (
        <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Centro de Comando CEES</h1>
                <p className="text-slate-500 dark:text-slate-400">Gestão e agendamento de avaliações multiprofissionais.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <span className="material-symbols-outlined text-primary">pending_actions</span>
                        Solicitações Pendentes e Agendadas
                    </h2>
                    <Button variant="ghost" icon="refresh" onClick={fetchRequests} isLoading={loading}>
                        Atualizar
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Protocolo</th>
                                <th className="px-6 py-4">Escola</th>
                                <th className="px-6 py-4">Aluno</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading && requests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-primary">sync</span>
                                        <p>Carregando solicitações...</p>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        Nenhuma solicitação encontrada no momento.
                                    </td>
                                </tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{req.protocol_number}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{req.schools?.name || 'Escola não vinculada'}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{req.student_name}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-500 uppercase">{req.request_type}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${req.status === 'PENDING_CEES' ? 'bg-blue-100 text-blue-700' :
                                                req.status === 'SCHEDULED' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                {req.status === 'PENDING_CEES' ? 'Aguardando Análise' :
                                                    req.status === 'SCHEDULED' ? 'Agendado' : req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button size="sm" variant="secondary" onClick={() => setSelectedRequest(req)}>
                                                Analisar
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {
                selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                    <span className="material-symbols-outlined text-primary">assignment_ind</span>
                                    Análise de Solicitação: {selectedRequest.protocol_number}
                                </h2>
                                <button onClick={closeModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-slate-500">close</span>
                                </button>
                            </div>

                            {/* Modal Body - Scrollable */}
                            <div className="p-6 overflow-y-auto space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Info Aluno */}
                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">Informações do Aluno</h3>
                                        <p className="text-sm"><span className="text-slate-500">Nome:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.student_name}</strong></p>
                                        <p className="text-sm"><span className="text-slate-500">Data Nasc.:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.student_birth_date}</strong></p>
                                        {selectedRequest.student_level && <p className="text-sm"><span className="text-slate-500">Etapa:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.student_level}</strong></p>}
                                        {selectedRequest.student_year_stage && <p className="text-sm"><span className="text-slate-500">Ano/Série:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.student_year_stage} - {selectedRequest.student_class} ({selectedRequest.student_shift})</strong></p>}
                                    </div>

                                    {/* Info Escola/Responsável */}
                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">Escola & Responsável</h3>
                                        <p className="text-sm"><span className="text-slate-500">Escola:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.schools?.name || 'N/A'}</strong></p>
                                        <p className="text-sm"><span className="text-slate-500">Tipo de Pedido:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.request_type}</strong></p>
                                        <p className="text-sm"><span className="text-slate-500">Resp. Legal:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.responsible_name}</strong></p>
                                        <p className="text-sm"><span className="text-slate-500">Tel. Resp.:</span> <strong className="text-slate-700 dark:text-slate-300">{selectedRequest.responsible_phone}</strong></p>
                                    </div>
                                </div>

                                {/* Observações */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Questionário e Observações:</h3>

                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Pedagógicas</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{selectedRequest.pedagogical_observations}</p>
                                    </div>

                                    <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">Relacionais/Comportamentais</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{selectedRequest.relational_observations}</p>
                                    </div>

                                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                        <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-1">Metodológicas (Acessibilidade)</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{selectedRequest.methodological_observations}</p>
                                    </div>
                                </div>

                                {/* Documento */}
                                <div className="py-2">
                                    <a
                                        href={selectedRequest.authorization_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors w-full sm:w-auto"
                                    >
                                        <span className="material-symbols-outlined text-primary">description</span>
                                        Visualizar Termo de Autorização Assinado
                                        <span className="material-symbols-outlined text-slate-400 text-sm ml-auto">open_in_new</span>
                                    </a>
                                </div>

                                {/* Área de Ações CEES */}
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Ações da CEES</h3>

                                    {actionType === 'NONE' ? (
                                        <div className="flex flex-wrap gap-3">
                                            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20" icon="assignment_return" onClick={() => setActionType('RETURN')}>
                                                Devolver para Correção
                                            </Button>
                                            <Button variant="primary" className="bg-purple-600 hover:bg-purple-700" icon="event" onClick={() => setActionType('SCHEDULE')}>
                                                Agendar Avaliação
                                            </Button>
                                        </div>
                                    ) : actionType === 'RETURN' ? (
                                        <div className="space-y-4 bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 animate-in slide-in-from-top-2">
                                            <label className="flex flex-col gap-2">
                                                <span className="text-sm font-bold text-red-800 dark:text-red-400">Motivo da Devolução *</span>
                                                <textarea
                                                    value={returnReason}
                                                    onChange={e => setReturnReason(e.target.value)}
                                                    placeholder="Ex: Documento de autorização ilegível. Favor reenviar com melhor resolução."
                                                    rows={3}
                                                    className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                                                />
                                            </label>
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setActionType('NONE')}>Cancelar</Button>
                                                <Button className="bg-red-600 hover:bg-red-700" icon="send" onClick={handleReturn} isLoading={actionLoading}>Confirmar Devolução</Button>
                                            </div>
                                        </div>
                                    ) : actionType === 'SCHEDULE' ? (
                                        <div className="space-y-4 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 animate-in slide-in-from-top-2">
                                            <label className="flex flex-col gap-2">
                                                <span className="text-sm font-bold text-purple-800 dark:text-purple-400">Data e Hora Sugerida *</span>
                                                <input
                                                    type="datetime-local"
                                                    value={evaluationDate}
                                                    onChange={e => setEvaluationDate(e.target.value)}
                                                    className="px-4 h-11 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-purple-500/20"
                                                />
                                            </label>
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" className="text-purple-600 dark:text-purple-400" onClick={() => setActionType('NONE')}>Cancelar</Button>
                                                <Button className="bg-purple-600 hover:bg-purple-700" icon="check_circle" onClick={handleSchedule} isLoading={actionLoading}>Confirmar Agendamento</Button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
