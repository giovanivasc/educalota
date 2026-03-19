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
import { Star, Plus, UserMinus, Trash2, Edit } from 'lucide-react';

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

export const ACTIVITY_COLORS: Record<string, string> = {
  'Avaliação': '#9333ea', // purple-600
  'Reunião': '#2563eb', // blue-600
  'Formação': '#ea580c', // orange-600
  'Assessoramento': '#10b981', // emerald-500
  'Outros': '#6b7280'  // gray-500
};

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Activity Form state
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState('Reunião');
  const [actLocation, setActLocation] = useState('');
  const [actStartTime, setActStartTime] = useState('');
  const [actEndTime, setActEndTime] = useState('');
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
      const { data, error } = await supabase.from('cees_activities').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: absences = [] } = useQuery({
    queryKey: ['cees_absences'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cees_absences').select('*');
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

  // 3. Smart Styling
  const eventStyleGetter = (event: any) => {
    const isMine = 
        (event.type === 'EVALUATION' && (event.resource.assessor_id === user?.id || event.resource.assessor_2_id === user?.id)) ||
        (event.type === 'ACTIVITY' && event.resource.participants?.includes(user?.id)) ||
        (event.type === 'ABSENCE' && event.resource.user_id === user?.id);

    let bgColor = '#6b7280';
    const opacityClass = isMine ? 'opacity-100 shadow-md' : 'opacity-60 grayscale-[0.2]';
    const borderClass = isMine ? 'border-l-4 border-l-white ml-0.5' : '';

    if (event.type === 'EVALUATION') {
        const status = event.resource.status;
        if (status === 'COMPLETED') bgColor = '#10b981';
        else if (status === 'SCHEDULED') bgColor = '#7c3aed';
        else if (status === 'INCONCLUSIVE') bgColor = '#f59e0b';
    } else if (event.type === 'ACTIVITY') {
        bgColor = ACTIVITY_COLORS[event.resource.activity_type] || ACTIVITY_COLORS['Outros'];
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
    if (!actTitle || !actStartTime || !actEndTime) return alert('Preencha os campos obrigatórios!');
    setSubmittingAct(true);
    try {
        const payload = {
            title: actTitle,
            activity_type: actType,
            location: actLocation,
            start_time: actStartTime,
            end_time: actEndTime,
            color: ACTIVITY_COLORS[actType] || ACTIVITY_COLORS['Outros'],
            participants: actParticipants,
            created_by: user?.id
        };

        if (isEditMode && editingId) {
            const { error } = await supabase.from('cees_activities').update(payload).eq('id', editingId);
            if (error) throw error;
            alert('Atividade atualizada!');
        } else {
            const { error } = await supabase.from('cees_activities').insert(payload);
            if (error) throw error;
        }

        queryClient.invalidateQueries({ queryKey: ['cees_activities'] });
        setIsActivityModalOpen(false);
        resetActForm();
    } catch (err: any) {
        alert('Erro: ' + err.message);
    } finally {
        setSubmittingAct(false);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta atividade?')) return;
    try {
        const { error } = await supabase.from('cees_activities').delete().eq('id', id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['cees_activities'] });
        setIsActivityModalOpen(false);
        resetActForm();
    } catch (err: any) {
        alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleCreateAbsence = async () => {
    if (!absStartDate || !absEndDate || !absReason) return alert('Preencha os campos obrigatórios!');
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
        alert('Erro ao salvar: ' + err.message);
    } finally {
        setSubmittingAbs(false);
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir sua ausência?')) return;
    try {
        const { error } = await supabase.from('cees_absences').delete().eq('id', id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['cees_absences'] });
        setSelectedEvent(null);
    } catch (err: any) {
        alert('Erro ao excluir: ' + err.message);
    }
  };

  const resetActForm = () => {
    setActTitle(''); setActType('Reunião'); setActLocation(''); setActStartTime(''); setActEndTime(''); setActParticipants([]);
    setIsEditMode(false); setEditingId(null);
  };

  const resetAbsForm = () => {
    setAbsStartDate(''); setAbsEndDate(''); setAbsReason('');
  };

  const openEditActivity = (act: any) => {
    setActTitle(act.title);
    setActType(act.activity_type);
    setActLocation(act.location || '');
    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    setActStartTime(new Date(act.start_time).toISOString().slice(0, 16));
    setActEndTime(new Date(act.end_time).toISOString().slice(0, 16));
    setActParticipants(act.participants || []);
    setIsEditMode(true);
    setEditingId(act.id);
    setIsActivityModalOpen(true);
  };

  const onSelectEvent = (event: any) => {
    if (event.type === 'ACTIVITY') {
        openEditActivity(event.resource);
    } else {
        setSelectedEvent(event);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Time Hub CEES</h1>
            <p className="text-slate-500 dark:text-slate-400">Gestão e sincronização da equipe.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="bg-white dark:bg-slate-800" icon="event_busy" onClick={() => setIsAbsenceModalOpen(true)}>
                Ausência
            </Button>
            <Button variant="primary" icon="add" onClick={() => { resetActForm(); setIsActivityModalOpen(true); }}>
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
          onSelectEvent={onSelectEvent}
          eventPropGetter={eventStyleGetter}
          components={{ event: CustomEvent }}
        />
      </div>

      {/* Modal de Detalhes (Leitura/Absença) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
            <div className={`px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center ${selectedEvent.type === 'ABSENCE' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{selectedEvent.type === 'ABSENCE' ? 'event_busy' : 'info'}</span>
                    {selectedEvent.type === 'ABSENCE' ? 'Ausência de Equipe' : 'Detalhes do Agendamento'}
                </h2>
                <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <span className="material-symbols-outlined text-slate-500">close</span>
                </button>
            </div>
            <div className="p-6 space-y-4">
                <p className="font-bold text-lg text-slate-900 dark:text-white">{selectedEvent.title}</p>
                {selectedEvent.type === 'EVALUATION' && (
                    <>
                        {selectedEvent.resource.protocol_number && <p className="text-sm"><span className="text-slate-500 font-bold text-[10px] uppercase">Protocolo:</span> <strong>{selectedEvent.resource.protocol_number}</strong></p>}
                        {selectedEvent.resource.schools?.name && <p className="text-sm"><span className="text-slate-500 font-bold text-[10px] uppercase">Escola:</span> <strong>{selectedEvent.resource.schools.name}</strong></p>}
                    </>
                )}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-2">
                    <p className="text-sm"><strong>Início:</strong> {selectedEvent.start.toLocaleString('pt-BR')}</p>
                    <p className="text-sm"><strong>Fim:</strong> {selectedEvent.end.toLocaleString('pt-BR')}</p>
                </div>
                {selectedEvent.type === 'ABSENCE' && selectedEvent.resource.reason && (
                    <div className="bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/20">
                        <span className="text-[10px] font-black uppercase text-red-600 block mb-1">Motivo:</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{selectedEvent.resource.reason}</p>
                    </div>
                )}
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between gap-2">
                <div>
                   {selectedEvent.type === 'ABSENCE' && (user?.id === selectedEvent.resource.user_id || user?.role === 'ADMIN' || user?.role === 'COORDENADOR') && (
                       <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" icon="delete" onClick={() => handleDeleteAbsence(selectedEvent.id)}>Excluir</Button>
                   )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setSelectedEvent(null)}>Fechar</Button>
                    {selectedEvent.type === 'EVALUATION' && <Button variant="primary" onClick={() => navigate('/assessor')}>Painel Assessor</Button>}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atividade (Editar/Criar) */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-xl animate-in zoom-in-95 overflow-hidden">
            <div className={`px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center ${isEditMode ? 'bg-amber-50 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                <h2 className="font-bold flex items-center gap-2">{isEditMode ? <Edit className="w-5 h-5"/> : <Plus className="w-5 h-5"/>} {isEditMode ? 'Editar Atividade' : 'Nova Atividade Equipe'}</h2>
                <button onClick={() => setIsActivityModalOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Título da Atividade *</span>
                    <input value={actTitle} onChange={e => setActTitle(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none text-base"/>
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo de Atividade</span>
                        <select value={actType} onChange={e => setActType(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none text-base">
                            {Object.keys(ACTIVITY_COLORS).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </label>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cor Padrão</span>
                        <div className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 flex items-center px-4 gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ACTIVITY_COLORS[actType] || ACTIVITY_COLORS['Outros'] }}></div>
                            <span className="text-xs font-mono">{ACTIVITY_COLORS[actType] || ACTIVITY_COLORS['Outros']}</span>
                        </div>
                    </div>
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
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <div>
                    {isEditMode && editingId && (
                        <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" icon="delete" onClick={() => handleDeleteActivity(editingId)}>Excluir</Button>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsActivityModalOpen(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={handleCreateActivity} isLoading={submittingAct}>{isEditMode ? 'Salvar Alterações' : 'Salvar Atividade'}</Button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ausência (Apenas Criação - Exclusão feita no detalhe) */}
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
