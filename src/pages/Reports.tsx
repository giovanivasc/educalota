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

  const getBase64FromUrl = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
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

      // Configuração A4 Paisagem (Landscape)
      // jsPDF units: mm. A4 Landscape = 297mm x 210mm
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const MARGIN = 12.7;
      const PAGE_WIDTH = 297;
      const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

      // Carregar Logos
      let imgPref, imgSemed, imgCoord;
      try {
        [imgPref, imgSemed, imgCoord] = await Promise.all([
          getBase64FromUrl('/img/logo_pref.jpg'),
          getBase64FromUrl('/img/logo_semed.jpg'),
          getBase64FromUrl('/img/logo_coord.jpg')
        ]);
      } catch (err) {
        console.warn("Logos não carregadas", err);
      }

      // --- CABEÇALHO ---
      // Esquerda: Logo Prefeitura
      if (imgPref) {
        doc.addImage(imgPref, 'JPEG', MARGIN, MARGIN, 25, 20);
      }

      // Direita: Logos SEMED e Coord
      const logoY = MARGIN;

      // Coord Ed Especial (Arvore) - Direita Extrema
      const coordW = 20;
      const coordX = PAGE_WIDTH - MARGIN - coordW;

      if (imgCoord) {
        doc.addImage(imgCoord, 'JPEG', coordX, logoY, coordW, 20);
      }

      // SEMED (Texto) - A esquerda da Coord
      const semedW = 40;
      const semedX = coordX - semedW - 2;

      if (imgSemed) {
        // Ajustar aspecto da SEMED (mais larga e baixa)
        doc.addImage(imgSemed, 'JPEG', semedX, logoY + 2, semedW, 15);
      }

      // Texto Central
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const headerTextX = PAGE_WIDTH / 2;
      const headerTextY = MARGIN + 8;

      doc.text("PREFEITURA MUNICIPAL DE CASTANHAL", headerTextX, headerTextY, { align: "center" });
      doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO", headerTextX, headerTextY + 6, { align: "center" });
      doc.text("COORDENADORIA DE EDUCAÇÃO ESPECIAL", headerTextX, headerTextY + 12, { align: "center" });

      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(MARGIN, MARGIN + 28, PAGE_WIDTH - MARGIN, MARGIN + 28);

      // --- IDENTIFICAÇÃO ---
      doc.setFontSize(14);
      doc.text("PRÉ-LOTAÇÃO DA EDUCAÇÃO ESPECIAL 2026", headerTextX, MARGIN + 38, { align: "center" });

      // Dados da Escola
      let currentY = MARGIN + 50;
      doc.setFontSize(11);

      doc.setFont("helvetica", "bold");
      doc.text(`Escola: ${school?.name || ''}`, MARGIN, currentY);

      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.text(`Diretor: ${school?.director || '-'} | Vice-Diretor: ${school?.vice_director || '-'}`, MARGIN, currentY);

      // Ano Letivo
      currentY += 6;
      doc.text(`Ano Letivo: ${selectedYear}`, MARGIN, currentY);

      // Espaço para tabela
      currentY += 8;

      // --- PREPARAÇÃO DA TABELA ---
      const tableBody: any[] = [];
      const rowSpans: { row: number, span: number }[] = [];

      let rowIndex = 0;

      reportData.forEach(cls => {
        // Tratar abreviações de modalidade
        let mod = cls.modality || '-';
        if (mod.includes("Educação Infantil")) mod = "EI";
        else if (mod.includes("Anos Iniciais")) mod = "AI";
        else if (mod.includes("Anos Finais")) mod = "AF";
        else if (mod.includes("EJA")) mod = "EJA";
        else if (mod.includes("Educação Especial")) mod = "EE";

        const studentsStr = cls.students.map((s: any) => s.name).join(', ');

        // Se não houver staff, criamos uma linha vazia para mostrar a turma
        // Mas a lógica pede para mostrar servidores. Se não tem servidor, a linha deve aparecer?
        // Assumindo que sim, com campos de servidor vazios.
        const staffList = (cls.staff && cls.staff.length > 0) ? cls.staff : [null];
        const spanCount = staffList.length;

        // Armazenar onde começa este grupo e qual o tamanho dele
        rowSpans.push({ row: rowIndex, span: spanCount });

        staffList.forEach((st: any) => {
          tableBody.push([
            mod,
            cls.series || '-',
            cls.shift || '-',
            studentsStr || '-',
            st ? st.name : '-',
            st ? st.role : '-',
            st ? (st.hours_total || '-') : '-'
          ]);
          rowIndex++;
        });
      });

      // --- TABELA ---
      autoTable(doc, {
        startY: currentY,
        head: [['Modalidade', 'Série', 'Turno', 'Estudantes', 'Servidor', 'Cargo', 'CH']],
        body: tableBody,
        theme: 'grid',
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 2,
          valign: 'middle',
          halign: 'center',
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0]
        },
        headStyles: {
          fillColor: [255, 255, 255], // Cabeçalho Branco ou Cinza Claro? O print parece Azul escuro.
          // O usuário não especificou cor, mas "títulos negrito".
          // Vamos usar um azul padrão ou manter simples. O modelo mostra Azul.
          fillColor: [41, 128, 185], // Azul
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 20 }, // Modalidade
          1: { cellWidth: 20 }, // Série
          2: { cellWidth: 25 }, // Turno
          3: { cellWidth: 'auto' }, // Estudantes (Expandir)
          4: { cellWidth: 50 }, // Servidor
          5: { cellWidth: 30 }, // Cargo
          6: { cellWidth: 15 }  // CH
        },
        margin: { left: MARGIN, right: MARGIN },
        didParseCell: (data) => {
          // Aplicar rowSpan nas colunas 0, 1, 2, 3
          if (data.section === 'body' && [0, 1, 2, 3].includes(data.column.index)) {
            const rIndex = data.row.index;
            const spanObj = rowSpans.find(s => s.row === rIndex);
            if (spanObj) {
              data.cell.rowSpan = spanObj.span;
            }
          }
        }
      });

      // --- TERMO DE CONCORDÂNCIA ---
      // Pega o Y final da tabela
      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // Controlar quebra de página se necessário
      // (simplificado: se finalY > 160 mm, abre nova pagina - mas landscape vai ate 210mm)

      const termo = "Declaro que, no exercício de minhas funções como gestor escolar, realizei e estou de pleno acordo com a pré-lotação dos servidores da Educação Especial, efetuada em conjunto com a Coordenadoria de Educação Especial, para o exercício de suas funções no ano letivo de 2026. Declaro, ainda, que fui devidamente informado(a) e estou ciente de que essa pré-lotação poderá sofrer alterações, a critério da Secretaria Municipal de Educação, sempre que houver necessidade em razão do interesse público.";

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitTermo = doc.splitTextToSize(termo, CONTENT_WIDTH);
      doc.text(splitTermo, MARGIN, finalY);

      const nextY = finalY + (splitTermo.length * 5) + 5;

      // Data
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const d = new Date();
      // "Castanhal, XX de Mês de Ano."
      const dateText = `Castanhal, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}.`;
      doc.text(dateText, PAGE_WIDTH - MARGIN, nextY, { align: 'right' });

      // --- ASSINATURAS ---
      // Diretor, Vice-Diretor, Coord. Ed. Especial
      let sigY = nextY + 25; // Espaço para assinar
      if (sigY > 190) { // Se estiver muito no fim da página
        doc.addPage();
        sigY = 40;
      }

      // Dividir largura content em 3 partes
      const partWidth = CONTENT_WIDTH / 3;

      // Linhas
      doc.setLineWidth(0.2);
      // Diretor (Centro da parte 1)
      const x1 = MARGIN + (partWidth * 0.1);
      const w1 = partWidth * 0.8;
      doc.line(x1, sigY, x1 + w1, sigY);

      // Vice (Centro da parte 2)
      const x2 = MARGIN + partWidth + (partWidth * 0.1);
      const w2 = partWidth * 0.8;
      doc.line(x2, sigY, x2 + w2, sigY);

      // Coord (Centro da parte 3)
      const x3 = MARGIN + (2 * partWidth) + (partWidth * 0.1);
      const w3 = partWidth * 0.8;
      doc.line(x3, sigY, x3 + w3, sigY);

      // Cargos
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Diretor", x1 + (w1 / 2), sigY + 5, { align: "center" });
      doc.text("Vice-Diretor", x2 + (w2 / 2), sigY + 5, { align: "center" });
      doc.text("Coord. Educação Especial", x3 + (w3 / 2), sigY + 5, { align: "center" });

      doc.save(`pre_lotacao_${school?.name}_2026.pdf`);

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
