import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const fetchReportData = async () => {
    if (!selectedSchoolId) return null;

    // 1. School Info
    const school = schools.find(s => s.id === selectedSchoolId);

    // 2. Classes with Students
    const { data: classesData } = await supabase
      .from('classes')
      .select('*, students(*)')
      .eq('school_id', selectedSchoolId);

    if (!classesData) return null;

    // 3. Allotments with Staff
    const { data: allotmentsData } = await supabase
      .from('allotments')
      .select('*, staff(*)')
      .eq('school_id', selectedSchoolId);

    // Merge data: Group by Class
    const reportData = classesData.map(cls => {
      const classAllotments = allotmentsData?.filter((a: any) => a.class_id === cls.id) || [];
      const staffList = classAllotments.map((a: any) => a.staff).filter(Boolean);
      const studentList = cls.students || [];

      return {
        classId: cls.id,
        series: cls.series, // "5º Ano A" if that's what is saved
        shift: cls.shift,
        modality: cls.modality || '-', // Use direct field
        year: cls.year,
        obs: cls.obs,
        students: studentList,
        staff: staffList
      };
    });

    return { school, reportData };
  };

  const generateExcel = async () => {
    if (!selectedSchoolId) {
      alert('Selecione uma escola primeiro.');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchReportData();
      if (!data) throw new Error("Dados não encontrados");

      const { school, reportData } = data;

      // Flatten for "Nome do servidor..." row-based format
      const rows: any[] = [];

      reportData.forEach(cls => {
        if (cls.staff.length > 0) {
          cls.staff.forEach((st: any) => {
            rows.push({
              "Nome do Servidor": st.name,
              "Cargo": st.role,
              "Vínculo": st.contract_type || '-',
              "Carga Horária": st.hours_total || '-',
              "Modalidade": cls.modality,
              "Série": cls.series,
              "Turno": cls.shift,
              "Estudantes": cls.students.map((s: any) => s.name).join(', ')
            });
          });
        } else {
          // Optional: Include classes without staff? Request implies staff focus for Excel ("Nome do servidor" first).
          // If request implies "Planilha de Lotação", maybe just allocated ones. 
          // But let's add one row if empty just to show the class exists? 
          // "Nome do servidor... abaixo em linhas". If no server, what to put?
          // Let's stick to Staff > Class > Student mapping. If no staff, no row in this specific format.
        }
      });

      if (rows.length === 0) {
        alert('Nenhuma lotação encontrada para esta escola.');
        setLoading(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Add Header info manually? 
      // XLSX utils usually overwrite. Better to make a custom array of arrays.
      const headerInfo = [
        [`Escola: ${school?.name}`],
        [`Diretor: ${school?.director || '-'}`, `Vice-Diretor: ${school?.vice_director || '-'}`],
        [],
        ['Nome do Servidor', 'Cargo', 'Vínculo', 'Carga Horária', 'Modalidade', 'Série', 'Turno', 'Estudantes']
      ];

      // Re-map rows to array matches header
      const bodyData = rows.map(r => [
        r["Nome do Servidor"], r["Cargo"], r["Vínculo"], r["Carga Horária"], r["Modalidade"], r["Série"], r["Turno"], r["Estudantes"]
      ]);

      const finalData = [...headerInfo, ...bodyData];
      const ws = XLSX.utils.aoa_to_sheet(finalData);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, ws, "Lotação");
      XLSX.writeFile(workbook, `lotacao_${school?.name}_${selectedYear}.xlsx`);

    } catch (e) {
      console.error(e);
      alert('Erro ao gerar Excel.');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!selectedSchoolId) {
      alert('Selecione uma escola primeiro.');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchReportData();
      if (!data) throw new Error("Dados não encontrados");
      const { school, reportData } = data;

      const doc = new jsPDF();

      // Header
      doc.setFontSize(14);
      doc.text(`Escola: ${school?.name}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Diretor: ${school?.director || '-'} | Vice-Diretor: ${school?.vice_director || '-'}`, 14, 22);
      doc.text(`Ano Letivo: ${selectedYear}`, 14, 28);

      // Table
      // Columns: modalidade, série, turno, nome dos estudantes, nome dos servidores, cargo, carga horária

      const body = reportData.map(cls => [
        cls.modality,
        cls.series,
        cls.shift,
        cls.students.map((s: any) => s.name).join(', '),
        cls.staff.map((s: any) => s.name).join('\n'), // Multiline for multiple staff
        cls.staff.map((s: any) => s.role).join('\n'),
        cls.staff.map((s: any) => s.hours_total || '-').join('\n')
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['Modalidade', 'Série', 'Turno', 'Estudantes', 'Servidores', 'Cargo', 'CH']],
        body: body,
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          3: { cellWidth: 50 }, // Students column wider
          4: { cellWidth: 40 }  // Staff column
        }
      });

      doc.save(`pre_lotacao_${school?.name}.pdf`);

    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF.');
    } finally {
      setLoading(false);
    }
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
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
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
            onClick={generateExcel}
            disabled={!selectedSchoolId || loading}
            isLoading={loading}
          >
            Baixar Planilha
          </Button>
        </div>

        {/* Card 2: PDF */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">.PDF</span>
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Relatório de Pré-Lotação</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Documento para conferência com lista de turmas, alunos e servidores.</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-8 w-full h-12 border-2"
            icon="print"
            onClick={generatePDF}
            disabled={!selectedSchoolId || loading}
            isLoading={loading}
          >
            Gerar PDF
          </Button>
        </div>
      </div>

      {/* Hidden Recent Table for now or keep generic mock? Keeping generic mock removed since user focused on actions. */}
    </div>
  );
};

export default Reports;
