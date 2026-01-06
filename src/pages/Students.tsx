import React, { useState, useEffect } from 'react';
// import { MOCK_SCHOOLS } from '../constants'; // Desabilitado
import { Student } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { BulkImporter } from '../components/BulkImporter';

const Students: React.FC = () => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    age: '' as number | string,
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
      age: '',
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
      age: student.age,
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
        age: Number(formData.age),
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
      const [studentsRes, schoolsRes] = await Promise.all([
        supabase.from('students').select('*, classes:class_id(series, section, shift, modality)'),
        supabase.from('schools').select('id, name')
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (schoolsRes.error) throw schoolsRes.error;

      const mappedStudents: Student[] = (studentsRes.data || []).map((s: any) => {
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
          name: s.name,
          age: s.age,
          series: displaySeries,
          schoolId: s.school_id,
          cid: s.cid,
          specialGroup: s.special_group,
          needsSupport: s.needs_support || [],
          additionalInfo: s.additional_info
        };
      });
      setStudents(mappedStudents);
      setSchools(schoolsRes.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (view === 'create') {
    return (
      <div className="mx-auto max-w-4xl space-y-8 pb-10">
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
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Idade</span>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.age}
                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ex: 10"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">cake</span>
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
                {['Atendido por Mediador', 'Atendido por Cuidador', 'Atendido por Prof. Braille', 'Atendido por Prof. Bilíngue', 'Necessita de avaliação', 'Não necessita'].map((item) => (
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Total Estudantes', value: students.length, icon: 'groups', color: 'bg-blue-50 text-blue-600' },
          { label: 'Aguardando Apoio', value: '3', icon: 'pending', color: 'bg-orange-50 text-orange-600' },
          { label: 'Com Laudo Atualizado', value: '98%', icon: 'task_alt', color: 'bg-green-50 text-green-600' },
        ].map((stat, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm">
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
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="relative flex-1">
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
                <th className="px-6 py-4">Estudante</th>
                <th className="px-6 py-4">Diagnóstico</th>
                <th className="px-6 py-4">Série / Turma</th>
                <th className="px-6 py-4">Necessidades</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-bold">
                      {student.name}
                      {student.additionalInfo && (
                        <span
                          className="material-symbols-outlined text-[18px] text-blue-400 hover:text-blue-600 cursor-help transition-colors"
                          title={student.additionalInfo}
                          onClick={(e) => { e.stopPropagation(); alert(`Informações Adicionais:\n${student.additionalInfo}`); }}
                        >
                          info
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-mono font-bold">
                      {student.cid}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">
                    {student.series}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {student.needsSupport.map((n, i) => (
                        <span key={i} className="text-[10px] font-bold uppercase tracking-tight bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">
                          {n}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-slate-400 hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined">delete</span>
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
  );
};

export default Students;
