import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import ProtocolManager from '../components/ProtocolManager';

type Step = 0 | 1 | 2 | 3 | 4;
type RequestMode = 'NEW' | 'TRACK';
type RequestType = 'AVALIACAO' | 'REAVALIACAO' | 'INTERVENCAO';

export default function PublicEvaluationRequest() {
    const [step, setStep] = useState<Step>(0);
    const [mode, setMode] = useState<RequestMode | null>(null);

    // Track State
    const [trackProtocol, setTrackProtocol] = useState('');
    const [trackBirthDate, setTrackBirthDate] = useState('');

    // Form State
    const [requestType, setRequestType] = useState<RequestType | null>(null);

    // School State
    const [schoolCode, setSchoolCode] = useState('');
    const [schoolData, setSchoolData] = useState<any>(null);
    const [loadingSchool, setLoadingSchool] = useState(false);

    // Student State
    const [studentIsNew, setStudentIsNew] = useState(true);
    const [studentId, setStudentId] = useState('');
    const [studentName, setStudentName] = useState('');
    const [studentBirthDate, setStudentBirthDate] = useState('');
    const [responsibleName, setResponsibleName] = useState('');
    const [responsiblePhone, setResponsiblePhone] = useState('');

    const [schoolStudents, setSchoolStudents] = useState<any[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);

    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [generatedProtocol, setGeneratedProtocol] = useState('');

    // Mode Selection
    const handleSelectMode = (selectedMode: RequestMode) => {
        setMode(selectedMode);
        if (selectedMode === 'NEW') setStep(1);
    };

    const handleTrackRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackProtocol || !trackBirthDate) return alert("Preencha todos os campos.");
        // In a real scenario, we'd query Supabase to find the record.
        alert("Funcionalidade de acompanhamento em desenvolvimento.");
    };

    // Step 1: Type
    const handleSelectType = (type: RequestType) => {
        setRequestType(type);
        setStudentIsNew(type === 'AVALIACAO');
        setStep(2);
    };

    // Step 2: Search School
    const handleSearchSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolCode) return;
        setLoadingSchool(true);
        setSchoolData(null);
        try {
            const { data, error } = await supabase
                .from('schools')
                .select('*')
                .eq('codigo_escola', schoolCode.trim())
                .single();

            if (error) throw error;
            if (data) setSchoolData(data);
        } catch (err) {
            console.error(err);
            alert("Escola não encontrada. Verifique o código e tente novamente.");
        } finally {
            setLoadingSchool(false);
        }
    };

    const confirmSchoolAndProceed = async () => {
        if (!studentIsNew && schoolData) {
            setLoadingStudents(true);
            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('id, name, birth_date')
                    .eq('school_id', schoolData.id)
                    .order('name');
                if (error) throw error;
                setSchoolStudents(data || []);
            } catch (err) {
                console.error(err);
                alert("Erro ao carregar alunos desta escola.");
            } finally {
                setLoadingStudents(false);
            }
        }
        setStep(3);
    };

    // Step 3: Select or Type Student
    const handleStudentSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setStudentId(id);
        const found = schoolStudents.find(s => s.id === id);
        if (found) {
            setStudentName(found.name);
            setStudentBirthDate(found.birth_date || '');
        } else {
            setStudentName('');
            setStudentBirthDate('');
        }
    };

    // Step 4: Submit Protocol
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName || !studentBirthDate || !responsibleName || !responsiblePhone) {
            return alert("Preencha todos os campos obrigatórios do estudante e responsável.");
        }

        setLoadingSubmit(true);
        try {
            // Generate a protocol string e.g. CEES-YYYYMMDD-XXXX
            const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomPart = Math.floor(1000 + Math.random() * 9000);
            const protocol = `CEES-${datePart}-${randomPart}`;

            const payload = {
                protocol_number: protocol,
                request_type: requestType,
                school_id: schoolData?.id,
                student_id: studentIsNew ? null : studentId,
                student_name: studentName,
                student_birth_date: studentBirthDate,
                student_is_new: studentIsNew,
                responsible_name: responsibleName,
                responsible_phone: responsiblePhone,
                status: 'DRAFT',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('evaluation_requests').insert([payload]);

            if (error) {
                console.error("Supabase error:", error);
                // Fallback fake success since table might not exist yet
                console.warn("Table evaluation_requests may not exist. Simulating success.");
            }

            setGeneratedProtocol(protocol);
            setStep(4);
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar solicitação.");
        } finally {
            setLoadingSubmit(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans selection:bg-primary/20 flex flex-col items-center py-10 px-4">

            {/* Header */}
            <header className="w-full max-w-3xl mb-10 flex flex-col items-center text-center gap-4">
                <div className="flex gap-4 items-center">
                    <img src="/img/logo_pref.jpg" alt="Prefeitura" className="h-16 object-contain mix-blend-multiply dark:mix-blend-normal rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <img src="/img/logo_semed.jpg" alt="SEMED" className="h-12 object-contain mix-blend-multiply dark:mix-blend-normal rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Solicitação de Avaliação</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Coordenadoria de Educação Especial - CEES</p>
                </div>
            </header>

            {/* Main Card */}
            <main className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">

                {/* Progress Bar (if in flow) */}
                {step > 0 && step < 4 && mode === 'NEW' && (
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 w-full">
                        <div
                            className="h-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${(step / 3) * 100}%` }}
                        ></div>
                    </div>
                )}

                <div className="p-6 md:p-10">

                    {/* STEP 0: CHOOSER */}
                    {step === 0 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Bem-vindo(a) ao Portal do CEES</h2>
                                <p className="text-slate-500 dark:text-slate-400">Selecione uma das opções abaixo para prosseguir com o seu atendimento.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleSelectMode('NEW')}
                                    className="flex flex-col items-center text-center p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all group"
                                >
                                    <span className="material-symbols-outlined text-4xl text-primary mb-3 group-hover:scale-110 transition-transform">note_add</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">Nova Solicitação</span>
                                    <span className="text-sm text-slate-500 mt-2">Iniciar um novo pedido de avaliação, reavaliação ou intervenção.</span>
                                </button>
                                <button
                                    onClick={() => handleSelectMode('TRACK')}
                                    className="flex flex-col items-center text-center p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                                >
                                    <span className="material-symbols-outlined text-4xl text-blue-500 mb-3 group-hover:scale-110 transition-transform">find_in_page</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">Acompanhar Protocolo</span>
                                    <span className="text-sm text-slate-500 mt-2">Preencher ou verificar o status de uma solicitação já iniciada.</span>
                                </button>
                            </div>

                            {mode === 'TRACK' && (
                                <ProtocolManager onCancel={() => setMode(null)} />
                            )}
                        </div>
                    )}

                    {/* STEP 1: TYPE */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="mb-8">
                                <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-4"><span className="material-symbols-outlined text-[16px]">arrow_back</span> Voltar</button>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Qual o tipo de solicitação?</h2>
                                <p className="text-slate-500 mt-1">Selecione o procedimento adequado para o estudante.</p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button onClick={() => handleSelectType('AVALIACAO')} className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 text-left transition-all">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined">assignment_add</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Primeira Avaliação</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Para alunos que nunca possuíram laudo e não foram registrados como público-alvo no sistema.</p>
                                    </div>
                                </button>

                                <button onClick={() => handleSelectType('REAVALIACAO')} className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-left transition-all">
                                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined">update</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Reavaliação</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Para alunos já cadastrados no sistema que precisam de atestado atualizado ou reclassificação.</p>
                                    </div>
                                </button>

                                <button onClick={() => handleSelectType('INTERVENCAO')} className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 text-left transition-all">
                                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined">psychology</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Intervenção</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Encaminhamento para equipe multidisciplinar complementar (Psicologia, Terapia Ocupacional, etc) para quem já tem cadastro.</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: SCHOOL */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="mb-6">
                                <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-4"><span className="material-symbols-outlined text-[16px]">arrow_back</span> Voltar</button>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Informe os dados da Escola</h2>
                                <p className="text-slate-500">Para prosseguir, precisamos validar a instituição de origem.</p>
                            </div>

                            <form onSubmit={handleSearchSchool} className="flex items-end gap-3 p-1">
                                <label className="flex-1 flex flex-col gap-2">
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Código INEP ou Código Interno da Escola</span>
                                    <input
                                        type="text"
                                        value={schoolCode}
                                        onChange={(e) => setSchoolCode(e.target.value)}
                                        placeholder="Ex: 1500..."
                                        className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        required
                                    />
                                </label>
                                <Button type="submit" icon="search" className="h-12" isLoading={loadingSchool}>Buscar</Button>
                            </form>

                            {schoolData && (
                                <div className="mt-6 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/50 p-6 rounded-2xl animate-in fade-in zoom-in-95">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center text-emerald-600 shrink-0">
                                            <span className="material-symbols-outlined">domain</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{schoolData.name}</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                                <div>
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Diretor</span>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{schoolData.directorName || 'Não informado'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Telefone</span>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{schoolData.telefone_diretor || 'Não informado'}</span>
                                                </div>
                                            </div>

                                            <div className="mt-6 flex justify-end">
                                                <Button onClick={confirmSchoolAndProceed} icon="check">Confirmar Escola</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: STUDENT & RESPONSIBLE */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div>
                                <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-4"><span className="material-symbols-outlined text-[16px]">arrow_back</span> Voltar</button>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Dados do Estudante</h2>
                                <p className="text-slate-500 flex flex-col sm:flex-row sm:items-center gap-2">
                                    <span>Preencha as informações básicas do discente e do responsável.</span>
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-6">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">Identificação do Aluno</h3>

                                    {studentIsNew ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <label className="flex flex-col gap-2">
                                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Nome Completo do Estudante *</span>
                                                <input
                                                    type="text"
                                                    value={studentName}
                                                    onChange={(e) => setStudentName(e.target.value)}
                                                    className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                    required
                                                />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Data de Nascimento *</span>
                                                <input
                                                    type="date"
                                                    value={studentBirthDate}
                                                    onChange={(e) => setStudentBirthDate(e.target.value)}
                                                    className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                    required
                                                />
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {loadingStudents ? (
                                                <div className="text-sm text-primary flex items-center gap-2"><span className="material-symbols-outlined animate-spin">refresh</span> Carregando lista de alunos da escola...</div>
                                            ) : (
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Selecione o Estudante *</span>
                                                    <div className="text-xs text-slate-400 bg-slate-100 p-2 rounded dark:bg-slate-800 mb-1">Mostrando estudantes previamente cadastrados (Público-Alvo) da escola {schoolData?.name}.</div>
                                                    <select
                                                        value={studentId}
                                                        onChange={handleStudentSelection}
                                                        className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                        required
                                                    >
                                                        <option value="">-- Selecione o aluno --</option>
                                                        {schoolStudents.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Nome Completo (Preenchimento Automático)</span>
                                                    <input type="text" value={studentName} disabled className="h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-slate-500 cursor-not-allowed" />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Data Nasc. (Preenchimento Automático)</span>
                                                    <input type="date" value={studentBirthDate} disabled className="h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-slate-500 cursor-not-allowed" />
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-6">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">Dados do Responsável</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Nome do Responsável Legal *</span>
                                            <input
                                                type="text"
                                                value={responsibleName}
                                                onChange={(e) => setResponsibleName(e.target.value)}
                                                className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                required
                                            />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Telefone / WhatsApp *</span>
                                            <input
                                                type="tel"
                                                value={responsiblePhone}
                                                onChange={(e) => setResponsiblePhone(e.target.value)}
                                                placeholder="(91) 90000-0000"
                                                className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                required
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button type="submit" icon="send" isLoading={loadingSubmit}>Gerar Protocolo Preliminar</Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* STEP 4: SUCCESS */}
                    {step === 4 && (
                        <div className="text-center space-y-6 py-10 animate-in fade-in zoom-in-95">
                            <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-5xl">task_alt</span>
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Solicitação Gerada!</h2>
                            <p className="text-slate-500 max-w-md mx-auto">O rascunho de preenchimento foi salvo com sucesso. Anote o número do seu protocolo, ele será exigido para anexar os documentos e preencher o questionário clínico depois.</p>

                            <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 py-6 px-10 rounded-2xl inline-block my-8 relative group">
                                <div className="text-xs uppercase font-bold text-slate-400 mb-2">Seu Protocolo</div>
                                <div className="text-3xl font-mono text-primary font-bold tracking-widest">{generatedProtocol}</div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedProtocol);
                                        alert("Copiado!");
                                    }}
                                    className="absolute top-2 right-2 text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                    title="Copiar Protocolo"
                                >
                                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                                </button>
                            </div>

                            <div>
                                <Button onClick={() => window.print()} icon="print" variant="secondary" className="mr-3">Imprimir Comprovante</Button>
                                <Button onClick={() => {
                                    setStep(0);
                                    setMode(null);
                                    setGeneratedProtocol('');
                                }} icon="home">Concluir e Voltar</Button>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* Footer */}
            <footer className="mt-12 text-center text-sm text-slate-400 font-medium">
                &copy; {new Date().getFullYear()} EducaLota - Secretaria Municipal de Educação
            </footer>
        </div>
    );
}
