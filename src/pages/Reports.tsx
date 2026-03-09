import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { generateExcel, generateDoc, generatePDF, generateGeneralDoc, generateGeneralPDF, generateMultiSchoolPDFZip } from '../lib/reports';
import { SrmReportModal } from '../components/SrmReportModal';
import { StaffBySchoolReportModal } from '../components/StaffBySchoolReportModal';
import { RhReportModal } from '../components/RhReportModal';

const Reports: React.FC = () => {
  const [schools, setSchools] = useState<{ id: string, name: string, director_name?: string, vice_director_name?: string, region?: string }[]>([]);

  // Filters
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Date Filters
  const [filterType, setFilterType] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [docLoading, setDocLoading] = useState(false); // separate loading optional or use global


  const [loading, setLoading] = useState(false);
  const [showSrmModal, setShowSrmModal] = useState(false);
  const [showStaffBySchoolModal, setShowStaffBySchoolModal] = useState(false);
  const [showMultiSchoolModal, setShowMultiSchoolModal] = useState(false);
  const [showRhModal, setShowRhModal] = useState(false);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [schoolRegionFilter, setSchoolRegionFilter] = useState<'all' | 'campo' | 'urbana'>('all');
  const [zipProgress, setZipProgress] = useState({ done: 0, total: 0 });
  const [zipLoading, setZipLoading] = useState(false);

  useEffect(() => {
    const fetchSchools = async () => {
      const { data } = await supabase.from('schools').select('*').order('name');
      if (data) setSchools(data);
    };
    fetchSchools();
  }, []);

  const getFilterDates = () => {
    if (filterType === 'month' && selectedMonth) {
      const [y, m] = selectedMonth.split('-');
      const start = new Date(parseInt(y), parseInt(m) - 1, 1);
      const end = new Date(parseInt(y), parseInt(m), 0);
      // Convert to YYYY-MM-DD
      const format = (d: Date) => d.toISOString().split('T')[0];
      return { start: format(start), end: format(end) };
    }
    return { start: dateRange.start || undefined, end: dateRange.end || undefined };
  };

  const handleGenerateExcel = async () => {
    setLoading(true);
    const { start, end } = getFilterDates();
    await generateExcel(selectedSchoolId, start, end);
    setLoading(false);
  };

  const handleGenerateGeneralDoc = async () => {
    setLoading(true);
    const { start, end } = getFilterDates();
    await generateGeneralDoc(selectedSchoolId, start, end);
    setLoading(false);
  }

  const handleGenerateGeneralPDF = async () => {
    setLoading(true);
    const { start, end } = getFilterDates();
    await generateGeneralPDF(selectedSchoolId, start, end);
    setLoading(false);
  }

  // Pre-Lotacao Actions (School Specific)
  const handleGeneratePreLotacaoDoc = async () => {
    setLoading(true);
    await generateDoc(selectedSchoolId, selectedYear);
    setLoading(false);
  };

  const handleGeneratePreLotacaoPDF = async () => {
    setLoading(true);
    await generatePDF(selectedSchoolId, selectedYear);
    setLoading(false);
  };

  const handleOpenMultiSchoolModal = () => {
    setShowMultiSchoolModal(true);
    setSelectedSchoolIds([]);
    setSchoolRegionFilter('all');
    setZipProgress({ done: 0, total: 0 });
  };

  const handleGenerateMultiZip = async () => {
    if (selectedSchoolIds.length === 0) {
      alert("Selecione pelo menos uma escola.");
      return;
    }
    setZipLoading(true);
    await generateMultiSchoolPDFZip(selectedSchoolIds, selectedYear, (done, total) => {
      setZipProgress({ done, total });
    });
    setZipLoading(false);
    setShowMultiSchoolModal(false);
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

        {/* Date Filters Row */}
        <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block">Tipo de Período</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="ftype" checked={filterType === 'month'} onChange={() => setFilterType('month')} /> Por Mês
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="ftype" checked={filterType === 'range'} onChange={() => setFilterType('range')} /> Data Personalizada
              </label>
            </div>
          </div>
          <div className="space-y-2">
            {filterType === 'month' ? (
              <>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Selecione o Mês</span>
                <input
                  type="month"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                />
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Intervalo de Datas</span>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="w-1/2 h-11 px-2 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm"
                    value={dateRange.start}
                    onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                  <input
                    type="date"
                    className="w-1/2 h-11 px-2 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm"
                    value={dateRange.end}
                    onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <p className="text-sm text-slate-500 leading-relaxed">Exportação de dados de lotação (Geral ou por Escola) com informações detalhadas.</p>
            </div>
          </div>
          <Button
            className="mt-8 w-full h-12"
            icon="download"
            onClick={handleGenerateExcel}
            disabled={loading}
            isLoading={loading}
          >
            Baixar Planilha
          </Button>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1 h-10 text-xs"
              icon="description"
              onClick={handleGenerateGeneralDoc}
              disabled={loading}
            >
              DOC
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-10 text-xs"
              icon="print"
              onClick={handleGenerateGeneralPDF}
              disabled={loading}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* Card 2: PDF (actually DOCX now) */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl">description</span>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">.DOC / .PDF</span>
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
            onClick={handleGeneratePreLotacaoDoc}
            disabled={!selectedSchoolId || loading}
            isLoading={loading}
          >
            Gerar Documento (DOCX)
          </Button>
          <Button
            variant="outline"
            className="mt-3 w-full h-12 border-2"
            icon="print"
            onClick={handleGeneratePreLotacaoPDF}
            disabled={!selectedSchoolId || loading}
            isLoading={loading}
          >
            Visualizar Impressão (PDF)
          </Button>

          <Button
            className="mt-3 w-full h-12"
            icon="folder_zip"
            onClick={handleOpenMultiSchoolModal}
            disabled={loading}
          >
            Exportar Lotações (ZIP)
          </Button>
        </div>

        {/* Card 3: Relatório de SRM */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl">domain</span>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">Lista</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Relatório</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Painel com lista de Escolas e Turmas que possuem Salas de Recursos Multifuncionais.</p>
            </div>
          </div>
          <Button
            className="mt-8 w-full h-12 border-2"
            icon="visibility"
            onClick={() => setShowSrmModal(true)}
            disabled={loading}
          >
            Abrir Relatório
          </Button>
        </div>

        {/* Card 4: Relatório de Lotação por Escola */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">Tabela</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Relatório: Lotação de Servidores por Escola</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Painel com listagem e agrupamento da lotação de servidores organizados por unidade de ensino e cargo.</p>
            </div>
          </div>
          <Button
            className="mt-8 w-full h-12 border-2"
            icon="visibility"
            onClick={() => setShowStaffBySchoolModal(true)}
            disabled={loading}
          >
            Abrir Relatório
          </Button>
        </div>

        {/* Card 5: Relatório RH */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl">badge</span>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">Lista</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Relatório RH</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Extração completa de todos os servidores com detalhamento de suas lotações.</p>
            </div>
          </div>
          <Button
            className="mt-8 w-full h-12 border-2"
            icon="visibility"
            onClick={() => setShowRhModal(true)}
            disabled={loading}
          >
            Abrir Relatório
          </Button>
        </div>
      </div>

      {/* Hidden Recent Table for now or keep generic mock? Keeping generic mock removed since user focused on actions. */}

      {showMultiSchoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Exportar Lotações (ZIP/PDF)</h3>
              <button onClick={() => setShowMultiSchoolModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col overflow-y-auto">
              {/* Region Filter */}
              <div className="mb-4">
                <span className="text-sm font-bold block mb-2">Filtrar por Região:</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={schoolRegionFilter === 'all'} onChange={() => { setSchoolRegionFilter('all'); setSelectedSchoolIds([]); }} /> Todas
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={schoolRegionFilter === 'campo'} onChange={() => { setSchoolRegionFilter('campo'); setSelectedSchoolIds([]); }} /> Campo
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={schoolRegionFilter === 'urbana'} onChange={() => { setSchoolRegionFilter('urbana'); setSelectedSchoolIds([]); }} /> Urbana
                  </label>
                </div>
              </div>

              {/* Schools List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      const filtered = schools.filter(s => {
                        if (schoolRegionFilter === 'campo') return s.region === 'Campo';
                        if (schoolRegionFilter === 'urbana') return s.region === 'Urbano' || s.region === 'Urbana';
                        return true;
                      });
                      if (e.target.checked) setSelectedSchoolIds(filtered.map(s => s.id));
                      else setSelectedSchoolIds([]);
                    }}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <span className="text-sm font-bold">Selecionar Todas</span>
                </div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {schools.filter(s => {
                    if (schoolRegionFilter === 'campo') return s.region === 'Campo';
                    if (schoolRegionFilter === 'urbana') return s.region === 'Urbano' || s.region === 'Urbana';
                    return true;
                  }).map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded-lg">
                      <input
                        type="checkbox"
                        checked={selectedSchoolIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSchoolIds([...selectedSchoolIds, s.id]);
                          else setSelectedSchoolIds(selectedSchoolIds.filter(id => id !== s.id));
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                      />
                      <span className="text-sm">{s.name} <span className="text-slate-400">({s.region || 'N/A'})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              {zipLoading && (
                <div className="flex items-center gap-2 mr-auto text-sm text-slate-500">
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  Gerando {zipProgress.done}/{zipProgress.total} PDFs...
                </div>
              )}
              <Button variant="outline" onClick={() => setShowMultiSchoolModal(false)} disabled={zipLoading}>Cancelar</Button>
              <Button onClick={handleGenerateMultiZip} disabled={zipLoading || selectedSchoolIds.length === 0} isLoading={zipLoading}>
                Gerar e Baixar
              </Button>
            </div>
          </div>
        </div>
      )}

      <SrmReportModal isOpen={showSrmModal} onClose={() => setShowSrmModal(false)} />
      <StaffBySchoolReportModal isOpen={showStaffBySchoolModal} onClose={() => setShowStaffBySchoolModal(false)} />
      <RhReportModal isOpen={showRhModal} onClose={() => setShowRhModal(false)} />

    </div >
  );
};

export default Reports;
