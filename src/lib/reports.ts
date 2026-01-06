
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
            [`Diretor: ${school?.director_name || '-'}`, `Vice-Diretor: ${school?.vice_director_name || '-'}`],
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

// --- HELPER FUNCTIONS FOR DISPLAY LOGIC ---

// Helper to abbreviate modality
const getModalityAbbr = (mod: string) => {
    if (!mod) return '-';
    if (mod.includes("Educação Infantil")) return "EI";
    if (mod.includes("Anos Iniciais") || mod.includes("1º/5º")) return "EF-1";
    if (mod.includes("Anos Finais") || mod.includes("6º/9º")) return "EF-2";
    if (mod.includes("EJA")) return "EJA";
    if (mod.includes("Educação Especial")) return "EE";
    return mod;
};

// Helper to parse staff role and clean hours
const getStaffDisplay = (staffMember: any) => {
    if (!staffMember) return { name: '-', role: '-', hours: '-' };

    let name = '-', role = '-', hours = '-';

    if (staffMember.staff_name) { // It's an allotment object
        name = staffMember.staff_name;
        const r = staffMember.staff_role || '';
        // Extract hours (e.g., "150h" or "100h") and ignore extra text like "(Extra)"
        // Flexible regex to capture hours at end or inside parens, but user said "leave only 100h, 150h or 200h"
        // Let's look for the number+h pattern.
        const hoursMatch = r.match(/(\d{3})h/); // Matches 100h, 150h, 200h
        if (hoursMatch) {
            hours = hoursMatch[0]; // "150h"
            // Role is everything before " - 150h" usually.
            // Split by " - " and take first part? Or remove the hours part?
            // "Mediador - 150h (Extra)" -> Role: Mediador
            const parts = r.split(' - ');
            if (parts.length > 1) {
                role = parts[0];
            } else {
                role = r.replace(hoursMatch[0], '').trim();
            }
        } else {
            // Fallback
            const parts = r.split(' - ');
            if (parts.length > 1) {
                hours = parts.pop();
                role = parts.join(' - ');
            } else {
                role = r;
            }
        }
    } else if (staffMember.name) { // Raw staff object
        name = staffMember.name;
        role = staffMember.role;
        hours = staffMember.hours_total ? `${staffMember.hours_total}h` : '-';
    }

    return { name, role, hours };
};

