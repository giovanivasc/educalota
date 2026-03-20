import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnamnesisData } from '../types';
import { useEffect } from 'react';

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

const defaultAnamnesisData: AnamnesisData = {
  attendanceDate: '', attendanceLocation: '',
  motherName: '', motherContact: '', fatherName: '', fatherContact: '', respName: '', respContact: '',
  hasSiblings: '', siblingsCount: '', familyComposition: [], familyCompositionOther: '',
  familyDeficiency: '', familyDeficiencyDetails: '', fosterCare: '', socioEducative: '',
  socioEducativeType: '', govPrograms: [], govProgramsOther: '', financialStatus: '',
  familyPlanning: '', prenatal: '', prenatalStartMonth: '', vaccines: '', motherEmotional: '',
  pregnancyEating: '', pregnancyDiseases: '', pregnancyDiseasesDetails: '', beforeBirth24h: [],
  beforeBirthOther: '', gestationTime: '', birthType: '', birthComplications: '',
  birthComplicationsDetails: '', riskPregnancy: '', atBirthCried: '', atBirthJaundice: '',
  atBirthAnoxia: '', atBirthCyanotic: '', incubator: '', testsDone: [], testsAlterations: '',
  testsAlterationsDetails: '', devHead: '', devSit: '', devCrawl: '', devStand: '',
  devWalk: '', devBabble: '', devWords: '', habitsPacifier: '', habitsThumb: '',
  habitsBreastMilk: '', foodComplement: false, foodSubstitute: false, foodIntroduction: '',
  hasDeficiency: '', deficiencyCid: '', selectiveEating: '', selectiveEatingDetails: '',
  restrictedEating: '', restrictedEatingDetails: '', sleepAgitated: '', constantCrying: '',
  bitesNails: '', bitesNailsFreq: '', bruxism: '', otherManipulations: '', shortFrenulum: '',
  surgery: '', surgeryDetails: '', trauma: '', traumaDetails: '', fainting: '',
  convulsions: '', currentDiseases: '', currentDiseasesDetails: '', clinicalCare: [],
  clinicalCareOther: '', medications: '', medicationsDetails: '', medicationsTime: [],
  relationship: [], relationshipOther: '', tendencyToFall: '', tendencyToInjure: '',
  tendencyToSelfHarm: '', objectManipulationDifficulty: '', otherDifficulties: '',
  communicationType: [], screenTimeExcess: '', screenTimeDetails: '',
  schoolAdaptationLimitation: '', schoolAdaptationDetails: '',
  avdFeeding: '', avdDressing: '', avdHygiene: '', avdBladder: '', avdBowel: '',
};

const RenderInput = ({ label, name, value, onChange, placeholder = "", type = "text", className = "" }: any) => (
    <div className={`space-y-1 ${className}`}>
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={placeholder}
            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm"
        />
    </div>
);

const RenderRadio = ({ label, name, value, options, onChange }: any) => (
    <div className="space-y-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
        <div className="flex flex-wrap gap-4 px-1">
            {options.map((opt: string) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                    <input
                        type="radio"
                        name={name}
                        checked={value === opt}
                        onChange={() => onChange(name, opt)}
                        className="size-4 text-primary border-slate-300 focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">{opt}</span>
                </label>
            ))}
        </div>
    </div>
);

const RenderCheckboxGroup = ({ label, name, values, options, onChange }: any) => (
    <div className="space-y-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-1">
            {options.map((opt: string) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={values.includes(opt)}
                        onChange={(e) => {
                            const newValues = e.target.checked 
                                ? [...values, opt]
                                : values.filter((v: string) => v !== opt);
                            onChange(name, newValues);
                        }}
                        className="size-4 rounded text-primary border-slate-300 focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">{opt}</span>
                </label>
            ))}
        </div>
    </div>
);



