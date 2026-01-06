import React, { useState, useEffect } from 'react';
// import { MOCK_SCHOOLS } from '../constants'; // Desabilitado
import { School } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { BulkImporter } from '../components/BulkImporter';
import { sortClasses } from '../lib/sorting';

const Schools: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'classes'>('list');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('schools')
        .select('*, students(count), classes(count)');

      if (error) throw error;

      const mappedData: School[] = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        region: s.region,
        description: s.description,
        studentsCount: s.students?.[0]?.count || 0,
        classesCount: s.classes?.[0]?.count || 0,
        location: 'Endereço não informado',
        active: true,
        // imageUrl removed, not used anymore
        directorName: s.director_name,
        viceDirectorName: s.vice_director_name
      }));

      setSchools(mappedData);
    } catch (error) {
      console.error('Error fetching schools:', error);
    } finally {
      setLoading(false);
    }
  };

  // State for classes management
  const [classes, setClasses] = useState<any[]>([]);
  // Sorting state for classes
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedClasses = React.useMemo(() => {
    let sortableItems = [...classes];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Especial para Série/Turma, combinando para ordenar melhor
        if (sortConfig.key === 'series') {
          aValue = `${a.series} ${a.section || ''}`;
          bValue = `${b.series} ${b.section || ''}`;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [classes, sortConfig]);

  const getSortIcon = (name: string) => {
    if (!sortConfig || sortConfig.key !== name) {
      return <span className="material-symbols-outlined text-[14px] opacity-30">unfold_more</span>;
    }
    return sortConfig.direction === 'asc'
      ? <span className="material-symbols-outlined text-[14px]">expand_less</span>
      : <span className="material-symbols-outlined text-[14px]">expand_more</span>;
  };

  const [newClass, setNewClass] = useState({
    modality: 'Educação Infantil',
    year: new Date().getFullYear(),
    series: '', // Grade part e.g. "5 anos"
    section: '', // Section/Turma part e.g. "A"
    shift: 'Manhã',
    obs: ''
  });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);

  // State for students management modal
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentModalTab, setStudentModalTab] = useState<'list' | 'create'>('list');
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [availableStudents, setAvailableStudents] = useState<any[]>([]); // Search results for linking

  // New Student State (Matches Students.tsx)
  const [newStudent, setNewStudent] = useState({
    name: '',
    age: '',
    cid: '',
    specialGroup: '',
    needsSupport: [] as string[],
    description: ''
  });

  // State for new school
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [newSchool, setNewSchool] = useState({
    name: '',
    region: '',
    description: '',
    director: '',
    viceDirector: ''
  });
  // const [schoolImageFile, setSchoolImageFile] = useState<File | null>(null); // Removed
  const [saveSchoolLoading, setSaveSchoolLoading] = useState(false);

  useEffect(() => {
    if (view === 'classes' && selectedSchool) {
      fetchClasses(selectedSchool.id);
    }
  }, [view, selectedSchool]);

  const fetchClasses = async (schoolId: string) => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, students(count)')
      .eq('school_id', schoolId);

    if (error) console.error(error);
    else {
      const sortedData = (data || []).sort(sortClasses);
      setClasses(sortedData);
    }
  };

  const handleSaveClass = async () => {
    if (!selectedSchool || !newClass.series || !newClass.section) {
      alert('Preencha a Série e a Turma.');
      return;
    }

    setLoading(true);
    try {
      if (editingClassId) {
        // Update
        const { error } = await supabase.from('classes').update({
          modality: newClass.modality,
          year: newClass.year,
          series: newClass.series,
          section: newClass.section,
          shift: newClass.shift,
          obs: newClass.obs
        }).eq('id', editingClassId);
        if (error) throw error;
        alert('Turma atualizada com sucesso!');
      } else {
        // Create
        const { error } = await supabase.from('classes').insert({
          school_id: selectedSchool.id,
          modality: newClass.modality,
          year: newClass.year,
          series: newClass.series,
          section: newClass.section,
          shift: newClass.shift,
          obs: newClass.obs
        });
        if (error) throw error;
        alert('Turma criada com sucesso!');
      }

      await fetchClasses(selectedSchool.id);
      setNewClass(prev => ({ ...prev, series: '', section: '', obs: '' }));
      setEditingClassId(null);
      setShowClassModal(false); // Close modal
    } catch (e: any) {
      console.error(e);
      alert('Erro ao salvar turma: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClass = (cls: any) => {
    setNewClass({
      modality: cls.modality,
      year: cls.year,
      series: cls.series,
      section: cls.section || '',
      shift: cls.shift,
      obs: cls.obs || ''
    });
    setEditingClassId(cls.id);
    setShowClassModal(true);
  };

  const fetchClassStudents = async (classId: string) => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId);
    if (error) console.error(error);
    else setClassStudents(data || []);
  };

  const handleManageStudents = (cls: any) => {
    setSelectedClass(cls);
    fetchClassStudents(cls.id);
    fetchAvailableStudents(); // Pre-fetch or wait for search? Let's wait for search usually, but maybe fetch all for now.
    setShowStudentModal(true);
    setStudentModalTab('list');
    setStudentSearchTerm('');
  };

  const fetchAvailableStudents = async () => {
    // Fetch students not in this class (or maybe all to allow moving?)
    // User said "busque entre os estudantes cadastrados".
    const { data } = await supabase.from('students').select('*').order('name');
    setAvailableStudents(data || []);
  };

  const activeAvailableStudents = availableStudents.filter(s =>
    s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) &&
    s.class_id !== selectedClass?.id // Exclude already in class
  );

  const handleAddStudent = async () => {
    if (!newStudent.name) return;
    try {
      const { error } = await supabase.from('students').insert({
        name: newStudent.name,
        age: newStudent.age ? parseInt(newStudent.age) : null,
        cid: newStudent.cid,
        special_group: newStudent.specialGroup,
        needs_support: newStudent.needsSupport,
        additional_info: newStudent.description, // Mapped from description
        school_id: selectedSchool?.id,
        class_id: selectedClass?.id,
        series: `${selectedClass?.series} - ${selectedClass?.section}` // Sync series name for legacy, or construct better
      });

      if (error) throw error;
      alert('Estudante cadastrado com sucesso!');
      setNewStudent({ name: '', age: '', cid: '', specialGroup: '', needsSupport: [], description: '' });
      fetchClassStudents(selectedClass.id);
      setStudentModalTab('list'); // Switch back to list
    } catch (e) {
      console.error(e);
      alert('Erro ao cadastrar estudante: ' + e.message);
    }
  };

  const handleLinkExistingStudent = async (studentId: string) => {
    try {
      const { error } = await supabase.from('students')
        .update({ class_id: selectedClass.id, school_id: selectedSchool?.id })
        .eq('id', studentId);
      if (error) throw error;
      alert('Estudante vinculado!');
      fetchClassStudents(selectedClass.id);
      fetchAvailableStudents(); // Refresh available list
    } catch (e) {
      console.error(e);
      alert('Erro ao vincular.');
    }
  }

  const toggleNeedSupport = (support: string) => {
    setNewStudent(prev => {
      const exists = prev.needsSupport.includes(support);
      return {
        ...prev,
        needsSupport: exists ? prev.needsSupport.filter(s => s !== support) : [...prev.needsSupport, support]
      };
    });
  };

  /* Removed handleLinkStudent and fetchAllStudents in favor of new modal logic above */

  /* Removed handleLinkStudent and fetchAllStudents in favor of new modal logic above and removed handleSchoolImageChange */

  const handleSaveSchool = async () => {
    if (!newSchool.name || !newSchool.region) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    setSaveSchoolLoading(true);
    try {
      // Image upload logic removed as requested.

      const schoolData = {
        name: newSchool.name,
        region: newSchool.region,
        description: newSchool.description,
        director_name: newSchool.director,
        vice_director_name: newSchool.viceDirector,
        // image_url: null 
      };

      if (isEditingSchool && editingSchoolId) {
        const { error } = await supabase.from('schools').update(schoolData).eq('id', editingSchoolId);
        if (error) throw error;
        alert('Escola atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('schools').insert({
          ...schoolData,
          students_count: 0,
          classes_count: 0
        });
        if (error) throw error;
        alert('Escola cadastrada com sucesso!');
      }

      setNewSchool({ name: '', region: '', description: '', director: '', viceDirector: '' });
      setIsEditingSchool(false);
      setEditingSchoolId(null);
      await fetchSchools();
      setView('list');

    } catch (e: any) {
      console.error(e);
      alert('Erro ao salvar escola.');
    } finally {
      setSaveSchoolLoading(false);
    }
  };

  const handleDeleteSchool = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta escola? Todas as turmas associadas também serão excluídas e os alunos desvinculados.')) return;

    try {
      // 1. Unlink students
      const { error: studentError } = await supabase
        .from('students')
        .update({ school_id: null, class_id: null })
        .eq('school_id', id);
      if (studentError) throw studentError;

      // 2. Delete allotments related to this school (via classes? or if allotments has school_id)
      // Assuming allotments are linked to classes. We need to find classes first to delete allotments?
      // Or just delete allotments linked to classes of this school.
      // Easier: Get classes IDs.
      const { data: schoolClasses } = await supabase.from('classes').select('id').eq('school_id', id);
      if (schoolClasses && schoolClasses.length > 0) {
        const classIds = schoolClasses.map(c => c.id);

        // Delete allotments for these classes
        const { error: allotError } = await supabase
          .from('allotments')
          .delete()
          .in('class_id', classIds);
        if (allotError) throw allotError;

        // 3. Delete classes
        const { error: classError } = await supabase
          .from('classes')
          .delete()
          .eq('school_id', id);
        if (classError) throw classError;
      }

      // 4. Delete school
      const { error } = await supabase.from('schools').delete().eq('id', id);
      if (error) throw error;

      alert('Escola excluída com sucesso.');
      fetchSchools();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao excluir escola: ' + (error.message || error.details || 'Erro desconhecido'));
    }
  };

  const handleEditSchool = (school: School, e: React.MouseEvent) => {
    e.stopPropagation();
    setNewSchool({
      name: school.name,
      region: school.region,
      description: school.description,
      director: school.directorName || '',
      viceDirector: school.viceDirectorName || ''
    });
    setEditingSchoolId(school.id);
    setIsEditingSchool(true);
    setView('create');
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta turma? Os alunos serão desvinculados e as lotações removidas.')) return;

    try {
      // 1. Unlink students
      const { error: studentError } = await supabase
        .from('students')
        .update({ class_id: null })
        .eq('class_id', id);
      if (studentError) throw studentError;

      // 2. Delete allotments
      const { error: allotError } = await supabase
        .from('allotments')
        .delete()
        .eq('class_id', id);
      if (allotError) throw allotError;

      // 3. Delete class
      const { error, data } = await supabase.from('classes').delete().eq('id', id).select();

      if (error) throw error;
      // Se não retornou dados, significa que a linha não foi deletada (provavelmente RLS)
      if (!data || data.length === 0) {
        throw new Error('Nenhuma turma foi excluída. Verifique suas permissões de acesso.');
      }

      alert('Turma excluída com sucesso!');
      if (selectedSchool) fetchClasses(selectedSchool.id);
      fetchSchools();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir turma: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleManageClasses = (school: School) => {
    setSelectedSchool(school);
    setView('classes');
  };

  if (view === 'create') {
    return (
      <div className="mx-auto max-w-4xl space-y-8 pb-10">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              fetchSchools();
              setView('list');
            }}
            icon="arrow_back"
            className="w-fit pl-0 hover:bg-transparent"
          >
            Voltar para Escolas
          </Button>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{isEditingSchool ? 'Editar Unidade' : 'Cadastrar Nova Unidade'}</h1>
          <p className="text-slate-500 dark:text-slate-400">{isEditingSchool ? 'Atualize as informações da unidade escolar.' : 'Registre uma nova unidade escolar no sistema EducaLota.'}</p>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome da Unidade</span>
                <input
                  value={newSchool.name}
                  onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Ex: Escola Municipal Centro"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Área</span>
                <div className="relative">
                  <select
                    value={newSchool.region}
                    onChange={(e) => setNewSchool({ ...newSchool, region: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecione a área</option>
                    <option>Urbano</option>
                    <option>Campo</option>
                  </select>
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined pointer-events-none">expand_more</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do Diretor(a)</span>
                <div className="relative">
                  <input
                    value={newSchool.director}
                    onChange={(e) => setNewSchool({ ...newSchool, director: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ex: João Silva"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">person</span>
                </div>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do Vice-Diretor(a)</span>
                <div className="relative">
                  <input
                    value={newSchool.viceDirector}
                    onChange={(e) => setNewSchool({ ...newSchool, viceDirector: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ex: Maria Oliveira"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">person</span>
                </div>
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Descrição / Observações</span>
              <textarea
                value={newSchool.description}
                onChange={(e) => setNewSchool({ ...newSchool, description: e.target.value })}
                className="w-full min-h-[140px] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                placeholder="Detalhes sobre acessibilidade, salas de recursos, etc."
              />
            </label>
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button onClick={handleSaveSchool} isLoading={saveSchoolLoading}>
                {isEditingSchool ? 'Atualizar Unidade' : 'Salvar Unidade'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'classes' && selectedSchool) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 pb-10 relative">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('list')}
            icon="arrow_back"
            className="w-fit pl-0 hover:bg-transparent"
          >
            Voltar para Escolas
          </Button>
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Gerenciamento de Turmas</h1>
              <p className="text-slate-500 dark:text-slate-400">Gerenciando as turmas da <span className="font-bold text-primary">{selectedSchool.name}</span>.</p>
            </div>
            <Button icon="add" onClick={() => {
              setEditingClassId(null);
              setNewClass(prev => ({ ...prev, series: '', section: '', obs: '' }));
              setShowClassModal(true);
            }}>
              Nova Turma
            </Button>
          </div>
        </div>

        {/* Modal de Nova/Edição de Turma */}
        {showClassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-surface-dark flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">{editingClassId ? 'edit' : 'add_circle'}</span>
                  {editingClassId ? 'Editar Turma' : 'Cadastrar Nova Turma'}
                </h2>
                <button onClick={() => setShowClassModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                  <span className="material-symbols-outlined text-slate-500">close</span>
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Etapa / Modalidade</span>
                  <select
                    value={newClass.modality}
                    title="Selecione a Modalidade"
                    onChange={e => setNewClass({ ...newClass, modality: e.target.value })}
                    className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm px-3 outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option>Educação Infantil</option>
                    <option>Ensino Fundamental 1º/5º ano</option>
                    <option>Ensino Fundamental 6º/9º ano</option>
                    <option>EJA</option>
                    <option>Educação Especial</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Ano Letivo</span>
                  <input
                    type="number"
                    value={newClass.year}
                    title="Ano Letivo"
                    onChange={e => setNewClass({ ...newClass, year: parseInt(e.target.value) })}
                    className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm px-3 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Série (Ex: 5º Ano)</span>
                  <input
                    type="text"
                    placeholder="Ex: 5º Ano"
                    value={newClass.series}
                    onChange={e => setNewClass({ ...newClass, series: e.target.value })}
                    className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm px-3 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Turma (Ex: A)</span>
                  <input
                    type="text"
                    placeholder="Ex: A"
                    value={newClass.section}
                    onChange={e => setNewClass({ ...newClass, section: e.target.value })}
                    className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm px-3 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Turno</span>
                  <select
                    value={newClass.shift}
                    title="Selecione o Turno"
                    onChange={e => setNewClass({ ...newClass, shift: e.target.value })}
                    className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm px-3 outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option>Manhã</option>
                    <option>Tarde</option>
                    <option>Noite</option>
                    <option>Integral</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs font-bold text-slate-500">Observações</span>
                  <input
                    type="text"
                    placeholder="Observações opcionais..."
                    value={newClass.obs}
                    onChange={e => setNewClass({ ...newClass, obs: e.target.value })}
                    className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm px-3 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 md:col-span-2 mt-4">
                  <Button variant="ghost" onClick={() => setShowClassModal(false)}>Cancelar</Button>
                  <Button icon="save" onClick={handleSaveClass} isLoading={loading}>
                    {editingClassId ? 'Atualizar Turma' : 'Salvar Turma'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Listagem de Turmas */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h2 className="font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">table_chart</span>
              Turmas Cadastradas
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors group select-none" onClick={() => handleSort('modality')}>
                    <div className="flex items-center gap-1">
                      Modalidade
                      {getSortIcon('modality')}
                    </div>
                  </th>
                  <th className="px-6 py-4">Ano</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors group select-none" onClick={() => handleSort('series')}>
                    <div className="flex items-center gap-1">
                      Série / Turma
                      {getSortIcon('series')}
                    </div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors group select-none" onClick={() => handleSort('shift')}>
                    <div className="flex items-center gap-1">
                      Turno
                      {getSortIcon('shift')}
                    </div>
                  </th>
                  <th className="px-6 py-4">Alunos</th>
                  <th className="px-6 py-4">Obs.</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedClasses.map(cls => (
                  <tr key={cls.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{cls.modality || '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{cls.year || new Date().getFullYear()}</td>
                    <td className="px-6 py-4 font-bold">{cls.series} {cls.section ? `- ${cls.section} ` : ''}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${cls.shift === 'Manhã' ? 'bg-yellow-100 text-yellow-700' :
                        cls.shift === 'Tarde' ? 'bg-orange-100 text-orange-700' :
                          cls.shift === 'Noite' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'
                        } `}>
                        {cls.shift}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">groups</span>
                        {cls.students ? cls.students[0].count : 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 truncate max-w-[200px]">{cls.obs}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Gerenciar Alunos" onClick={(e) => { e.stopPropagation(); handleManageStudents(cls); }}>
                          <span className="material-symbols-outlined text-[20px]">group_add</span>
                        </button>
                        <button type="button" className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Editar Turma" onClick={(e) => { e.stopPropagation(); handleEditClass(cls); }}>
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button type="button" className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }} title="Excluir Turma">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- STUDENT MANAGEMENT MODAL --- */}
        {showStudentModal && selectedClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-surface-dark">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">groups</span>
                    Gerenciar Estudantes
                  </h2>
                  <p className="text-sm text-slate-500">{selectedClass.name} - {selectedSchool.name}</p>
                </div>
                <button onClick={() => setShowStudentModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                  <span className="material-symbols-outlined text-slate-500">close</span>
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 gap-6">
                <button
                  className={`py - 4 text - sm font - bold border - b - 2 transition - colors ${studentModalTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'} `}
                  onClick={() => setStudentModalTab('list')}
                >
                  Matrículas e Vínculo
                </button>
                <button
                  className={`py - 4 text - sm font - bold border - b - 2 transition - colors ${studentModalTab === 'create' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'} `}
                  onClick={() => setStudentModalTab('create')}
                >
                  Cadastrar Novo
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">

                {/* Tab: List and Link */}
                {studentModalTab === 'list' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    {/* Left: Enrolled Students */}
                    <div className="flex flex-col bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-fit max-h-full">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-200 flex justify-between">
                        <span>Matriculados na Turma</span>
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{classStudents.length}</span>
                      </div>
                      <div className="overflow-y-auto max-h-[400px]">
                        {classStudents.length === 0 ? <p className="p-4 text-sm text-slate-400 text-center">Nenhum aluno.</p> : (
                          <table className="w-full text-left text-sm">
                            <tbody>
                              {classStudents.map(s => (
                                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                  <td className="p-3">
                                    <div className="font-bold text-slate-700 dark:text-slate-200">{s.name}</div>
                                    <div className="text-xs text-slate-400">{s.cid ? `CID: ${s.cid} ` : 'Sem CID'}</div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      className="text-red-400 hover:text-red-600 p-1"
                                      title="Remover da turma"
                                      onClick={async () => {
                                        if (confirm('Remover aluno desta turma?')) {
                                          await supabase.from('students').update({ class_id: null }).eq('id', s.id);
                                          fetchClassStudents(selectedClass.id);
                                        }
                                      }}
                                    >
                                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* Right: Search and Link */}
                    <div className="flex flex-col bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-fit max-h-full">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="font-bold text-slate-700 dark:text-slate-200 mb-2">Vincular Estudante Existente</div>
                        <div className="relative">
                          <input
                            placeholder="Buscar por nome no cadastro geral..."
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary"
                            value={studentSearchTerm}
                            onChange={e => setStudentSearchTerm(e.target.value)}
                          />
                          <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-[18px]">search</span>
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-[400px]">
                        {studentSearchTerm.length < 2 ? (
                          <p className="p-8 text-center text-sm text-slate-400">Digite para buscar...</p>
                        ) : activeAvailableStudents.length === 0 ? (
                          <p className="p-8 text-center text-sm text-slate-400">Nenhum estudante encontrado.</p>
                        ) : (
                          <table className="w-full text-left text-sm">
                            <tbody>
                              {activeAvailableStudents.map(s => (
                                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                  <td className="p-3">
                                    <div className="font-bold text-slate-700 dark:text-slate-200">{s.name}</div>
                                    <div className="text-xs text-slate-400 flex gap-2">
                                      <span>{s.cid || 'Sem CID'}</span>
                                      {s.class_id && <span className="text-orange-400">• Já tem turma</span>}
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs bg-primary/10 text-primary hover:bg-primary hover:text-white shadow-none"
                                      onClick={() => handleLinkExistingStudent(s.id)}
                                    >
                                      Vincular
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Create New */}
                {studentModalTab === 'create' && (
                  <div className="max-w-3xl mx-auto bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome Completo</span>
                          <input
                            className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Ex: Ana Souza"
                            value={newStudent.name}
                            onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                          />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Idade</span>
                          <input
                            className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary"
                            type="number"
                            placeholder="Ex: 12"
                            value={newStudent.age}
                            onChange={e => setNewStudent({ ...newStudent, age: e.target.value })}
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">CID / Diagnóstico</span>
                          <input
                            className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Ex: F84.0"
                            value={newStudent.cid}
                            onChange={e => setNewStudent({ ...newStudent, cid: e.target.value })}
                          />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Grupo Especial</span>
                          <select
                            className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary"
                            value={newStudent.specialGroup}
                            onChange={e => setNewStudent({ ...newStudent, specialGroup: e.target.value })}
                          >
                            <option value="">Selecione...</option>
                            <option>Transtorno do Espectro Autista (TEA)</option>
                            <option>Deficiência Intelectual</option>
                            <option>Deficiência Visual</option>
                            <option>Deficiência Auditiva / Surdez</option>
                            <option>Deficiência Física</option>
                            <option>Deficiência Múltipla</option>
                            <option>Altas habilidades/superdotação</option>
                          </select>
                        </label>
                      </div>
                      <div className="space-y-3">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Suporte Necessário</span>
                        <div className="grid grid-cols-2 gap-3">
                          {['Atendido por Mediador', 'Atendido por Cuidador', 'Atendido por Prof. Braille', 'Atendido por Prof. Bilíngue', 'Necessita de avaliação', 'Não necessita'].map((item) => (
                            <label key={item} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded text-primary focus:ring-primary"
                                checked={newStudent.needsSupport.includes(item)}
                                onChange={() => toggleNeedSupport(item)}
                              />
                              <span className="text-sm">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Informações Adicionais</span>
                        <textarea
                          className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-primary resize-y"
                          placeholder="Observações sobre o aluno..."
                          value={newStudent.description}
                          onChange={e => setNewStudent({ ...newStudent, description: e.target.value })}
                        />
                      </label>
                      <div className="pt-4 flex justify-end">
                        <Button onClick={handleAddStudent} icon="save">Salvar e Matricular</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }



  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Escolas e Unidades</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie as unidades escolares e suas especificidades de acessibilidade.</p>
        </div>
        <BulkImporter type="schools" onSuccess={fetchSchools} label="Importar Escolas" />
        <Button
          onClick={() => {
            setIsEditingSchool(false);
            setNewSchool({ name: '', region: '', description: '', director: '', viceDirector: '' });
            // setSchoolImageFile(null);
            setView('create');
          }}
          icon="add_business"
        >
          Cadastrar Escola
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-4 shadow-sm flex items-center gap-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <span className="material-symbols-outlined">domain</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total de Unidades</p>
            <p className="text-2xl font-bold">{schools.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-4 shadow-sm flex items-center gap-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <span className="material-symbols-outlined">class</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total de Turmas</p>
            <p className="text-2xl font-bold">{schools.reduce((acc, s) => acc + (s.classesCount || 0), 0)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search Bar moved above list */}
        <div className="flex items-center gap-4 bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">search</span>
            <input
              type="text"
              className="h-10 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder="Buscar escola por nome ou área..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* List View */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Escola / Unidade</th>
                  <th className="px-6 py-4">Região</th>
                  <th className="px-6 py-4 text-center">Alunos</th>
                  <th className="px-6 py-4 text-center">Turmas</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSchools.map((school) => (
                  <tr
                    key={school.id}
                    onClick={() => handleManageClasses(school)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <span className="material-symbols-outlined">school</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{school.name}</p>
                          <p className="text-xs text-slate-500 line-clamp-1">{school.description || 'Sem descrição'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {school.region}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{school.studentsCount}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{school.classesCount}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleEditSchool(school, e)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteSchool(school.id, e)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schools;
