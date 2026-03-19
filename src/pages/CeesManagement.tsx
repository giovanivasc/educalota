import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { EvaluationRequest } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function CeesManagement() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: requests = [] as any[], isLoading: loading, refetch: manualRefetch } = useQuery({
        queryKey: ['evaluation_requests', 'cees_management'],
        queryFn: fetchRequests
    });

    const { data: assessorsData = [] as any[] } = useQuery({
        queryKey: ['assessors'],
        queryFn: fetchAssessors
    });

    const { data: absences = [] as any[] } = useQuery({
        queryKey: ['cees_absences'],
        queryFn: async () => {
            const { data, error } = await supabase.from('cees_absences').select('*');
            if (error) throw error;
            return data || [];
        }
    });

    const getAbsence = (userId: string, dateStr: string) => {
        if (!userId || !dateStr) return null;
        const target = dateStr.split('T')[0]; // "YYYY-MM-DD"
        return absences.find(abs => 
            abs.user_id === userId && 
            target >= abs.start_date && 
            target <= abs.end_date
        );
    };

    // Modal state
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

    // Action states
    const [actionType, setActionType] = useState<'NONE' | 'RETURN' | 'SCHEDULE'>('NONE');
    const [returnReason, setReturnReason] = useState('');
    const [evaluationDate, setEvaluationDate] = useState('');
    const [assessorId, setAssessorId] = useState('');
    const [assessor2Id, setAssessor2Id] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [migrationLoading, setMigrationLoading] = useState(false);

    async function fetchRequests() {
        const { data, error } = await supabase
            .from('evaluation_requests')
            .select('*, schools(name), class_id')
            .in('status', ['PENDING_CEES', 'SCHEDULED', 'INCONCLUSIVE', 'RETURNED', 'COMPLETED'])
            .order('first_received_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async function fetchAssessors() {
        const { data, error } = await supabase.rpc('get_all_users');
        if (error) throw error;
        return (data || []).filter((u: any) => 
            u.role?.toUpperCase() === 'ASSESSOR' || 
            u.permissions?.includes('assessor') ||
            u.permissions?.includes('cees') || 
            u.role?.toUpperCase() === 'ADMIN' ||
            u.role?.toUpperCase() === 'COORDENADOR'
        );
    }

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
                    history: [
                        ...(selectedRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'DEVOLUÇÃO',
                            result: 'Pendente Correção',
                            description: `Devolvido para correção: ${returnReason}`,
                            actor: user?.user_metadata?.name || user?.email,
                            assessors: 'N/A'
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            alert('Solicitação devolvida para correção.');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            closeModal();
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
        if (!assessorId) {
            return alert("Selecione o assessor responsável.");
        }

        // Validação de Ausências
        const abs1 = getAbsence(assessorId, evaluationDate);
        if (abs1) {
            const name = assessorsData.find(a => a.id === assessorId)?.name || 'Assessor';
            return alert(`Erro: O assessor ${name} registrou ausência neste período (Motivo: ${abs1.reason}). Escolha outra data ou outro profissional.`);
        }

        if (assessor2Id) {
            const abs2 = getAbsence(assessor2Id, evaluationDate);
            if (abs2) {
                const name = assessorsData.find(a => a.id === assessor2Id)?.name || 'Assessor 2';
                return alert(`Erro: O assessor secundário ${name} registrou ausência neste período (Motivo: ${abs2.reason}). Escolha outra data ou outro profissional.`);
            }
        }

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'SCHEDULED',
                    evaluation_date: evaluationDate,
                    assessor_id: assessorId,
                    assessor_2_id: assessor2Id || null,
                    history: [
                        ...(selectedRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'AGENDAMENTO',
                            result: 'Agendado',
                            description: `Agendado para ${new Date(evaluationDate).toLocaleString()}`,
                            actor: user?.user_metadata?.name || user?.email,
                            assessors: `${assessorsData.find((a: any) => a.id === assessorId)?.name || 'Assessor 1'} ${assessor2Id ? ' e ' + (assessorsData.find((a: any) => a.id === assessor2Id)?.name || 'Assessor 2') : ''}`
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            alert('Avaliação agendada com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            
            // Disparar Notificações
            const notify = async (targetId: string) => {
                await supabase.from('notifications').insert({
                    user_id: targetId,
                    title: 'Nova Avaliação Agendada',
                    message: `Você foi designado para avaliar ${selectedRequest.student_name} no dia ${new Date(evaluationDate).toLocaleString()}.`,
                    type: 'AVALIACAO',
                    link: '/assessor'
                });
            };
            await notify(assessorId);
            if (assessor2Id) await notify(assessor2Id);

            closeModal();
        } catch (err) {
            console.error(err);
            alert('Erro ao agendar avaliação.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleMigrateStudent = async () => {
        if (selectedRequest.student_id) {
            return alert('Este aluno já possui matrícula efetivada no sistema.');
        }

        setMigrationLoading(true);
        try {
            const newStudent = {
                name: selectedRequest.student_name,
                birth_date: selectedRequest.student_birth_date,
                school_id: selectedRequest.school_id,
                class_id: selectedRequest.class_id,
                series: selectedRequest.student_year_stage || selectedRequest.student_level,
                possui_laudo: true,
                cid: selectedRequest.cid_hipotese || 'A definir (CEES)',
                needs_support: selectedRequest.specialized_support ? [selectedRequest.specialized_support] : [],
                additional_info: `Migrado via protocolo CEES ${selectedRequest.protocol_number}. Parecer: ${selectedRequest.final_report_text || 'Sem parecer disponível'}`
            };

            const { data: insertedStudent, error: insertError } = await supabase
                .from('students')
                .insert([newStudent])
                .select()
                .single();

            if (insertError) throw insertError;

            const { error: updateReqError } = await supabase
                .from('evaluation_requests')
                .update({
                    student_id: insertedStudent.id,
                    history: [
                        ...(selectedRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'MATRICULA',
                            result: 'Efetivado',
                            description: `Aluno matriculado e migrado para a base oficial de estudantes. ID: ${insertedStudent.id}`,
                            actor: user?.user_metadata?.name || user?.email,
                        }
                    ]
                })
                .eq('id', selectedRequest.id);

            if (updateReqError) throw updateReqError;

            alert('Aluno migrado e efetivado com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            closeModal();
        } catch (err: any) {
            console.error(err);
            alert('Erro ao migrar aluno: ' + err.message);
        } finally {
            setMigrationLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setActionType('NONE');
        setReturnReason('');
        setEvaluationDate('');
        setAssessorId('');
        setAssessor2Id('');
    };

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Centro de Comando CEES</h1>
                <p className="text-slate-500 dark:text-slate-400">Gestão e agendamento de avaliações multiprofissionais.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <span className="material-symbols-outlined text-primary">pending_actions</span>
                        Solicitações em Aberto
                    </h2>
                    <Button variant="ghost" icon="refresh" onClick={() => manualRefetch()} isLoading={loading}>
                        Atualizar
                    </Button>
                </div>

                <div className="overflow-x-auto w-full max-w-[100vw] shadow-sm rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Protocolo</th>
                                <th className="px-6 py-4 whitespace-nowrap">Recebido em</th>
                                <th className="px-6 py-4 whitespace-nowrap">Escola</th>
                                <th className="px-6 py-4 whitespace-nowrap">Aluno</th>
                                <th className="px-6 py-4 whitespace-nowrap">Tipo</th>
                                <th className="px-6 py-4 whitespace-nowrap">Estado</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading && requests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-primary">sync</span>
                                        <p>Carregando solicitações...</p>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        Nenhuma solicitação encontrada no momento.
                                    </td>
                                </tr>
                            ) : (
                                (requests as any[]).map(req => (
                                    <tr key={req.id} className={`transition-colors transition-opacity ${
                                        req.status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-900/10' :
                                        req.status === 'RETURNED' ? 'bg-slate-50/50 dark:bg-slate-900/30 opacity-60 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                                    }`}>
                                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                            {req.protocol_number}
                                        </td>
                                        <td className="px-6 py-4 text-[11px] font-medium text-slate-500 whitespace-nowrap">
                                            {req.first_received_at ? new Date(req.first_received_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{req.schools?.name || 'Escola não vinculada'}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{req.student_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-bold text-slate-500 uppercase">{req.request_type}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                                req.status === 'PENDING_CEES' ? 'bg-blue-100 text-blue-700' :
                                                req.status === 'SCHEDULED' ? 'bg-purple-100 text-purple-700' :
                                                req.status === 'INCONCLUSIVE' ? 'bg-orange-100 text-orange-700' :
                                                req.status === 'RETURNED' ? 'bg-red-50 text-red-600 grayscale' :
                                                req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-slate-100 text-slate-700'
                                                }`}>
                                                {req.status === 'PENDING_CEES' ? 'Aguardando Análise' :
                                                 req.status === 'SCHEDULED' ? 'Agendado' : 
                                                 req.status === 'INCONCLUSIVE' ? 'Inconclusivo' : 
                                                 req.status === 'RETURNED' ? 'Devolvido' : 
                                                 req.status === 'COMPLETED' ? 'Concluído' : req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <Button size="sm" variant={req.status === 'RETURNED' ? 'ghost' : 'secondary'} onClick={() => setSelectedRequest(req)}>
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

            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <span className="material-symbols-outlined text-primary">assignment_ind</span>
                                Análise de Solicitação: {selectedRequest.protocol_number}
                            </h2>
                            <button onClick={closeModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            
                            {/* Histórico */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">history</span>
                                    Histórico de Movimentações (Log)
                                </h3>
                                <div className="space-y-3">
                                    {selectedRequest.history && selectedRequest.history.length > 0 ? (
                                        <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                                            {selectedRequest.history.slice().reverse().map((event: any, idx: number) => (
                                                <div key={idx} className="pl-6 relative">
                                                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-primary z-10 shadow-sm"></div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                            {event.action}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(event.date).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                                                        Resultado: {event.result}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {event.description}
                                                    </p>
                                                    {event.assessors && event.assessors !== 'N/A' && (
                                                        <p className="text-[10px] text-slate-400 mt-1 italic">
                                                            Assessores: {event.assessors}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        Por: {event.actor}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-slate-400 text-xs italic">
                                            Nenhuma movimentação registrada.
                                        </div>
                                    )}
                                </div>
                            </div>

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

                            {/* Questionário */}
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

                                {selectedRequest.status === 'COMPLETED' ? (
                                    <Button 
                                        icon="person_add" 
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white w-full mt-4" 
                                        onClick={handleMigrateStudent} 
                                        isLoading={migrationLoading}
                                    >
                                        Efetivar Matrícula do Aluno (Migrar para Estudantes)
                                    </Button>
                                ) : actionType === 'NONE' ? (
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
                                                className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none text-base"
                                            />
                                        </label>
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setActionType('NONE')}>Cancelar</Button>
                                            <Button className="bg-red-600 hover:bg-red-700" icon="send" onClick={handleReturn} isLoading={actionLoading}>Confirmar Devolução</Button>
                                        </div>
                                    </div>
                                ) : actionType === 'SCHEDULE' ? (
                                    <div className="space-y-4 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <label className="flex flex-col gap-2">
                                                <span className="text-sm font-bold text-purple-800 dark:text-purple-400">Data e Hora Sugerida *</span>
                                                <input
                                                    type="datetime-local"
                                                    value={evaluationDate}
                                                    onChange={e => setEvaluationDate(e.target.value)}
                                                    className="px-4 h-11 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-base"
                                                />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-sm font-bold text-purple-800 dark:text-purple-400">Assessor 1 (Titular) *</span>
                                                <select
                                                    value={assessorId}
                                                    onChange={e => setAssessorId(e.target.value)}
                                                    className="px-4 h-11 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-base"
                                                >
                                                    <option value="">Selecione o(a) titular...</option>
                                                    {assessorsData.map((a: any) => {
                                                        const isAbsent = !!getAbsence(a.id, evaluationDate);
                                                        return (
                                                            <option key={a.id} value={a.id} className={isAbsent ? 'text-red-500 italic' : ''}>
                                                                {a.name || a.email?.split('@')[0]} ({a.role}){isAbsent ? ' - AUSENTE' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-sm font-bold text-purple-800 dark:text-purple-400">Assessor 2 (Acompanhante)</span>
                                                <select
                                                    value={assessor2Id}
                                                    onChange={e => setAssessor2Id(e.target.value)}
                                                    className="px-4 h-11 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-base"
                                                >
                                                    <option value="">Nenhum (Opcional)</option>
                                                    {assessorsData.map((a: any) => {
                                                        const isAbsent = !!getAbsence(a.id, evaluationDate);
                                                        return (
                                                            <option key={a.id} value={a.id} className={isAbsent ? 'text-red-500 italic' : ''}>
                                                                {a.name || a.email?.split('@')[0]} ({a.role}){isAbsent ? ' - AUSENTE' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </label>
                                        </div>
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
            )}
        </div>
    );
}
