import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import ProtocolManager from '../components/ProtocolManager';
import { RequestType, EvaluationRequest } from '../types';

type Step = 0 | 1 | 2 | 3 | 4;
type RequestMode = 'NEW' | 'TRACK';

export default function PublicEvaluationRequest() {
    const [step, setStep] = useState<Step>(0);
    const [mode, setMode] = useState<RequestMode | null>(null);

    // Form State
    const [requestType, setRequestType] = useState<RequestType | null>(null);

    // School State
    const [schoolCode, setSchoolCode] = useState('');
    const [schoolData, setSchoolData] = useState<any>(null);
    const [loadingSchool, setLoadingSchool] = useState(false);
    const [hasSrm, setHasSrm] = useState<boolean>(false);
    const [aeeTeachers, setAeeTeachers] = useState<string[]>([]);

    // Student Initial State
    const [schoolStudents, setSchoolStudents] = useState<any[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [schoolClasses, setSchoolClasses] = useState<any[]>([]);

    // Detailed Form State
    const [studentId, setStudentId] = useState('');
    const [studentName, setStudentName] = useState('');
    const [studentBirthDate, setStudentBirthDate] = useState('');
    const [studentAge, setStudentAge] = useState('');
    const [possuiLaudo, setPossuiLaudo] = useState('');
    const [cidHipotese, setCidHipotese] = useState('');
    const [responsibleName, setResponsibleName] = useState('');
    const [responsiblePhone, setResponsiblePhone] = useState('');
    const [studentIsNew, setStudentIsNew] = useState('');
    const [studentPreviousSchool, setStudentPreviousSchool] = useState('');
    const [studentLevel, setStudentLevel] = useState('');
    const [studentYearStage, setStudentYearStage] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [studentShift, setStudentShift] = useState('');
    const [studentsInClass, setStudentsInClass] = useState<number | ''>('');
    const [regularTeacherName, setRegularTeacherName] = useState('');
    const [hasSpecializedProfessional, setHasSpecializedProfessional] = useState('');
    const [specializedProfessionalType, setSpecializedProfessionalType] = useState('');
    const [specializedProfessionalName, setSpecializedProfessionalName] = useState('');
    const [hasOtherSpecialEdStudents, setHasOtherSpecialEdStudents] = useState('');
    const [otherSpecialEdStudentsCount, setOtherSpecialEdStudentsCount] = useState<number | ''>('');
    const [otherSpecialEdStudentsDisabilities, setOtherSpecialEdStudentsDisabilities] = useState('');

    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [generatedProtocol, setGeneratedProtocol] = useState('');

    // Calc Idade
    useEffect(() => {
        if (studentBirthDate) {
            const birth = new Date(studentBirthDate);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            setStudentAge(age >= 0 ? age.toString() : '');
        } else {
            setStudentAge('');
        }
    }, [studentBirthDate]);

    // Mode Selection
    const handleSelectMode = (selectedMode: RequestMode) => {
        setMode(selectedMode);
        if (selectedMode === 'NEW') setStep(1);
    };

    // Step 1: Type
    const handleSelectType = (type: RequestType) => {
        setRequestType(type);
        setStep(2);
    };

    // Step 2: Search School
    const handleSearchSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolCode) return;
        setLoadingSchool(true);
        setSchoolData(null);
        setHasSrm(false);
        setAeeTeachers([]);
        try {
            const { data: school, error } = await supabase
                .from('schools')
                .select('*')
                .eq('codigo_escola', schoolCode.trim())
                .single();

            if (error || !school) throw new Error("Escola não encontrada");

            setSchoolData(school);

            // Verificar AEE na escola através da tabela classes ou staff/lotações
            const { data: classesData } = await supabase
                .from('classes')
                .select('modality')
                .eq('school_id', school.id);

            const temSrm = classesData?.some(c => c.modality === 'AEE' || c.modality === 'Educação Especial') || false;
            setHasSrm(temSrm);

            // Buscar professores AEE vinculados
            const { data: staffData } = await supabase
                .from('staff')
                .select('name, role')
                .eq('school_id', school.id)
                .in('role', ['Professor AEE', 'Prof. Sala Recurso']); // Assuming straightforward binding or fallback

            // Or from allotments mapping
            const { data: allotData } = await supabase
                .from('allotments')
                .select('staff:staff_id(name, role)')
                .eq('school_id', school.id)
                .eq('status', 'Concluído');

            const aeeNames: string[] = [];
            staffData?.forEach(s => {
                if (s.role.includes('AEE')) aeeNames.push(s.name);
            });
            allotData?.forEach(a => {
                const staff: any = a.staff;
                if (staff && staff.role && staff.role.includes('AEE') && !aeeNames.includes(staff.name)) {
                    aeeNames.push(staff.name);
                }
            });

            setAeeTeachers(aeeNames);
        } catch (err) {
            console.error(err);
            alert("Escola não encontrada. Verifique o código INEP/MEC e tente novamente.");
        } finally {
            setLoadingSchool(false);
        }
    };

    const confirmSchoolAndProceed = async () => {
        if (!schoolData) return;
        setLoadingStudents(true);
        try {
            // Se for Reavaliação ou Intervenção, puxar alunos
            if (requestType !== 'AVALIACAO') {
                const { data: students, error } = await supabase
                    .from('students')
                    .select('id, name, birth_date, possui_laudo, cid_hipotese')
                    .eq('school_id', schoolData.id)
                    .order('name');
                if (error) throw error;
                setSchoolStudents(students || []);
            }

            // Fetch classes to populate dropdowns
            const { data: classesData } = await supabase
                .from('classes')
                .select('series, section, shift')
                .eq('school_id', schoolData.id);

            setSchoolClasses(classesData || []);

            setStep(3);
        } catch (err) {
            console.error(err);
            alert("Erro ao preparar dados da escola.");
        } finally {
            setLoadingStudents(false);
        }
    };

    // Step 3: Populate from select
    const handleStudentSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setStudentId(id);
        const found = schoolStudents.find(s => s.id === id);
        if (found) {
            setStudentName(found.name);
            setStudentBirthDate(found.birth_date || '');
            setPossuiLaudo(found.possui_laudo ? 'SIM' : 'NÃO');
            setCidHipotese(found.cid_hipotese || '');
        } else {
            setStudentName('');
            setStudentBirthDate('');
            setPossuiLaudo('');
            setCidHipotese('');
        }
    };

    // Step 4: Submit Protocol
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!studentName || !studentBirthDate || !possuiLaudo || !responsibleName || !responsiblePhone || !studentIsNew || !studentLevel || !studentsInClass || !regularTeacherName || !hasSpecializedProfessional) {
            return alert("Preencha todos os campos obrigatórios marcados com *.");
        }

        if (possuiLaudo === 'SIM' && !cidHipotese) return alert("Informe o CID ou Hipótese se possui laudo.");
        if (studentIsNew === 'SIM' && !studentPreviousSchool) return alert("Informe a escola anterior do aluno.");
        if (hasSpecializedProfessional === 'SIM' && (!specializedProfessionalType || !specializedProfessionalName)) return alert("Informe os dados do profissional especializado.");

        setLoadingSubmit(true);
        try {
            const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomPart = Math.floor(1000 + Math.random() * 9000);
            const protocol = `CEES-${datePart}-${randomPart}`;

            const payload: Partial<EvaluationRequest> = {
                protocol_number: protocol,
                request_type: requestType as RequestType,
                school_id: schoolData.id,
                student_id: studentId || undefined,
                student_name: studentName,
                student_birth_date: studentBirthDate,
                student_is_new: studentIsNew === 'SIM',
                student_previous_school: studentPreviousSchool,
                student_level: studentLevel,
                student_year_stage: studentYearStage,
                student_class: studentClass,
                student_shift: studentShift,
                students_in_class: Number(studentsInClass),
                regular_teacher_name: regularTeacherName,
                has_specialized_professional: hasSpecializedProfessional === 'SIM',
                specialized_professional_type: specializedProfessionalType,
                specialized_professional_name: specializedProfessionalName,
                has_other_special_ed_students: hasOtherSpecialEdStudents === 'SIM',
                other_special_ed_students_count: otherSpecialEdStudentsCount === '' ? undefined : Number(otherSpecialEdStudentsCount),
                other_special_ed_students_disabilities: otherSpecialEdStudentsDisabilities,
                responsible_name: responsibleName,
                responsible_phone: responsiblePhone,
                status: 'DRAFT',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('evaluation_requests').insert([payload]);

            if (error) throw error;

            setGeneratedProtocol(protocol);
            setStep(4);
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar solicitação e salvar dados.");
        } finally {
            setLoadingSubmit(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans selection:bg-primary/20 flex flex-col items-center py-10 px-4">

            {/* Header */}
            <header className="w-full max-w-4xl mb-10 flex flex-col items-center text-center gap-4">
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
            <main className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">

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
                                    className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group group-hover:shadow relative overflow-hidden text-left"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-primary transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                    <span className="material-symbols-outlined text-4xl text-primary mb-2">add_task</span>
                                    <div className="text-center">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Nova Solicitação</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Escolas que precisam solicitar avaliação / intervenção.</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleSelectMode('TRACK')}
                                    className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group group-hover:shadow relative overflow-hidden text-left"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
                                    <span className="material-symbols-outlined text-4xl text-blue-500 mb-2">search_check</span>
                                    <div className="text-center">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Acompanhar / Completar Protocolo</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhar status ou enviar laudos e autorizações de protocolos gerados.</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODE = TRACK (Render ProtocolManager) */}
                    {mode === 'TRACK' && <ProtocolManager onCancel={() => setMode('NEW')} />}

                    {/* STEP 1: Tipo de Solicitação */}
                    {step === 1 && mode === 'NEW' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">1. O que você precisa solicitar?</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['AVALIACAO', 'REAVALIACAO', 'INTERVENCAO'] as RequestType[]).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => handleSelectType(t)}
                                        className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary hover:bg-primary/5 transition-all text-center group"
                                    >
                                        <span className={`material-symbols-outlined text-3xl mb-3 ${t === 'AVALIACAO' ? 'text-emerald-500' : t === 'REAVALIACAO' ? 'text-amber-500' : 'text-purple-500'}`}>
                                            {t === 'AVALIACAO' ? 'person_search' : t === 'REAVALIACAO' ? 'sync_saved_locally' : 'psychology'}
                                        </span>
                                        <h3 className="font-bold text-slate-800 dark:text-white uppercase text-sm">{t}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                            {t === 'AVALIACAO' ? 'Alunos sem queixa analisada anteriormente.' : t === 'REAVALIACAO' ? 'Para alunos com histórico já no CEES.' : 'Intervenção pontual ou continuada.'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                            <Button variant="ghost" onClick={() => setStep(0)}>Voltar</Button>
                        </div>
                    )}

                    {/* STEP 2: Buscar Escola */}
                    {step === 2 && mode === 'NEW' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">2. Identificação da Escola</h2>
                            <form onSubmit={handleSearchSchool} className="flex gap-4">
                                <label className="flex-1 flex flex-col gap-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Código INEP / MEC da Escola</span>
                                    <input
                                        type="text"
                                        value={schoolCode}
                                        onChange={(e) => setSchoolCode(e.target.value)}
                                        className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        placeholder="Ex: 15..."
                                        required
                                    />
                                </label>
                                <div className="flex items-end">
                                    <Button type="submit" isLoading={loadingSchool} className="h-12 w-full md:w-auto px-6">
                                        Buscar Escola
                                    </Button>
                                </div>
                            </form>

                            {schoolData && (
                                <div className="p-6 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30 rounded-2xl flex flex-col space-y-4 animate-in zoom-in-95">
                                    <div>
                                        <h3 className="text-sm font-bold uppercase text-emerald-800 dark:text-emerald-400 mb-1">Unidade Encontrada:</h3>
                                        <p className="font-black text-xl text-slate-800 dark:text-slate-100">{schoolData.name}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Diretor(a)</span>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{schoolData.director_name || 'Não informado'}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Telefone do Diretor</span>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{schoolData.telefone_diretor || 'Não informado'}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/30 mt-2">
                                        <p className="text-sm font-bold flex items-center gap-2">
                                            <span className={`material-symbols-outlined ${hasSrm ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                {hasSrm ? 'check_circle' : 'warning'}
                                            </span>
                                            <span className="text-slate-800 dark:text-slate-200">
                                                Possui Sala de Recursos Multifuncionais (AEE): <strong className={hasSrm ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{hasSrm ? 'Sim' : 'Não'}</strong>
                                            </span>
                                        </p>
                                        {aeeTeachers.length > 0 && (
                                            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                                <strong>Profissionais de AEE:</strong> {aeeTeachers.join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between pt-4">
                                        <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                                        <Button icon="arrow_forward" onClick={confirmSchoolAndProceed}>Confirmar Escola e Prosseguir</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Dados do Estudante */}
                    {step === 3 && mode === 'NEW' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">3. Dados do Estudante / Turma</h2>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Search Student if Reavaliacao/Intervencao */}
                                {(requestType === 'REAVALIACAO' || requestType === 'INTERVENCAO') && (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl mb-6">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-amber-900 dark:text-amber-400">Buscar Estudante Existente</span>
                                            {loadingStudents ? (
                                                <div className="text-amber-700 animate-pulse">Carregando alunos...</div>
                                            ) : (
                                                <select
                                                    value={studentId}
                                                    onChange={handleStudentSelection}
                                                    className="h-12 px-4 rounded-xl border border-amber-300 dark:border-amber-600/50 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                                                >
                                                    <option value="">-- Cadastrar novo / Não encontrado --</option>
                                                    {schoolStudents.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} (Nasc: {s.birth_date})</option>
                                                    ))}
                                                </select>
                                            )}
                                        </label>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <label className="flex flex-col gap-2 md:col-span-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do Aluno(a) *</span>
                                        <input
                                            type="text"
                                            value={studentName}
                                            onChange={(e) => setStudentName(e.target.value)}
                                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            required
                                        />
                                    </label>

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Data Nasc. *</span>
                                            <input
                                                type="date"
                                                value={studentBirthDate}
                                                onChange={(e) => setStudentBirthDate(e.target.value)}
                                                className="h-12 px-4 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                                required
                                            />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Idade</span>
                                            <input
                                                type="text"
                                                value={studentAge}
                                                className="h-12 px-4 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-slate-500 font-bold outline-none cursor-not-allowed"
                                                readOnly
                                            />
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Possui Laudo? *</span>
                                            <select
                                                required
                                                value={possuiLaudo}
                                                onChange={(e) => setPossuiLaudo(e.target.value)}
                                                className="h-12 px-4 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="SIM">Sim</option>
                                                <option value="NÃO">Não</option>
                                            </select>
                                        </label>
                                        {possuiLaudo === 'SIM' && (
                                            <label className="flex flex-col gap-2 animate-in fade-in">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">CID (Se houver)</span>
                                                <input
                                                    type="text"
                                                    value={cidHipotese}
                                                    onChange={(e) => setCidHipotese(e.target.value)}
                                                    className="h-12 px-4 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                                    placeholder="Ex: F84"
                                                    required
                                                />
                                            </label>
                                        )}
                                    </div>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Responsável Legal *</span>
                                        <input
                                            type="text"
                                            value={responsibleName}
                                            onChange={(e) => setResponsibleName(e.target.value)}
                                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            required
                                        />
                                    </label>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Telefone Resp. *</span>
                                        <input
                                            type="text"
                                            value={responsiblePhone}
                                            onChange={(e) => setResponsiblePhone(e.target.value)}
                                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="(XX) XXXXX-XXXX"
                                            required
                                        />
                                    </label>
                                </div>

                                <hr className="border-slate-200 dark:border-slate-700" />

                                {/* Info Turma */}
                                <h3 className="font-bold text-slate-800 dark:text-white mb-4">Escolaridade & Turma</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Aluno Novo Aqui? *</span>
                                            <select
                                                required
                                                value={studentIsNew}
                                                onChange={(e) => setStudentIsNew(e.target.value)}
                                                className="h-12 px-4 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="SIM">Sim</option>
                                                <option value="NÃO">Não</option>
                                            </select>
                                        </label>
                                        {studentIsNew === 'SIM' && (
                                            <label className="flex flex-col gap-2 animate-in fade-in">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Escola Anterior *</span>
                                                <input
                                                    type="text"
                                                    value={studentPreviousSchool}
                                                    onChange={(e) => setStudentPreviousSchool(e.target.value)}
                                                    className="h-12 px-4 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                                    required
                                                />
                                            </label>
                                        )}
                                    </div>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Etapa de Ensino *</span>
                                        <select
                                            required
                                            value={studentLevel}
                                            onChange={(e) => setStudentLevel(e.target.value)}
                                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                        >
                                            <option value="">Selecione a etapa...</option>
                                            <option value="Educação Infantil">Educação Infantil</option>
                                            <option value="EF Anos Iniciais">EF Anos Iniciais</option>
                                            <option value="EF Anos Finais">EF Anos Finais</option>
                                            <option value="EJA">EJA</option>
                                        </select>
                                    </label>

                                    <div className="grid grid-cols-3 gap-4 md:col-span-2">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold flex items-center justify-between text-slate-700 dark:text-slate-300">Ano/Série </span>
                                            <input
                                                list="series-list"
                                                value={studentYearStage}
                                                onChange={e => setStudentYearStage(e.target.value)}
                                                className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: 5º Ano"
                                            />
                                            <datalist id="series-list">
                                                {Array.from(new Set(schoolClasses.map(c => c.series))).map(s => <option key={s} value={s} />)}
                                            </datalist>
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Turma</span>
                                            <input
                                                list="classes-list"
                                                value={studentClass}
                                                onChange={e => setStudentClass(e.target.value)}
                                                className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: 501 / A"
                                            />
                                            <datalist id="classes-list">
                                                {Array.from(new Set(schoolClasses.map(c => c.section))).map(s => <option key={s} value={s} />)}
                                            </datalist>
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Turno</span>
                                            <select
                                                value={studentShift}
                                                onChange={e => setStudentShift(e.target.value)}
                                                className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="Manhã">Manhã</option>
                                                <option value="Tarde">Tarde</option>
                                                <option value="Noite">Noite</option>
                                                <option value="Integral">Integral</option>
                                            </select>
                                        </label>
                                    </div>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Professor Regente da Turma *</span>
                                        <input
                                            type="text"
                                            value={regularTeacherName}
                                            onChange={(e) => setRegularTeacherName(e.target.value)}
                                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            required
                                        />
                                    </label>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Qtd. de Alunos na Turma *</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={studentsInClass}
                                            onChange={(e) => setStudentsInClass(e.target.value ? Number(e.target.value) : '')}
                                            className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                                            required
                                        />
                                    </label>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2 bg-slate-100/50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 rounded-xl mt-2">
                                        <label className="flex flex-col gap-2 md:col-span-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">A turma tem profissional especializado de apoio? *</span>
                                            <div className="flex gap-4 items-center">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" value="SIM" name="hasProfSelect" required checked={hasSpecializedProfessional === 'SIM'} onChange={(e) => setHasSpecializedProfessional(e.target.value)} />
                                                    <span className="dark:text-slate-300">Sim</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" value="NÃO" name="hasProfSelect" required checked={hasSpecializedProfessional === 'NÃO'} onChange={(e) => setHasSpecializedProfessional(e.target.value)} />
                                                    <span className="dark:text-slate-300">Não</span>
                                                </label>
                                            </div>
                                        </label>

                                        {hasSpecializedProfessional === 'SIM' && (
                                            <>
                                                <label className="flex flex-col gap-2 animate-in fade-in">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Função *</span>
                                                    <select
                                                        required
                                                        value={specializedProfessionalType}
                                                        onChange={(e) => setSpecializedProfessionalType(e.target.value)}
                                                        className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20"
                                                    >
                                                        <option value="">Selecione...</option>
                                                        <option value="Mediador">Mediador</option>
                                                        <option value="Cuidador">Cuidador</option>
                                                        <option value="Prof. Bilíngue">Prof. Bilíngue</option>
                                                        <option value="Prof. de Braille">Prof. de Braille</option>
                                                        <option value="Tradutor/Intérprete de Libras">Tradutor/Intérprete de Libras</option>
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2 animate-in fade-in">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do Profissional *</span>
                                                    <input
                                                        type="text"
                                                        value={specializedProfessionalName}
                                                        required
                                                        onChange={(e) => setSpecializedProfessionalName(e.target.value)}
                                                        className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </label>
                                            </>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2 bg-slate-100/50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <label className="flex flex-col gap-2 md:col-span-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Há outros alunos da Ed. Especial na sala comum?</span>
                                            <div className="flex gap-4 items-center">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" value="SIM" name="hasOtherSpEd" checked={hasOtherSpecialEdStudents === 'SIM'} onChange={(e) => setHasOtherSpecialEdStudents(e.target.value)} />
                                                    <span className="dark:text-slate-300">Sim</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" value="NÃO" name="hasOtherSpEd" checked={hasOtherSpecialEdStudents === 'NÃO'} onChange={(e) => setHasOtherSpecialEdStudents(e.target.value)} />
                                                    <span className="dark:text-slate-300">Não</span>
                                                </label>
                                            </div>
                                        </label>

                                        {hasOtherSpecialEdStudents === 'SIM' && (
                                            <>
                                                <label className="flex flex-col gap-2 animate-in fade-in">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Aproximadamente Quantos?</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={otherSpecialEdStudentsCount}
                                                        onChange={(e) => setOtherSpecialEdStudentsCount(e.target.value ? Number(e.target.value) : '')}
                                                        className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </label>
                                                <label className="flex flex-col gap-2 animate-in fade-in">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Quais Deficiências?</span>
                                                    <input
                                                        type="text"
                                                        value={otherSpecialEdStudentsDisabilities}
                                                        onChange={(e) => setOtherSpecialEdStudentsDisabilities(e.target.value)}
                                                        className="h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-between pt-8 border-t border-slate-200 dark:border-slate-700">
                                    <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
                                    <Button type="submit" isLoading={loadingSubmit}>Salvar Rascunho & Prosseguir</Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* STEP 4: SUCCESS Protocol Generated */}
                    {step === 4 && (
                        <div className="space-y-6 text-center animate-in zoom-in slide-in-from-bottom-4 py-8">
                            <div className="mx-auto size-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mb-6 border-8 border-emerald-50 dark:border-emerald-900/10">
                                <span className="material-symbols-outlined text-4xl">check_circle</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white">Rascunho Salvo com Sucesso!</h2>
                            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                                Os dados formativos do estudante foram registrados. Anote o número do seu protocolo gerado abaixo, <strong>ele será necessário</strong> para o Coordenador completar os anexos avaliativos.
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 inline-block w-full max-w-sm mt-4">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Número do Protocolo</span>
                                <div className="text-3xl font-black tracking-widest text-primary font-mono select-all">
                                    {generatedProtocol}
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                                <Button onClick={() => window.location.reload()} variant="outline">Novo Atendimento</Button>
                                <Button icon="arrow_forward" onClick={() => { setMode('TRACK'); setStep(0); }}>Completar Dados / Anexar Laudo Agora</Button>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            <footer className="mt-12 text-center text-sm text-slate-500 font-medium">
                EducaLota &copy; {new Date().getFullYear()} - SEMED
            </footer>
        </div>
    );
}
