
import { supabase } from './supabase';
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
    VerticalMergeType
} from 'docx';
import { saveAs } from 'file-saver';
import { sortClasses } from './sorting';

export const fetchReportData = async (schoolId: string) => {
    if (!schoolId) return null;

    // 1. School Info
    const { data: schoolData } = await supabase.from('schools').select('*').eq('id', schoolId).single();
    const school = schoolData;

    if (!school) return null;

    // 2. Classes with Students
    const { data: classesData } = await supabase
        .from('classes')
        .select('*, students(*)')
        .eq('school_id', schoolId);

    if (!classesData) return null;

    // 3. Allotments with Staff
    const { data: allotmentsData } = await supabase
        .from('allotments')
        .select('*, staff(*)')
        .eq('school_id', schoolId);

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

    // Custom Sort using utility
    reportData.sort(sortClasses);

    return { school, reportData };
};

export const generateExcel = async (schoolId: string, selectedYear: string) => {
    if (!schoolId) {
        alert('Selecione uma escola primeiro.');
        return;
    }

    try {
        const data = await fetchReportData(schoolId);
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
                // Se não tiver staff, não gera linha conforme lógica original, ou poderia gerar linha vazia de staff.
                // Mantendo lógica original de Reports.tsx
            }
        });

        if (rows.length === 0) {
            // Se quisermos manter consistência, avisamos. Mas se for chamado num botão de ação rápida...
            // Talvez alert seja OK.
            alert('Nenhuma lotação encontrada para esta escola.');
            return;
        }

        // Header info manually
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
    }
};

const getArrayBufferFromUrl = async (url: string): Promise<ArrayBuffer> => {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await blob.arrayBuffer();
    } catch (e) {
        console.warn(`Failed to load image from ${url}`, e);
        return new ArrayBuffer(0);
    }
};

export const generateDoc = async (schoolId: string, selectedYear: string) => {
    if (!schoolId) {
        alert('Selecione uma escola primeiro.');
        return;
    }

    try {
        const data = await fetchReportData(schoolId);
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
                                (imgPrefBuf && imgPrefBuf.byteLength > 0) ? new Paragraph({
                                    children: [new ImageRun({
                                        data: imgPrefBuf,
                                        transformation: { width: 80, height: 60 },
                                        type: "jpg"
                                    })]
                                }) : new Paragraph("")
                            ]
                        }),
                        // Cell 2: Center Text
                        new TableCell({
                            width: { size: 55, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: "PREFEITURA MUNICIPAL DE CASTANHAL", bold: true, size: 24 })]
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
                                        ...((imgSemedBuf && imgSemedBuf.byteLength > 0) ? [new ImageRun({
                                            data: imgSemedBuf,
                                            transformation: { width: 100, height: 40 },
                                            type: "jpg"
                                        })] : []),
                                        new TextRun("   "),
                                        ...((imgCoordBuf && imgCoordBuf.byteLength > 0) ? [new ImageRun({
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
                new TextRun({ text: `PRÉ-LOTAÇÃO DA EDUCAÇÃO ESPECIAL ${selectedYear}`, bold: true, size: 28 })
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

        const tableRows: TableRow[] = [];

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
                const mergeType = isFirst ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;

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
                            width: { size: 3000, type: WidthType.DXA },
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
                    size: 20
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
        saveAs(blob, `pre_lotacao_${school?.name}_${selectedYear}.docx`);

    } catch (e) {
        console.error(e);
        alert('Erro ao gerar Documento.');
    }
};
