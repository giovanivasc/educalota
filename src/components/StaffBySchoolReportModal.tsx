import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { generateStaffBySchoolDoc } from '../lib/reports';

interface StaffBySchoolReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ProcessedRow {
    schoolId: string;
    schoolName: string;
    role: string;
    staffName: string;
    shift: string;
    isFirstInSchool: boolean;
    schoolRowSpan: number;
    isFirstInRole: boolean;
    roleRowSpan: number;
}

export const StaffBySchoolReportModal: React.FC<StaffBySchoolReportModalProps> = ({ isOpen, onClose }) => {
    const [data, setData] = useState<ProcessedRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchReportData();
        }
    }, [isOpen]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const { data: allotments, error } = await supabase
                .from('allotments')
                .select(`*`)
                .neq('staff_name', 'Disponível')
                .eq('status', 'Ativo');

            if (error) throw error;

            if (!allotments || allotments.length === 0) {
                setData([]);
                return;
            }

            const schoolIds = [...new Set(allotments.map((a: any) => a.school_id).filter(Boolean))];
            const classIds = [...new Set(allotments.map((a: any) => a.class_id).filter(Boolean))];
            const staffIds = [...new Set(allotments.map((a: any) => a.staff_id).filter(Boolean))];

            const [schoolsRes, classesRes, staffRes] = await Promise.all([
                supabase.from('schools').select('id, name').in('id', schoolIds),
                supabase.from('classes').select('id, shift').in('id', classIds),
                supabase.from('staff').select('id, role').in('id', staffIds)
            ]);

            const schoolsData = schoolsRes.data || [];
            const classesData = classesRes.data || [];
            const staffData = staffRes.data || [];

            const rawData = allotments.map((a: any) => {
                const school = schoolsData.find((s: any) => s.id === a.school_id);
                const cls = classesData.find((c: any) => c.id === a.class_id);
                const staff = staffData.find((s: any) => s.id === a.staff_id);

                let roleName = staff?.role || a.staff_role || 'Desconhecido';
                if (roleName.includes(' - ')) {
                    roleName = roleName.split(' - ')[0]; // Limpa carga horária se estiver lá
                }

                return {
                    schoolId: a.school_id || 'unknown',
                    schoolName: school?.name || a.school_name || 'Escola Desconhecida',
                    role: roleName,
                    staffName: a.staff_name || 'Desconhecido',
                    shift: cls?.shift || '-'
                };
            });

            // Grouping and Sorting
            // Sort by School > Role > Staff Name
            rawData.sort((a, b) => {
                const schoolSort = a.schoolName.localeCompare(b.schoolName, 'pt-BR');
                if (schoolSort !== 0) return schoolSort;

                const roleSort = a.role.localeCompare(b.role, 'pt-BR');
                if (roleSort !== 0) return roleSort;

                return a.staffName.localeCompare(b.staffName, 'pt-BR');
            });

            // Calculate rowSpans
            const processed: ProcessedRow[] = [];
            let currentSchoolRowSpan = 0;
            let currentSchoolStartIndex = 0;

            let currentRoleRowSpan = 0;
            let currentRoleStartIndex = 0;

            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];
                const isFirstInSchool = i === 0 || row.schoolName !== rawData[i - 1].schoolName;
                const isFirstInRole = isFirstInSchool || row.role !== rawData[i - 1].role;

                processed.push({
                    ...row,
                    isFirstInSchool,
                    schoolRowSpan: 1, // Placeholder
                    isFirstInRole,
                    roleRowSpan: 1 // Placeholder
                });

                if (isFirstInSchool) {
                    if (i > 0) {
                        processed[currentSchoolStartIndex].schoolRowSpan = currentSchoolRowSpan;
                    }
                    currentSchoolStartIndex = i;
                    currentSchoolRowSpan = 1;
                } else {
                    currentSchoolRowSpan++;
                }

                if (isFirstInRole) {
                    if (i > 0 && !isFirstInSchool) {
                        processed[currentRoleStartIndex].roleRowSpan = currentRoleRowSpan;
                    } else if (i > 0 && isFirstInSchool) {
                        processed[currentRoleStartIndex].roleRowSpan = currentRoleRowSpan;
                    }
                    currentRoleStartIndex = i;
                    currentRoleRowSpan = 1;
                } else {
                    currentRoleRowSpan++;
                }
            }

            // Update the last blocks
            if (processed.length > 0) {
                processed[currentSchoolStartIndex].schoolRowSpan = currentSchoolRowSpan;
                processed[currentRoleStartIndex].roleRowSpan = currentRoleRowSpan;
            }

            setData(processed);
        } catch (e) {
            console.error(e);
            alert('Erro ao buscar dados do relatório.');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        if (data.length === 0) return;

        // Create CSV content
        const header = ['Nome da Escola', 'Cargo / Função', 'Nome do Servidor', 'Turno de Lotação'];
        const rows = data.map(row => [
            `"${row.schoolName}"`,
            `"${row.role}"`,
            `"${row.staffName}"`,
            `"${row.shift}"`
        ]);

        const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'relatorio_lotacao_por_escola.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:static print:bg-white print:p-0 print:block">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] print:shadow-none print:w-full print:max-h-none print:rounded-none">

                {/* Modal Header (Hidden on Print) */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center print:hidden">
                    <h3 className="text-xl font-bold">Relatório: Lotação de Servidores por Escola</h3>
                    <div className="flex gap-2">
                        <Button variant="outline" icon="description" onClick={() => generateStaffBySchoolDoc(data)} disabled={loading || data.length === 0}>Salvar DOCX</Button>
                        <Button variant="outline" icon="download" onClick={handleExportCSV} disabled={loading || data.length === 0}>Baixar CSV</Button>
                        <Button variant="outline" icon="print" onClick={handlePrint} disabled={loading || data.length === 0}>Imprimir</Button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-4 transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Print Header (Visible only on Print) */}
                <div className="hidden print:flex flex-col items-center mb-6 pt-6 bg-white w-full">
                    <div className="flex justify-between items-center w-full px-10">
                        <img src="/img/logo_pref.jpg" alt="Logo Pref" style={{ height: '60px' }} />
                        <div className="text-center font-serif text-black">
                            <h2 className="text-sm font-bold m-0 leading-tight uppercase">PREFEITURA MUNICIPAL DE CASTANHAL</h2>
                            <h2 className="text-sm font-bold m-0 leading-tight uppercase">SECRETARIA MUNICIPAL DE EDUCAÇÃO</h2>
                            <h2 className="text-sm font-bold m-0 leading-tight uppercase">COORDENADORIA DE EDUCAÇÃO ESPECIAL</h2>
                        </div>
                        <img src="/img/logo_semed.jpg" alt="Logo Semed" style={{ height: '50px' }} />
                    </div>
                    <h1 className="mt-8 text-xl font-bold text-center underline uppercase text-black">RELATÓRIO - LOTAÇÃO POR ESCOLA</h1>
                </div>

                {/* Table Content */}
                <div id="print-area" className="p-6 overflow-y-auto print:p-0 print:overflow-visible print:bg-white bg-white w-full h-full relative">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 print:hidden">
                            <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-20 text-slate-500 font-bold uppercase print:text-black">Nenhuma lotação encontrada.</div>
                    ) : (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden print:border-none print:rounded-none">
                            <table className="w-full text-sm text-left border-collapse table-auto text-black">
                                <thead className="bg-primary text-white print:bg-slate-200 print:text-black print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
                                    <tr>
                                        <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-center w-1/4">Unidade de Ensino</th>
                                        <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-center w-1/4">Cargo / Função</th>
                                        <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-left">Nome do Servidor</th>
                                        <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-center w-32">Turno</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, idx) => (
                                        <tr key={idx} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 print:border-black print:hover:bg-transparent">
                                            {row.isFirstInSchool && (
                                                <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-center font-bold bg-slate-50 dark:bg-slate-800 print:bg-transparent" rowSpan={row.schoolRowSpan}>
                                                    {row.schoolName}
                                                </td>
                                            )}
                                            {row.isFirstInRole && (
                                                <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-center font-semibold bg-white dark:bg-slate-900 print:bg-transparent text-slate-700 dark:text-slate-300 print:text-black" rowSpan={row.roleRowSpan}>
                                                    {row.role}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-left font-medium">
                                                {row.staffName}
                                            </td>
                                            <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-center">
                                                {row.shift}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="hidden print:block text-right text-xs mt-10 mr-4 font-serif text-black">
                                Castanhal, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          title { display: none; }
          body * { visibility: hidden; }
          .print\\:static, .print\\:static *, #root > div.flex > div.flex-1.flex.flex-col > main > div > div:nth-child(3) > div.fixed { visibility: visible !important; }
          
          /* Hide Sidebar and NavBar during print entirely */
          aside, nav, header { display: none !important; }
          
          .print\\:hidden { display: none !important; }
          
          body { 
            background-color: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
          }
          
          .fixed.inset-0 {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            min-height: 100vh !important;
            width: 100vw !important;
            background: white !important;
            z-index: 99999 !important;
          }
          
          /* Adjust table headers and page breaks */
          table { page-break-after: auto; }
          tr    { page-break-inside: avoid; page-break-after: auto; }
          td    { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          
          @page { size: A4 landscape; margin: 15mm; }
        }
      `}} />
        </div>
    );
};
