import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  AlignmentType,
  VerticalAlign,
  PageOrientation,
  VerticalMergeType,
  Header
} from 'docx';
import { saveAs } from 'file-saver';

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
    let reportData = classesData.map(cls => {
      const classAllotments = allotmentsData?.filter((a: any) => a.class_id === cls.id) || [];
      const staffList = classAllotments.map((a: any) => a.staff).filter(Boolean);
      const studentList = cls.students || [];

      return {
        classId: cls.id,
        series: cls.series, // "5º Ano"
        section: cls.section, // "A"
        shift: cls.shift,
        modality: cls.modality || '-',
        year: cls.year,
        obs: cls.obs,
        students: studentList,
        staff: staffList
      };
    });

    // Custom Sort
    const getModalityOrder = (m: string) => {
      if (!m) return 99;
      const v = m.toLowerCase();
      if (v.includes("infantil")) return 1;
      if (v.includes("anos iniciais")) return 2;
      if (v.includes("anos finais")) return 3;
      if (v.includes("eja")) return 4;
      if (v.includes("especial")) return 5;
      return 99;
    };

    const getSeriesOrder = (s: string) => {
      if (!s) return 99;
      const v = s.toLowerCase();
      if (v.includes("2 anos")) return 1;
      if (v.includes("3 anos")) return 2;
      if (v.includes("4 anos")) return 3;
      if (v.includes("5 anos")) return 4;
      if (v.includes("1º")) return 5;
      if (v.includes("2º")) return 6;
      if (v.includes("3º")) return 7;
      if (v.includes("4º")) return 8;
      if (v.includes("5º")) return 9;
      if (v.includes("6º")) return 10;
      if (v.includes("7º")) return 11;
      if (v.includes("8º")) return 12;
      if (v.includes("9º")) return 13;
      if (v.includes("1ª etapa")) return 14;
      if (v.includes("2ª etapa")) return 15;
      if (v.includes("srm")) return 16;
      return 99;
    };

    const getSectionOrder = (s: string) => {
      if (!s) return 99;
      const v = s.toLowerCase();
      if (v === 'a') return 1;
      if (v === 'b') return 2;
      if (v === 'c') return 3;
      if (v === 'd') return 4;
      if (v.includes("mista")) return 5;
      if (v.includes("multi")) return 6;
      if (v.includes("aee")) return 7;
      return 50; // Alphabetical fallback?
    };

    const getShiftOrder = (s: string) => {
      if (!s) return 99;
      const v = s.toLowerCase();
      if (v.includes("matutino")) return 1;
      if (v.includes("vespertino")) return 2;
      if (v.includes("integral")) return 3;
      return 99;
    };

    reportData.sort((a, b) => {
      // 1. Modality
      const modA = getModalityOrder(a.modality);
      const modB = getModalityOrder(b.modality);
      if (modA !== modB) return modA - modB;

      // 2. Series
      const serA = getSeriesOrder(a.series);
      const serB = getSeriesOrder(b.series);
      if (serA !== serB) return serA - serB;

      // 3. Section (Turma)
      const secA = getSectionOrder(a.section);
      const secB = getSectionOrder(b.section);
      if (secA !== secB) return secA - secB;

      // 4. Shift
      const shiftA = getShiftOrder(a.shift);
      const shiftB = getShiftOrder(b.shift);
      return shiftA - shiftB;
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

  const getArrayBufferFromUrl = async (url: string): Promise<ArrayBuffer> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return await blob.arrayBuffer();
  };

  const generateDoc = async () => {
    if (!selectedSchoolId) {
      alert('Selecione uma escola primeiro.');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchReportData();
      if (!data) throw new Error("Dados não encontrados");
      const { school, reportData } = data;

      // 1. Carregar Images (ArrayBuffer)
      let imgPrefBuf, imgSemedBuf, imgCoordBuf;
      try {
        [imgPrefBuf, imgSemedBuf, imgCoordBuf] = await Promise.all([
          getArrayBufferFromUrl('/img/logo_pref.jpg'),
          getArrayBufferFromUrl('/img/logo_semed.jpg'),
          getArrayBufferFromUrl('/img/logo_coord.jpg')
        ]);
      } catch (e) {
        console.warn('Erro ao carregar imagens', e);
      }

      // Utils para bordas
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
      const tableBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      };

      // HEADER TABLE (Invisible Layout)
      // Row 1: Logo Pref (Left), Text (Center), Logos (Right)
      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
          insideVertical: noBorder, insideHorizontal: noBorder
        },
        rows: [
          new TableRow({
            children: [
              // Cell 1: Pref Logo
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  imgPrefBuf ? new Paragraph({
                    children: [new ImageRun({
                      data: imgPrefBuf,
                      transformation: { width: 80, height: 60 },
                      type: "jpg"
                    })]
                  }) : new Paragraph("LOGO PREF")
                ]
              }),
              // Cell 2: Center Text
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "PREFEITURA MUNICIPAL DE CASTANHAL", bold: true, size: 24 })] // size in half-points (24 = 12pt)
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "SECRETARIA MUNICIPAL DE EDUCAÇÃO", bold: true, size: 24 })]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "COORDENADORIA DE EDUCAÇÃO ESPECIAL", bold: true, size: 24 })]
                  })
                ]
              }),
              // Cell 3: Right Logos (Semed + Coord)
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      ...(imgSemedBuf ? [new ImageRun({
                        data: imgSemedBuf,
                        transformation: { width: 100, height: 40 },
                        type: "jpg"
                      })] : []),
                      new TextRun("   "),
                      ...(imgCoordBuf ? [new ImageRun({
                        data: imgCoordBuf,
                        transformation: { width: 50, height: 50 },
                        type: "jpg"
                      })] : [])
                    ]
                  })
                ]
              })
            ]
          })
        ]
      });

      // Separator Line
      const separator = new Paragraph({
        border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } },
        spacing: { after: 200 }
      });

      // Title
      const title = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: "PRÉ-LOTAÇÃO DA EDUCAÇÃO ESPECIAL 2026", bold: true, size: 28 }) // 14pt
        ]
      });

      // School Info
      const schoolInfo = [
        new Paragraph({
          children: [new TextRun({ text: `Escola: ${school?.name || ''}`, bold: true, size: 22 })]
        }),
        new Paragraph({
          children: [new TextRun({ text: `Diretor: ${school?.director || '-'} | Vice-Diretor: ${school?.vice_director || '-'}`, size: 22 })]
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: `Ano Letivo: ${selectedYear}`, size: 22 })]
        })
      ];

      // MAIN TABLE
      // Headers
      const tableHeaderRow = new TableRow({
        tableHeader: true,
        children: [
          "Modalidade", "Série", "Turno", "Estudantes", "Servidor", "Cargo", "CH"
        ].map(text => new TableCell({
          shading: { fill: "2980B9", color: "FFFFFF" }, // Blue background
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })]
          })]
        }))
      });

      // Body Rows
      const tableRows: TableRow[] = [];
      let rowIndex = 0;

      // Flat map rows first to handle spans manually
      // We iterate classes, then staff.
      // Logic: 
      // For each class:
      //   rows = staff.length || 1
      //   First row gets RESTART merge for Cols 0-3.
      //   Subsequent rows get CONTINUE merge for Cols 0-3.

      reportData.forEach(cls => {
        let mod = cls.modality || '-';
        if (mod.includes("Educação Infantil")) mod = "EI";
        else if (mod.includes("Anos Iniciais")) mod = "AI";
        else if (mod.includes("Anos Finais")) mod = "AF";
        else if (mod.includes("EJA")) mod = "EJA";
        else if (mod.includes("Educação Especial")) mod = "EE";

        const studentsStr = cls.students.map((s: any) => s.name).join(', ');
        const staffList = (cls.staff && cls.staff.length > 0) ? cls.staff : [null];

        staffList.forEach((st: any, i: number) => {
          const isFirst = i === 0;
          const mergeType = isFirst ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE; // Fix: docx restart/continue logic

          // Actually, docx uses 'restart' on the first cell and 'continue' on subsequent cells in the same column index.

          const row = new TableRow({
            children: [
              // Col 0: Modality
              new TableCell({
                verticalMerge: mergeType,
                verticalAlign: VerticalAlign.CENTER,
                children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mod, size: 18 })] })] : []
              }),
              // Col 1: Series
              new TableCell({
                verticalMerge: mergeType,
                verticalAlign: VerticalAlign.CENTER,
                children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cls.series || '-', size: 18 })] })] : []
              }),
              // Col 2: Shift
              new TableCell({
                verticalMerge: mergeType,
                verticalAlign: VerticalAlign.CENTER,
                children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cls.shift || '-', size: 18 })] })] : []
              }),
              // Col 3: Students
              new TableCell({
                verticalMerge: mergeType,
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 3000, type: WidthType.DXA }, // Wider
                children: isFirst ? [new Paragraph({ children: [new TextRun({ text: studentsStr || '-', size: 18 })] })] : []
              }),
              // Col 4: Server
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ children: [new TextRun({ text: st ? st.name : '-', size: 18 })] })]
              }),
              // Col 5: Role
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: st ? st.role : '-', size: 18 })] })]
              }),
              // Col 6: Hours
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: st ? (st.hours_total || '-') : '-', size: 18 })] })]
              })
            ]
          });
          tableRows.push(row);
        });
      });

      const mainTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [tableHeaderRow, ...tableRows]
      });

      // Terms
      const terms = new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 400 },
        children: [
          new TextRun({
            text: "Declaro que, no exercício de minhas funções como gestor escolar, realizei e estou de pleno acordo com a pré-lotação dos servidores da Educação Especial, efetuada em conjunto com a Coordenadoria de Educação Especial, para o exercício de suas funções no ano letivo de 2026. Declaro, ainda, que fui devidamente informado(a) e estou ciente de que essa pré-lotação poderá sofrer alterações, a critério da Secretaria Municipal de Educação, sempre que houver necessidade em razão do interesse público.",
            size: 20 // 10pt
          })
        ]
      });

      // Date
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const d = new Date();
      const dateText = `Castanhal, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}.`;

      const datePara = new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 400, after: 800 },
        children: [new TextRun({ text: dateText, size: 20 })]
      });

      // Signatures
      const sigTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
          insideVertical: noBorder, insideHorizontal: noBorder
        },
        rows: [
          // Lines
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1, color: "000000" } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Diretor", bold: true, size: 18 })] })] }),
              new TableCell({ width: { size: 500, type: WidthType.DXA }, children: [] }), // Gap
              new TableCell({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1, color: "000000" } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Vice-Diretor", bold: true, size: 18 })] })] }),
              new TableCell({ width: { size: 500, type: WidthType.DXA }, children: [] }), // Gap
              new TableCell({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1, color: "000000" } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Coord. Educação Especial", bold: true, size: 18 })] })] }),
            ]
          })
        ]
      });


      // BUILD DOCUMENT
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { orientation: PageOrientation.LANDSCAPE },
              margin: {
                top: 720, // 0.5 inch (1.27cm)
                right: 720,
                bottom: 720,
                left: 720
              }
            }
          },
          children: [
            headerTable,
            separator,
            title,
            ...schoolInfo,
            mainTable,
            terms,
            datePara,
            sigTable
          ]
        }]
      });

      // EXPORT
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `pre_lotacao_${school?.name}_2026.docx`);

    } catch (e) {
      console.error(e);
      alert('Erro ao gerar Documento.');
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
            onClick={generateExcel}
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
            onClick={generateDoc}
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
