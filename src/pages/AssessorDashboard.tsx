import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function AssessorDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: usersMap = {} } = useQuery({
        queryKey: ['users_map'],
        queryFn: async () => {
            const { data: usersData } = await supabase.rpc('get_all_users');
            const map: Record<string, string> = {};
            usersData?.forEach((u: any) => {
                map[u.id] = u.name || u.email?.split('@')[0] || 'Assessor';
            });
            return map;
        }
    });

    const { data: requests = [], isLoading: loading } = useQuery({
        queryKey: ['evaluation_requests', 'assessor', user?.id],
        queryFn: fetchRequests,
        enabled: !!user
    });
    
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [cancellingRequest, setCancellingRequest] = useState<any | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [reportText, setReportText] = useState('');
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [isInconclusiveSubmitting, setIsInconclusiveSubmitting] = useState(false);
    const [reassessmentNeeded, setReassessmentNeeded] = useState(false);
    const [reassessmentPeriod, setReassessmentPeriod] = useState('6 meses');

    const cancelReasons = [
        'Problemas logísticos',
        'Solicitação da Unidade Escolar',
        'Não comparecimento dos responsáveis',
        'Aluno faltou',
        'Turma dispensada'
    ];

    async function fetchRequests() {
        if (!user) return [];
        const { data, error } = await supabase
            .from('evaluation_requests')
            .select('*, schools(name)')
            .eq('status', 'SCHEDULED')
            .or(`assessor_id.eq.${user.id},assessor_2_id.eq.${user.id}`)
            .order('evaluation_date', { ascending: true });
        
        if (error) throw error;
        return data || [];
    }

    const handleComplete = async () => {
        if (!reportText.trim()) {
            return alert("Por favor, preencha o Parecer Técnico Final.");
        }
        
        setSubmitting(true);
        try {
            let final_report_file_url = null;
            
            if (reportFile) {
                const fileExt = reportFile.name.split('.').pop();
                const fileName = `${selectedRequest.id}-${Math.random()}.${fileExt}`;
                const filePath = `${fileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('relatorios')
                    .upload(filePath, reportFile);
                    
                if (uploadError) throw uploadError;
                
                const { data: publicURLData } = supabase.storage
                    .from('relatorios')
                    .getPublicUrl(filePath);
                    
                final_report_file_url = publicURLData.publicUrl;
            }
            
            const { error: updateError } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'COMPLETED',
                    final_report_text: reportText,
                    final_report_file_url: final_report_file_url,
                    reassessment_needed: reassessmentNeeded,
                    reassessment_period: reassessmentNeeded ? reassessmentPeriod : null,
                    history: [
                        ...(selectedRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'FINALIZAÇÃO',
                            result: 'Finalizado',
                            description: `Avaliação concluída com parecer técnico. ${reassessmentNeeded ? 'Reavaliação necessária em ' + reassessmentPeriod : 'Sem necessidade de reavaliação'}`,
                            actor: user?.user_metadata?.name || user?.email,
                            assessors: `${usersMap[selectedRequest.assessor_id] || 'Assessor 1'} ${selectedRequest.assessor_2_id ? ' e ' + (usersMap[selectedRequest.assessor_2_id] || 'Assessor 2') : ''}`
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);
                
            if (updateError) throw updateError;
            
            alert('Avaliação concluída com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            closeModal();
        } catch (err) {
            console.error('Erro ao concluir avaliação:', err);
            alert('Erro ao concluir avaliação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelReason) {
            return alert("Por favor, selecione o motivo do cancelamento.");
        }

        setCancelling(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'PENDING_CEES', // Volta para a triagem da CEES para reagendamento
                    return_reason: `Cancelado em campo: ${cancelReason}`,
                    evaluation_date: null,
                    assessor_id: null,
                    assessor_2_id: null,
                    history: [
                        ...(cancellingRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'CANCELAMENTO',
                            result: 'Agendamento Cancelado',
                            description: `Cancelado em campo. Motivo: ${cancelReason}`,
                            actor: user?.user_metadata?.name || user?.email,
                            assessors: `${usersMap[cancellingRequest.assessor_id] || 'Assessor 1'} ${cancellingRequest.assessor_2_id ? ' e ' + (usersMap[cancellingRequest.assessor_2_id] || 'Assessor 2') : ''}`
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', cancellingRequest.id);

            if (error) throw error;

            alert('Atendimento cancelado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            setCancellingRequest(null);
            setCancelReason('');
        } catch (err: any) {
            console.error(err);
            alert('Erro ao cancelar atendimento: ' + err.message);
        } finally {
            setCancelling(false);
        }
    };

    const handleInconclusive = async () => {
        if (!reportText.trim()) {
            return alert("Por favor, preencha as anotações no Parecer Técnico antes de marcar como inconclusivo.");
        }

        setIsInconclusiveSubmitting(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'INCONCLUSIVE', // Novo status sugerido pelo usuário
                    return_reason: `Avaliação Inconclusiva: ${reportText}`,
                    evaluation_date: null,
                    assessor_id: null,
                    assessor_2_id: null,
                    history: [
                        ...(selectedRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'INCONCLUSIVO',
                            result: 'Inconclusivo',
                            description: `Atendimento realizado mas sem conclusão. Notas: ${reportText.substring(0, 100)}...`,
                            actor: user?.user_metadata?.name || user?.email,
                            assessors: `${usersMap[selectedRequest.assessor_id] || 'Assessor 1'} ${selectedRequest.assessor_2_id ? ' e ' + (usersMap[selectedRequest.assessor_2_id] || 'Assessor 2') : ''}`
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            alert('Atendimento marcado como inconclusivo. Todas as anotações foram salvas e a solicitação retornou para novo agendamento.');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            closeModal();
        } catch (err: any) {
            console.error(err);
            alert('Erro ao processar: ' + err.message);
        } finally {
            setIsInconclusiveSubmitting(false);
        }
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setReportText('');
        setReportFile(null);
        setReassessmentNeeded(false);
        setReassessmentPeriod('6 meses');
    };

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Meu Painel (Assessor)</h1>
                <p className="text-slate-500 dark:text-slate-400">Suas avaliações agendadas aguardando atendimento.</p>
            </div>
            
            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4">event_available</span>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Nenhuma avaliação agendada.</h3>
                    <p className="text-slate-500 mt-2">Você concluiu todos os seus atendimentos pendentes.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col h-full">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-purple-600 bg-purple-100 p-2 rounded-lg">event</span>
                                    <div>
                                        <p className="text-sm font-bold text-slate-500 uppercase">Data Agendada</p>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {req.evaluation_date ? new Date(req.evaluation_date).toLocaleString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-1">{req.student_name}</h3>
                                {/* Safe calculate age */}
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Idade: {
                                    Math.floor((new Date().getTime() - new Date(req.student_birth_date).getTime()) / 31557600000)
                                } anos</p>
                                
                                <div className="space-y-2 mb-6">
                                    <p className="text-sm flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-[16px]">group</span>
                                        Equipa: {usersMap[req.assessor_id] || 'Assessor 1'} {req.assessor_2_id ? `e ${usersMap[req.assessor_2_id] || 'Assessor 2'}` : ''}
                                    </p>
                                    <p className="text-sm flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-[16px]">school</span>
                                        {req.schools?.name || 'Escola não informada'}
                                    </p>
                                    <p className="text-sm flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-[16px]">assignment</span>
                                        Protocolo: {req.protocol_number}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="mt-auto grid grid-cols-2 gap-2">
                                <Button 
                                    className="bg-primary hover:bg-primary-dark"
                                    onClick={() => setSelectedRequest(req)}
                                    icon="clinical_notes"
                                >
                                    Iniciar Atendimento
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                    onClick={() => setCancellingRequest(req)}
                                    icon="cancel"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <span className="material-symbols-outlined text-primary">edit_document</span>
                                Emitir Parecer: {selectedRequest.student_name}
                            </h2>
                            <button onClick={closeModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Resumo do Histórico</h3>
                                <div className="space-y-4">
                                    {selectedRequest.pedagogical_observations && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400">Observações Pedagógicas</h4>
                                            <p className="text-sm text-slate-800 dark:text-slate-300 mt-1">{selectedRequest.pedagogical_observations}</p>
                                        </div>
                                    )}
                                    {selectedRequest.methodological_observations && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400">Observações Metodológicas</h4>
                                            <p className="text-sm text-slate-800 dark:text-slate-300 mt-1">{selectedRequest.methodological_observations}</p>
                                        </div>
                                    )}
                                    {selectedRequest.authorization_file_url && (
                                        <div className="pt-2">
                                            <a 
                                                href={selectedRequest.authorization_file_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                Ver Termo dos Pais (Anexo)
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex flex-col gap-2">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">Parecer Técnico Final *</span>
                                    <textarea 
                                        value={reportText}
                                        onChange={e => setReportText(e.target.value)}
                                        className="w-full h-40 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y text-base"
                                        placeholder="Descreva o parecer detalhado e conclusões..."
                                    />
                                </label>

                                <label className="flex flex-col gap-2">
                                    <span className="bold text-slate-800 dark:text-slate-200">Anexar Relatório Final Assinado (PDF)</span>
                                    <input 
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        onChange={e => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                setReportFile(e.target.files[0]);
                                            }
                                        }}
                                        className="block w-full text-sm text-slate-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-xl file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-primary/10 file:text-primary
                                        hover:file:bg-primary/20 cursor-pointer
                                        "
                                    />
                                </label>

                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-xl space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={reassessmentNeeded}
                                            onChange={e => setReassessmentNeeded(e.target.checked)}
                                            className="w-5 h-5 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                                        />
                                        <span className="font-bold text-yellow-800 dark:text-yellow-400">Há necessidade de reavaliação?</span>
                                    </label>
                                    
                                    {reassessmentNeeded && (
                                        <div className="flex items-center gap-4 animate-in slide-in-from-left-2 transition-all">
                                            <span className="text-sm text-yellow-700 dark:text-yellow-500">Período de espera:</span>
                                            <div className="flex gap-2">
                                                {['6 meses', '1 ano'].map(period => (
                                                    <button
                                                        key={period}
                                                        type="button"
                                                        onClick={() => setReassessmentPeriod(period)}
                                                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${
                                                            reassessmentPeriod === period 
                                                            ? 'bg-yellow-600 border-yellow-600 text-white shadow-sm' 
                                                            : 'bg-white dark:bg-slate-900 border-yellow-200 text-yellow-700 hover:border-yellow-400'
                                                        }`}
                                                    >
                                                        {period}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between gap-3 shrink-0">
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300" 
                                    onClick={handleInconclusive}
                                    isLoading={isInconclusiveSubmitting}
                                    disabled={submitting}
                                    icon="warning"
                                >
                                    Inconclusivo
                                </Button>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={closeModal} disabled={submitting || isInconclusiveSubmitting}>
                                    Sair
                                </Button>
                                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleComplete} isLoading={submitting} disabled={isInconclusiveSubmitting} icon="check_circle">
                                    Concluir Avaliação
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CANCELAMENTO */}
            {cancellingRequest && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-red-50 dark:bg-red-900/10 shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-red-700 dark:text-red-400">
                                <span className="material-symbols-outlined">event_busy</span>
                                Cancelar Atendimento
                            </h2>
                            <button onClick={() => setCancellingRequest(null)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-red-500">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <p className="text-slate-600 dark:text-slate-300 italic text-sm">
                                Tem certeza que deseja cancelar o agendamento de <span className="font-bold text-slate-900 dark:text-white">{cancellingRequest.student_name}</span>?
                            </p>
                            
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Selecione o Motivo *</label>
                                <select 
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-base"
                                >
                                    <option value="">Selecione um motivo...</option>
                                    {cancelReasons.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button 
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white"
                                    onClick={() => setCancellingRequest(null)}
                                >
                                    Manter Atendimento
                                </Button>
                                <Button 
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    onClick={handleCancel}
                                    isLoading={cancelling}
                                    icon="check_circle"
                                >
                                    Confirmar Cancelamento
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
