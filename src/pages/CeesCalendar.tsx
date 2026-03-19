import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Components } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Star, Plus, UserMinus } from 'lucide-react';
import { CeesActivity, CeesAbsence } from '../types';

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

const messages = {
  today: 'Hoje',
  previous: 'Voltar',
  next: 'Próximo',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Nenhum agendamento neste período.',
  showMore: (total: number) => `+ Ver mais (${total})`,
};

export default function CeesCalendar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Modals state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);

  // Activity Form state
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState('REUNIÃO');
  const [actLocation, setActLocation] = useState('');
  const [actStartTime, setActStartTime] = useState('');
  const [actEndTime, setActEndTime] = useState('');
  const [actColor, setActColor] = useState('#7c3aed');
  const [actParticipants, setActParticipants] = useState<string[]>([]);
  const [submittingAct, setSubmittingAct] = useState(false);

  // Absence Form state
  const [absStartDate, setAbsStartDate] = useState('');
  const [absEndDate, setAbsEndDate] = useState('');
  const [absReason, setAbsReason] = useState('');
  const [submittingAbs, setSubmittingAbs] = useState(false);

  // 1. Fetch Multiple Sources
  const { data: evaluations = [] } = useQuery({
    queryKey: ['evaluation_requests', 'calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_requests')
        .select('*, schools(name)')
        .not('evaluation_date', 'is', null)
        .in('status', ['SCHEDULED', 'COMPLETED', 'INCONCLUSIVE']);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['cees_activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cees_activities')
        .select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: absences = [] } = useQuery({
    queryKey: ['cees_absences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cees_absences')
        .select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: assessors = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_users');
      if (error) throw error;
      return data || [];
    }
  });

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    assessors.forEach((u: any) => {
        map[u.id] = u.name || u.email?.split('@')[0] || 'Assessor';
    });
    return map;
  }, [assessors]);

  // 2. Merge Events
  const allEvents = useMemo(() => {
    const evs: any[] = [];

    evaluations.forEach((req: any) => {
        evs.push({
            id: req.id,
            title: `${req.student_name} (${req.protocol_number})`,
            start: new Date(req.evaluation_date),
            end: new Date(new Date(req.evaluation_date).getTime() + 60 * 60 * 1000),
            type: 'EVALUATION',
            resource: req
        });
    });

    activities.forEach((act: any) => {
        evs.push({
            id: act.id,
            title: act.title,
            start: new Date(act.start_time),
            end: new Date(act.end_time),
            type: 'ACTIVITY',
            resource: act
        });
    });

    absences.forEach((abs: any) => {
        evs.push({
            id: abs.id,
            title: `Ausente: ${usersMap[abs.user_id] || 'Membro da Equipe'}`,
            start: new Date(abs.start_date),
            end: new Date(abs.end_date),
            allDay: true,
            type: 'ABSENCE',
            resource: abs
        });
    });

    return evs;
  }, [evaluations, activities, absences, usersMap]);

  // 3. Smart Styling (eventPropGetter)
  const eventStyleGetter = (event: any) => {
    const isMine = 
        (event.type === 'EVALUATION' && (event.resource.assessor_id === user?.id || event.resource.assessor_2_id === user?.id)) ||
        (event.type === 'ACTIVITY' && event.resource.participants?.includes(user?.id)) ||
        (event.type === 'ABSENCE' && event.resource.user_id === user?.id);

    let bgColor = '#6b7280'; // Default gray
    const opacityClass = isMine ? 'opacity-100 shadow-md' : 'opacity-60 grayscale-[0.2]';
    const borderClass = isMine ? 'border-l-4 border-l-white ml-0.5' : '';

    if (event.type === 'EVALUATION') {
        const status = event.resource.status;
        if (status === 'COMPLETED') bgColor = '#10b981';
        else if (status === 'SCHEDULED') bgColor = '#7c3aed';
        else if (status === 'INCONCLUSIVE') bgColor = '#f59e0b';
    } else if (event.type === 'ACTIVITY') {
        bgColor = event.resource.color || '#3b82f6';
    } else if (event.type === 'ABSENCE') {
        bgColor = '#ef4444';
        return {
            className: `${opacityClass} ${borderClass} border-none rounded text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 flex items-center gap-1`,
            style: { 
                backgroundColor: bgColor, 
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)'
            }
        };
    }

    return {
        className: `${opacityClass} ${borderClass} border-none rounded text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 shadow-sm`,
        style: { backgroundColor: bgColor }
    };
  };

  // 4. Custom Event Component
  const CustomEvent: Components['event'] = ({ event }) => {
    const isMine = 
        (event.type === 'EVALUATION' && (event.resource.assessor_id === user?.id || event.resource.assessor_2_id === user?.id)) ||
        (event.type === 'ACTIVITY' && event.resource.participants?.includes(user?.id)) ||
        (event.type === 'ABSENCE' && event.resource.user_id === user?.id);

    return (
        <div className="flex items-center gap-1 overflow-hidden truncate">
            {isMine && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />}
            <span className="truncate">{event.title}</span>
        </div>
    );
  };

  const handleCreateActivity = async () => {
    if (!actTitle || !actStartTime || !actEndTime) return alert('Preecha todos os campos obrigatórios!');
    setSubmittingAct(true);
    try {
        const { error } = await supabase.from('cees_activities').insert({
            title: actTitle,
            activity_type: actType,
            location: actLocation,
            start_time: actStartTime,
            end_time: actEndTime,
            color: actColor,
            participants: actParticipants,
            created_by: user?.id
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['cees_activities'] });
        setIsActivityModalOpen(false);
        resetActForm();
    } catch (err: any) {
        alert('Erro ao salvar atividade: ' + err.message);
    } finally {
        setSubmittingAct(false);
    }
  };

  const handleCreateAbsence = async () => {
    if (!absStartDate || !absEndDate || !absReason) return alert('Preecha todos os campos obrigatórios!');
    setSubmittingAbs(true);
    try {
        const { error } = await supabase.from('cees_absences').insert({
            user_id: user?.id,
            start_date: absStartDate,
            end_date: absEndDate,
            reason: absReason
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['cees_absences'] });
        setIsAbsenceModalOpen(false);
        resetAbsForm();
    } catch (err: any) {
        alert('Erro ao salvar ausência: ' + err.message);
    } finally {
        setSubmittingAbs(false);
    }
  };

  const resetActForm = () => {
    setActTitle(''); setActType('REUNIÃO'); setActLocation(''); setActStartTime(''); setActEndTime(''); setActColor('#7c3aed'); setActParticipants([]);
  };

  const resetAbsForm = () => {
    setAbsStartDate(''); setAbsEndDate(''); setAbsReason('');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Time Hub CEES</h1>
            <p className="text-slate-500 dark:text-slate-400">Hub completo de gestão de tempo da equipe.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="bg-white dark:bg-slate-800" icon="event_busy" onClick={() => setIsAbsenceModalOpen(true)}>
                Ausência
            </Button>
            <Button variant="primary" icon="add" onClick={() => setIsActivityModalOpen(true)}>
                Atividade
            </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-[75vh] min-h-[600px] relative">
        <Calendar
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          culture="pt-BR"
          messages={messages}
          onSelectEvent={(event) => setSelectedEvent(event.resource)}
          eventPropGetter={eventStyleGetter}
          components={{ event: CustomEvent }}
        />
      </div>

      {/* Modal de Detalhes (mesclado) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">info</span>
                    Detalhes do Evento
                </h2>
                <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <span className="material-symbols-outlined text-slate-500">close</span>
                </button>
            </div>
            <div className="p-6 space-y-4">
                <p className="font-bold text-lg text-slate-900 dark:text-white">{selectedEvent.student_name || selectedEvent.title}</p>
                
                {selectedEvent.protocol_number && <p className="text-sm"><span className="text-slate-500 uppercase font-black text-[10px] tracking-widest block">Protocolo</span> <strong>{selectedEvent.protocol_number}</strong></p>}
                {selectedEvent.location && <p className="text-sm"><span className="text-slate-500 uppercase font-black text-[10px] tracking-widest block">Local</span> <strong>{selectedEvent.location}</strong></p>}
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        <strong>Início:</strong> {new Date(selectedEvent.evaluation_date || selectedEvent.start_time || selectedEvent.start_date).toLocaleString('pt-BR')}
                    </p>
                    {selectedEvent.end_time && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            <strong>Fim:</strong> {new Date(selectedEvent.end_time).toLocaleString('pt-BR')}
                        </p>
                    )}
                </div>

                {selectedEvent.participants && (
                    <div>
                        <span className="text-slate-500 uppercase font-black text-[10px] tracking-widest block mb-1">Participantes</span>
                        <div className="flex flex-wrap gap-1">
                            {selectedEvent.participants.map((pid: string) => (
                                <span key={pid} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[11px] font-bold">
                                    {usersMap[pid]}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSelectedEvent(null)}>Fechar</Button>
                {selectedEvent.protocol_number && (
                    <Button variant="primary" onClick={() => navigate('/assessor')}>Ir para Painel</Button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Atividade */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-xl animate-in zoom-in-95 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-primary/10 text-primary flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2"><Plus className="w-5 h-5"/> Nova Atividade Equipe</h2>
                <button onClick={() => setIsActivityModalOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Título da Atividade *</span>
                    <input value={actTitle} onChange={e => setActTitle(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none text-base" placeholder="Ex: Reunião Geral CEES"/>
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo</span>
                        <select value={actType} onChange={e => setActType(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none text-base">
                            <option value="REUNIÃO">Reunião</option>
                            <option value="FORMAÇÃO">Formação</option>
                            <option value="VISITA">Visita Técnica</option>
                            <option value="OUTRO">Outro</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cor</span>
                        <input type="color" value={actColor} onChange={e => setActColor(e.target.value)} className="w-full h-11 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"/>
                    </label>
                </div>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Local</span>
                    <input value={actLocation} onChange={e => setActLocation(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none text-base"/>
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Início *</span>
                        <input type="datetime-local" value={actStartTime} onChange={e => setActStartTime(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-base"/>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Fim *</span>
                        <input type="datetime-local" value={actEndTime} onChange={e => setActEndTime(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-base"/>
                    </label>
                </div>
                <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Participantes</span>
                    <div className="grid grid-cols-2 gap-2 h-32 overflow-y-auto p-2 border border-slate-100 dark:border-slate-800 rounded-xl">
                        {assessors.map((a: any) => (
                            <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 p-1 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={actParticipants.includes(a.id)}
                                    onChange={e => {
                                        if (e.target.checked) setActParticipants([...actParticipants, a.id]);
                                        else setActParticipants(actParticipants.filter(id => id !== a.id));
                                    }}
                                    className="w-4 h-4 rounded text-primary"
                                />
                                <span className="truncate">{a.name || a.email?.split('@')[0]}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsActivityModalOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleCreateActivity} isLoading={submittingAct}>Salvar Atividade</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Ausência */}
      {isAbsenceModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-red-50 text-red-600 flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2"><UserMinus className="w-5 h-5"/> Registrar Ausência</h2>
                <button onClick={() => setIsAbsenceModalOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Data Início *</span>
                        <input type="date" value={absStartDate} onChange={e => setAbsStartDate(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-base"/>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Data Fim *</span>
                        <input type="date" value={absEndDate} onChange={e => setAbsEndDate(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-base"/>
                    </label>
                </div>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Motivo *</span>
                    <textarea value={absReason} onChange={e => setAbsReason(e.target.value)} rows={3} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 text-base resize-none" placeholder="Ex: Licença Médica, Férias, etc."/>
                </label>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsAbsenceModalOpen(false)}>Cancelar</Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleCreateAbsence} isLoading={submittingAbs}>Salvar Ausência</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
