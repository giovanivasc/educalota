import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useQuery } from '@tanstack/react-query';

const locales = {
  'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function CeesCalendar() {
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ['evaluation_requests', 'calendar'],
    queryFn: fetchEvents
  });

  const { data: assessors = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchAssessors
  });

  async function fetchEvents() {
    const { data, error } = await supabase
      .from('evaluation_requests')
      .select('*, schools(name)')
      .not('evaluation_date', 'is', null)
      .in('status', ['SCHEDULED', 'COMPLETED', 'INCONCLUSIVE']);

    if (error) throw error;

    return (data || []).map((req: any) => ({
      id: req.id,
      title: `${req.student_name} (${req.protocol_number})`,
      start: new Date(req.evaluation_date),
      end: new Date(new Date(req.evaluation_date).getTime() + 60 * 60 * 1000), // 1 hour duration
      resource: req,
    }));
  }

  async function fetchAssessors() {
    const { data, error } = await supabase.rpc('get_all_users');
    if (error) throw error;
    return data || [];
  }

  const getAssessorNames = (req: any) => {
    const names = [];
    if (req.assessor_id) {
      const a1 = (assessors as any[]).find(u => u.id === req.assessor_id);
      names.push(a1?.name || 'Assessor 1');
    }
    if (req.assessor_2_id) {
      const a2 = (assessors as any[]).find(u => u.id === req.assessor_2_id);
      names.push(a2?.name || 'Assessor 2');
    }
    return names.length > 0 ? names.join(' e ') : 'Não atribuído';
  };

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Calendário de Avaliações</h1>
        <p className="text-slate-500 dark:text-slate-400">Acompanhe os agendamentos da equipe CEES.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[500px]">
        {loading && (
            <div className="flex items-center justify-center p-8">
                <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
            </div>
        )}
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '70vh' }}
          culture="pt-BR"
          messages={{
            next: "Próximo",
            previous: "Anterior",
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "Nenhum evento neste período.",
            showMore: (total) => `+ Ver mais (${total})`,
          }}
          onSelectEvent={(event) => setSelectedEvent(event.resource)}
          eventPropGetter={(event) => {
            const status = event.resource.status;
            let bgColor = '#3b82f6'; // Blue for scheduled
            if (status === 'COMPLETED') bgColor = '#10b981'; // Green for completed
            if (status === 'INCONCLUSIVE') bgColor = '#f59e0b'; // Orange for inconclusive
            
            return {
                style: {
                    backgroundColor: bgColor,
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 'bold',
                }
            };
          }}
        />
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-slate-200">Detalhes do Agendamento</h2>
                <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                    <span className="material-symbols-outlined text-slate-500">close</span>
                </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aluno</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{selectedEvent.student_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Protocolo</span>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{selectedEvent.protocol_number}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Escola</span>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{selectedEvent.schools?.name || 'N/A'}</p>
                  </div>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data e Hora</span>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {new Date(selectedEvent.evaluation_date).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assessores</span>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{getAssessorNames(selectedEvent)}</p>
              </div>
              <div className="pt-2">
                 <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                    selectedEvent.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    selectedEvent.status === 'INCONCLUSIVE' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                 }`}>
                    {selectedEvent.status}
                 </span>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                <Button onClick={() => setSelectedEvent(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
