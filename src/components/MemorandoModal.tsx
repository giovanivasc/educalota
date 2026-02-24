import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Staff } from '../types';
import { Button } from './ui/Button';
import html2pdf from 'html2pdf.js';

interface MemorandoModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff | null;
}

export const MemorandoModal: React.FC<MemorandoModalProps> = ({ isOpen, onClose, staff }) => {
  const [loading, setLoading] = useState(true);
  const [allotments, setAllotments] = useState<any[]>([]);
  const [issueDate, setIssueDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Memo number by school. If 2 schools, we need 2 memo numbers.
  const [memoNumbers, setMemoNumbers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && staff) {
      fetchAllotments();
    } else {
      setAllotments([]);
      setMemoNumbers({});
    }
  }, [isOpen, staff]);

  const fetchAllotments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('allotments')
        .select(`
          id,
          school_id,
          school_name,
          staff_role,
          class_id,
          status
        `)
        .eq('staff_id', staff?.id)
        .eq('status', 'Ativo');

      if (error) throw error;

      // Group by school
      const schoolGroups: Record<string, any> = {};

      for (const allot of data || []) {
        let shift = 'N/A';
        let section = 'N/A';

        if (allot.class_id) {
          const { data: cls } = await supabase.from('classes').select('series, section, shift').eq('id', allot.class_id).single();
          if (cls) {
            shift = cls.shift || 'N/A';
            section = `${cls.series} ${cls.section || ''}`;
          }
        }

        const schoolName = allot.school_name || "Desconhecida";

        if (!schoolGroups[schoolName]) {
          schoolGroups[schoolName] = {
            schoolName,
            schoolId: allot.school_id,
            shifts: new Set<string>(),
            sections: new Set<string>(),
            hoursTotal: 0
          };
        }

        schoolGroups[schoolName].shifts.add(shift);
        schoolGroups[schoolName].sections.add(section.trim());

        // Parse hours from staff_role
        const roleStr = allot.staff_role || '';
        const m = roleStr.match(/- (\d+)h/);
        if (m) {
          schoolGroups[schoolName].hoursTotal += parseInt(m[1], 10);
        }
      }

      setAllotments(Object.values(schoolGroups));

      // Init memo numbers object
      const newMemos: Record<string, string> = {};
      Object.values(schoolGroups).forEach((sg: any) => {
        newMemos[sg.schoolName] = '';
      });
      setMemoNumbers(newMemos);

    } catch (e) {
      console.error(e);
      alert('Erro ao buscar lotações para memorando.');
    } finally {
      setLoading(false);
    }
  };

  const getShiftWeight = (shift: string) => {
    if (shift === 'Manhã') return 1;
    if (shift === 'Tarde') return 2;
    if (shift === 'Noite') return 3;
    if (shift === 'Integral') return 4;
    return 5;
  };

  // Process logic according to rules
  const processHoursText = (schoolGroup: any, allSchools: any[], roleName: string) => {
    const isTeacher = ['Professor de Educação Especial', 'Professor Bilíngue', 'Professor de Braille'].includes(roleName);
    const isSupport = ['Mediador', 'Cuidador'].includes(roleName);

    if (isTeacher) {
      return `${schoolGroup.hoursTotal}h`;
    }

    if (isSupport) {
      if (allSchools.length === 1) {
        if (schoolGroup.hoursTotal >= 200) {
          return "200h (50h em regime de hora extra)";
        } else {
          return "150h";
        }
      }

      if (allSchools.length >= 2) {
        // Find best shift for this school
        let myBestShiftWeight = 999;
        const myShifts = Array.from(schoolGroup.shifts) as string[];
        myShifts.forEach(s => {
          const w = getShiftWeight(s);
          if (w < myBestShiftWeight) myBestShiftWeight = w;
        });

        // Find the absolute best shift weight across ALL schools
        let overallBestShiftWeight = 999;
        allSchools.forEach(sg => {
          Array.from(sg.shifts).forEach((s: any) => {
            const w = getShiftWeight(s);
            if (w < overallBestShiftWeight) overallBestShiftWeight = w;
          });
        });

        if (myBestShiftWeight === overallBestShiftWeight) {
          // This is the "first turn" school
          return "100h";
        } else {
          // This is the "second turn" school
          return "100h (50h em regime de hora extra)";
        }
      }
    }

    // Fallback
    return `${schoolGroup.hoursTotal}h`;
  };

  const handleGeneratePDF = (schoolName: string) => {
    const memoNumber = memoNumbers[schoolName] || '____';
    const sg = allotments.find(a => a.schoolName === schoolName);
    if (!sg) return;

    const roleName = staff?.role || '';
    const contractType = staff?.contractType || '';
    const staffName = staff?.name || '';

    const processedHoursText = processHoursText(sg, allotments, roleName);
    const classesText = Array.from(sg.sections).join(', ');
    const shiftsText = Array.from(sg.shifts).join(', ');

    const issueDateParts = issueDate.split('-');
    const formattedIssueDate = issueDateParts.length === 3
      ? `${issueDateParts[2]}/${issueDateParts[1]}/${issueDateParts[0]}`
      : issueDate;

    // Build HTML for PDF
    const mm = memoNumber;
    const year = new Date().getFullYear();

    const viaTemplate = (isRightColumn: boolean) => `
      <div style="flex: 1; padding: 20px 30px; border-right: ${isRightColumn ? 'none' : '1px dashed #ccc'}">
        <div style="text-align: center; margin-bottom: 10px;">
          <img src="/img/logo_pref.jpg" onerror="this.style.display='none'" style="height: 60px;" />
          <h2 style="margin: 5px 0 2px 0; font-size: 14px; font-weight: bold;">PREFEITURA MUNICIPAL DE CASTANHAL</h2>
          <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: normal;">SECRETARIA MUNICIPAL DE EDUCAÇÃO</h3>
          <h4 style="margin: 0; font-size: 13px; font-weight: bold;">MEM. N° ${mm}/${year}/CEES/SEMED/PMC</h4>
        </div>
        
        <div style="margin-bottom: 20px; font-size: 12px; line-height: 1.5;">
          <p style="margin: 2px 0;">Em: ${formattedIssueDate}</p>
          <p style="margin: 2px 0;">Para: <strong>${schoolName}</strong></p>
          <p style="margin: 2px 0;">Assunto: LOTAÇÃO DE SERVIDOR</p>
        </div>
        
        <div style="text-align: justify; font-size: 13px; line-height: 1.6; margin-bottom: 40px;">
          Informamos a V. Sa. que o(a) servidor(a) ${contractType.toLowerCase()} <strong>${staffName.toUpperCase()}</strong>, 
          cargo <strong>${roleName.toUpperCase()}</strong>, a partir desta data será lotado(a) nessa Unidade de Ensino, 
          com carga horária de <strong>${processedHoursText}</strong>, na(s) turma(s) <strong>${classesText}</strong>, 
          no(s) turno(s) <strong>${shiftsText}</strong>.
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <p style="margin: 0 0 5px 0;">Atenciosamente,</p>
          <img src="/img/assign_cees.jpg" onerror="this.style.display='none'" style="height: 60px; margin-bottom: 5px;" />
        </div>
        
        <div style="font-size: 10px; line-height: 1.4; margin-bottom: 30px;">
          <strong>Observações Importantes:</strong><br/>
          1. O servidor deverá apresentar-se à Unidade de Ensino no prazo máximo de 24 (vinte e quatro) horas, contado a partir do recebimento deste memorando. O não comparecimento dentro do prazo estabelecido poderá implicar a perda da lotação, nos termos das normas administrativas vigentes.<br/><br/>
          2. A Gestão da Unidade de Ensino deverá proceder à confirmação da lotação, ao endereço eletrônico: rhlotacao@semedcastanhal.pa.gov.br com cópia para especial.semed@castanhal.pa.gov.br, no prazo de 24 (vinte e quatro) horas após o recebimento deste memorando, a fim de assegurar a regularidade dos registros funcionais e a continuidade do serviço público.
        </div>
        
        ${isRightColumn ? `
        <div style="margin-top: 40px; font-size: 12px;">
          Recebido em: ____/____/________<br/><br/><br/>
          _______________________________________________________
        </div>
        ` : '<div style="margin-top: 40px; height: 75px;"></div>'}
        
        <div style="margin-top: auto; padding-top: 20px; text-align: center; font-size: 9px; line-height: 1.3;">
          SEMED: Avenida Altamira, nº 200, CEP: 68741-320 - Castanhal-Pa - E-mail: especial.semed@castanhal.pa.gov.br<br/>
          PMC: Avenida Barão do Rio Branco, nº 2332 – CEP: 68743-050 Castanhal-Pa www.castanhal.pa.gov.br
        </div>
      </div>
    `;

    const htmlContent = `
      <div style="display: flex; flex-direction: row; width: 100%; height: 100%; font-family: Arial, sans-serif; color: black; background: white;">
        ${viaTemplate(false)}
        ${viaTemplate(true)}
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    // We add it to document briefly for html2pdf to process styles better sometimes, but typically not needed.

    // Config for A4 Landscape
    const opt = {
      margin: [5, 5, 5, 5],
      filename: `Memorando_${staffName.replace(/\s+/g, '_')}_${schoolName.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().from(element).set(opt).save();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-2xl relative my-8">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-primary">description</span>
            Emissão de Memorando
          </h2>
          <p className="text-slate-500">Configure e emita o memorando de lotação para <strong>{staff?.name}</strong>.</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500">Carregando dados da lotação...</div>
        ) : allotments.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            Nenhuma lotação encontrada para este servidor.
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-4">
              <label className="flex flex-col gap-2 flex-1">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Data de Emissão</span>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {allotments.map((sg, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">school</span>
                    {sg.schoolName}
                  </h3>

                  <div className="space-y-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nº do Memorando (Obrigatório)</span>
                      <input
                        type="text"
                        value={memoNumbers[sg.schoolName] || ''}
                        onChange={e => setMemoNumbers({ ...memoNumbers, [sg.schoolName]: e.target.value })}
                        placeholder="Ex: 001"
                        className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </label>

                    <div className="text-sm space-y-2 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p><strong>Vínculo:</strong> {staff?.contractType}</p>
                      <p><strong>Cargo/Função:</strong> {staff?.role}</p>
                      <p><strong>Carga Horária Impressa:</strong> {processHoursText(sg, allotments, staff?.role || '')}</p>
                      <p><strong>Turmas:</strong> {Array.from(sg.sections).join(', ') || 'Nenhuma'}</p>
                      <p><strong>Turnos:</strong> {Array.from(sg.shifts).join(', ') || 'Nenhum'}</p>
                    </div>

                    <Button
                      onClick={() => handleGeneratePDF(sg.schoolName)}
                      disabled={!memoNumbers[sg.schoolName]?.trim()}
                      className="w-full"
                      icon="print"
                    >
                      Gerar Documento (PDF)
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
