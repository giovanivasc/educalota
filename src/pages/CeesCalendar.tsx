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
import { Star, Plus, UserMinus, Trash2, Edit, X, Info, Calendar as CalendarIcon, MapPin, Users } from 'lucide-react';

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
  
  // States
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  // 1. Fetch Data
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

  // 3. Styling Logic
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

  // 4. Handlers
  const onSelectEvent = (event: any) => {
    setSelectedEvent(event);
    setIsViewModalOpen(true);
  };

  const handleEditClick = () => {
    if (selectedEvent?.type !== 'ACTIVITY') return;
    const act = selectedEvent.resource;
    setActTitle(act.title);
    setActType(act.activity_type);
    setActLocation(act.location || '');
    setActStartTime(new Date(act.start_time).toISOString().slice(0, 16));
    setActEndTime(new Date(act.end_time).toISOString().slice(0, 16));
    setActParticipants(act.participants || []);
    setIsEditMode(true);
    setEditingId(act.id);
    setIsViewModalOpen(false);
    setIsEditModalOpen(true);
  };

  const resetActForm = () => {
    setActTitle(''); setActType('Reunião'); setActLocation(''); setActStartTime(''); setActEndTime(''); setActParticipants([]);
    setIsEditMode(false); setEditingId(null);
  };

  const handleSaveActivity = async () => {
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
        } else {
            const { error } = await supabase.from('cees_activities').insert(payload);
            if (error) throw error;
        }
        queryClient.invalidateQueries({ queryKey: ['cees_activities'] });
        setIsEditModalOpen(false);
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
        setIsViewModalOpen(false);
        setSelectedEvent(null);
    } catch (err: any) {
        alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleSaveAbsence = async () => {
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
        setAbsStartDate(''); setAbsEndDate(''); setAbsReason('');
    } catch (err: any) {
        alert('Erro: ' + err.message);
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
        setIsViewModalOpen(false);
        setSelectedEvent(null);
    } catch (err: any) {
        alert('Erro ao excluir: ' + err.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Time Hub Equipe CEES</h1>
            <p className="text-slate-500 dark:text-slate-400">Gestão de tempo e coordenação da equipe técnica.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="bg-white dark:bg-slate-800" icon="event_busy" onClick={() => setIsAbsenceModalOpen(true)}>
                Registrar Ausência
            </Button>
            <Button variant="primary" icon="add" onClick={() => { resetActForm(); setIsEditModalOpen(true); }}>
                Nova Atividade
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

      {/* 5. Modal de Visualização (Read-Only) */}
      {isViewModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
            <div className={`px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center ${selectedEvent.type === 'ABSENCE' ? 'bg-red-50 text-red-700' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    Detalhes da Atividade
                </h2>
                <button onClick={() => setIsViewModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>
            
            <div className="p-6 space-y-6">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{selectedEvent.title}</h3>
                    {selectedEvent.type === 'ACTIVITY' && (
                        <div className="flex items-center gap-2 mt-2">
                            <span 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: ACTIVITY_COLORS[selectedEvent.resource.activity_type] || '#6b7280' }}
                            ></span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {selectedEvent.resource.activity_type}
                            </span>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <CalendarIcon className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="text-slate-600 dark:text-slate-300"><strong>Início:</strong> {selectedEvent.start.toLocaleString('pt-BR')}</p>
                            <p className="text-slate-600 dark:text-slate-300"><strong>Fim:</strong> {selectedEvent.end.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>

                    {selectedEvent.resource.location && (
                        <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                            <p className="text-sm text-slate-600 dark:text-slate-300"><strong>Local:</strong> {selectedEvent.resource.location}</p>
                        </div>
                    )}

                    {selectedEvent.type === 'EVALUATION' && (
                        <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                            <p className="text-sm text-primary font-bold">Protocolo: {selectedEvent.resource.protocol_number}</p>
                            <p className="text-xs text-slate-500 mt-1">Escola: {selectedEvent.resource.schools?.name}</p>
                        </div>
                    )}

                    {selectedEvent.type === 'ABSENCE' && (
                        <div className="bg-red-50/50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20">
                            <p className="text-xs font-black uppercase text-red-600 mb-1">Motivo da Ausência:</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 italic">{selectedEvent.resource.reason}</p>
                        </div>
                    )}
                </div>

                {selectedEvent.resource.participants && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Participantes da Equipe</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {selectedEvent.resource.participants.map((pid: string) => (
                                <span key={pid} className="px-2 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    {usersMap[pid]}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <div>
                    {(selectedEvent.type === 'ACTIVITY' || (selectedEvent.type === 'ABSENCE' && (user?.id === selectedEvent.resource.user_id || user?.role === 'ADMIN'))) && (
                         <Button variant="outline" className="text-red-500 border-red-100 hover:bg-red-50" icon="delete" onClick={() => selectedEvent.type === 'ACTIVITY' ? handleDeleteActivity(selectedEvent.id) : handleDeleteAbsence(selectedEvent.id)}>
                            Excluir
                         </Button>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsViewModalOpen(false)}>Fechar</Button>
                    {selectedEvent.type === 'ACTIVITY' && (
                        <Button variant="primary" icon="edit" onClick={handleEditClick}>Editar</Button>
                    )}
                    {selectedEvent.type === 'EVALUATION' && (
                        <Button variant="primary" onClick={() => navigate('/assessor')}>Ir para Painel</Button>
                    )}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Formulário (Edit/Create Activity) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-xl animate-in zoom-in-95 overflow-hidden">
            <div className={`px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center ${isEditMode ? 'bg-amber-50 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                <h2 className="font-bold flex items-center gap-2">{isEditMode ? <Edit className="w-5 h-5"/> : <Plus className="w-5 h-5"/>} {isEditMode ? 'Editar Atividade' : 'Nova Atividade de Equipe'}</h2>
                <button onClick={() => setIsEditModalOpen(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Título da Atividade *</span>
                    <input value={actTitle} onChange={e => setActTitle(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 text-base" placeholder="Ex: Reunião de Planejamento Mensal"/>
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo</span>
                        <select value={actType} onChange={e => setActType(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 text-base">
                            {Object.keys(ACTIVITY_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </label>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cor Identificadora</span>
                        <div className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 flex items-center px-4 gap-2 bg-slate-50 dark:bg-slate-900/50">
                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: ACTIVITY_COLORS[actType] || '#6b7280' }}></span>
                            <span className="text-xs font-bold text-slate-500 uppercase">{actType}</span>
                        </div>
                    </div>
                </div>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Localização</span>
                    <input value={actLocation} onChange={e => setActLocation(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 text-base" placeholder="Ex: Sala de Reuniões 02 / Online"/>
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
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Participantes da Equipe</span>
                    <div className="grid grid-cols-2 gap-2 h-32 overflow-y-auto p-2 border border-slate-100 dark:border-slate-800 rounded-xl">
                        {assessors.map((a: any) => (
                            <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 p-1.5 rounded transition-colors group">
                                <input 
                                    type="checkbox" 
                                    checked={actParticipants.includes(a.id)}
                                    onChange={e => {
                                        if (e.target.checked) setActParticipants([...actParticipants, a.id]);
                                        else setActParticipants(actParticipants.filter(id => id !== a.id));
                                    }}
                                    className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary/20"
                                />
                                <span className="truncate group-hover:text-primary transition-colors">{a.name || a.email?.split('@')[0]}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleSaveActivity} isLoading={submittingAct}>
                    {isEditMode ? 'Salvar Alterações' : 'Criar Atividade'}
                </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Ausência */}
      {isAbsenceModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-red-50 text-red-600 flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2"><UserMinus className="w-5 h-5"/> Registrar Ausência</h2>
                <button onClick={() => setIsAbsenceModalOpen(false)}><X className="w-5 h-5"/></button>
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
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Motivo da Ausência *</span>
                    <textarea value={absReason} onChange={e => setAbsReason(e.target.value)} rows={3} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 text-base resize-none" placeholder="Ex: Licença Saúde, Férias, Viagem Institucional"/>
                </label>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsAbsenceModalOpen(false)}>Cancelar</Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSaveAbsence} isLoading={submittingAbs}>Salvar Registro</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
