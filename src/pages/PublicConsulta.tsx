import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { normalizeText } from '../lib/stringUtils';

// Interfazes originais
interface ClassData {
    id: string;
    shift: string;
    series: string;
    section: string;
    schools: {
        name: string;
    };
}

interface StudentData {
    id: string;
    name: string;
    cid: string;
    special_group: string;
    needs_support: string[];
    additional_info: string;
    classes: ClassData | null;
    class_id: string;
}

interface AllotmentData {
    id: string;
    staff_name: string;
    staff_role: string;
}

// Interfaces para os Filtros da Aba 2
interface SchoolItem {
    id: string;
    name: string;
}

interface ClassItem {
    id: string;
    school_id: string;
    shift: string;
    series: string;
    section: string;
}

export const PublicConsulta: React.FC = () => {
    // Auth e Layout
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [activeTab, setActiveTab] = useState<'student' | 'class'>('student');

    // Aba 1: Busca por Estudante
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingStudent, setLoadingStudent] = useState(false);
    const [studentsResult, setStudentsResult] = useState<(StudentData & { professionals: AllotmentData[] })[]>([]);
    const [hasSearchedStudent, setHasSearchedStudent] = useState(false);

    // Aba 2: Busca por Turma
    const [schools, setSchools] = useState<SchoolItem[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);

    // Filtros Aba 2
    const [selectedSchool, setSelectedSchool] = useState('');
    const [searchSchoolTerm, setSearchSchoolTerm] = useState('');
    const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState('');
    const [selectedClass, setSelectedClass] = useState('');

    // Resultados Aba 2
    const [loadingClass, setLoadingClass] = useState(false);
    const [classStaffResult, setClassStaffResult] = useState<AllotmentData[]>([]);
    const [classStudentsResult, setClassStudentsResult] = useState<StudentData[]>([]);
    const [hasSearchedClass, setHasSearchedClass] = useState(false);

    // Efeito para carregar as escolas e turmas base quando desbloqueia a tela
    useEffect(() => {
        if (isUnlocked) {
            fetchBaseData();
        }
    }, [isUnlocked]);

    const fetchBaseData = async () => {
        try {
            const { data: schoolsData } = await supabase.from('schools').select('id, name');
            if (schoolsData) setSchools(schoolsData.sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name))));

            const { data: classesData } = await supabase.from('classes').select('id, school_id, shift, series, section');
            if (classesData) setClasses(classesData);
        } catch (e) {
            console.error('Erro ao buscar filtros base:', e);
        }
    };

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.trim().toUpperCase() === 'CEES2026') {
            setIsUnlocked(true);
            setPinError('');
        } else {
            setPinError('Código de acesso inválido.');
        }
    };

    // --- LÓGICA DA ABA 1: CONSULTAR ALUNO ---
    const handleSearchStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoadingStudent(true);
        setHasSearchedStudent(true);
        setStudentsResult([]);

        try {
            // Buscamos todos os registros paginando para contornar o limite de 1000 da API
            let studentsData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error: studentError } = await supabase
                    .from('students')
                    .select(`
                        id,
                        name,
                        cid,
                        special_group,
                        needs_support,
                        additional_info,
                        class_id,
                        classes (
                            id,
                            shift,
                            series,
                            section,
                            schools ( name )
                        )
                    `)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (studentError) throw studentError;

                if (data && data.length > 0) {
                    studentsData = [...studentsData, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }

            if (!studentsData || studentsData.length === 0) {
                setStudentsResult([]);
                return;
            }

            // Normalização e filtro accent-insensitive
            const term = normalizeText(searchQuery.trim());
            const filteredStudents = studentsData
                .filter(s => normalizeText(s.name).includes(term))
                .slice(0, 20); // Limit to 20 results in UI

            if (filteredStudents.length === 0) {
                setStudentsResult([]);
                return;
            }

            const classIds = Array.from(new Set(filteredStudents.map(s => s.class_id).filter(Boolean)));
            let allotmentsData: { class_id: string, staff_name: string, staff_role: string, id: string }[] = [];

            if (classIds.length > 0) {
                const { data: allotData, error: allotError } = await supabase
                    .from('allotments')
                    .select('id, class_id, staff_name, staff_role')
                    .in('class_id', classIds)
                    .eq('status', 'Ativo');

                if (allotError) throw allotError;
                if (allotData) {
                    allotmentsData = allotData;
                }
            }

            const finalResults = filteredStudents.map((student: any) => {
                const studentClassId = student.class_id;
                const studentProfessionals = allotmentsData.filter(a => a.class_id === studentClassId);
                return {
                    ...student,
                    professionals: studentProfessionals
                };
            });

            setStudentsResult(finalResults);
        } catch (error) {
            console.error('Erro na busca de estudante:', error);
            alert('Ocorreu um erro ao realizar a consulta de estudante.');
        } finally {
            setLoadingStudent(false);
        }
    };

    const handleClearStudentSearch = () => {
        setSearchQuery('');
        setStudentsResult([]);
        setHasSearchedStudent(false);
    };

    // --- LÓGICA DA ABA 2: CONSULTAR TURMA ---
    const handleSearchClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSchool || !selectedShift || !selectedClass) {
            alert('Por favor, selecione Escola, Turno e Turma para prosseguir com a busca.');
            return;
        }

        setLoadingClass(true);
        setHasSearchedClass(true);
        setClassStaffResult([]);
        setClassStudentsResult([]);

        try {
            // Bloco A: Profissionais Lotados na Turma
            const { data: staffData, error: staffError } = await supabase
                .from('allotments')
                .select('id, staff_name, staff_role')
                .eq('class_id', selectedClass)
                .eq('status', 'Ativo');

            if (staffError) throw staffError;
            if (staffData) setClassStaffResult(staffData);

            // Bloco B: Estudantes da Educação Especial na Turma (Trazendo needs_support para filtrar ou só exibir)
            const { data: studentsData, error: stuError } = await supabase
                .from('students')
                .select('id, name, cid, special_group, needs_support, additional_info, class_id')
                .eq('class_id', selectedClass);

            if (stuError) throw stuError;

            setClassStudentsResult((studentsData || []) as unknown as StudentData[]);
        } catch (error) {
            console.error('Erro na busca da turma:', error);
            alert('Ocorreu um erro ao realizar a consulta de turma.');
        } finally {
            setLoadingClass(false);
        }
    };

    const handleClearClassSearch = () => {
        setSelectedSchool('');
        setSearchSchoolTerm('');
        setSelectedShift('');
        setSelectedClass('');
        setClassStaffResult([]);
        setClassStudentsResult([]);
        setHasSearchedClass(false);
    };

    // --- RENDER ---
    if (!isUnlocked) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-6 text-center">
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-primary mb-4">
                        <span className="material-symbols-outlined text-3xl">lock</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white">Acesso Restrito</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Consulta rápida de informações. Insira o código de segurança para acessar o módulo.
                    </p>

                    <form onSubmit={handleUnlock} className="space-y-4 pt-4">
                        <div>
                            <input
                                type="password"
                                placeholder="Código de Acesso"
                                className="w-full text-center tracking-widest text-lg h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/50 outline-none transition-all uppercase"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                autoFocus
                            />
                            {pinError && <p className="text-red-500 text-sm mt-2">{pinError}</p>}
                        </div>
                        <Button type="submit" className="w-full h-14">Entrar</Button>
                    </form>
                </div>
            </div>
        );
    }

    // Filtragem acent-insensitive das escolas
    const filteredSchools = schools.filter(s => normalizeText(s.name).includes(normalizeText(searchSchoolTerm)));
    const selectedSchoolObj = schools.find(s => s.id === selectedSchool);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 h-16 flex justify-between items-center sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">search</span>
                        </div>
                        <h1 className="font-bold text-slate-800 dark:text-white text-lg">Consulta Rápida da Equipe</h1>
                    </div>
                    <button
                        onClick={() => {
                            setIsUnlocked(false);
                            setPin('');
                            setStudentsResult([]);
                            setSearchQuery('');
                            setHasSearchedStudent(false);
                            setClassStaffResult([]);
                            setClassStudentsResult([]);
                            setHasSearchedClass(false);
                            setSelectedSchool('');
                            setSearchSchoolTerm('');
                            setSelectedShift('');
                            setSelectedClass('');
                        }}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm font-medium flex items-center gap-1 min-h-[44px] px-2"
                    >
                        <span className="material-symbols-outlined text-sm">logout</span> Sair
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 mt-4 pb-20">
                {/* Abas de Navegação */}
                <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl w-full sm:w-fit mx-auto shadow-inner">
                    <button
                        className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-sm font-bold transition-all min-h-[44px] ${activeTab === 'student' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        onClick={() => setActiveTab('student')}
                    >
                        Consultar Aluno
                    </button>
                    <button
                        className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-sm font-bold transition-all min-h-[44px] ${activeTab === 'class' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        onClick={() => setActiveTab('class')}
                    >
                        Consultar Turma
                    </button>
                </div>

                {/* ABA 1: CONSULTAR ALUNO */}
                {activeTab === 'student' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Barra de Pesquisa */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
                            <form onSubmit={handleSearchStudent} className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">search</span>
                                    <input
                                        type="text"
                                        placeholder="Nome do estudante..."
                                        className="w-full h-14 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-base min-h-[44px]"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={handleClearStudentSearch} disabled={loadingStudent || (!searchQuery && !hasSearchedStudent)} className="flex-1 sm:flex-none h-14 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 min-h-[44px]">
                                        Limpar
                                    </Button>
                                    <Button type="submit" disabled={loadingStudent} className="flex-1 sm:flex-none h-14 px-8 min-h-[44px]" isLoading={loadingStudent}>
                                        Buscar
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Resultados Estudantes */}
                        <div className="space-y-6">
                            {loadingStudent ? (
                                <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3">
                                    <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                                    Buscando informações...
                                </div>
                            ) : studentsResult.length > 0 ? (
                                studentsResult.map(student => {
                                    const escolaAtual = student.classes?.schools?.name || 'Não alocado';
                                    const turma = student.classes ? `${student.classes.series} ${student.classes.section ? '- ' + student.classes.section : ''}` : '-';
                                    const turno = student.classes?.shift || '-';
                                    const precisaSuporte = (student.needs_support && student.needs_support.length > 0) ? student.needs_support.join(', ') : 'Não informado / Não necessita';

                                    return (
                                        <div key={student.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            {/* Info Estudante */}
                                            <div className="p-4 sm:p-6">
                                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
                                                        {student.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 space-y-4 w-full">
                                                        <div>
                                                            <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight">
                                                                {student.name}
                                                            </h3>
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                                    CID: {student.cid || 'N/A'}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                                                                    {student.special_group || 'Grupo não informado'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Alertas sobre suporte */}
                                                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 rounded-xl space-y-2">
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase">Necessita de Suporte Especializado?</span>
                                                                <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">{precisaSuporte}</span>
                                                            </div>
                                                            {student.additional_info && (
                                                                <div className="pt-2 border-t border-amber-100 dark:border-amber-900/30">
                                                                    <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase">Informações Adicionais</span>
                                                                    <span className="text-sm font-medium text-amber-800 dark:text-amber-400/80">{student.additional_info}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Dados de Lotação do Aluno */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Escola Atual</span>
                                                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 break-words">
                                                                    <span className="material-symbols-outlined text-[16px] text-slate-400">home_work</span>
                                                                    {escolaAtual}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Turma</span>
                                                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-[16px] text-slate-400">class</span>
                                                                    {turma}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Turno</span>
                                                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                                                                    {turno}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Profissionais Lotados na mesma Turma */}
                                            <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-base">support_agent</span>
                                                    Profissionais Lotados nesta Turma
                                                </h4>

                                                {student.professionals.length > 0 ? (
                                                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        {student.professionals.map(prof => (
                                                            <li key={prof.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                                    <span className="material-symbols-outlined text-primary text-sm">badge</span>
                                                                </div>
                                                                <div className="flex-1 overflow-hidden">
                                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={prof.staff_name}>
                                                                        {prof.staff_name}
                                                                    </p>
                                                                    <p className="text-[11px] text-slate-500 truncate mt-0.5" title={prof.staff_role}>
                                                                        {prof.staff_role.split(' - ')[0]}
                                                                    </p>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="flex items-center justify-center p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 text-sm bg-white dark:bg-slate-900/20">
                                                        Nenhum profissional lotado nesta turma
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                hasSearchedStudent && !loadingStudent && (
                                    <div className="text-center py-12 text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <div className="bg-slate-100 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="material-symbols-outlined text-3xl opacity-50">search_off</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nenhum estudante encontrado</h3>
                                        <p className="text-sm mt-1">Verifique a grafia e tente novamente.</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* ABA 2: CONSULTAR TURMA */}
                {activeTab === 'class' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Filtros da Turma */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <form onSubmit={handleSearchClass} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2 relative">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Unidade Escolar</label>
                                        <div className="relative">
                                            <div
                                                className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-primary/20"
                                                onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
                                            >
                                                <span className={`truncate ${!selectedSchoolObj ? 'text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                                    {selectedSchoolObj ? selectedSchoolObj.name : 'Selecione a Escola'}
                                                </span>
                                                <span className="material-symbols-outlined text-slate-400">arrow_drop_down</span>
                                            </div>

                                            {isSchoolDropdownOpen && (
                                                <div className="absolute z-20 top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-64">
                                                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-sm">search</span>
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                placeholder="Buscar escola..."
                                                                value={searchSchoolTerm}
                                                                onChange={(e) => setSearchSchoolTerm(e.target.value)}
                                                                className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto flex-1 p-1">
                                                        {filteredSchools.length > 0 ? filteredSchools.map(s => (
                                                            <div
                                                                key={s.id}
                                                                className={`px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${selectedSchool === s.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                                                                onClick={() => {
                                                                    setSelectedSchool(s.id);
                                                                    setSelectedClass('');
                                                                    setIsSchoolDropdownOpen(false);
                                                                    setSearchSchoolTerm('');
                                                                }}
                                                            >
                                                                {s.name}
                                                            </div>
                                                        )) : (
                                                            <div className="p-3 text-sm text-slate-500 text-center">Nenhuma escola encontrada</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Turno</label>
                                        <select
                                            className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none text-sm focus:ring-2 focus:ring-primary/20 appearance-none min-h-[48px]"
                                            title="Turno"
                                            value={selectedShift}
                                            onChange={(e) => {
                                                setSelectedShift(e.target.value);
                                                setSelectedClass(''); // Reseta turma ao trocar turno
                                            }}
                                            disabled={!selectedSchool}
                                        >
                                            <option value="">Selecione o Turno</option>
                                            <option value="Manhã">Manhã</option>
                                            <option value="Tarde">Tarde</option>
                                            <option value="Noite">Noite</option>
                                            <option value="Integral">Integral</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Turma</label>
                                        <select
                                            className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none text-sm focus:ring-2 focus:ring-primary/20 appearance-none min-h-[48px]"
                                            title="Turma"
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            disabled={!selectedSchool || !selectedShift}
                                        >
                                            <option value="">Selecione a Turma</option>
                                            {classes
                                                .filter(c => c.school_id === selectedSchool && c.shift === selectedShift)
                                                .map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.series} {c.section ? `- ${c.section}` : ''}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row justify-end pt-4 gap-3">
                                    <Button type="button" variant="outline" onClick={handleClearClassSearch} disabled={loadingClass || (!selectedSchool && !hasSearchedClass)} className="w-full sm:w-auto min-h-[48px] px-8 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700">
                                        Limpar
                                    </Button>
                                    <Button type="submit" disabled={loadingClass || !selectedClass} isLoading={loadingClass} className="w-full sm:w-auto min-h-[48px] px-8">
                                        Pesquisar Turma
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Resultados da Turma */}
                        {
                            loadingClass ? (
                                <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3">
                                    <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                                    Buscando dados da turma...
                                </div>
                            ) : hasSearchedClass && !loadingClass ? (
                                <div className="space-y-6">
                                    {/* Bloco A: Equipe Lotada na Turma */}
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                                                <span className="material-symbols-outlined text-xl">badge</span>
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800 dark:text-white">Equipe Lotada na Turma</h3>
                                        </div>

                                        {classStaffResult.length > 0 ? (
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {classStaffResult.map(prof => (
                                                    <li key={prof.id} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                                                        <span className="material-symbols-outlined text-slate-400 text-2xl">account_circle</span>
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={prof.staff_name}>
                                                                {prof.staff_name}
                                                            </p>
                                                            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5" title={prof.staff_role}>
                                                                {prof.staff_role.split(' - ')[0]}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-center border border-dashed border-slate-200 dark:border-slate-700">
                                                Nenhum profissional de apoio registrado nesta turma.
                                            </div>
                                        )}
                                    </div>

                                    {/* Bloco B: Alunos Vinculados à Turma */}
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 delay-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-purple-50 dark:bg-purple-900/20 w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                                                <span className="material-symbols-outlined text-xl">groups</span>
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800 dark:text-white">Alunos Vinculados à Turma</h3>
                                        </div>

                                        {classStudentsResult.length > 0 ? (
                                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                <table className="w-full text-left">
                                                    <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                                        <tr>
                                                            <th className="px-6 py-4">Nome do Aluno</th>
                                                            <th className="px-6 py-4">CID</th>
                                                            <th className="px-6 py-4 text-right">Necessita de Suporte?</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {classStudentsResult.map(std => {
                                                            const needs = (std.needs_support && std.needs_support.length > 0) ? std.needs_support.join(', ') : 'Não necessita';
                                                            return (
                                                                <tr key={std.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-xs shrink-0">
                                                                                {std.name.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <p className="font-bold text-sm text-slate-800 dark:text-white">{std.name}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                                            {std.cid || 'N/A'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${needs.includes('Não')
                                                                            ? 'text-slate-500 bg-slate-100 dark:bg-slate-800'
                                                                            : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50'
                                                                            }`}>
                                                                            {needs}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-900 p-8 rounded-xl text-center border border-dashed border-slate-200 dark:border-slate-700">
                                                Nenhum estudante vinculado a esta turma.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null
                        }
                    </div>
                )}
            </main>
        </div>
    );
};