// Helper to build row data with smart merging
const buildClassRows = (cls: any) => {
    const mod = getModalityAbbr(cls.modality);

    // Students
    const studentsList = cls.students || [];

    // Eligible students for staff assignment
    // Rule: "Necessita de avaliação" or "Não necessita" -> Staff columns blank.
    // We map each student to whether they "need" staff.
    const studentRows = studentsList.map((s: any) => {
        const support = s.needs_support ? (Array.isArray(s.needs_support) ? s.needs_support.join(', ') : s.needs_support) : "Não";
        const needs = !(support.includes("Não necessita") || support.includes("Necessita de avaliação"));
        return {
            studentName: s.name,
            studentSupport: support,
            needsStaff: needs
        };
    });

    // Staff
    const staffAllotments: any[] = (cls as any).allotments || [];
    const staffList = (staffAllotments.length > 0) ? staffAllotments : (cls.staff || []);

    // We need to distribute staff across the "needsStaff" rows.
    // If multiple staff, list them sequentially.
    // If more rows than staff, repeat/merge the staff (User asked to merge).
    // If an eligible row is followed by non-eligible, the merge breaks.

    const rows: any[] = [];
    const totalRows = Math.max(studentRows.length, staffList.length, 1);

    // Pre-calculate staff assignment for eligible rows
    let currentStaffIndex = 0;

    // We only have strict merging in DOCX if rows are contiguous. 
    // Logic: 
    // Iterate 0 to totalRows.
    // Determine Student col content.
    // Determine Staff col content based on eligibility and availability.

    for (let i = 0; i < totalRows; i++) {
        const sRow = studentRows[i]; // May be undefined if i >= students.length

        // Student Info
        const sName = sRow ? sRow.studentName : "";
        const sSupport = sRow ? sRow.studentSupport : "";

        let staffInfo = { name: '', role: '', hours: '' };

        // Should we show staff?
        // If sRow exists and !needsStaff -> Empty.
        // If sRow exists and needsStaff -> Show staff.
        // If !sRow (extra rows for staff only) -> Show staff. (Case: More staff than students).

        const showStaff = !sRow || sRow.needsStaff;

        if (showStaff) {
            // Which staff?
            // If we have staff available.
            // Distribute strategy:
            // Since "server is allotted to the class", presumably they cover all eligible students.
            // User: "merge lines... representing that that server serves all those students"
            // If 1 server, 5 eligible students -> Server appears on all 5.
            // If 2 servers, 5 eligible -> How to split? Usually they share duties?
            // "if server number equals students, one on each line" implies 1-to-1 mapping if counts match.
            // If <, merge. 
            // Let's assume sequential assignment cycling or filling?
            // "merge lines... to not leave blank line".
            // Suggestion: Repeat the Staff List cyclically or spread them? 
            // Usually in this case (Allotment to Class), we list ALL servers for the Class, generally merged if possible or just listed.
            // But the table structure is 1 line per student.
            // If I have 1 server and 10 students. Server names must appear.
            // If I put Server A on line 1 and merge down to 10, perfect.
            // If I have 2 servers. Server A on 1-5, Server B on 6-10? Or A on 1, B on 2 (repeating)?
            // The request "merge lines" suggests blocking.
            // I will implement Blocking: Divide eligible rows by number of servers.

            // Count remaining TOTAL eligible slots from this point onwards? No, too complex.
            // Simple approach: Use `currentStaffIndex`. 
            // If `staffList` has items.
            // If `staffList.length` <= eligible_slots. We spread them.
            // For now, let's just pick `staffList[Math.min(i, staffList.length -1)]`? 
            // No, that repeats the last one forever.
            // Correct logic for "1 server for 10 students": `staffList[0]` always.
            // For "2 servers for 10 students": `staffList[0]` for 0-4, `staffList[1]` for 5-9?
            // Let's simplify: If `i < staffList.length`, show `staffList[i]`.
            // IF `i >= staffList.length` AND `staffList.length > 0`, show `staffList[last]`?
            // Yes, that satisfies "merge" visually if we effectively repeat the last one (or distribute earlier).
            // Actually, if we want to merge, we should repeat the SAME server object reference conceptually or index.

            // Let's mapping index:
            // If we have S servers and N eligible students (N > S).
            // We want to change server every N/S rows.

            // Count total eligible rows first.
            const totalEligible = studentRows.filter(r => r.needsStaff).length;
            // Rows per server
            const distinctStaffCount = staffList.length || 1;
            const rowsPerStaff = Math.ceil(Math.max(totalEligible, 1) / distinctStaffCount);

            // We need to know which "eligible index" this is.
            // We can track `eligibleCounter` outside loop.
        }

        rows.push({
            mod: i === 0 ? mod : null,
            series: i === 0 ? `${cls.series} ${cls.section || ''}` : null,
            shift: i === 0 ? (cls.shift || '-') : null,
            studentName: sName,
            studentSupport: sSupport,
            showStaff: showStaff, // Flag to determing content
            staffIndex: -1 // Will fill below
        });
    }

    // Pass 2: Fill Staff Indexes based on eligibility flow
    let eligibleCounter = 0;
    const totalEligible = rows.filter(r => r.showStaff).length;
    const distinctStaffCount = staffList.length || 1;
    const chunk = Math.ceil(totalEligible / distinctStaffCount); // e.g. 5/2 = 3. Server 0 gets 3, Server 1 gets 2.

    rows.forEach(r => {
        if (r.showStaff) {
            // Should correspond to which staff?
            // chunk index = floor(counter / chunk)
            let sIndex = Math.floor(eligibleCounter / chunk);
            if (sIndex >= staffList.length) sIndex = staffList.length - 1; // Safety cap

            r.staffIndex = sIndex;
            r.staffData = getStaffDisplay(staffList[sIndex]);

            eligibleCounter++;
        }
    });

    return { rows, maxRows: totalRows };
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

        // Header Logic (Same as before)...
        // Simplified for brevity in this response but IS present in full file implementation below.
        // ... (Header Table construction is identical to previous, keeping code size manageable) ...
        // Replicating header part exactly:
        const headerTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
                insideVertical: noBorder, insideHorizontal: noBorder
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [(imgPrefBuf && imgPrefBuf.byteLength > 0) ? new Paragraph({ children: [new ImageRun({ data: imgPrefBuf, transformation: { width: 80, height: 60 }, type: "jpg" })] }) : new Paragraph("")] }),
                        new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PREFEITURA MUNICIPAL DE CASTANHAL", bold: true, size: 24 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SECRETARIA MUNICIPAL DE EDUCAÇÃO", bold: true, size: 24 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "COORDENADORIA DE EDUCAÇÃO ESPECIAL", bold: true, size: 24 })] })] }),
                        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [...((imgSemedBuf && imgSemedBuf.byteLength > 0) ? [new ImageRun({ data: imgSemedBuf, transformation: { width: 100, height: 40 }, type: "jpg" })] : []), new TextRun("   "), ...((imgCoordBuf && imgCoordBuf.byteLength > 0) ? [new ImageRun({ data: imgCoordBuf, transformation: { width: 50, height: 50 }, type: "jpg" })] : [])] })] })
                    ]
                })
            ]
        });

        const separator = new Paragraph({ border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 200 } });
        const title = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: `PRÉ-LOTAÇÃO DA EDUCAÇÃO ESPECIAL ${selectedYear}`, bold: true, size: 28 })] });
        const schoolInfo = [
            new Paragraph({ children: [new TextRun({ text: `Escola: ${school?.name || ''}`, bold: true, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: `Diretor: ${school?.director_name || '-'} | Vice-Diretor: ${school?.vice_director_name || '-'}`, size: 22 })] }),
            new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Ano Letivo: ${selectedYear}`, size: 22 })] })
        ];

        // START MAIN TABLE LOGIC //
        const tableHeaderRow = new TableRow({
            tableHeader: true,
            children: [
                "Etapa/Modalidade", "Série/Turma", "Turno", "Estudante", "Suporte Especializado", "Servidor", "Cargo/Função", "CH"
            ].map(text => new TableCell({
                shading: { fill: "2980B9", color: "FFFFFF" },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 16 })] })]
            }))
        });

        const tableRows: TableRow[] = [];

        reportData.forEach((cls, classIndex) => {
            const { rows, maxRows } = buildClassRows(cls);
            // Light Blue for alternate classes (e.g. index 1, 3, 5...)
            // Standard Zebra: Even white, Odd colored. Or 1st White (0), 2nd Blue (1).
            const isAlternate = classIndex % 2 !== 0;
            const bgColor = isAlternate ? "F0F8FF" : "auto"; // AliceBlue hex for docx

            rows.forEach((r, i) => {
                const isFirst = i === 0;
                // Modifiers for merge
                const mergeTypeMeta = isFirst ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;

                // For Staff, we need to check if we restart or continue merge based on PREVIOUS row
                // Logic: If current staffIndex == prev staffIndex AND current showStaff == true AND prev showStaff == true, CONTINUE.
                let mergeTypeStaff: typeof VerticalMergeType.RESTART | typeof VerticalMergeType.CONTINUE = VerticalMergeType.RESTART;
                const prevRow = i > 0 ? rows[i - 1] : null;

                if (i > 0 && r.showStaff && prevRow && prevRow.showStaff && r.staffIndex === prevRow.staffIndex) {
                    mergeTypeStaff = VerticalMergeType.CONTINUE;
                }

                // If !showStaff (empty), we just put empty cell (no merge active usually, or distinct empty)
                // Actually if !showStaff, we don't merge with previous, we start a blank cell? 
                // Wait, users asked to leave blank.

                const staffData = r.showStaff && r.staffData ? r.staffData : { name: '', role: '', hours: '' };

                // Build TableRow with Shading
                const shading = { fill: bgColor };

                tableRows.push(new TableRow({
                    children: [
                        // Metadata (Merged for WHOLE class block)
                        new TableCell({ shading, verticalMerge: mergeTypeMeta, verticalAlign: VerticalAlign.CENTER, children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.mod, size: 16 })] })] : [] }),
                        new TableCell({ shading, verticalMerge: mergeTypeMeta, verticalAlign: VerticalAlign.CENTER, children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.series, size: 16 })] })] : [] }),
                        new TableCell({ shading, verticalMerge: mergeTypeMeta, verticalAlign: VerticalAlign.CENTER, children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.shift, size: 16 })] })] : [] }),

                        // Student
                        new TableCell({ shading, verticalAlign: VerticalAlign.CENTER, width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: r.studentName, size: 16 })] })] }),
                        new TableCell({ shading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.studentSupport, size: 14 })] })] }),

                        // Staff (Conditionally Merged)
                        new TableCell({
                            shading,
                            verticalMerge: (!r.showStaff) ? VerticalMergeType.RESTART : mergeTypeStaff,
                            verticalAlign: VerticalAlign.CENTER,
                            children: (mergeTypeStaff === VerticalMergeType.RESTART && r.showStaff) ? [new Paragraph({ children: [new TextRun({ text: staffData.name, size: 16 })] })] :
                                (!r.showStaff) ? [new Paragraph("")] : []
                        }),
                        new TableCell({
                            shading,
                            verticalMerge: (!r.showStaff) ? VerticalMergeType.RESTART : mergeTypeStaff,
                            verticalAlign: VerticalAlign.CENTER,
                            children: (mergeTypeStaff === VerticalMergeType.RESTART && r.showStaff) ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: staffData.role, size: 14 })] })] :
                                (!r.showStaff) ? [new Paragraph("")] : []
                        }),
                        new TableCell({
                            shading,
                            verticalMerge: (!r.showStaff) ? VerticalMergeType.RESTART : mergeTypeStaff,
                            verticalAlign: VerticalAlign.CENTER,
                            children: (mergeTypeStaff === VerticalMergeType.RESTART && r.showStaff) ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: staffData.hours, size: 14 })] })] :
                                (!r.showStaff) ? [new Paragraph("")] : []
                        }),
                    ]
                }));
            });
        });

        const mainTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [tableHeaderRow, ...tableRows]
        });

        const terms = new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 400 }, children: [new TextRun({ text: "Declaro que, no exercício de minhas funções como gestor escolar, realizei e estou de pleno acordo com a pré-lotação dos servidores da Educação Especial, efetuada em conjunto com a Coordenadoria de Educação Especial, para o exercício de suas funções no ano letivo de 2026. Declaro, ainda, que fui devidamente informado(a) e estou ciente de que essa pré-lotação poderá sofrer alterações, a critério da Secretaria Municipal de Educação, sempre que houver necessidade em razão do interesse público.", size: 20 })] });
        const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        const d = new Date();
        const dateText = `Castanhal, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}.`;
        const datePara = new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 400, after: 800 }, children: [new TextRun({ text: dateText, size: 20 })] });

        const sigTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideVertical: noBorder, insideHorizontal: noBorder },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1, color: "000000" } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Diretor", bold: true, size: 18 })] })] }),
                        new TableCell({ width: { size: 500, type: WidthType.DXA }, children: [] }),
                        new TableCell({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1, color: "000000" } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Vice-Diretor", bold: true, size: 18 })] })] }),
                        new TableCell({ width: { size: 500, type: WidthType.DXA }, children: [] }),
                        new TableCell({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1, color: "000000" } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Coord. Educação Especial", bold: true, size: 18 })] })] }),
                    ]
                })
            ]
        });

        const doc = new Document({
            sections: [{
                properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
                children: [headerTable, separator, title, ...schoolInfo, mainTable, terms, datePara, sigTable]
            }]
        });

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

        let tableRowsHtml = '';

        reportData.forEach((cls, classIndex) => {
            const { rows, maxRows } = buildClassRows(cls);
            const isAlternate = classIndex % 2 !== 0;
            const bgColor = isAlternate ? "#F0F8FF" : "#FFFFFF"; // AliceBlue for web

            rows.forEach((r, i) => {
                const isFirst = i === 0;
                tableRowsHtml += `<tr style="background-color: ${bgColor};">`;

                // Metadata (Merged)
                if (isFirst) {
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${r.mod}</td>`;
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${r.series}</td>`;
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${r.shift}</td>`;
                }

                // Student
                tableRowsHtml += `<td>${r.studentName}</td>`;
                tableRowsHtml += `<td>${r.studentSupport}</td>`;

                // Staff
                // HTML Table RowSpan Logic
                // If this is the START of a block (or singleton) -> render TD with rowspan
                // If inside block (>start) -> Don't render TD
                // We need to calculate rowspan for current staff index chunk

                const prevRow = i > 0 ? rows[i - 1] : null;
                const isStaffContinuous = (i > 0 && r.showStaff && prevRow && prevRow.showStaff && r.staffIndex === prevRow.staffIndex);

                if (r.showStaff) {
                    // Check if this is the first of this staff block
                    if (!isStaffContinuous) {
                        // Calculate how many rows ahead have same staffIndex?
                        let span = 1;
                        for (let k = i + 1; k < rows.length; k++) {
                            if (rows[k].showStaff && rows[k].staffIndex === r.staffIndex) {
                                span++;
                            } else {
                                break;
                            }
                        }
                        const staffData = r.staffData;
                        tableRowsHtml += `<td rowSpan="${span}" style="vertical-align: middle;">${staffData.name}</td>`;
                        tableRowsHtml += `<td rowSpan="${span}" style="vertical-align: middle;">${staffData.role}</td>`;
                        tableRowsHtml += `<td rowSpan="${span}" style="vertical-align: middle;">${staffData.hours}</td>`;
                    }
                } else {
                    // Empty cell
                    tableRowsHtml += `<td></td><td></td><td></td>`;
                }

                tableRowsHtml += '</tr>';
            });
        });

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pré-Lotação - ${school.name}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
                .container { width: 100%; max-width: 100%; margin: 0 auto; }
                .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 10px; }
                .header-logo { width: 80px; height: auto; }
                .header-center { text-align: center; flex: 1; margin: 0 20px; }
                .header-center h1 { margin: 2px 0; font-size: 14px; font-weight: bold; text-transform: uppercase; }
                .header-right { text-align: right; display: flex; gap: 10px; align-items: center; }
                .doc-title { text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
                .school-info { font-size: 14px; margin-bottom: 20px; }
                .school-info p { margin: 4px 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: top; font-size: 11px; }
                th { background-color: #2980B9; color: white; font-weight: bold; vertical-align: middle; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .terms { text-align: justify; margin: 20px 0; font-size: 12px; line-height: 1.4; }
                .date { text-align: right; margin: 20px 0 40px 0; font-size: 12px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
                .sig-block { border-top: 1px solid #000; padding-top: 5px; width: 30%; font-weight: bold; font-size: 11px; }
                @media print { @page { size: landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div><img src="${window.location.origin}/img/logo_pref.jpg" alt="Logo Pref" style="height: 50px;" /></div>
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
                    <p><strong>Diretor:</strong> ${school.director_name || '-'} | <strong>Vice-Diretor:</strong> ${school.vice_director_name || '-'}</p>
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
                    <tbody>${tableRowsHtml}</tbody>
                </table>
                <div class="terms">
                    Declaro que, no exercício de minhas funções como gestor escolar, realizei e estou de pleno acordo com a pré-lotação dos servidores da Educação Especial, efetuada em conjunto com a Coordenadoria de Educação Especial, para o exercício de suas funções no ano letivo de 2026. Declaro, ainda, que fui devidamente informado(a) e estou ciente de que essa pré-lotação poderá sofrer alterações, a critério da Secretaria Municipal de Educação, sempre que houver necessidade em razão do interesse público.
                </div>
                <div class="date">Castanhal, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.</div>
                <div class="signatures">
                    <div class="sig-block">Diretor</div>
                    <div class="sig-block">Vice-Diretor</div>
                    <div class="sig-block">Coord. Educação Especial</div>
                </div>
            </div>
            <script>window.onload = function() { window.print(); }</script>
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
