
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
            series: cls.series,
            section: cls.section,
            shift: cls.shift,
            modality: cls.modality || '-',
            year: cls.year,
            obs: cls.obs,
            students: studentList,
            allotments: classAllotments, // Return full allotments to get role/hours
            staff: staffList // Keep for compatibility if needed, but prefer allotments
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
                "Etapa/Modalidade", "Série/Turma", "Turno", "Estudante", "Suporte Especializado", "Servidor", "Cargo/Função", "CH"
            ].map(text => new TableCell({
                shading: { fill: "2980B9", color: "FFFFFF" }, // Blue background
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 16 })]
                })]
            }))
        });

        const tableRows: TableRow[] = [];

        reportData.forEach(cls => {
            let mod = cls.modality || '-';
            if (mod.includes("Educação Infantil")) mod = "Ed. Infantil";
            else if (mod.includes("Anos Iniciais") || mod.includes("1º/5º")) mod = "Ens. Fund. (1º/5º)";
            else if (mod.includes("Anos Finais") || mod.includes("6º/9º")) mod = "Ens. Fund. (6º/9º)";
            else if (mod.includes("EJA")) mod = "EJA";
            else if (mod.includes("Educação Especial")) mod = "Ed. Especial";

            // Listas
            // Use allotments if available for accurate role/hours per assignment
            // Or fallback to staff list if allotments not populated correctly in data hook yet
            const staffAllotments: any[] = (cls as any).allotments || [];
            // If allotments empty but staff not (legacy data?), fallback to staff
            const staffList = (staffAllotments.length > 0) ? staffAllotments : (cls.staff || []);
            const studentsList = cls.students || [];

            const maxRows = Math.max(studentsList.length, staffList.length, 1);

            for (let i = 0; i < maxRows; i++) {
                const isFirst = i === 0;
                const mergeType = isFirst ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;

                // Student Data
                const student = studentsList[i];
                const studentName = student ? student.name : "";
                const studentSupport = student ? (student.needs_support ? (Array.isArray(student.needs_support) ? student.needs_support.join(', ') : student.needs_support) : "Não") : "";

                // Staff Data
                const staffMember = staffList[i];
                let staffName = "-";
                let staffRole = "-";
                let staffHours = "-";

                if (staffMember) {
                    if (staffMember.staff_name) { // It's an allotment object
                        staffName = staffMember.staff_name;
                        // Parse role string "Role - 150h" or "Role - 150h (Extra)"
                        const r = staffMember.staff_role || '';
                        // Simple split by dash might fail if role name has dash.
                        // Ideally we look for strict pattern " - Xh" but split is ok for now if role names don't have dashes.
                        // Or utilize that the last part is hours.
                        const parts = r.split(' - ');
                        if (parts.length > 1) {
                            staffHours = parts.pop(); // Last part is hours
                            staffRole = parts.join(' - '); // Rest is role
                        } else {
                            staffRole = r;
                        }
                    } else if (staffMember.name) { // It's a raw staff object (fallback)
                        staffName = staffMember.name;
                        staffRole = staffMember.role;
                        staffHours = staffMember.hours_total ? `${staffMember.hours_total}h` : '-';
                    }
                }

                const row = new TableRow({
                    children: [
                        // Col 0: Modality (Merged)
                        new TableCell({
                            verticalMerge: mergeType,
                            verticalAlign: VerticalAlign.CENTER,
                            children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mod, size: 16 })] })] : []
                        }),
                        // Col 1: Series (Merged)
                        new TableCell({
                            verticalMerge: mergeType,
                            verticalAlign: VerticalAlign.CENTER,
                            children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${cls.series} ${cls.section || ''}` || '-', size: 16 })] })] : []
                        }),
                        // Col 2: Shift (Merged)
                        new TableCell({
                            verticalMerge: mergeType,
                            verticalAlign: VerticalAlign.CENTER,
                            children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cls.shift || '-', size: 16 })] })] : []
                        }),
                        // Col 3: Student Name
                        new TableCell({
                            verticalAlign: VerticalAlign.CENTER,
                            width: { size: 2500, type: WidthType.DXA },
                            children: [new Paragraph({ children: [new TextRun({ text: studentName, size: 16 })] })]
                        }),
                        // Col 4: Special Support
                        new TableCell({
                            verticalAlign: VerticalAlign.CENTER,
                            children: [new Paragraph({ children: [new TextRun({ text: studentSupport, size: 14 })] })]
                        }),
                        // Col 5: Server Name
                        new TableCell({
                            verticalAlign: VerticalAlign.CENTER,
                            children: [new Paragraph({ children: [new TextRun({ text: staffName, size: 16 })] })]
                        }),
                        // Col 6: Role
                        new TableCell({
                            verticalAlign: VerticalAlign.CENTER,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: staffRole, size: 14 })] })]
                        }),
                        // Col 7: Hours
                        new TableCell({
                            verticalAlign: VerticalAlign.CENTER,
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: staffHours, size: 14 })] })]
                        })
                    ]
                });
                tableRows.push(row);
            }
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

export const generatePDF = async (schoolId: string, selectedYear: string) => {
    try {
        const data = await fetchReportData(schoolId);
        if (!data) throw new Error("Dados não encontrados");
        const { school, reportData } = data;

        // Construir linhas da tabela HTML
        let tableRowsHtml = '';

        reportData.forEach(cls => {
            let mod = cls.modality || '-';
            if (mod.includes("Educação Infantil")) mod = "Ed. Infantil";
            else if (mod.includes("Anos Iniciais") || mod.includes("1º/5º")) mod = "Ens. Fund. (1º/5º)";
            else if (mod.includes("Anos Finais") || mod.includes("6º/9º")) mod = "Ens. Fund. (6º/9º)";
            else if (mod.includes("EJA")) mod = "EJA";
            else if (mod.includes("Educação Especial")) mod = "Ed. Especial";

            const staffAllotments: any[] = (cls as any).allotments || [];
            const staffList = (staffAllotments.length > 0) ? staffAllotments : (cls.staff || []);
            const studentsList = cls.students || [];

            const maxRows = Math.max(studentsList.length, staffList.length, 1);

            for (let i = 0; i < maxRows; i++) {
                const isFirst = i === 0;

                // Student
                const student = studentsList[i];
                const studentName = student ? student.name : "";
                const studentSupport = student ? (student.needs_support ? (Array.isArray(student.needs_support) ? student.needs_support.join(', ') : student.needs_support) : "Não") : "";

                // Staff
                const staffMember = staffList[i];
                let staffName = "-";
                let staffRole = "-";
                let staffHours = "-";

                if (staffMember) {
                    if (staffMember.staff_name) {
                        staffName = staffMember.staff_name;
                        const r = staffMember.staff_role || '';
                        const parts = r.split(' - ');
                        if (parts.length > 1) {
                            staffHours = parts.pop();
                            staffRole = parts.join(' - ');
                        } else {
                            staffRole = r;
                        }
                    } else if (staffMember.name) {
                        staffName = staffMember.name;
                        staffRole = staffMember.role;
                        staffHours = staffMember.hours_total ? `${staffMember.hours_total}h` : '-';
                    }
                }

                tableRowsHtml += '<tr>';

                // Merged Columns (Render only on first row of the block)
                if (isFirst) {
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${mod}</td>`;
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${cls.series} ${cls.section || ''}</td>`;
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${cls.shift || '-'}</td>`;
                }

                // Individual Columns
                tableRowsHtml += `<td>${studentName}</td>`;
                tableRowsHtml += `<td>${studentSupport}</td>`;
                tableRowsHtml += `<td>${staffName}</td>`;
                tableRowsHtml += `<td>${staffRole}</td>`;
                tableRowsHtml += `<td>${staffHours}</td>`;

                tableRowsHtml += '</tr>';
            }
        });

        // HTML Completo
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pré-Lotação - ${school.name}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
                .container { width: 100%; max-width: 100%; margin: 0 auto; }
                
                /* Header Layout */
                .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 10px; }
                .header-logo { width: 80px; height: auto; }
                .header-center { text-align: center; flex: 1; margin: 0 20px; }
                .header-center h1 { margin: 2px 0; font-size: 14px; font-weight: bold; text-transform: uppercase; }
                .header-right { text-align: right; display: flex; gap: 10px; align-items: center; }
                
                /* Title & School Info */
                .doc-title { text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
                .school-info { font-size: 14px; margin-bottom: 20px; }
                .school-info p { margin: 4px 0; }
                
                /* Table */
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: top; font-size: 11px; }
                th { background-color: #2980B9; color: white; font-weight: bold; vertical-align: middle; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                
                /* Footer */
                .terms { text-align: justify; margin: 20px 0; font-size: 12px; line-height: 1.4; }
                .date { text-align: right; margin: 20px 0 40px 0; font-size: 12px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
                .sig-block { border-top: 1px solid #000; padding-top: 5px; width: 30%; font-weight: bold; font-size: 11px; }

                @media print {
                    @page { size: landscape; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div>
                        <img src="${window.location.origin}/img/logo_pref.jpg" alt="Logo Pref" style="height: 50px;" />
                    </div>
                    <div class="header-center">
                        <h1>Prefeitura Municipal de Castanhal</h1>
                        <h1>Secretaria Municipal de Educação</h1>
                        <h1>Coordenadoria de Educação Especial</h1>
                    </div>
                    <div class="header-right">
                         <img src="${window.location.origin}/img/logo_semed.jpg" alt="Semed" style="height: 35px;" />
                         <img src="${window.location.origin}/img/logo_coord.jpg" alt="Coord" style="height: 40px;" />
                    </div>
                </div>

                <div class="doc-title">PRÉ-LOTAÇÃO DA EDUCAÇÃO ESPECIAL ${selectedYear}</div>

                <div class="school-info">
                    <p><strong>Escola:</strong> ${school.name}</p>
                    <p><strong>Diretor:</strong> ${school.director || '-'} | <strong>Vice-Diretor:</strong> ${school.vice_director || '-'}</p>
                    <p><strong>Ano Letivo:</strong> ${selectedYear}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Etapa/Modalidade</th>
                            <th>Série/Turma</th>
                            <th>Turno</th>
                            <th>Estudante</th>
                            <th>Suporte Especializado</th>
                            <th>Servidor</th>
                            <th>Cargo/Função</th>
                            <th>CH</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>

                <div class="terms">
                    Declaro que, no exercício de minhas funções como gestor escolar, realizei e estou de pleno acordo com a pré-lotação dos servidores da Educação Especial, efetuada em conjunto com a Coordenadoria de Educação Especial, para o exercício de suas funções no ano letivo de 2026. Declaro, ainda, que fui devidamente informado(a) e estou ciente de que essa pré-lotação poderá sofrer alterações, a critério da Secretaria Municipal de Educação, sempre que houver necessidade em razão do interesse público.
                </div>

                <div class="date">
                    Castanhal, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </div>

                <div class="signatures">
                    <div class="sig-block">Diretor</div>
                    <div class="sig-block">Vice-Diretor</div>
                    <div class="sig-block">Coord. Educação Especial</div>
                </div>
            </div>
            <script>
                // Auto-print when loaded
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } else {
            alert('Por favor, permita popups para gerar o PDF.');
        }

    } catch (e) {
        console.error(e);
        alert('Erro ao gerar visualização de impressão.');
    }
};
