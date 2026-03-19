import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Eye, 
    ClipboardList, 
    Users, 
    User, 
    ArrowLeft, 
    Save, 
    CheckCircle, 
    History,
    X,
    GraduationCap,
    Calendar,
    MoreVertical,
    CheckSquare,
    PlayCircle,
    Home,
    Search
} from 'lucide-react';

type StepType = 'MAIN' | 'ANAMNESE' | 'ESCUTA' | 'OBSERVACAO' | 'INDIVIDUAL';

export default function AssessorDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // States for Modals
    const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
    const [isAttendanceHubOpen, setIsAttendanceHubOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState<StepType>('MAIN');
    
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
    const [specializedSupport, setSpecializedSupport] = useState('');

    // Step UI State
    const [stepNotes, setStepNotes] = useState('');
    const [isSavingStep, setIsSavingStep] = useState(false);

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
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('evaluation_requests')
                .select('*, schools(name)')
                .in('status', ['SCHEDULED', 'IN_PROGRESS'])
                .or(`assessor_id.eq.${user.id},assessor_2_id.eq.${user.id}`)
                .order('evaluation_date', { ascending: true });
            
            if (error) throw error;
            return data || [];
        },
        enabled: !!user
    });

    const handleStartAttendance = async (req: any) => {
        if (req.status === 'SCHEDULED') {
            try {
                const { error } = await supabase
                    .from('evaluation_requests')
                    .update({ status: 'IN_PROGRESS' })
                    .eq('id', req.id);
                if (error) throw error;
                queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            } catch (err) {
                console.error('Error starting attendance:', err);
            }
        }
        setSelectedRequest(req);
        setIsFichaModalOpen(false);
        setIsAttendanceHubOpen(true);
        setCurrentStep('MAIN');
    };

    const openStep = (step: StepType) => {
        setCurrentStep(step);
        const column = getColumnName(step);
        if (column && selectedRequest[column]) {
            const myData = selectedRequest[column][user?.id];
            setStepNotes(myData?.notes || '');
        } else {
            setStepNotes('');
        }
    };

    const getColumnName = (step: StepType) => {
        switch(step) {
            case 'ANAMNESE': return 'anamnesis_data';
            case 'ESCUTA': return 'pedagogical_listening_data';
            case 'OBSERVACAO': return 'classroom_observation_data';
            case 'INDIVIDUAL': return 'individual_evaluation_data';
            default: return null;
        }
    };

    const handleSaveStep = async () => {
        const column = getColumnName(currentStep);
        if (!column || !selectedRequest || !user) return;

        setIsSavingStep(true);
        try {
            const currentData = selectedRequest[column] || {};
            const newData = {
                ...currentData,
                [user.id]: {
                    notes: stepNotes,
                    completed: true,
                    updated_at: new Date().toISOString(),
                    assessor_name: user?.user_metadata?.name || user?.email
                }
            };

            const { error } = await supabase
                .from('evaluation_requests')
                .update({ [column]: newData })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            // Update local selectedRequest to reflect change
            setSelectedRequest({ ...selectedRequest, [column]: newData });
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            setCurrentStep('MAIN');
        } catch (err: any) {
            alert('Erro ao salvar etapa: ' + err.message);
        } finally {
            setIsSavingStep(false);
        }
    };

    const handleComplete = async () => {
        if (!reportText.trim()) return alert("Por favor, preencha o Parecer Técnico Final.");
        if (!specializedSupport) return alert('Por favor, selecione a necessidade de suporte especializado.');
        
        setSubmitting(true);
        try {
            let final_report_file_url = null;
            if (reportFile) {
                const fileExt = reportFile.name.split('.').pop();
                const filePath = `${selectedRequest.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('relatorios').upload(filePath, reportFile);
                if (uploadError) throw uploadError;
                const { data: publicURLData } = supabase.storage.from('relatorios').getPublicUrl(filePath);
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
                    specialized_support: specializedSupport,
                    history: [
                        ...(selectedRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'FINALIZAÇÃO',
                            result: 'Finalizado',
                            description: `Avaliação concluída com parecer técnico. Suporte indicado: ${specializedSupport}.`,
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
            setIsAttendanceHubOpen(false);
            setSelectedRequest(null);
            setSpecializedSupport('');
        } catch (err) {
            console.error(err);
            alert('Erro ao concluir avaliação.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleInconclusive = async () => {
        if (!reportText.trim()) return alert("Preencha as anotações antes de marcar como inconclusivo.");
        setIsInconclusiveSubmitting(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'INCONCLUSIVE',
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
                            description: `Atendimento realizado mas sem conclusão.`,
                            actor: user?.user_metadata?.name || user?.email,
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);
            if (error) throw error;
            alert('Atendimento marcado como inconclusivo.');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            setIsAttendanceHubOpen(false);
            setSelectedRequest(null);
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setIsInconclusiveSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelReason) return alert("Selecione o motivo.");
        setCancelling(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    status: 'PENDING_CEES',
                    return_reason: `Cancelado em campo: ${cancelReason}`,
                    evaluation_date: null,
                    assessor_id: null,
                    assessor_2_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', cancellingRequest.id);
            if (error) throw error;
            alert('Cancelado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            setCancellingRequest(null);
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Painel do Assessor</h1>
                <p className="text-slate-500 dark:text-slate-400">Atendimentos agendados e em andamento.</p>
            </div>
            
            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
            ) : requests.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 shadow-sm">
                    <History className="text-6xl text-slate-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700">Tudo em dia!</h3>
                    <p className="text-slate-500">Nenhum atendimento agendado para você no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
                            <div className={`h-2 ${req.status === 'IN_PROGRESS' ? 'bg-amber-400' : 'bg-primary'}`}></div>
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-xl ${req.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                                            <Calendar />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                                {req.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Agendado'}
                                            </p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                {req.evaluation_date ? new Date(req.evaluation_date).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <button className="text-slate-400 hover:text-slate-600"><MoreVertical /></button>
                                </div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 leading-tight group-hover:text-primary transition-colors">{req.student_name}</h3>
                                <div className="flex items-center gap-2 mb-4">
                                    <GraduationCap className="text-slate-400 text-sm" />
                                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{req.schools?.name}</span>
                                </div>
                                <div className="space-y-2 mb-6 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl">
                                    <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 font-medium">
                                        <ClipboardList className="text-[14px]" />
                                        Protocolo: <span className="font-bold">{req.protocol_number}</span>
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 font-medium">
                                        <Users className="text-[14px]" />
                                        Equipe CEES
                                    </p>
                                </div>
                            </div>
                            <div className="px-6 pb-6 pt-2 grid grid-cols-2 gap-3">
                                <Button 
                                    className="bg-primary hover:bg-primary-dark shadow-sm"
                                    onClick={() => { setSelectedRequest(req); setIsFichaModalOpen(true); }}
                                    icon="visibility"
                                >
                                    Ver Ficha
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="border-red-100 text-red-500 hover:bg-red-50"
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

            {/* MODAL 1: FICHA DO ALUNO (READ-ONLY) */}
            {isFichaModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Eye className="text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Ficha do Estudante</h2>
                                    <p className="text-xs text-slate-500">Dados cadastrados pela Unidade Escolar</p>
                                </div>
                            </div>
                            <button onClick={() => setIsFichaModalOpen(false)} className="size-10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
                            <section className="grid grid-cols-2 gap-6">
                                <div className="col-span-2 bg-primary/5 p-4 rounded-3xl border border-primary/10 flex items-center gap-4">
                                    <div className="bg-white dark:bg-slate-800 size-12 rounded-2xl flex items-center justify-center shadow-sm">
                                        <User className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-slate-900 dark:text-white">{selectedRequest.student_name}</p>
                                        <p className="text-xs font-bold text-primary uppercase tracking-widest">Protocolo {selectedRequest.protocol_number}</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escola</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedRequest.schools?.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Turma / Turno</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedRequest.student_class} - {selectedRequest.student_shift}</p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ClipboardList className="text-sm" /> Resumo das Queixas
                                </h4>
                                <div className="space-y-3">
                                    {['pedagogical_observations', 'methodological_observations', 'relational_observations'].map(field => (
                                        selectedRequest[field] && (
                                            <div key={field} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <p className="text-[10px] font-black text-primary uppercase mb-1">{field.replace('_observations', '').replace('pedagogical', 'Pedagógica').replace('methodological', 'Metodológica').replace('relational', 'Relacional')}</p>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedRequest[field]}</p>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </section>

                            {selectedRequest.authorization_file_url && (
                                <section>
                                    <a href={selectedRequest.authorization_file_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 group hover:bg-blue-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 shadow-sm"><Eye /></div>
                                            <span className="text-sm font-bold text-blue-800 dark:text-blue-400">Ver Termo de Autorização Assinado</span>
                                        </div>
                                        <ArrowLeft className="rotate-180 text-blue-400 group-hover:translate-x-1 transition-transform" />
                                    </a>
                                </section>
                            )}
                        </div>
                        <div className="p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setIsFichaModalOpen(false)}>Fechar</Button>
                            <Button variant="primary" icon="play_arrow" onClick={() => handleStartAttendance(selectedRequest)}>
                                {selectedRequest.status === 'IN_PROGRESS' ? 'Continuar Atendimento' : 'Iniciar Atendimento'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2 & 3: HUB DE ATENDIMENTO E FORMULÁRIOS DE ETAPAS */}
            {isAttendanceHubOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xl md:p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full h-full md:rounded-[40px] md:max-w-5xl md:max-h-[95vh] shadow-2xl flex flex-col overflow-hidden relative">
                        {currentStep === 'MAIN' ? (
                            <div className="flex flex-col h-full animate-in zoom-in-95 duration-300">
                                {/* Header do Hub */}
                                <div className="px-8 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-lg uppercase">Atendimento em Campo</span>
                                            <span className="text-slate-400 text-[10px] font-bold">#{selectedRequest.protocol_number}</span>
                                        </div>
                                        <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">{selectedRequest.student_name}</h2>
                                        <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium">
                                            <GraduationCap className="text-sm" /> {selectedRequest.schools?.name}
                                        </p>
                                    </div>
                                    <button onClick={() => { setIsAttendanceHubOpen(false); setSpecializedSupport(''); }} className="size-12 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
                                        <X className="text-slate-400" />
                                    </button>
                                </div>

                                <div className="flex-1 p-8 overflow-y-auto space-y-10 no-scrollbar">
                                    <div>
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Etapas da Avaliação</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {[
                                                { id: 'ANAMNESE', label: 'Escuta Família (Anamnese)', icon: <Users />, color: 'purple', col: 'anamnesis_data' },
                                                { id: 'ESCUTA', label: 'Escuta Equipe Pedagógica', icon: <Search />, color: 'blue', col: 'pedagogical_listening_data' },
                                                { id: 'OBSERVACAO', label: 'Observação em Sala', icon: <Eye />, color: 'emerald', col: 'classroom_observation_data' },
                                                { id: 'INDIVIDUAL', label: 'Avaliação Individual', icon: <User />, color: 'orange', col: 'individual_evaluation_data' }
                                            ].map(step => {
                                                const hasData = selectedRequest[step.col] && Object.keys(selectedRequest[step.col]).length > 0;
                                                const completedByMe = selectedRequest[step.col]?.[user?.id]?.completed;
                                                
                                                return (
                                                    <button 
                                                        key={step.id} 
                                                        onClick={() => openStep(step.id as StepType)}
                                                        className={`bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center text-center group relative ${
                                                            completedByMe ? 'border-emerald-500 shadow-emerald-100 dark:shadow-none bg-emerald-50/30' : 
                                                            hasData ? 'border-slate-300 shadow-sm' : 'border-slate-100 dark:border-slate-800 hover:border-primary/50 hover:shadow-xl'
                                                        }`}
                                                    >
                                                        <div className={`size-14 rounded-2xl mb-4 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${
                                                            completedByMe ? 'bg-emerald-500 text-white' : 
                                                            `bg-${step.color}-100 text-${step.color}-600 dark:bg-${step.color}-900/20`
                                                        }`}>
                                                            {step.icon}
                                                        </div>
                                                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight">{step.label}</span>
                                                        {hasData && (
                                                            <div className="absolute top-4 right-4 flex -space-x-2">
                                                                {Object.values(selectedRequest[step.col]).map((val: any, i: number) => (
                                                                    <div key={i} className="size-5 rounded-full bg-slate-200 border-2 border-white dark:border-slate-800 flex items-center justify-center overflow-hidden" title={val.assessor_name}>
                                                                        <User className="text-[10px] text-slate-500" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {completedByMe && <div className="mt-2 text-[10px] font-black uppercase text-emerald-600">Salvo por você</div>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-inner">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="size-10 rounded-2xl bg-primary text-white flex items-center justify-center"><CheckSquare /></div>
                                            <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight">Parecer Técnico Final</h3>
                                        </div>
                                        <div className="space-y-6">
                                            <textarea 
                                                value={reportText} onChange={e => setReportText(e.target.value)}
                                                className="w-full h-40 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-base placeholder:italic"
                                                placeholder="Após concluir todas as etapas, descreva aqui o parecer técnico final..."
                                            />
                                            
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Necessita de Suporte Especializado?</label>
                                                <select 
                                                    value={specializedSupport}
                                                    onChange={(e) => setSpecializedSupport(e.target.value)}
                                                    className="w-full h-14 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold"
                                                >
                                                    <option value="">Selecione uma opção...</option>
                                                    <option value="Atendido por Mediador">Atendido por Mediador</option>
                                                    <option value="Atendido por Cuidador">Atendido por Cuidador</option>
                                                    <option value="Atendido por Prof. Braille">Atendido por Prof. Braille</option>
                                                    <option value="Atendido por Prof. Bilíngue">Atendido por Prof. Bilíngue</option>
                                                    <option value="Necessita de avaliação">Necessita de avaliação</option>
                                                    <option value="Não necessita">Não necessita</option>
                                                    <option value="Atendimento domiciliar">Atendimento domiciliar</option>
                                                    <option value="Mediação exclusiva">Mediação exclusiva</option>
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 flex items-center justify-between group cursor-pointer hover:border-primary transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary/10 rounded-xl text-primary"><Save className="text-sm"/></div>
                                                        <span className="text-sm font-bold text-slate-600">Anexar PDF Assinado</span>
                                                    </div>
                                                    <input type="file" onChange={e => e.target.files && setReportFile(e.target.files[0])} className="absolute opacity-0 w-40 cursor-pointer"/>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">{reportFile ? 'Selecionado ✓' : 'Procurar...'}</span>
                                                </div>
                                                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100">
                                                    <input type="checkbox" checked={reassessmentNeeded} onChange={e => setReassessmentNeeded(e.target.checked)} className="size-5 rounded-lg text-primary"/>
                                                    <span className="text-sm font-bold text-slate-700">Necessita Reavaliação?</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-3 pt-4">
                                                <Button variant="outline" className="text-orange-600 border-orange-100" onClick={handleInconclusive} isLoading={isInconclusiveSubmitting}>Inconclusivo</Button>
                                                <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-700 h-14 px-8 rounded-2xl text-lg font-black shadow-lg shadow-emerald-200 dark:shadow-none" icon="check_circle" onClick={handleComplete} isLoading={submitting}>Concluir Avaliação</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 bg-slate-50 dark:bg-slate-900">
                                {/* Header da Etapa */}
                                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                                    <button onClick={() => setCurrentStep('MAIN')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
                                        <ArrowLeft /> Voltar para Etapas
                                    </button>
                                    <div className="text-center flex-1 pr-10">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Formulário de Campo</p>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none">
                                            {currentStep === 'ANAMNESE' && 'Escuta com a Família (Anamnese)'}
                                            {currentStep === 'ESCUTA' && 'Escuta da Equipe Pedagógica'}
                                            {currentStep === 'OBSERVACAO' && 'Observação em Sala de Aula'}
                                            {currentStep === 'INDIVIDUAL' && 'Avaliação Individual do Estudante'}
                                        </h3>
                                    </div>
                                </div>

                                <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
                                    <div className="max-w-3xl mx-auto space-y-6">
                                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="size-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center"><ClipboardList /></div>
                                                <h4 className="font-black text-slate-800 dark:text-slate-200">Anotações Provisórias da Etapa</h4>
                                            </div>
                                            <textarea 
                                                value={stepNotes} 
                                                onChange={e => setStepNotes(e.target.value)}
                                                className="w-full h-[50vh] p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 border-none outline-none focus:ring-4 focus:ring-primary/10 text-lg leading-relaxed shadow-inner"
                                                placeholder="Digite aqui livremente suas anotações, observações e descobertas desta etapa..."
                                            />
                                            <p className="text-[10px] text-slate-400 mt-4 italic text-center uppercase tracking-widest font-bold">O trabalho salvo aqui fica visível para os outros assessores da equipe desta avaliação.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-4">
                                    <Button variant="ghost" className="h-14 px-8 rounded-2xl" onClick={() => setCurrentStep('MAIN')}>Cancelar</Button>
                                    <Button variant="primary" className="h-14 px-12 rounded-2xl text-lg font-black shadow-xl" icon="save" onClick={handleSaveStep} isLoading={isSavingStep}>Salvar e Voltar</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE CANCELAMENTO */}
            {cancellingRequest && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-red-50 text-red-700 flex justify-between items-center">
                            <h2 className="text-lg font-black flex items-center gap-2">Cancelar Atendimento</h2>
                            <button onClick={() => setCancellingRequest(null)}><X /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-slate-600 text-sm leading-relaxed">Deseja realmente cancelar o agendamento de <span className="font-bold text-slate-900 dark:text-white">{cancellingRequest.student_name}</span>?</p>
                            <select 
                                value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                                className="w-full h-14 px-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary outline-none font-bold"
                            >
                                <option value="">Selecione o motivo...</option>
                                <option value="Aluno Faltou">Aluno Faltou</option>
                                <option value="Escola Fechada">Escola Fechada</option>
                                <option value="Responsável não autorizou">Responsável não autorizou</option>
                                <option value="Outros">Outros</option>
                            </select>
                            <div className="flex gap-3 pt-2">
                                <Button className="flex-1 bg-slate-100 text-slate-600 rounded-2xl" onClick={() => setCancellingRequest(null)}>Manter</Button>
                                <Button className="flex-1 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-100" onClick={handleCancel} isLoading={cancelling}>Confirmar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
