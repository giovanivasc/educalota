import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { generateExcel, generateDoc } from '../lib/reports';

const Reports: React.FC = () => {
  const [schools, setSchools] = useState<{ id: string, name: string, director?: string, vice_director?: string }[]>([]);

  // Filters
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSchools = async () => {
      const { data } = await supabase.from('schools').select('*').order('name');
      if (data) setSchools(data);
    };
    fetchSchools();
  }, []);

  // Wrapper functions to call lib with component state
  const handleGenerateExcel = async () => {
    setLoading(true);
    await generateExcel(selectedSchoolId, selectedYear);
    setLoading(false);
  };

  const handleGenerateDoc = async () => {
    setLoading(true);
    await generateDoc(selectedSchoolId, selectedYear);
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <span>Home</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white">Relatórios</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Central de Relatórios</h1>
          <p className="max-w-2xl text-slate-500 dark:text-slate-400 leading-relaxed">
            Gere e exporte dados sobre a lotação dos servidores da educação especial.
          </p>
        </div>
        <Button variant="outline" icon="history">
          Histórico
        </Button>
      </div>

      {/* Filters Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-50 dark:border-slate-800">
          <span className="material-symbols-outlined text-slate-400">filter_alt</span>
          <h2 className="text-lg font-bold">Filtros de Dados</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Escola / Unidade</label>
            <div className="relative">
              <input
                className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Pesquisar escola..."
                value={selectedSchoolId ? (schools.find(s => s.id === selectedSchoolId)?.name || '') : schoolSearchTerm}
                onChange={(e) => {
                  setSchoolSearchTerm(e.target.value);
                  setSelectedSchoolId('');
                  setShowSchoolDropdown(true);
                }}
                onFocus={() => {
                  setSchoolSearchTerm('');
                  setShowSchoolDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowSchoolDropdown(false), 200)}
              />
              {showSchoolDropdown && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg">
                  {schools.filter(s => s.name.toLowerCase().includes(schoolSearchTerm.toLowerCase())).map(s => (
                    <div
                      key={s.id}
                      className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm"
                      onMouseDown={() => {
                        setSelectedSchoolId(s.id);
                        setSchoolSearchTerm(s.name);
                        setShowSchoolDropdown(false);
                      }}
                    >
                      {s.name}
                    </div>
                  ))}
                  {schools.filter(s => s.name.toLowerCase().includes(schoolSearchTerm.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-slate-400 text-sm">Nenhuma escola encontrada</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Ano Letivo</span>
            <select
              className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              title="Selecionar Ano Letivo"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              <option>2026</option>
              <option>2025</option>
              <option>2024</option>
              <option>2023</option>
            </select>
          </div>

        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Card 1: Excel */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl">table_view</span>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">.XLSX</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Planilha de Lotação</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Exportação completa contendo dados de servidores, turmas e estudantes.</p>
            </div>
          </div>
          <Button
            className="mt-8 w-full h-12"
            icon="download"
            onClick={handleGenerateExcel}
            disabled={!selectedSchoolId || loading}
            isLoading={loading}
          >
            Baixar Planilha
          </Button>
        </div>

        {/* Card 2: PDF (actually DOCX now) */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl">description</span>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">.DOC</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Relatório de Pré-Lotação</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Documento World editável para conferência com lista de turmas e servidores.</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-8 w-full h-12 border-2"
            icon="file_download"
            onClick={handleGenerateDoc}
            disabled={!selectedSchoolId || loading}
            isLoading={loading}
          >
            Gerar Documento
          </Button>
        </div>
      </div>

      {/* Hidden Recent Table for now or keep generic mock? Keeping generic mock removed since user focused on actions. */}
    </div>
  );
};

export default Reports;
