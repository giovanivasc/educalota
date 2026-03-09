import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';

// Definindo as interfaces locais para tipagem dos resultados
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
    classes: ClassData | null;
    class_id: string;
}

interface AllotmentData {
    id: string;
    staff_name: string;
    staff_role: string;
}

export const PublicConsulta: React.FC = () => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<(StudentData & { professionals: AllotmentData[] })[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.trim().toUpperCase() === 'CEES2026') {
            setIsUnlocked(true);
            setPinError('');
        } else {
            setPinError('Código de acesso inválido.');
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        setHasSearched(true);
        setStudents([]);

        try {
            // 1. Buscar estudantes cujo nome seja semelhante ao pesquisado, carregando classe e escola associadas
            const { data: studentsData, error: studentError } = await supabase
                .from('students')
                .select(`
          id,
          name,
          cid,
          special_group,
          class_id,
          classes (
            id,
            shift,
            series,
            section,
            schools ( name )
          )
        `)
                .ilike('name', `%${searchQuery.trim()}%`)
                .limit(20);

            if (studentError) throw studentError;

            if (!studentsData || studentsData.length === 0) {
                setStudents([]);
                return;
            }

            // 2. Extrair os class_ids únicos encontrados
            const classIds = Array.from(new Set(studentsData.map(s => s.class_id).filter(Boolean)));

            // 3. Buscar profissionais (allotments) daquelas turmas (ativo) em uma única query
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

            // 4. Mapear profissionais para cada estudante com base no class_id
            const finalResults = studentsData.map((student: any) => {
                const studentClassId = student.class_id;
                const studentProfessionals = allotmentsData.filter(a => a.class_id === studentClassId);

                return {
                    ...student,
                    professionals: studentProfessionals
                };
            });

            setStudents(finalResults);

        } catch (error) {
            console.error('Erro na busca:', error);
            alert('Ocorreu um erro ao realizar a consulta.');
        } finally {
            setLoading(false);
        }
    };

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
                                className="w-full text-center tracking-widest text-lg h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/50 outline-none transition-all uppercase"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                autoFocus
                            />
                            {pinError && <p className="text-red-500 text-sm mt-2">{pinError}</p>}
                        </div>
                        <Button type="submit" className="w-full h-12">Entrar</Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            {/* Header Limpo */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 h-16 flex justify-between items-center">
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
                            setStudents([]);
                            setSearchQuery('');
                            setHasSearched(false);
                        }}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">logout</span> Sair
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 mt-4 pb-20">

                {/* Barra de Pesquisa */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <form onSubmit={handleSearch} className="flex gap-3">
                        <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">search</span>
                            <input
                                type="text"
                                placeholder="Digite o nome completo ou parcial do estudante..."
                                className="w-full h-14 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-base"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button type="submit" disabled={loading} className="h-14 px-8" isLoading={loading}>
                            Buscar
                        </Button>
                    </form>
                </div>

                {/* Resultados */}
                <div className="space-y-6">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                            Buscando informações...
                        </div>
                    ) : students.length > 0 ? (
                        students.map(student => {
                            const escolaAtual = student.classes?.schools?.name || 'Não alocado';
                            const turma = student.classes ? `${student.classes.series} ${student.classes.section ? '- ' + student.classes.section : ''}` : '-';
                            const turno = student.classes?.shift || '-';

                            return (
                                <div key={student.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    {/* Info Estudante */}
                                    <div className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
                                                {student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 space-y-4">
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

                                                {/* Dados de Lotação do Aluno */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Escola Atual</span>
                                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
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
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {student.professionals.map(prof => (
                                                    <li key={prof.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">person</span>
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={prof.staff_name}>
                                                                {prof.staff_name}
                                                            </p>
                                                            <p className="text-xs text-slate-500 truncate mt-0.5" title={prof.staff_role}>
                                                                {prof.staff_role}
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
                        hasSearched && !loading && (
                            <div className="text-center py-12 text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="bg-slate-100 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl opacity-50">search_off</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nenhum estudante encontrado</h3>
                                <p className="text-sm mt-1">Verifique a grafia e tente novamente.</p>
                            </div>
                        )
                    )}
                </div>

            </main>
        </div>
    );
};
