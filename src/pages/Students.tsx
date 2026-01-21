import React, { useState, useEffect } from 'react';
// import { MOCK_SCHOOLS } from '../constants'; // Desabilitado
import { Student } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { BulkImporter } from '../components/BulkImporter';
import { normalizeText } from '../lib/stringUtils';

const Students: React.FC = () => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [distortionList, setDistortionList] = useState<any[]>([]);
  const [showDistortionModal, setShowDistortionModal] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    birthDate: '',
    series: '',
    schoolId: '',
    cid: '',
    specialGroup: '',
    needsSupport: [] as string[],
    additionalInfo: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      birthDate: '',
      series: '',
      schoolId: '',
      cid: '',
      specialGroup: '',
      needsSupport: [],
      additionalInfo: ''
    });
    setEditingId(null);
  };

  const handleEdit = (student: Student) => {
    setFormData({
      name: student.name,
      birthDate: student.birthDate || '',
      series: student.series,
      schoolId: student.schoolId || '',
      cid: student.cid,
      specialGroup: student.specialGroup,
      needsSupport: student.needsSupport || [],
      additionalInfo: student.additionalInfo || ''
    });
    setEditingId(student.id);
    setView('create');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este estudante?')) return;

    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      setStudents(prev => prev.filter(s => s.id !== id));
      alert('Estudante excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir estudante.');
    }
  };

  const handleSave = async () => {
    if (!formData.name) return alert('Nome é obrigatório');

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        birth_date: formData.birthDate || null,
        series: formData.series,
        school_id: formData.schoolId || null,
        cid: formData.cid,
        special_group: formData.specialGroup,
        needs_support: formData.needsSupport,
        additional_info: formData.additionalInfo
      };

      if (editingId) {
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        alert('Estudante atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('students')
          .insert([payload]);
        if (error) throw error;
        alert('Estudante cadastrado com sucesso!');
      }

      await fetchData();
      setView('list');
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar estudante.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSupport = (item: string) => {
    setFormData(prev => {
      const exists = prev.needsSupport.includes(item);
      return {
        ...prev,
        needsSupport: exists
          ? prev.needsSupport.filter(i => i !== item)
          : [...prev.needsSupport, item]
      };
    });
  };

  const fetchData = async () => {
    try {
      // Função auxiliar para buscar todos os estudantes (paginação manual)
      const fetchAllStudents = async () => {
        let allStudents: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('students')
            .select('*, schools(name), classes:class_id(series, section, shift, modality)')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;

          if (data) {
            allStudents = [...allStudents, ...data];
            // Se retornou menos que o tamanho da página, acabou
            if (data.length < pageSize) hasMore = false;
            else page++;
          } else {
            hasMore = false;
          }
        }
        return allStudents;
      };

      const [allStudentsData, schoolsRes] = await Promise.all([
        fetchAllStudents(),
        supabase.from('schools').select('id, name')
      ]);

      if (schoolsRes.error) throw schoolsRes.error;

      const mappedStudents: Student[] = (allStudentsData || []).map((s: any) => {
        let displaySeries = s.series;

        if (s.classes) {
          const { series, section, shift } = s.classes;
          const parts = [series, section].filter(Boolean).join(' ');
          if (parts) {
            displaySeries = shift ? `${parts} - ${shift}` : parts;
          }
        }

        return {
          id: s.id,
          name: s.name || '',
          birthDate: s.birth_date || '',
          series: displaySeries || '',
          schoolId: s.school_id,
          cid: s.cid || '',
          specialGroup: s.special_group || '',
          needsSupport: s.needs_support || [],
          additionalInfo: s.additional_info || ''
        };
      });

      // Calculate Distortion (unchanged logic)
      const distortionDetails: any[] = [];
      const refDate = new Date(new Date().getFullYear(), 2, 31);

      (allStudentsData || []).forEach((s: any) => {
        if (!s.birth_date) return;
        const birth = new Date(s.birth_date);
        let age = refDate.getFullYear() - birth.getFullYear();
        const m = refDate.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) age--;

        let expectedAge: number | null = null;
        let series = '';
        let modality = '';

        if (s.classes) {
          series = (s.classes.series || '').toLowerCase();
          modality = (s.classes.modality || '').toLowerCase();
        } else if (s.series) {
          series = s.series.toLowerCase();
        }

        if (!series) return;

        if (modality.includes('infantil') || series.includes('infantil') || series.includes('creche')) {
          if (series.includes('2 anos')) expectedAge = 2;
          else if (series.includes('3 anos')) expectedAge = 3;
          else if (series.includes('4 anos')) expectedAge = 4;
          else if (series.includes('5 anos')) expectedAge = 5;
        }
        else if (modality.includes('fundamental') || series.includes('ano') || series.includes('série')) {
          if (series.includes('1º') || series.includes('1o') || series.includes('primeiro')) expectedAge = 6;
          else if (series.includes('2º') || series.includes('2o') || series.includes('segundo')) expectedAge = 7;
          else if (series.includes('3º') || series.includes('3o') || series.includes('terceiro')) expectedAge = 8;
          else if (series.includes('4º') || series.includes('4o') || series.includes('quarto')) expectedAge = 9;
          else if (series.includes('5º') || series.includes('5o') || series.includes('quinto')) expectedAge = 10;
          else if (series.includes('6º') || series.includes('6o') || series.includes('sexto')) expectedAge = 11;
          else if (series.includes('7º') || series.includes('7o') || series.includes('sétimo')) expectedAge = 12;
          else if (series.includes('8º') || series.includes('8o') || series.includes('oitavo')) expectedAge = 13;
          else if (series.includes('9º') || series.includes('9o') || series.includes('nono')) expectedAge = 14;
        }

        if (expectedAge !== null && age > expectedAge) {
          distortionDetails.push({
            id: s.id,
            name: s.name,
            age,
            series: s.classes?.series || s.series,
            modality: s.classes?.modality || 'Não informado',
            schoolName: s.schools?.name || 'Não informado',
            gap: age - expectedAge
          });
        }
      });
      setDistortionList(distortionDetails);
      setStudents(mappedStudents);
      setSchools(schoolsRes.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' ? { key, direction: 'desc' } : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredStudents = students
    .filter(s => {
      const search = normalizeText(searchTerm);
      const name = normalizeText(s.name || '');
      const cid = normalizeText(s.cid || '');
      return name.includes(search) || cid.includes(search);
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;

      let valA = '';
      let valB = '';

      switch (sortConfig.key) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          break;
        case 'birthDate':
          valA = a.birthDate || '';
          valB = b.birthDate || '';
          break;
        case 'specialGroup':
          valA = (a.specialGroup || '').toLowerCase();
          valB = (b.specialGroup || '').toLowerCase();
          break;
        case 'series':
          valA = (a.series || '').toLowerCase();
          valB = (b.series || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  /* New State for Multi-Selection */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} estudantes selecionados?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      alert('Estudantes excluídos com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir em massa:', error);
      alert('Erro ao excluir estudantes.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'create') {
    // ... (rest of the create view remains unchanged)
    return (
      <div className="mx-auto max-w-4xl space-y-8 pb-10">
        {/* ... */}
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setView('list'); resetForm(); }}
            icon="arrow_back"
            className="w-fit pl-0 hover:bg-transparent"
          >
            Voltar para Listagem
          </Button>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {editingId ? 'Editar Estudante' : 'Cadastro de Estudante'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Preencha os dados abaixo para registrar um novo estudante no sistema.</p>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome Completo do Estudante</span>
                <div className="relative">
                  <input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ex: João da Silva"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">person</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Data de Nascimento</span>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">calendar_month</span>
                </div>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Série</span>
                <div className="relative">
                  <input
                    value={formData.series}
                    onChange={e => setFormData({ ...formData, series: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ex: 5º Ano A"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">school</span>
                </div>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Escola de Referência</span>
                <div className="relative">
                  <select
                    value={formData.schoolId}
                    onChange={e => setFormData({ ...formData, schoolId: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecione a escola</option>
                    {schools.map(school => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined pointer-events-none">domain</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Hipótese Diagnóstica ou CID</span>
                <div className="relative">
                  <input
                    value={formData.cid}
                    onChange={e => setFormData({ ...formData, cid: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ex: F84.0"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">medical_services</span>
                </div>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Grupo da Educação Especial</span>
                <div className="relative">
                  <select
                    value={formData.specialGroup}
                    onChange={e => setFormData({ ...formData, specialGroup: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecione o grupo</option>
                    <option>Transtorno do Espectro Autista (TEA)</option>
                    <option>Deficiência Intelectual</option>
                    <option>Deficiência Visual</option>
                    <option>Deficiência Auditiva / Surdez</option>
                    <option>Deficiência Física</option>
                    <option>Deficiência Múltipla</option>
                    <option>Altas habilidades/superdotação</option>
                  </select>
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined pointer-events-none">expand_more</span>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Necessita de Suporte Especializado?</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {['Atendido por Mediador', 'Atendido por Cuidador', 'Atendido por Prof. Braille', 'Atendido por Prof. Bilíngue', 'Necessita de avaliação', 'Não necessita', 'Atendimento domiciliar', 'Mediação exclusiva'].map((item) => (
                  <label key={item} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-primary/50 transition-colors ${formData.needsSupport.includes(item) ? 'bg-primary/5 border-primary' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
                    <input
                      type="checkbox"
                      checked={formData.needsSupport.includes(item)}
                      onChange={() => toggleSupport(item)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Informações Adicionais</span>
                <textarea
                  value={formData.additionalInfo}
                  onChange={e => setFormData({ ...formData, additionalInfo: e.target.value })}
                  className="w-full min-h-[140px] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-y"
                  placeholder="Descreva observações relevantes sobre o estudante, adaptações necessárias ou histórico escolar..."
                />
              </label>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button onClick={handleSave} icon="save" isLoading={loading}>
                {editingId ? 'Atualizar Estudante' : 'Salvar Estudante'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Estudantes (Público-Alvo)</h1>
          <p className="text-slate-500 dark:text-slate-400">Gestão de prontuários e acompanhamento de necessidades especiais.</p>
        </div>
        <div className="flex gap-2">
          <BulkImporter type="students" onSuccess={fetchData} label="Importar Estudantes" />
          <Button onClick={() => { setView('create'); resetForm(); }} icon="person_add">
            Novo Estudante
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Estudantes', value: students.length, icon: 'groups', color: 'bg-blue-50 text-blue-600' },
          { label: 'Aguardando Apoio', value: '3', icon: 'pending', color: 'bg-orange-50 text-orange-600' },
          { label: 'Com Laudo Atualizado', value: '98%', icon: 'task_alt', color: 'bg-green-50 text-green-600' },
          { label: 'Defasagem Idade-Série', value: distortionList.length, icon: 'warning', color: 'bg-red-50 text-red-600', onClick: () => setShowDistortionModal(true) },
        ].map((stat, i) => (
          <div
            key={i}
            className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm flex flex-col justify-between ${stat.onClick ? 'cursor-pointer hover:border-red-200 hover:ring-2 hover:ring-red-100 transition-all' : ''}`}
            onClick={stat.onClick}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${stat.color} dark:bg-opacity-10`}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Buscar estudante por nome ou CID..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-3 py-3 w-[40px] text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                    checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th
                  className="px-3 py-3 w-[30%] min-w-[250px] cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none group"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Estudante
                    <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary transition-colors">
                      {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none group"
                  onClick={() => handleSort('birthDate')}
                >
                  <div className="flex items-center gap-1">
                    Data Nasc.
                    <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary transition-colors">
                      {sortConfig?.key === 'birthDate' ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none group"
                  onClick={() => handleSort('specialGroup')}
                >
                  <div className="flex items-center gap-1">
                    Grupo Educação Especial
                    <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary transition-colors">
                      {sortConfig?.key === 'specialGroup' ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none group"
                  onClick={() => handleSort('series')}
                >
                  <div className="flex items-center gap-1">
                    Série / Turma
                    <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary transition-colors">
                      {sortConfig?.key === 'series' ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                    </span>
                  </div>
                </th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredStudents.map(student => (
                <tr key={student.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${selectedIds.has(student.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                      checked={selectedIds.has(student.id)}
                      onChange={(e) => handleSelectOne(student.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 font-bold truncate max-w-[300px]" title={student.name}>
                      {student.name}
                      {student.additionalInfo && (
                        <span
                          className="material-symbols-outlined text-[16px] text-blue-400 hover:text-blue-600 cursor-help transition-colors flex-shrink-0"
                          title={student.additionalInfo}
                          onClick={(e) => { e.stopPropagation(); alert(`Informações Adicionais:\n${student.additionalInfo}`); }}
                        >
                          info
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-500 whitespace-nowrap">
                    {student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-lg bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-1 text-xs font-bold whitespace-nowrap">
                      {student.specialGroup || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                    {student.series}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-slate-400 hover:text-primary transition-colors p-1"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
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

      {/* Floating Action Bar for Bulk Selection */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-3 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">{selectedIds.size}</span> selecionado{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          <Button
            variant="secondary"
            className="h-8 bg-red-50 text-red-600 hover:bg-red-100 border-red-200 text-xs px-3"
            onClick={handleBulkDelete}
            icon="delete"
          >
            Excluir Selecionados
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            title="Cancelar seleção"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      {/* Distortion Modal */}
      {showDistortionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-surface-dark">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-red-600">
                  <span className="material-symbols-outlined">warning</span>
                  Estudantes em Defasagem Idade-Série
                </h2>
                <p className="text-sm text-slate-500">
                  Total de {distortionList.length} estudantes identificados com idade acima do esperado para a série.
                </p>
              </div>
              <button
                onClick={() => setShowDistortionModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              {distortionList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                  <p>Nenhuma distorção encontrada.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-6 py-4">Estudante</th>
                      <th className="px-6 py-4">Idade</th>
                      <th className="px-6 py-4">Escola / Série</th>
                      <th className="px-6 py-4 text-center">Defasagem (Anos)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {distortionList.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {student.name}
                        </td>
                        <td className="px-6 py-4">
                          {student.age} anos
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{student.schoolName}</span>
                            <span className="text-xs text-slate-500">{student.series} ({student.modality})</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 text-xs font-bold">
                            +{student.gap} anos
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <Button onClick={() => setShowDistortionModal(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
