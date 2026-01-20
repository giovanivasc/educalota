
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

// Helper to parse DD/MM/YYYY
const parseDateBR = (d: string) => {
    if (!d) return null;
    const parts = d.split('/');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

// --- SCHOOL BASED REPORTS (PRE-LOTACAO) ---

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
            obs: cls.obs, // Ensure this is passed
            students: studentList,
            allotments: classAllotments, // Return full allotments to get role/hours
            staff: staffList // Keep for compatibility if needed, but prefer allotments
        };
    });

    // Custom Sort using utility
    reportData.sort(sortClasses);

    return { school, reportData };
};

// --- GENERAL REPORT FUNCTIONS (PLANILHA DE LOTACAO) ---

export const fetchGeneralReportData = async (schoolId: string, startDate?: string, endDate?: string) => {
    // Fetch needed data
    const { data: staffList } = await supabase.from('staff').select('id, contract_type');
    const staffMap = new Map(staffList?.map(s => [s.id, s.contract_type]));

    const { data: classesList } = await supabase.from('classes').select('id, shift, school_id');
    const classMap = new Map(classesList?.map(c => [c.id, c]));

    const { data: schools } = await supabase.from('schools').select('id, name');
    const schoolMap = new Map(schools?.map(s => [s.id, s.name]));

    let query = supabase.from('allotments').select('*');

    if (schoolId) {
        query = query.eq('school_id', schoolId);
    }

    const { data: allotments } = await query;

    if (!allotments) return [];

    // Filter by Date Logic (Allotment Date is DD/MM/YYYY)
    let filtered = allotments;

    if (startDate || endDate) {
        filtered = filtered.filter(a => {
            const aDate = parseDateBR(a.date);
            if (!aDate) return false;

            if (startDate) {
                const start = new Date(startDate); // YYYY-MM-DD
                // Reset time
                start.setHours(0, 0, 0, 0);
                if (aDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (aDate > end) return false;
            }
            return true;
        });
    }

    // Map to Final Rows
    return filtered.map(a => {
        const schoolName = schoolId ? (a.school_name || '') : (schoolMap.get(a.school_id) || a.school_name || 'Desconhecida');
        const cls = classMap.get(a.class_id);
        const turno = cls ? cls.shift : '-';
        const vinculo = staffMap.get(a.staff_id) || '-';

        const roleStr = a.staff_role || '';
        const separatorIndex = roleStr.indexOf(' - ');
        let role = roleStr;
        let cargaHoraria = '-';

        if (separatorIndex !== -1) {
            role = roleStr.substring(0, separatorIndex);
            cargaHoraria = roleStr.substring(separatorIndex + 3);
        }

        return {
            schoolName,
            staffName: a.staff_name,
            role,
            vinculo,
            date: a.date || '-',
            shift: turno,
            hours: cargaHoraria
        };
    }).sort((a, b) => {
        if (a.schoolName < b.schoolName) return -1;
        if (a.schoolName > b.schoolName) return 1;
        if (a.staffName < b.staffName) return -1;
        if (a.staffName > b.staffName) return 1;
        return 0;
    });
};

export const generateExcel = async (schoolId: string, startDate?: string, endDate?: string) => {
    try {
        const rowsRaw = await fetchGeneralReportData(schoolId, startDate, endDate);

        if (rowsRaw.length === 0) {
            alert('Nenhuma lotação encontrada neste período.');
            return;
        }

        const rows = rowsRaw.map(r => ({
            "Nome da Escola": r.schoolName,
            "Nome do Servidor": r.staffName,
            "Cargo/Função": r.role,
            "Vínculo": r.vinculo,
            "Data de Lotação": r.date,
            "Turno": r.shift,
            "Carga Horária": r.hours
        }));

        let filename = schoolId ? `lotacao_escola.xlsx` : `lotacao_geral.xlsx`;

        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = [{ wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
        ws['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, ws, "Lotação");
        XLSX.writeFile(workbook, filename);

    } catch (e) {
        console.error(e);
        alert('Erro ao gerar Excel.');
    }
};

export const generateGeneralDoc = async (schoolId: string, startDate?: string, endDate?: string) => {
    try {
        const rows = await fetchGeneralReportData(schoolId, startDate, endDate);
        if (rows.length === 0) {
            alert('Nenhuma lotação encontrada neste período.');
            return;
        }

        let imgPrefBuf, imgSemedBuf, imgCoordBuf;
        try {
            [imgPrefBuf, imgSemedBuf, imgCoordBuf] = await Promise.all([
                getArrayBufferFromUrl('/img/logo_pref.jpg'),
                getArrayBufferFromUrl('/img/logo_semed.jpg'),
                getArrayBufferFromUrl('/img/logo_coord.jpg')
            ]);
        } catch (e) { }

        const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
        const tableBorders = {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        };

        const headerTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideVertical: noBorder, insideHorizontal: noBorder },
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

        const title = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: `PLANILHA DE LOTAÇÃO`, bold: true, size: 28 })] });

        let periodText = 'Geral';
        if (startDate && endDate) periodText = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`;
        else if (startDate) periodText = `A partir de: ${startDate.split('-').reverse().join('/')}`;

        const periodPara = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: periodText, size: 20 })] });

        const headers = ["Escola", "Servidor", "Cargo", "Vínculo", "Data", "Turno", "Carga Horária"];
        const headerRow = new TableRow({
            tableHeader: true,
            children: headers.map(h => new TableCell({
                shading: { fill: "2980B9", color: "FFFFFF" },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 14 })] })]
            }))
        });

        const tableRows = rows.map((r, i) => new TableRow({
            children: [
                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.schoolName, size: 14 })] })] }),
                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.staffName, size: 14 })] })] }),
                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.role, size: 14 })] })] }),
                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.vinculo, size: 14 })] })] }),
                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.date, size: 14 })] })] }),
                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.shift, size: 14 })] })] }),
                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.hours, size: 14 })] })] }),
            ]
        }));

        const mainTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [headerRow, ...tableRows]
        });

        const doc = new Document({
            sections: [{
                properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
                children: [headerTable, title, periodPara, mainTable]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `planilha_lotacao_geral.docx`);

    } catch (e) {
        console.error(e);
        alert('Erro ao gerar DOC.');
    }
};

export const generateGeneralPDF = async (schoolId: string, startDate?: string, endDate?: string) => {
    try {
        const rows = await fetchGeneralReportData(schoolId, startDate, endDate);
        if (rows.length === 0) {
            alert('Nenhuma lotação encontrada neste período.');
            return;
        }

        let tableRowsHtml = '';
        rows.forEach((r, i) => {
            const bgColor = i % 2 === 0 ? "#FFFFFF" : "#F0F8FF";
            tableRowsHtml += `<tr style="background-color: ${bgColor};">
                <td>${r.schoolName}</td>
                <td>${r.staffName}</td>
                <td>${r.role}</td>
                <td>${r.vinculo}</td>
                <td>${r.date}</td>
                <td>${r.shift}</td>
                <td>${r.hours}</td>
             </tr>`;
        });

        let periodText = 'Geral';
        if (startDate && endDate) periodText = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Planilha de Lotação</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
                .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 10px; }
                .header-center { text-align: center; flex: 1; margin: 0 20px; }
                .header-center h1 { margin: 2px 0; font-size: 14px; font-weight: bold; text-transform: uppercase; }
                .doc-title { text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle; font-size: 10px; }
                th { background-color: #2980B9; color: white; font-weight: bold; -webkit-print-color-adjust: exact; }
                @media print { @page { size: landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <div class="header">
                 <div class="header-center">
                     <h1>Prefeitura Municipal de Castanhal</h1>
                     <h1>Secretaria Municipal de Educação</h1>
                     <h1>Coordenadoria de Educação Especial</h1>
                 </div>
            </div>
            <div class="doc-title">PLANILHA DE LOTAÇÃO (${periodText})</div>
            <table>
                <thead>
                    <tr>
                        <th>Escola</th>
                        <th>Servidor</th>
                        <th>Cargo</th>
                        <th>Vínculo</th>
                        <th>Data</th>
                        <th>Turno</th>
                        <th>Carga Horária</th>
                    </tr>
                </thead>
                <tbody>${tableRowsHtml}</tbody>
            </table>
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } else {
            alert('Por favor, permita popups.');
        }

    } catch (e) {
        console.error(e);
        alert('Erro ao gerar PDF.');
    }
};

// --- REST OF HELPERS (generateDoc/generatePDF for School Pre-Lotacao) ---

const getArrayBufferFromUrl = async (url: string): Promise<ArrayBuffer> => {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await blob.arrayBuffer();
    } catch (e) {
        return new ArrayBuffer(0);
    }
};

const getModalityAbbr = (mod: string) => {
    if (!mod) return '-';
    if (mod.includes("Educação Infantil")) return "EI";
    if (mod.includes("Anos Iniciais") || mod.includes("1º/5º")) return "EF-1";
    if (mod.includes("Anos Finais") || mod.includes("6º/9º")) return "EF-2";
    if (mod.includes("Ensino Fundamental")) {
        if (mod.includes("Iniciais") || mod.includes("5º")) return "EF-1";
        if (mod.includes("Finais") || mod.includes("9º")) return "EF-2";
        return "EF";
    }
    if (mod.includes("EJA")) return "EJA";
    if (mod.includes("Educação Especial")) return "EE";
    return mod;
};

const getStaffDisplay = (staffMember: any) => {
    if (!staffMember) return { name: '-', role: '-', hours: '-' };

    let name = '-', role = '-', hours = '-';

    if (staffMember.staff_name) {
        name = staffMember.staff_name;
        const r = staffMember.staff_role || '';
        const hoursMatch = r.match(/(\d{3})h/);
        if (hoursMatch) {
            hours = hoursMatch[0];
            const parts = r.split(' - ');
            if (parts.length > 1) {
                role = parts[0];
            } else {
                role = r.replace(hoursMatch[0], '').trim();
            }
        } else {
            const parts = r.split(' - ');
            if (parts.length > 1) {
                hours = parts.pop();
                role = parts.join(' - ');
            } else {
                role = r;
            }
        }
    } else if (staffMember.name) {
        name = staffMember.name;
        role = staffMember.role;
        hours = staffMember.hours_total ? `${staffMember.hours_total}h` : '-';
    }

    return { name, role, hours };
};


const buildClassRows = (cls: any) => {
    const mod = getModalityAbbr(cls.modality);
    const studentsList = cls.students || [];
    const studentRows = studentsList.map((s: any) => {
        const support = s.needs_support ? (Array.isArray(s.needs_support) ? s.needs_support.join(', ') : s.needs_support) : "Não";
        const needs = !(support.includes("Não necessita") || support.includes("Necessita de avaliação"));
        return {
            studentName: s.name,
            studentSupport: support,
            needsStaff: needs
        };
    });

    const staffAllotments: any[] = (cls as any).allotments || [];
    const staffList = (staffAllotments.length > 0) ? staffAllotments : (cls.staff || []);

    const rows: any[] = [];
    const totalRows = Math.max(studentRows.length, staffList.length, 1);

    for (let i = 0; i < totalRows; i++) {
        const sRow = studentRows[i];
        const sName = sRow ? sRow.studentName : "";
        const sSupport = sRow ? sRow.studentSupport : "";
        const showStaff = !sRow || sRow.needsStaff;

        rows.push({
            mod: i === 0 ? mod : null,
            series: i === 0 ? `${cls.series} ${cls.section || ''}` : null,
            shift: i === 0 ? (cls.shift || '-') : null,
            studentName: sName,
            studentSupport: sSupport,
            showStaff: showStaff,
            staffIndex: -1
        });
    }

    let eligibleCounter = 0;
    const totalEligible = rows.filter(r => r.showStaff).length;
    const distinctStaffCount = staffList.length || 1;
    const chunk = Math.ceil(totalEligible / distinctStaffCount);

    rows.forEach(r => {
        if (r.showStaff) {
            let sIndex = Math.floor(eligibleCounter / chunk);
            if (sIndex >= staffList.length) sIndex = staffList.length - 1;

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

        let imgPrefBuf, imgSemedBuf, imgCoordBuf;
        try {
            [imgPrefBuf, imgSemedBuf, imgCoordBuf] = await Promise.all([
                getArrayBufferFromUrl('/img/logo_pref.jpg'),
                getArrayBufferFromUrl('/img/logo_semed.jpg'),
                getArrayBufferFromUrl('/img/logo_coord.jpg')
            ]);
        } catch (e) {
        }

        const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
        const tableBorders = {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        };

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
            const isAlternate = classIndex % 2 !== 0;
            const bgColor = isAlternate ? "F0F8FF" : "auto";

            rows.forEach((r, i) => {
                const isFirst = i === 0;
                const mergeTypeMeta = isFirst ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;

                let mergeTypeStaff: typeof VerticalMergeType.RESTART | typeof VerticalMergeType.CONTINUE = VerticalMergeType.RESTART;
                const prevRow = i > 0 ? rows[i - 1] : null;

                if (i > 0 && r.showStaff && prevRow && prevRow.showStaff && r.staffIndex === prevRow.staffIndex) {
                    mergeTypeStaff = VerticalMergeType.CONTINUE;
                }

                const staffData = r.showStaff && r.staffData ? r.staffData : { name: '', role: '', hours: '' };

                const shading = { fill: bgColor };

                tableRows.push(new TableRow({
                    children: [
                        new TableCell({ shading, verticalMerge: mergeTypeMeta, verticalAlign: VerticalAlign.CENTER, children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.mod, size: 16 })] })] : [] }),
                        new TableCell({ shading, verticalMerge: mergeTypeMeta, verticalAlign: VerticalAlign.CENTER, children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.series, size: 16 })] })] : [] }),
                        new TableCell({ shading, verticalMerge: mergeTypeMeta, verticalAlign: VerticalAlign.CENTER, children: isFirst ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.shift, size: 16 })] })] : [] }),

                        new TableCell({ shading, verticalAlign: VerticalAlign.CENTER, width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: r.studentName, size: 16 })] })] }),
                        new TableCell({ shading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: r.studentSupport, size: 14 })] })] }),

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

        // Notes Section
        const notesElements: Paragraph[] = [];
        const classesWithObs = reportData.filter(c => c.obs);

        if (classesWithObs.length > 0) {
            notesElements.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "Notas / Observações:", bold: true, size: 16 })] }));

            classesWithObs.forEach(c => {
                notesElements.push(new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: `${c.series} ${c.section ? '- ' + c.section : ''} (${c.shift}): `, bold: true, size: 14 }),
                        new TextRun({ text: c.obs || '', size: 14 })
                    ]
                }));
            });
        }

        const doc = new Document({
            sections: [{
                properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
                children: [headerTable, separator, title, ...schoolInfo, mainTable, terms, ...notesElements, datePara, sigTable]
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

                if (isFirst) {
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${r.mod}</td>`;
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${r.series}</td>`;
                    tableRowsHtml += `<td rowSpan="${maxRows}" style="vertical-align: middle;">${r.shift}</td>`;
                }

                tableRowsHtml += `<td>${r.studentName}</td>`;
                tableRowsHtml += `<td>${r.studentSupport}</td>`;

                const prevRow = i > 0 ? rows[i - 1] : null;
                const isStaffContinuous = (i > 0 && r.showStaff && prevRow && prevRow.showStaff && r.staffIndex === prevRow.staffIndex);

                if (r.showStaff) {
                    if (!isStaffContinuous) {
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

                ${reportData.some(c => c.obs) ? `
                <div style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px;">
                    <h3 style="font-size: 12px; margin: 0 0 5px 0;">Notas / Observações:</h3>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 10px;">
                        ${reportData.filter(c => c.obs).map(c => `
                            <li style="margin-bottom: 4px;"><strong>${c.series} ${c.section ? '- ' + c.section : ''} (${c.shift}):</strong> ${c.obs}</li>
                        `).join('')}
                    </ul>
                </div>` : ''}

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
