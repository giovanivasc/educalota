import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { generateSrmDoc } from '../lib/reports';

interface SrmReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SrmReportModal: React.FC<SrmReportModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReportData();
    }
  }, [isOpen]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data: schoolsData, error } = await supabase
        .from('schools')
        .select(`
          id, name, region,
          classes (
            id, series, section, shift
          )
        `)
        .order('name');

      if (error) throw error;

      // Filter and formatting
      const formattedData: any[] = [];
      schoolsData?.forEach(school => {
        const srmClasses = school.classes?.filter(
          (c: any) =>
            (c.series && (c.series.toUpperCase().includes('AEE') || c.series.toUpperCase().includes('SRM'))) ||
            (c.section && (c.section.toUpperCase().includes('AEE') || c.section.toUpperCase().includes('SRM')))
        ) || [];

        if (srmClasses.length > 0) {
          const getShiftWeight = (shift: string) => {
            if (!shift) return 5;
            const s = shift.toLowerCase();
            if (s.includes('manhã')) return 1;
            if (s.includes('tarde')) return 2;
            if (s.includes('noite')) return 3;
            if (s.includes('integral')) return 4;
            return 5;
          };

          srmClasses.sort((a: any, b: any) => {
            const shiftWeightA = getShiftWeight(a.shift);
            const shiftWeightB = getShiftWeight(b.shift);

            if (shiftWeightA !== shiftWeightB) {
              return shiftWeightA - shiftWeightB;
            }

            const classNameA = `${a.series || ''} ${a.section || ''}`.trim();
            const classNameB = `${b.series || ''} ${b.section || ''}`.trim();
            return classNameA.localeCompare(classNameB, 'pt-BR');
          });

          srmClasses.forEach((cls: any, index: number) => {
            formattedData.push({
              schoolId: school.id,
              schoolName: school.name,
              region: school.region || 'Urbana',
              isFirstInSchool: index === 0,
              rowSpan: srmClasses.length,
              className: `${cls.series} ${cls.section || ''}`.trim(),
              shift: cls.shift || '-'
            });
          });
        }
      });

      setData(formattedData);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:static print:bg-white print:p-0 print:block">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] print:shadow-none print:w-full print:max-h-none print:rounded-none">

        {/* Modal Header (Hidden on Print) */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center print:hidden">
          <h3 className="text-xl font-bold">Relatório: Escolas com Salas de Recursos Multifuncionais</h3>
          <div className="flex gap-2">
            <Button variant="outline" icon="description" onClick={() => generateSrmDoc(data)} disabled={loading}>Salvar DOCX</Button>
            <Button variant="outline" icon="print" onClick={handlePrint} disabled={loading}>Imprimir Relatório</Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-4">
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
          <h1 className="mt-8 text-xl font-bold text-center underline uppercase text-black">RELATÓRIO - ESCOLAS AEE / SRM</h1>
        </div>

        {/* Table Content */}
        <div id="print-area" className="p-6 overflow-y-auto print:p-0 print:overflow-visible print:bg-white bg-white w-full h-full">
          {loading ? (
            <div className="flex items-center justify-center py-10 print:hidden">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-bold uppercase print:text-black">Nenhuma escola com turmas AEE/SRM encontrada.</div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden print:border-none print:rounded-none">
              <table className="w-full text-sm text-left border-collapse table-auto text-black">
                <thead className="bg-primary text-white print:bg-slate-200 print:text-black print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
                  <tr>
                    <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-center">Escola</th>
                    <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-center w-32">Região</th>
                    <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-center">Turma Cadastrada</th>
                    <th className="px-4 py-3 border border-slate-300 print:border-black font-bold text-center w-32">Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 print:border-black print:hover:bg-transparent">
                      {row.isFirstInSchool && (
                        <>
                          <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-center font-bold" rowSpan={row.rowSpan}>{row.schoolName}</td>
                          <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-center" rowSpan={row.rowSpan}>{row.region}</td>
                        </>
                      )}
                      <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-center">{row.className}</td>
                      <td className="px-4 py-3 border border-slate-300 print:border-black align-middle text-center">{row.shift}</td>
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
          
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}} />
    </div>
  );
};