export default function AssessorDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // States for Modals
    const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
    const [isAttendanceHubOpen, setIsAttendanceHubOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState<StepType>('MAIN');
    
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [anamnesisForm, setAnamnesisForm] = useState<AnamnesisData>(defaultAnamnesisData);

    useEffect(() => {
        if (selectedRequest?.anamnesis_data?.[user?.id]?.form) {
            setAnamnesisForm(selectedRequest.anamnesis_data[user.id].form);
        } else {
            setAnamnesisForm(defaultAnamnesisData);
        }
    }, [selectedRequest, user?.id]);

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

    // Unlock request states
    const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
    const [unlockReason, setUnlockReason] = useState('');
    const [requestingUnlock, setRequestingUnlock] = useState(false);
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState<'PENDENTES' | 'ANDAMENTO' | 'CONCLUIDO'>('PENDENTES');

    // View Modal for Completed
    const [isViewParecerOpen, setIsViewParecerOpen] = useState(false);

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
                .in('status', ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'])
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
                    notes: currentStep === 'ANAMNESE' ? 'Dados estruturados salvos no formulário.' : stepNotes,
                    form: currentStep === 'ANAMNESE' ? anamnesisForm : null,
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

    const handleRequestUnlock = async () => {
        if (!unlockReason.trim()) return alert("Descreva o motivo da alteração.");
        setRequestingUnlock(true);
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    unlock_requested: true,
                    unlock_reason: unlockReason,
                    history: [
                        ...(selectedRequest.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'PEDIDO DE DESBLOQUEIO',
                            result: 'Pendente Aprovação',
                            description: `Solicitação de alteração: ${unlockReason}`,
                            actor: user?.user_metadata?.name || user?.email,
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;
            alert('Pedido de desbloqueio enviado com sucesso.');
            
            // DISPARAR NOTIFICAÇÕES PARA GESTORES
            try {
                const { data: allUsers } = await supabase.rpc('get_all_users');
                const managers = (allUsers || []).filter((u: any) => u.role === 'ADMIN' || u.role === 'DIRETOR');
                
                const notifications = managers.map((manager: any) => ({
                    user_id: manager.id,
                    title: 'Pedido de Desbloqueio de Avaliação',
                    message: `O assessor ${user?.user_metadata?.name || user?.email} solicitou a edição do protocolo ${selectedRequest.protocol_number} (${selectedRequest.student_name}).`,
                    type: 'SISTEMA',
                    link: '/cees'
                }));

                if (notifications.length > 0) {
                    await supabase.from('notifications').insert(notifications);
                }
            } catch (notifyErr) {
                console.error("Erro ao notificar gestores:", notifyErr);
            }

            queryClient.invalidateQueries({ queryKey: ['evaluation_requests'] });
            setIsUnlockModalOpen(false);
            setUnlockReason('');
        } catch (err: any) {
            alert('Erro ao solicitar desbloqueio: ' + err.message);
        } finally {
            setRequestingUnlock(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Painel do Assessor</h1>
                <p className="text-slate-500 dark:text-slate-400">Atendimentos agendados, em andamento e concluídos.</p>
            </div>

            <div className="flex space-x-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar pt-2">
                {[
                    { id: 'PENDENTES', label: 'Pendentes', status: 'SCHEDULED' },
                    { id: 'ANDAMENTO', label: 'Em Andamento', status: 'IN_PROGRESS' },
                    { id: 'CONCLUIDO', label: 'Concluído', status: 'COMPLETED' }
                ].map(tab => {
                    const count = requests.filter(r => r.status === tab.status).length;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-4 px-2 text-sm font-black transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                                isActive ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {tab.label}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
            
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 shadow-sm">
                    <History className="text-6xl text-slate-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700">Tudo em dia!</h3>
                    <p className="text-slate-500">Nenhum atendimento agendado para você no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests
                        .filter(req => {
                            if (activeTab === 'PENDENTES') return req.status === 'SCHEDULED';
                            if (activeTab === 'ANDAMENTO') return req.status === 'IN_PROGRESS';
                            return req.status === 'COMPLETED';
                        })
                        .map(req => {
                            const isPendingUnlock = req.status === 'COMPLETED' && req.unlock_requested;
                            return (
                                <div key={req.id} className={`bg-white dark:bg-slate-800 rounded-3xl border shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all group relative ${
                                    isPendingUnlock 
                                    ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20' 
                                    : 'border-slate-200 dark:border-slate-700'
                                }`}>
                                    {isPendingUnlock && (
                                        <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl flex items-center gap-1 shadow-sm z-10">
                                            <span className="material-symbols-outlined text-[14px]">lock_open</span> 
                                            Aguardando Desbloqueio
                                        </div>
                                    )}
                                    <div className={`h-2 ${
                                        req.status === 'COMPLETED' ? 'bg-emerald-500' :
                                        req.status === 'IN_PROGRESS' ? 'bg-amber-400' : 'bg-primary'
                                    }`}></div>
                                    
                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-2 rounded-xl ${
                                                    req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                    req.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
                                                }`}>
                                                    {req.status === 'COMPLETED' ? <CheckCircle /> : <Calendar />}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                                        {req.status === 'COMPLETED' ? 'Concluído' : req.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Agendado'}
                                                    </p>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                        {req.evaluation_date ? new Date(req.evaluation_date).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setActiveDropdownId(activeDropdownId === req.id ? null : req.id)}
                                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
                                                >
                                                    <MoreVertical />
                                                </button>
                                                {activeDropdownId === req.id && (
                                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 animate-in fade-in zoom-in-95">
                                                        <div className="p-1">
                                                            {req.status === 'COMPLETED' && !req.unlock_requested && (
                                                                <button 
                                                                    onClick={() => { setSelectedRequest(req); setIsUnlockModalOpen(true); setActiveDropdownId(null); }}
                                                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-black text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                >
                                                                    <History className="size-4" />
                                                                    Solicitar Permissão de Alteração
                                                                </button>
                                                            )}
                                                            <button 
                                                                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                                                onClick={() => setActiveDropdownId(null)}
                                                            >
                                                                <CheckSquare className="size-4" />
                                                                Outras Ações
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 leading-tight group-hover:text-primary transition-colors">{req.student_name}</h3>
                                        
                                        {req.unlock_requested && (
                                            <div className="mb-2">
                                                <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                                                    <History className="size-2.5" />
                                                    Desbloqueio Solicitado (Aguardando)
                                                </span>
                                            </div>
                                        )}

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

                                    <div className={`px-6 pb-6 pt-2 ${req.status === 'COMPLETED' ? 'flex flex-col' : 'grid grid-cols-2 gap-3'}`}>
                                        {req.status === 'COMPLETED' ? (
                                            <Button 
                                                className="bg-emerald-600 hover:bg-emerald-700 shadow-sm w-full"
                                                onClick={() => { setSelectedRequest(req); setIsViewParecerOpen(true); }}
                                                icon="description"
                                            >
                                                Ver Parecer Final
                                            </Button>
                                        ) : (
                                            <>
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
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* MODAL 1: FICHA DO ALUNO (READ-ONLY) */}
            {isFichaModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Eye className="text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-sm uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Ficha do Estudante</h2>
                                    <p className="text-[10px] text-slate-500">Dados cadastrados pela Unidade Escolar</p>
                                </div>
                            </div>
                            <button onClick={() => setIsFichaModalOpen(false)} className="size-10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-4 no-scrollbar">
                            <section className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 bg-primary/5 p-3 rounded-2xl border border-primary/10 flex items-center gap-4">
                                    <div className="bg-white dark:bg-slate-800 size-10 rounded-xl flex items-center justify-center shadow-sm">
                                        <User className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-slate-900 dark:text-white">{selectedRequest.student_name}</p>
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Protocolo {selectedRequest.protocol_number}</p>
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

                            <section className="space-y-3">
                                <h4 className="text-sm uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                                    <ClipboardList className="text-sm" /> Resumo das Queixas
                                </h4>
                                <div className="space-y-2">
                                    {['pedagogical_observations', 'methodological_observations', 'relational_observations'].map(field => (
                                        selectedRequest[field] && (
                                            <div key={field} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <p className="text-xs uppercase font-bold text-primary mb-1">{field.replace('_observations', '').replace('pedagogical', 'Pedagógica').replace('methodological', 'Metodológica').replace('relational', 'Relacional')}</p>
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
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
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
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-lg uppercase">Atendimento em Campo</span>
                                            <span className="text-slate-400 text-[10px] font-bold">#{selectedRequest.protocol_number}</span>
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{selectedRequest.student_name}</h2>
                                        <p className="text-slate-500 mt-0.5 flex items-center gap-2 font-medium text-sm">
                                            <GraduationCap className="text-sm" /> {selectedRequest.schools?.name}
                                        </p>
                                    </div>
                                    <button onClick={() => { setIsAttendanceHubOpen(false); setSpecializedSupport(''); }} className="size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
                                        <X className="text-slate-400" />
                                    </button>
                                </div>

                                <div className="flex-1 p-4 overflow-y-auto space-y-6 no-scrollbar">
                                    <div>
                                        <h3 className="text-sm uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">Etapas da Avaliação</h3>
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
                                                        className={`bg-white dark:bg-slate-800 p-4 rounded-3xl border-2 transition-all flex flex-col items-center text-center group relative ${
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
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">{step.label}</span>
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

                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-4 border border-slate-100 dark:border-slate-800 shadow-inner">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="size-10 rounded-2xl bg-primary text-white flex items-center justify-center"><CheckSquare /></div>
                                            <h3 className="text-sm uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Parecer Técnico Final</h3>
                                        </div>
                                        <div className="space-y-4">
                                            <textarea 
                                                value={reportText} onChange={e => setReportText(e.target.value)}
                                                className="w-full h-32 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm placeholder:italic"
                                                placeholder="Após concluir todas as etapas, descreva aqui o parecer técnico final..."
                                            />
                                            
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Necessita de Suporte Especializado?</label>
                                                <select 
                                                    value={specializedSupport}
                                                    onChange={(e) => setSpecializedSupport(e.target.value)}
                                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold"
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
                                            <div className="flex justify-end gap-3 pt-2">
                                                <Button variant="outline" size="sm" className="text-orange-600 border-orange-100" onClick={handleInconclusive} isLoading={isInconclusiveSubmitting}>Inconclusivo</Button>
                                                <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-700 h-12 px-6 rounded-xl text-base font-black shadow-lg shadow-emerald-200 dark:shadow-none" icon="check_circle" onClick={handleComplete} isLoading={submitting}>Concluir Avaliação</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 bg-slate-50 dark:bg-slate-900">
                                {/* Header da Etapa */}
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                                    <button onClick={() => setCurrentStep('MAIN')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition-all text-sm">
                                        <ArrowLeft className="size-4" /> Voltar
                                    </button>
                                    <div className="text-center flex-1 pr-10">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Formulário de Campo</p>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white leading-none">
                                            {currentStep === 'ANAMNESE' && 'Anamnese'}
                                            {currentStep === 'ESCUTA' && 'Equipe Pedagógica'}
                                            {currentStep === 'OBSERVACAO' && 'Observação'}
                                            {currentStep === 'INDIVIDUAL' && 'Avaliação Individual'}
                                        </h3>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        {currentStep === 'ANAMNESE' ? (
                                            <>
                                                {/* 1. Identificação */}
                                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                                                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                                                        <div className="size-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center"><User className="size-4"/></div>
                                                        <h4 className="text-sm uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-300">1. Identificação do Atendimento</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderInput label="Data do Atendimento" name="attendanceDate" value={anamnesisForm.attendanceDate} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} type="date" />
                                                        <RenderRadio label="Local do Atendimento" name="attendanceLocation" value={anamnesisForm.attendanceLocation} options={['CEES', 'Unidade de Ensino']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>
                                                </div>

                                                {/* 2. Dados da Família */}
                                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                                                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                                                        <div className="size-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><Users className="size-4"/></div>
                                                        <h4 className="text-sm uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-300">2. Estrutura e Dinâmica Familiar</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderInput label="Nome da Mãe" name="motherName" value={anamnesisForm.motherName} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderInput label="Contato (Mãe)" name="motherContact" value={anamnesisForm.motherContact} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderInput label="Nome do Pai" name="fatherName" value={anamnesisForm.fatherName} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderInput label="Contato (Pai)" name="fatherContact" value={anamnesisForm.fatherContact} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderInput label="Responsável Legal" name="respName" value={anamnesisForm.respName} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderInput label="Contato (Resp.)" name="respContact" value={anamnesisForm.respContact} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Tem Irmãos?" name="hasSiblings" value={anamnesisForm.hasSiblings} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.hasSiblings === 'Sim' && <RenderInput label="Quantos?" name="siblingsCount" value={anamnesisForm.siblingsCount} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>
                                                    <RenderCheckboxGroup label="Composição Familiar (Quem mora na casa?)" name="familyComposition" values={anamnesisForm.familyComposition} options={['Mãe', 'Pai', 'Irmãos', 'Tios', 'Avós', 'Outros']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    {anamnesisForm.familyComposition.includes('Outros') && <RenderInput label="Especifique 'Outros'" name="familyCompositionOther" value={anamnesisForm.familyCompositionOther} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Casos de Deficiência na Família?" name="familyDeficiency" value={anamnesisForm.familyDeficiency} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.familyDeficiency === 'Sim' && <RenderInput label="Quem e qual?" name="familyDeficiencyDetails" value={anamnesisForm.familyDeficiencyDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Acolhimento Institucional/Familiar?" name="fosterCare" value={anamnesisForm.fosterCare} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Medida Socioeducativa?" name="socioEducative" value={anamnesisForm.socioEducative} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.socioEducative === 'Sim' && <RenderRadio label="Tipo de Medida" name="socioEducativeType" value={anamnesisForm.socioEducativeType} options={['Liberdade Assistida', 'Prestação de Serviço']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>

                                                    <RenderCheckboxGroup label="Programas do Governo" name="govPrograms" values={anamnesisForm.govPrograms} options={['Bolsa Família', 'BPC', 'Outros']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    {anamnesisForm.govPrograms.includes('Outros') && <RenderInput label="Especifique Programas" name="govProgramsOther" value={anamnesisForm.govProgramsOther} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    
                                                    <RenderInput label="Situação Econômica / Profissões" name="financialStatus" value={anamnesisForm.financialStatus} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: Renda de 2 salários, pais desempregados, etc." />
                                                </div>

                                                {/* 3. Gestação e Parto */}
                                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                                                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                                                        <div className="size-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center"><History className="size-4"/></div>
                                                        <h4 className="text-sm uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-300">3. Antecedentes (Gestação e Parto)</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Gravidez Planejada?" name="familyPlanning" value={anamnesisForm.familyPlanning} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Fez Pré-Natal?" name="prenatal" value={anamnesisForm.prenatal} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {anamnesisForm.prenatal === 'Sim' && <RenderInput label="Iniciou no mês:" name="prenatalStartMonth" value={anamnesisForm.prenatalStartMonth} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        <RenderRadio label="Vacinas em dia?" name="vaccines" value={anamnesisForm.vaccines} options={['Sim', 'Não', 'Incompleta']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>
                                                    <RenderInput label="Estado Emocional da Mãe (Gestação)" name="motherEmotional" value={anamnesisForm.motherEmotional} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    <RenderInput label="Alimentação / Medicação (Gestação)" name="pregnancyEating" value={anamnesisForm.pregnancyEating} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Doenças na Gestação?" name="pregnancyDiseases" value={anamnesisForm.pregnancyDiseases} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.pregnancyDiseases === 'Sim' && <RenderInput label="Quais?" name="pregnancyDiseasesDetails" value={anamnesisForm.pregnancyDiseasesDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>

                                                    <RenderCheckboxGroup label="Ocorrências nas 24h pré-parto" name="beforeBirth24h" values={anamnesisForm.beforeBirth24h} options={['Dores', 'Corrimento', 'Hemorragia', 'Acidente', 'Eclampsia', 'Outros']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    {anamnesisForm.beforeBirth24h.includes('Outros') && <RenderInput label="Especifique" name="beforeBirthOther" value={anamnesisForm.beforeBirthOther} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <RenderInput label="Tempo Gestação" name="gestationTime" value={anamnesisForm.gestationTime} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 38 semanas" />
                                                        <RenderRadio label="Tipo Parto" name="birthType" value={anamnesisForm.birthType} options={['Normal', 'Cesárea']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Gravidez de Risco?" name="riskPregnancy" value={anamnesisForm.riskPregnancy} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Intercorrências no Parto?" name="birthComplications" value={anamnesisForm.birthComplications} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.birthComplications === 'Sim' && <RenderInput label="Quais?" name="birthComplicationsDetails" value={anamnesisForm.birthComplicationsDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                        <RenderRadio label="Chorou?" name="atBirthCried" value={anamnesisForm.atBirthCried} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Icterícia?" name="atBirthJaundice" value={anamnesisForm.atBirthJaundice} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Anoxia?" name="atBirthAnoxia" value={anamnesisForm.atBirthAnoxia} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Cianótico?" name="atBirthCyanotic" value={anamnesisForm.atBirthCyanotic} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>
                                                    
                                                    <RenderRadio label="Precisou de Incubadora?" name="incubator" value={anamnesisForm.incubator} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    
                                                    <RenderCheckboxGroup label="Testes Realizados" name="testsDone" values={anamnesisForm.testsDone} options={['Pezinho', 'Orelhinha', 'Olhinho', 'Coraçãozinho']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Alguma Alteração?" name="testsAlterations" value={anamnesisForm.testsAlterations} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.testsAlterations === 'Sim' && <RenderInput label="Especifique Alteração" name="testsAlterationsDetails" value={anamnesisForm.testsAlterationsDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>
                                                </div>

                                                {/* 4. Desenvolvimento */}
                                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                                                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                                                        <div className="size-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckSquare className="size-4"/></div>
                                                        <h4 className="text-sm uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-300">4. Desenvolvimento Psicomotor e Linguagem</h4>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                        <RenderInput label="Sustentou Cabeça" name="devHead" value={anamnesisForm.devHead} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 3 m" />
                                                        <RenderInput label="Sentou" name="devSit" value={anamnesisForm.devSit} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 6 m" />
                                                        <RenderInput label="Engatinhou" name="devCrawl" value={anamnesisForm.devCrawl} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 8 m" />
                                                        <RenderInput label="Ficou em pé" name="devStand" value={anamnesisForm.devStand} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 10 m" />
                                                        <RenderInput label="Andou" name="devWalk" value={anamnesisForm.devWalk} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 1 ano" />
                                                        <RenderInput label="Balbuciou" name="devBabble" value={anamnesisForm.devBabble} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 6 m" />
                                                        <RenderInput label="Primeiras Palavras" name="devWords" value={anamnesisForm.devWords} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} placeholder="Ex: 1 ano" />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                                        <RenderRadio label="Chupeta?" name="habitsPacifier" value={anamnesisForm.habitsPacifier} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Chupa Dedo?" name="habitsThumb" value={anamnesisForm.habitsThumb} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Mamou peito?" name="habitsBreastMilk" value={anamnesisForm.habitsBreastMilk} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Complemento / Substituto</label>
                                                            <div className="flex gap-4">
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input type="checkbox" checked={anamnesisForm.foodComplement} onChange={e => setAnamnesisForm({...anamnesisForm, foodComplement: e.target.checked})} className="size-4 rounded text-primary border-slate-300" />
                                                                    <span className="text-sm font-medium text-slate-600">Complemento</span>
                                                                </label>
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input type="checkbox" checked={anamnesisForm.foodSubstitute} onChange={e => setAnamnesisForm({...anamnesisForm, foodSubstitute: e.target.checked})} className="size-4 rounded text-primary border-slate-300" />
                                                                    <span className="text-sm font-medium text-slate-600">Substituto</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <RenderRadio label="Introdução Alimentar" name="foodIntroduction" value={anamnesisForm.foodIntroduction} options={['Antes dos 6 meses', 'Após os 6 meses']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>
                                                </div>

                                                {/* 5. Dados Adicionais Atuais */}
                                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                                                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                                                        <div className="size-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Search className="size-4"/></div>
                                                        <h4 className="text-sm uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-300">5. Dados Adicionais Atuais</h4>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Possui Deficiência?" name="hasDeficiency" value={anamnesisForm.hasDeficiency} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.hasDeficiency === 'Sim' && <RenderInput label="Qual/CID?" name="deficiencyCid" value={anamnesisForm.deficiencyCid} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>

                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                                                            <RenderRadio label="Seletividade Alimentar?" name="selectiveEating" value={anamnesisForm.selectiveEating} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            {anamnesisForm.selectiveEating === 'Sim' && <RenderInput label="Detalhes" name="selectiveEatingDetails" value={anamnesisForm.selectiveEatingDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                                                            <RenderRadio label="Restrição Alimentar?" name="restrictedEating" value={anamnesisForm.restrictedEating} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            {anamnesisForm.restrictedEating === 'Sim' && <RenderInput label="Detalhes" name="restrictedEatingDetails" value={anamnesisForm.restrictedEatingDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Sono Agitado?" name="sleepAgitated" value={anamnesisForm.sleepAgitated} options={['Sim', 'Não', 'Às vezes']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Choro Constante?" name="constantCrying" value={anamnesisForm.constantCrying} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-4">
                                                            <RenderRadio label="Roe Unhas?" name="bitesNails" value={anamnesisForm.bitesNails} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            {anamnesisForm.bitesNails === 'Sim' && <RenderInput label="Frequência" name="bitesNailsFreq" value={anamnesisForm.bitesNailsFreq} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        </div>
                                                        <RenderRadio label="Bruxismo?" name="bruxism" value={anamnesisForm.bruxism} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderInput label="Outras Manipulações (Ex: tiques)" name="otherManipulations" value={anamnesisForm.otherManipulations} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Frênulo de Língua Curto?" name="shortFrenulum" value={anamnesisForm.shortFrenulum} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-4">
                                                            <RenderRadio label="Já fez Cirurgia?" name="surgery" value={anamnesisForm.surgery} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            {anamnesisForm.surgery === 'Sim' && <RenderInput label="Qual?" name="surgeryDetails" value={anamnesisForm.surgeryDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-4">
                                                            <RenderRadio label="Trauma/Internação?" name="trauma" value={anamnesisForm.trauma} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            {anamnesisForm.trauma === 'Sim' && <RenderInput label="Detalhes" name="traumaDetails" value={anamnesisForm.traumaDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                                                        <RenderRadio label="Desmaios?" name="fainting" value={anamnesisForm.fainting} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Convulsões?" name="convulsions" value={anamnesisForm.convulsions} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-4">
                                                        <RenderRadio label="Doenças Atuais?" name="currentDiseases" value={anamnesisForm.currentDiseases} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.currentDiseases === 'Sim' && <RenderInput label="Quais?" name="currentDiseasesDetails" value={anamnesisForm.currentDiseasesDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                    </div>

                                                    <RenderCheckboxGroup label="Atendimento Clínico Atual" name="clinicalCare" values={anamnesisForm.clinicalCare} options={['Fonoaudiologia', 'Psicologia', 'Psicoterapia', 'Terapia Ocupacional', 'Fisioterapia', 'Equoterapia', 'Outros']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    {anamnesisForm.clinicalCare.includes('Outros') && <RenderInput label="Especifique Atendimentos" name="clinicalCareOther" value={anamnesisForm.clinicalCareOther} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}

                                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-4">
                                                        <RenderRadio label="Faz uso de Medicação?" name="medications" value={anamnesisForm.medications} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        {anamnesisForm.medications === 'Sim' && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <RenderInput label="Quais medicações?" name="medicationsDetails" value={anamnesisForm.medicationsDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                                <RenderCheckboxGroup label="Horários" name="medicationsTime" values={anamnesisForm.medicationsTime} options={['Manhã', 'Tarde', 'Noite']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <RenderCheckboxGroup label="Relacionamento / Lazer" name="relationship" values={anamnesisForm.relationship} options={['Com família', 'Com crianças', 'Sozinho', 'Gosta de brincar', 'Outros']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <RenderRadio label="Tende a cair?" name="tendencyToFall" value={anamnesisForm.tendencyToFall} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Tende a se machucar?" name="tendencyToInjure" value={anamnesisForm.tendencyToInjure} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Autolesão?" name="tendencyToSelfHarm" value={anamnesisForm.tendencyToSelfHarm} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <RenderRadio label="Dificuldade em manipular objetos?" name="objectManipulationDifficulty" value={anamnesisForm.objectManipulationDifficulty} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderInput label="Outras Dificuldades" name="otherDifficulties" value={anamnesisForm.otherDifficulties} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>

                                                    <RenderCheckboxGroup label="Tipo de Comunicação" name="communicationType" values={anamnesisForm.communicationType} options={['Verbal', 'Não Verbal', 'Mista', 'Sinalizada']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-4">
                                                            <RenderRadio label="Excesso de Telas?" name="screenTimeExcess" value={anamnesisForm.screenTimeExcess} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            {anamnesisForm.screenTimeExcess === 'Sim' && <RenderInput label="Quantas horas/dia?" name="screenTimeDetails" value={anamnesisForm.screenTimeDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-4">
                                                            <RenderRadio label="Limitação na Adaptação Escolar?" name="schoolAdaptationLimitation" value={anamnesisForm.schoolAdaptationLimitation} options={['Sim', 'Não']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                            {anamnesisForm.schoolAdaptationLimitation === 'Sim' && <RenderInput label="Que tipo?" name="schoolAdaptationDetails" value={anamnesisForm.schoolAdaptationDetails} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 6. AVDs */}
                                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                                                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                                                        <div className="size-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><CheckSquare className="size-4"/></div>
                                                        <h4 className="text-sm uppercase tracking-wider font-extrabold text-slate-600 dark:text-slate-300">6. Atividades de Vida Diária (AVDs)</h4>
                                                    </div>
                                                    <div className="space-y-6">
                                                        <RenderRadio label="Alimentação" name="avdFeeding" value={anamnesisForm.avdFeeding} options={['Independente', 'Dependência parcial', 'Dependência completa']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Vestuário" name="avdDressing" value={anamnesisForm.avdDressing} options={['Independente', 'Dependência parcial', 'Dependência completa']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Higiene Pessoal" name="avdHygiene" value={anamnesisForm.avdHygiene} options={['Independente', 'Dependência parcial', 'Dependência completa']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Controle Esfincteriano (Bexiga)" name="avdBladder" value={anamnesisForm.avdBladder} options={['Independente', 'Dependência parcial', 'Dependência completa']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                        <RenderRadio label="Controle Esfincteriano (Intestino)" name="avdBowel" value={anamnesisForm.avdBowel} options={['Independente', 'Dependência parcial', 'Dependência completa']} onChange={(k:any,v:any)=>setAnamnesisForm({...anamnesisForm, [k]:v})} />
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="size-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><ClipboardList className="size-4"/></div>
                                                    <h4 className="text-sm uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Anotações da Etapa</h4>
                                                </div>
                                                <textarea 
                                                    value={stepNotes} 
                                                    onChange={e => setStepNotes(e.target.value)}
                                                    className="w-full h-[40vh] p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-none outline-none focus:ring-4 focus:ring-primary/10 text-sm leading-relaxed shadow-inner"
                                                    placeholder="Digite aqui livremente suas anotações..."
                                                />
                                                <p className="text-[10px] text-slate-400 mt-4 italic text-center uppercase tracking-widest font-bold">O trabalho salvo aqui fica visível para os outros assessores da equipe.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>


                                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-4">
                                    <Button variant="ghost" className="h-10 px-6 rounded-xl" onClick={() => setCurrentStep('MAIN')}>Cancelar</Button>
                                    <Button variant="primary" className="h-10 px-8 rounded-xl text-sm font-black shadow-xl" icon="save" onClick={handleSaveStep} isLoading={isSavingStep}>Salvar e Voltar</Button>
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
            {/* MODAL DE VISUALIZAÇÃO DE PARECER (READ-ONLY) */}
            {isViewParecerOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/50">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <CheckCircle />
                                </div>
                                <div>
                                    <h2 className="text-sm uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Parecer Técnico Concluído</h2>
                                    <p className="text-[10px] text-slate-500">Protocolo {selectedRequest.protocol_number}</p>
                                </div>
                            </div>
                            <button onClick={() => { setIsViewParecerOpen(false); setSelectedRequest(null); }} className="size-10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-4 no-scrollbar">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <p className="text-xs uppercase font-bold text-slate-400 mb-1">Estudante</p>
                                <p className="text-base font-black text-slate-900 dark:text-white">{selectedRequest.student_name}</p>
                                <p className="text-sm text-slate-500 italic mt-0.5">{selectedRequest.schools?.name}</p>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                                    <ClipboardList className="text-sm" /> Parecer Técnico Final
                                </h4>
                                <div className="p-4 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-300 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedRequest.final_report_text || 'Nenhum texto de parecer disponível.'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Suporte Indicado</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedRequest.specialized_support || 'Não informado'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Reavaliação</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedRequest.reassessment_needed ? `Necessária (${selectedRequest.reassessment_period})` : 'Não necessária'}</p>
                                </div>
                            </div>

                            {selectedRequest.final_report_file_url && (
                                <a 
                                    href={selectedRequest.final_report_file_url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10 group hover:bg-primary/10 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-primary shadow-sm"><CheckCircle /></div>
                                        <span className="text-sm font-bold text-primary">Abrir PDF do Parecer Assinado</span>
                                    </div>
                                    <ArrowLeft className="rotate-180 text-primary group-hover:translate-x-1 transition-transform" />
                                </a>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                            <Button variant="primary" onClick={() => { setIsViewParecerOpen(false); setSelectedRequest(null); }}>Fechar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: SOLICITAÇÃO DE DESBLOQUEIO */}
            {isUnlockModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-amber-50 text-amber-700 flex justify-between items-center">
                            <h2 className="text-lg font-black flex items-center gap-2">Solicitar Reabertura</h2>
                            <button onClick={() => setIsUnlockModalOpen(false)}><X /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Explique o motivo pelo qual você precisa alterar a avaliação de <span className="font-bold text-slate-900 dark:text-white">{selectedRequest.student_name}</span> após a conclusão.
                            </p>
                            <textarea 
                                value={unlockReason} 
                                onChange={e => setUnlockReason(e.target.value)}
                                placeholder="Descreva aqui o motivo..."
                                className="w-full h-32 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary outline-none text-sm leading-relaxed"
                            />
                            <div className="flex gap-3 pt-2">
                                <Button className="flex-1 bg-slate-100 text-slate-600 rounded-2xl" onClick={() => setIsUnlockModalOpen(false)}>Cancelar</Button>
                                <Button className="flex-1 bg-amber-600 text-white rounded-2xl shadow-lg shadow-amber-100" onClick={handleRequestUnlock} isLoading={requestingUnlock} icon="history">Solicitar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL DE DESBLOQUEIO */}
            {isUnlockModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="size-14 rounded-2xl bg-amber-100 flex items-center justify-center">
                                    <History className="text-amber-600 size-7" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Solicitar Alteração</h2>
                                    <p className="text-sm text-slate-500 font-medium">Esta avaliação já foi concluída.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Justificativa da Alteração</span>
                                    <textarea 
                                        className="w-full p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none text-sm font-medium min-h-[120px]"
                                        placeholder="Descreva por que você precisa editar esta avaliação..."
                                        value={unlockReason}
                                        onChange={(e) => setUnlockReason(e.target.value)}
                                    />
                                </label>
                            </div>

                            <div className="flex gap-3">
                                <Button 
                                    variant="ghost" 
                                    className="flex-1 rounded-2xl h-14 font-black" 
                                    onClick={() => setIsUnlockModalOpen(false)}
                                    disabled={requestingUnlock}
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200 rounded-2xl h-14 font-black"
                                    onClick={handleRequestUnlock}
                                    isLoading={requestingUnlock}
                                >
                                    Enviar Pedido
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
