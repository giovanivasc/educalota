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
    let displayRoleName = roleName;
    if (roleName.toLowerCase() === 'mediador' || roleName.toLowerCase() === 'cuidador') {
      displayRoleName = `Profissional de Apoio Escolar - ${roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase()}`;
    }
    const contractType = staff?.contractType || '';
    const staffName = staff?.name || '';

    const processedHoursText = processHoursText(sg, allotments, roleName);
    const classesText = Array.from(sg.sections).join(', ');
    const shiftsText = Array.from(sg.shifts).join(', ');

    const issueDateParts = issueDate.split('-');
    const formattedIssueDate = issueDateParts.length === 3
      ? `${issueDateParts[2]}/${issueDateParts[1]}/${issueDateParts[0]}`
      : issueDate;

    const mm = memoNumber;
    const year = new Date().getFullYear();

    const viaTemplate = (isLeftColumn: boolean) => `
      <div class="column ${isLeftColumn ? 'left-col' : 'right-col'}">
        <div class="header">
          <img src="/img/brasao_oficial.jpg" alt="Brasão Castanhal" onerror="this.onerror=null; this.src='/img/logo_pref.jpg'" />
          <h2>PREFEITURA MUNICIPAL DE CASTANHAL<br/>SECRETARIA MUNICIPAL DE EDUCAÇÃO</h2>
          <div class="border-bottom-header"></div>
        </div>
        
        <div class="doc-dados">
          <div class="memo-number">MEM. N° ${mm}/${year}/CEES/SEMED/PMC</div>
          <div class="date-issue">Em: ${formattedIssueDate}</div>
        </div>
        
        <div class="envio-dados">
          <p>Para: <span>${schoolName}</span></p>
          <p>Assunto: <strong>LOTAÇÃO DE SERVIDOR</strong></p>
        </div>
        
        <div class="corpo-texto">
          Informamos a V. Sa. que o(a) servidor(a) ${contractType.charAt(0).toUpperCase() + contractType.slice(1).toLowerCase()} <strong>${staffName.toUpperCase()}</strong>, cargo <strong>${displayRoleName}</strong>, que a partir desta data será lotado(a) nessa Unidade de Ensino, com carga horária de <strong>${processedHoursText}</strong>, na(s) turma(s) ${classesText}, no(s) turno(s) ${shiftsText}.
        </div>
        
        <div class="assinatura-coordenacao">
          <p>Atenciosamente,</p>
          <img src="/img/assinatura_fernanda.png" alt="Assinatura Coordenação" onerror="this.onerror=null; this.src='/img/logo_coord.jpg'" />
          <div class="border-assinatura"></div>
          <strong>Fernanda de Oliveira Noronha</strong><br/>
          Coordenadora da Educação Especial<br/>
          Portaria n.º 143/2025
        </div>

        <div class="observacoes">
          <strong>Observações Importantes:</strong><br/>
          1. O servidor deverá apresentar-se à Unidade de Ensino no prazo máximo de <strong>24 (vinte e quatro) horas</strong>, contado a partir do recebimento deste memorando. O não comparecimento dentro do prazo estabelecido poderá implicar a <strong>perda da lotação</strong>, nos termos das normas administrativas vigentes.<br/>
          2. A Gestão da Unidade de Ensino deverá proceder à <strong>confirmação da lotação, ao endereço eletrônico: <a href="mailto:rhlotacao@semedcastanhal.pa.gov.br">rhlotacao@semedcastanhal.pa.gov.br</a></strong> com cópia para <strong><a href="mailto:especial.semed@castanhal.pa.gov.br">especial.semed@castanhal.pa.gov.br</a></strong>, no prazo de <strong>24 (vinte e quatro) horas</strong> após o recebimento deste memorando, a fim de assegurar a regularidade dos registros funcionais e a continuidade do serviço público.
        </div>
        
        <div class="spacer"></div>
        
        ${isLeftColumn ? `
        <div class="assinatura-recebimento">
          Recebido em: ____/____/________ &nbsp;&nbsp;&nbsp;&nbsp; _________________________________________ 
        </div>
        ` : ''}
        
        <div class="rodape-institucional">
          <div class="border-top-footer"></div>
          <p>SEMED: Avenida Altamira, nº 200, CEP: 68741-320-Castanhal-Pa - E-mail: especial.semed@castanhal.pa.gov.br</p>
          <p>PMC: Avenida Barão do Rio Branco, nº 2332-CEP: 68743-050 Castanhal-Pa www.castanhal.pa.gov.br</p>
        </div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Memorando de Lotação - ${staffName}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            font-family: "Times New Roman", Times, serif;
            margin: 0;
            padding: 0;
            color: black;
            font-size: 11pt;
            display: flex;
            width: 100%;
            height: 99vh;
            overflow: hidden;
            box-sizing: border-box;
          }
          .page-container {
            display: flex;
            width: 100%;
            height: 100%;
          }
          .column {
            flex: 1;
            padding: 0 10mm;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
          }
          .column.left-col {
            border-right: 1px dashed #ccc;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          .header img {
            height: 55px;
            margin-bottom: 5px;
          }
          .header h2 {
            margin: 0;
            font-size: 12pt;
            font-weight: bold;
            line-height: 1.2;
          }
          .border-bottom-header {
            border-bottom: 2px solid black;
            margin-top: 8px;
            margin-bottom: 10px;
            width: 100%;
          }
          
          .doc-dados {
            position: relative;
            margin-bottom: 15px;
          }
          .memo-number {
            text-align: left;
          }
          .date-issue {
            text-align: right;
            margin-top: 5px;
          }
          
          .envio-dados {
            margin-bottom: 15px;
          }
          .envio-dados p {
            margin: 0;
            line-height: 1.4;
          }

          .corpo-texto {
            text-align: justify;
            text-indent: 35px;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          
          .assinatura-coordenacao {
            text-align: center;
            margin: 20px 0;
            font-size: 11pt;
            line-height: 1.2;
          }
          .assinatura-coordenacao img {
            height: 55px;
            margin: -5px 0;
          }
          .border-assinatura {
            border-bottom: 1px solid black;
            width: 250px;
            margin: 0 auto 5px auto;
          }
          
          .observacoes {
            font-size: 8.5pt;
            color: #444;
            text-align: justify;
            line-height: 1.25;
            margin-bottom: 15px;
          }
          .observacoes a {
            color: #444;
            text-decoration: underline;
          }
          
          .assinatura-recebimento {
            font-size: 10pt;
            margin-bottom: 10px;
          }
          
          .spacer {
            flex-grow: 1;
          }
          
          .rodape-institucional {
            font-size: 7.5pt;
            text-align: center;
            color: #666;
            margin-top: auto;
          }
          .border-top-footer {
            border-top: 1px solid #999;
            margin-bottom: 5px;
          }
          .rodape-institucional p {
            margin: 0;
            line-height: 1.2;
          }
          
          @media print {
            body { 
              font-size: 11pt;
              margin: 0;
              -webkit-print-color-adjust: exact;
            }
            .observacoes { color: #555; font-size: 8.5pt; }
            .rodape-institucional { color: #555; }
            .column { padding: 0 5mm; }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          ${viaTemplate(true)}
          ${viaTemplate(false)}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert("Por favor, permita pop-ups neste site para gerar o memorando.");
    }
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
