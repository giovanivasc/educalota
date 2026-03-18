import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { EvaluationRequest } from '../types';

interface ProtocolManagerProps {
    onCancel: () => void;
}

export default function ProtocolManager({ onCancel }: ProtocolManagerProps) {
    // Search state
    const [trackProtocol, setTrackProtocol] = useState('');
    const [trackBirthDate, setTrackBirthDate] = useState('');
    const [loadingSearch, setLoadingSearch] = useState(false);

    // Data state
    const [requestData, setRequestData] = useState<EvaluationRequest | null>(null);

    // Form state (only editable if DRAFT or RETURNED)
    const [pedagogicalObs, setPedagogicalObs] = useState('');
    const [relationalObs, setRelationalObs] = useState('');
    const [methodologicalObs, setMethodologicalObs] = useState('');

    // File state
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [savingMsg, setSavingMsg] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackProtocol || !trackBirthDate) return alert("Preencha todos os campos.");

        setLoadingSearch(true);
        setRequestData(null);
        try {
            const { data, error } = await supabase
                .from('evaluation_requests')
                .select('*')
                .eq('protocol_number', trackProtocol.trim())
                .eq('student_birth_date', trackBirthDate)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    alert('Protocolo não encontrado para esta data de nascimento.');
                } else {
                    throw error;
                }
            }

            if (data) {
                setRequestData(data as EvaluationRequest);
                setPedagogicalObs(data.pedagogical_observations || '');
                setRelationalObs(data.relational_observations || '');
                setMethodologicalObs(data.methodological_observations || '');
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao buscar protocolo.");
        } finally {
            setLoadingSearch(false);
        }
    };

    const isEditable = requestData?.status === 'DRAFT' || requestData?.status === 'RETURNED';

    const handleSaveDraft = async () => {
        if (!requestData) return;
        setSavingMsg('Salvando rascunho...');

        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    pedagogical_observations: pedagogicalObs,
                    relational_observations: relationalObs,
                    methodological_observations: methodologicalObs,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestData.id);

            if (error) throw error;

            setRequestData({
                ...requestData,
                pedagogical_observations: pedagogicalObs,
                relational_observations: relationalObs,
                methodological_observations: methodologicalObs,
            });
            alert("Rascunho salvo com sucesso.");
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar rascunho.");
        } finally {
            setSavingMsg('');
        }
    };

    const handlePrintConsent = () => {
        if (!requestData) return;
        window.open(`/api/print-consent?id=${requestData.id}`, '_blank');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmitCEES = async () => {
        if (!requestData) return;
        if (!pedagogicalObs.trim() || !relationalObs.trim() || !methodologicalObs.trim()) {
            return alert("Preencha todas as observações antes de enviar.");
        }

        let fileUrl = requestData.authorization_file_url;

        if (file) {
            setUploading(true);
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${requestData.protocol_number}_${Date.now()}.${fileExt}`;
                const filePath = `autorizacoes/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('autorizacoes')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('autorizacoes')
                    .getPublicUrl(filePath);

                fileUrl = urlData.publicUrl;
            } catch (err) {
                console.error("Erro no upload:", err);
                alert("Erro ao enviar o arquivo de autorização.");
                setUploading(false);
                return;
            }
        }

        if (!fileUrl) {
            return alert("Você precisa anexar o termo de autorização assinado.");
        }

        setSavingMsg('Enviando para o CEES...');
        try {
            const { error } = await supabase
                .from('evaluation_requests')
                .update({
                    pedagogical_observations: pedagogicalObs,
                    relational_observations: relationalObs,
                    methodological_observations: methodologicalObs,
                    authorization_file_url: fileUrl,
                    status: 'PENDING_CEES',
                    history: [
                        ...(requestData.history || []),
                        {
                            date: new Date().toISOString(),
                            action: 'ENVIO',
                            result: 'Encaminhado',
                            description: `Solicitação enviada pela escola para triagem.`,
                            actor: 'Escola (Público)',
                            assessors: 'N/A'
                        }
                    ],
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestData.id);

            if (error) throw error;

            setRequestData({
                ...requestData,
                status: 'PENDING_CEES',
                authorization_file_url: fileUrl,
                history: [
                    ...(requestData.history || []),
                    {
                        date: new Date().toISOString(),
                        action: 'ENVIO',
                        result: 'Encaminhado',
                        description: `Solicitação enviada pela escola para triagem.`,
                        actor: 'Escola (Público)',
                        assessors: 'N/A'
                    }
                ]
            } as EvaluationRequest);

            alert("Sua solicitação e a folha de autorização foram enviadas com sucesso para a Coordenadoria de Educação Especial (CEES)!");
        } catch (err) {
            console.error(err);
            alert("Erro ao enviar solicitação.");
        } finally {
            setUploading(false);
            setSavingMsg('');
        }
    };

    const canSubmit = pedagogicalObs.trim().length > 0 &&
        relationalObs.trim().length > 0 &&
        methodologicalObs.trim().length > 0 &&
        (file || requestData?.authorization_file_url);

    if (!requestData) {
        return (
            <form onSubmit={handleSearch} className="mt-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Consultar Protocolo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Número do Protocolo</span>
                        <input
                            type="text"
                            value={trackProtocol}
                            onChange={(e) => setTrackProtocol(e.target.value)}
                            placeholder="Ex: CEES-20261010-1234"
                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Data de Nascimento (Aluno)</span>
                        <input
                            type="date"
                            value={trackBirthDate}
                            onChange={(e) => setTrackBirthDate(e.target.value)}
                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            required
                        />
                    </label>
                </div>
                <div className="flex gap-3 justify-end">
                    <Button type="button" variant="ghost" onClick={onCancel}>Voltar</Button>
                    <Button type="submit" icon="search" isLoading={loadingSearch}>Buscar</Button>
                </div>
            </form>
        );
    }

    return (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setRequestData(null)} className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-4">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span> Voltar à Busca
            </button>

            <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-8">
                {/* Header Info */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">Protocolo {requestData.protocol_number}</h3>
                        <p className="text-slate-500 mt-1">{requestData.student_name} • {requestData.request_type}</p>
                    </div>
                    <div>
                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                            requestData.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                            requestData.status === 'RETURNED' ? 'bg-red-100 text-red-700' :
                            requestData.status === 'PENDING_CEES' ? 'bg-blue-100 text-blue-700' :
                            requestData.status === 'SCHEDULED' ? 'bg-purple-100 text-purple-700' :
                            requestData.status === 'INCONCLUSIVE' ? 'bg-orange-100 text-orange-700' :
                            requestData.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-700'
                            }`}>
                            {requestData.status === 'DRAFT' ? 'Rascunho' :
                             requestData.status === 'RETURNED' ? 'Devolvido (Pendente de Ajustes)' :
                             requestData.status === 'PENDING_CEES' ? 'Aguardando Triagem CEES' :
                             requestData.status === 'SCHEDULED' ? 'Avaliação Agendada' :
                             requestData.status === 'INCONCLUSIVE' ? 'Avaliação Inconclusiva' :
                             requestData.status === 'COMPLETED' ? 'Avaliação Finalizada' : requestData.status}
                        </span>
                    </div>
                </div>

                {/* Histórico Público */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">history_edu</span>
                        Acompanhamento da Solicitação
                    </h4>
                    <div className="space-y-4">
                        {requestData.history && requestData.history.length > 0 ? (
                            <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                                {requestData.history.slice().reverse().map((event: any, idx: number) => {
                                    // Regra de privacidade: esconder descrição para Inconclusivo e Finalização (notas internas)
                                    const showDescription = !['INCONCLUSIVO', 'FINALIZAÇÃO'].includes(event.action);
                                    
                                    return (
                                        <div key={idx} className="pl-6 relative">
                                            <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-primary z-10 shadow-sm"></div>
                                            <div className="flex justify-between items-start">
                                                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded tracking-wider">
                                                    {event.action}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(event.date).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                                                {event.result}
                                            </p>
                                            {showDescription && event.description && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                                    {event.description}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-400 text-xs italic">
                                Nenhuma movimentação registrada no sistema.
                            </div>
                        )}
                    </div>
                </div>

                {!isEditable && requestData.status !== 'COMPLETED' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 p-4 rounded-xl font-medium">
                        Esta solicitação encontra-se em processamento pela equipe CEES e não pode ser editada no momento.
                    </div>
                )}

                {requestData.status === 'COMPLETED' && (
                    <div className="space-y-6 animate-in slide-in-from-top-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center gap-4">
                            <span className="material-symbols-outlined text-4xl text-emerald-600">verified</span>
                            <div className="flex-1 text-center sm:text-left">
                                <h3 className="text-lg sm:text-xl font-black">Processo de Avaliação Concluído</h3>
                                <p className="text-sm mt-1 opacity-90">O relatório técnico final foi emitido pela equipe multidisciplinar.</p>
                            </div>
                        </div>

                        {requestData.final_report_text && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">clinical_notes</span>
                                    Parecer Técnico Final
                                </h4>
                                <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                    {requestData.final_report_text}
                                </div>
                            </div>
                        )}

                        {requestData.final_report_file_url && (
                            <div className="pt-2 flex justify-center sm:justify-start">
                                <a
                                    href={requestData.final_report_file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 w-full sm:w-auto"
                                >
                                    <span className="material-symbols-outlined">cloud_download</span>
                                    Descarregar Parecer Técnico (PDF)
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {isEditable && (
                    <div className="space-y-6">
                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200">Questionário do Aluno</h4>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Observações Pedagógicas *</span>
                            <textarea
                                value={pedagogicalObs}
                                onChange={(e) => setPedagogicalObs(e.target.value)}
                                rows={4}
                                className="p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                placeholder="Descreva as habilidades acadêmicas, dificuldades de aprendizagem..."
                            />
                        </label>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Observações Relacionais / Comportamentais *</span>
                            <textarea
                                value={relationalObs}
                                onChange={(e) => setRelationalObs(e.target.value)}
                                rows={4}
                                className="p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                placeholder="Interação com colegas e professores, comportamento em sala de aula, regulação emocional..."
                            />
                        </label>

                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Observações Metodológicas (Acessibilidade) *</span>
                            <textarea
                                value={methodologicalObs}
                                onChange={(e) => setMethodologicalObs(e.target.value)}
                                rows={4}
                                className="p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                placeholder="Quais adaptações o aluno precisa (material ampliado, tempo extra, mediador, etc)?..."
                            />
                        </label>
                    </div>
                )}

                {isEditable && (
                    <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200">Autorização dos Pais/Responsáveis</h4>
                        <p className="text-slate-500 text-sm">Gere o termo de consentimento, colha a assinatura do responsável e anexe o arquivo digitalizado (PDF ou Imagem) abaixo.</p>

                        <div className="flex flex-wrap gap-4 items-center">
                            <Button type="button" variant="secondary" icon="print" onClick={handlePrintConsent}>
                                Gerar Documento de Autorização
                            </Button>

                            <div className="relative">
                                <input
                                    type="file"
                                    id="auth-upload"
                                    className="hidden"
                                    accept=".pdf,image/*"
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="auth-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                                    <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                    {file ? file.name : (requestData.authorization_file_url ? 'Modificar Anexo' : 'Anexar Autorização Assinada')}
                                </label>
                            </div>
                        </div>

                        {requestData.authorization_file_url && !file && (
                            <div className="text-emerald-600 text-sm font-bold flex items-center gap-1 mt-2">
                                <span className="material-symbols-outlined text-[16px]">check_circle</span> Arquivo já anexado
                            </div>
                        )}
                    </div>
                )}

                {/* Action Footer */}
                {isEditable && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 mt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="text-sm font-medium text-slate-500">
                            {savingMsg || (uploading ? 'Processando arquivo...' : '')}
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <Button type="button" variant="outline" icon="save" onClick={handleSaveDraft} className="flex-1 sm:flex-none">
                                Salvar Rascunho
                            </Button>
                            <Button type="button" icon="send" disabled={!canSubmit || uploading} onClick={handleSubmitCEES} className="flex-1 sm:flex-none">
                                Enviar pedido para CEES
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
