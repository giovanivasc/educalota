import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';

export default function AssessorDashboard() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [reportText, setReportText] = useState('');
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchRequests = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data: usersData } = await supabase.rpc('get_all_users');
            const map: Record<string, string> = {};
            usersData?.forEach((u: any) => {
                map[u.id] = u.name || u.email?.split('@')[0] || 'Assessor';
            });
            setUsersMap(map);

            const { data, error } = await supabase
                .from('evaluation_requests')
                .select('*, schools(name)')
                .eq('status', 'SCHEDULED')
                .or(`assessor_id.eq.${user.id},assessor_2_id.eq.${user.id}`)
                .order('evaluation_date', { ascending: true });
            
            if (error) throw error;
            setRequests(data || []);
        } catch (err) {
            console.error('Erro ao buscar avaliações:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [user]);

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
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);
                
            if (updateError) throw updateError;
            
            alert('Avaliação concluída com sucesso!');
            closeModal();
            fetchRequests();
        } catch (err) {
            console.error('Erro ao concluir avaliação:', err);
            alert('Erro ao concluir avaliação.');
        } finally {
            setSubmitting(false);
        }
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setReportText('');
        setReportFile(null);
    };

    return (
        <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
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
                            
                            <Button 
                                className="w-full bg-primary hover:bg-primary-dark"
                                onClick={() => setSelectedRequest(req)}
                                icon="clinical_notes"
                            >
                                Iniciar Atendimento
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
                                        className="w-full h-40 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                                        placeholder="Descreva o parecer detalhado e conclusões..."
                                    />
                                </label>

                                <label className="flex flex-col gap-2">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">Anexar Relatório Final Assinado (PDF)</span>
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
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
                            <Button variant="ghost" onClick={closeModal} disabled={submitting}>
                                Cancelar
                            </Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleComplete} isLoading={submitting} icon="check_circle">
                                Concluir Avaliação
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
