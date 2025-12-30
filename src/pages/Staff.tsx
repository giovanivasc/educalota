import React, { useState, useEffect } from 'react';

import { Staff } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { BulkImporter } from '../components/BulkImporter';

const StaffPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos os Cargos');
  const [availabilityFilter, setAvailabilityFilter] = useState('Todas as Disponibilidades');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // New Staff State
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: '',
    contractType: '',
    hoursTotal: 100,
    avatar: ''
  });
  // const [avatarFile, setAvatarFile] = useState<File | null>(null); // Removed
  const [saveLoading, setSaveLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // For Edit

  // Action Menu State
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

  // View Allotment State
  const [viewAllotmentId, setViewAllotmentId] = useState<string | null>(null);
  const [staffAllotments, setStaffAllotments] = useState<any[]>([]);
  const [loadingAllotments, setLoadingAllotments] = useState(false);

  // Edit Allotment Workload State
  const [editingAllotmentId, setEditingAllotmentId] = useState<string | null>(null);
  const [newWorkload, setNewWorkload] = useState(0);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('staff').select('*').order('name', { ascending: true });
      if (error) throw error;

      const mappedStaff: Staff[] = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        registration: s.registration,
        role: s.role,
        contractType: s.contract_type as any,
        hoursTotal: s.hours_total,
        hoursAvailable: s.hours_available,
        avatar: s.avatar
      }));
      setStaffList(mappedStaff);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staffList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.registration.includes(searchTerm);

    const matchesRole = roleFilter === 'Todos os Cargos' || s.role === roleFilter;

    let matchesAvailability = true;
    if (availabilityFilter === 'Com Disponibilidade') {
      matchesAvailability = s.hoursAvailable > 0;
    } else if (availabilityFilter === 'Sem Disponibilidade') {
      matchesAvailability = s.hoursAvailable === 0;
    } else if (availabilityFilter === 'Totalmente Livre') {
      matchesAvailability = s.hoursAvailable === s.hoursTotal;
    }

    return matchesSearch && matchesRole && matchesAvailability;
  });

  const handleSaveStaff = async () => {
    if (!newStaff.name || !newStaff.role || !newStaff.contractType) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    setSaveLoading(true);
    try {
      const avatarUrl = ''; // Using automatic initials instead of stored avatar

      // Generate a mock registration for now or let DB handle it? 
      const registration = Math.floor(100000 + Math.random() * 900000).toString();

      if (editingId) {
        // Update logic
        const { error } = await supabase.from('staff').update({
          name: newStaff.name,
          role: newStaff.role,
          contract_type: newStaff.contractType,
          hours_total: newStaff.hoursTotal,
          avatar: avatarUrl,
        }).eq('id', editingId);
        if (error) throw error;
        alert('Servidor atualizado com sucesso!');
      } else {
        // Create logic
        const { error } = await supabase.from('staff').insert({
          name: newStaff.name,
          role: newStaff.role,
          contract_type: newStaff.contractType,
          hours_total: newStaff.hoursTotal,
          hours_available: newStaff.hoursTotal, // Initially full available
          avatar: avatarUrl,
          registration: registration
        });
        if (error) throw error;
        alert('Servidor cadastrado com sucesso!');
      }

      setNewStaff({ name: '', role: '', contractType: '', hoursTotal: 100, avatar: '' });
      setEditingId(null);
      await fetchStaff();
      setView('list');

    } catch (e) {
      console.error(e);
      alert('Erro ao salvar servidor.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este servidor? Todas as lotações vinculadas serão removidas.')) return;
    try {
      // Manual Cascade: Delete allotments first
      const { error: allotmentError } = await supabase.from('allotments').delete().eq('staff_id', id);
      if (allotmentError) throw allotmentError;

      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;

      setStaffList(prev => prev.filter(s => s.id !== id));
      alert('Servidor excluído com sucesso!');
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao excluir servidor: ${e.message || 'Erro desconhecido'}`);
    }
    setDropdownOpenId(null);
  };

  const handleEditStaff = (staff: Staff) => {
    setNewStaff({
      name: staff.name,
      role: staff.role,
      contractType: staff.contractType,
      hoursTotal: staff.hoursTotal,
      avatar: staff.avatar || ''
    });
    setEditingId(staff.id);
    setView('create');
    setDropdownOpenId(null);
  };

  const handleViewAllotment = async (staffId: string) => {
    setDropdownOpenId(null);
    setViewAllotmentId(staffId);
    setLoadingAllotments(true);
    setStaffAllotments([]);
    setEditingAllotmentId(null); // Reset edit state
    try {
      const { data, error } = await supabase
        .from('allotments')
        .select('*')
        .eq('staff_id', staffId)
        .eq('status', 'Ativo');

      if (error) throw error;

      const enrichedData = await Promise.all((data || []).map(async (a: any) => {
        let className = 'N/A';
        if (a.class_id) {
          const { data: cls } = await supabase.from('classes').select('series, section, shift').eq('id', a.class_id).single();
          if (cls) {
            className = `${cls.series} ${cls.section ? `- ${cls.section}` : ''} - ${cls.shift}`;
          }
        }

        // Parse workload from role string "Role - 100h"
        const roleParts = (a.staff_role || '').split(' - ');
        const hours = roleParts[1] ? parseInt(roleParts[1].replace('h', '')) : 0;
        const roleBase = roleParts[0];

        return {
          ...a,
          className,
          hours, // Numeric
          roleBase // Just role name
        };
      }));

      setStaffAllotments(enrichedData);
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar lotações.');
    } finally {
      setLoadingAllotments(false);
    }
  };

  const handleUpdateWorkload = async () => {
    if (!editingAllotmentId || !viewAllotmentId) return;

    const allotment = staffAllotments.find(a => a.id === editingAllotmentId);
    if (!allotment) return;

    if (newWorkload === allotment.hours) {
      setEditingAllotmentId(null);
      return;
    }

    try {
      // 1. Fetch Fresh Staff Data
      const { data: staff, error: staffError } = await supabase.from('staff').select('*').eq('id', viewAllotmentId).single();
      if (staffError) throw staffError;

      // 2. Calculate Hours difference
      const hourDiff = newWorkload - allotment.hours; // Positive if increasing, Negative if decreasing

      // 3. Validation
      if (hourDiff > 0 && staff.hours_available < hourDiff) {
        alert(`Servidor não possui horas suficientes. Necessário: ${hourDiff}h, Disponível: ${staff.hours_available}h`);
        return;
      }

      // 4. Update Staff Hours Available
      const { error: updateStaffError } = await supabase
        .from('staff')
        .update({ hours_available: staff.hours_available - hourDiff })
        .eq('id', viewAllotmentId);

      if (updateStaffError) throw updateStaffError;

      // 5. Update Allotment (Role + Hours)
      const newRoleString = `${allotment.roleBase} - ${newWorkload}h`;
      const { error: updateAllotmentError } = await supabase
        .from('allotments')
        .update({ staff_role: newRoleString })
        .eq('id', editingAllotmentId);

      if (updateAllotmentError) {
        console.error('Failed to update allotment, potential consistency issue.', updateAllotmentError);
        throw updateAllotmentError;
      }

      alert('Carga horária atualizada com sucesso!');
      await handleViewAllotment(viewAllotmentId); // Refresh list
      await fetchStaff(); // Refresh main list background
      setEditingAllotmentId(null);
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao atualizar carga horária: ${e.message}`);
    }
  };

  if (view === 'create') {
    return (
      <div className="mx-auto max-w-4xl space-y-8 pb-10">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setView('list'); setEditingId(null); setNewStaff({ name: '', role: '', contractType: '', hoursTotal: 100, avatar: '' }); }}
            icon="arrow_back"
            className="w-fit pl-0 hover:bg-transparent"
          >
            Voltar para Listagem
          </Button>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {editingId ? 'Editar Servidor' : 'Cadastro de Servidor'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Insira as informações profissionais e de carga horária para registrar o novo servidor.</p>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <div className="space-y-6">
            {/* Nome Completo */}
            <div className="grid grid-cols-1 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome Completo</span>
                <div className="relative">
                  <input
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ex: Ana Maria Silva"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined">person</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cargo / Função</span>
                <div className="relative">
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecione o cargo</option>
                    <option>Professor de Educação Especial</option>
                    <option>Mediador</option>
                    <option>Cuidador</option>
                    <option>Professor de Braille</option>
                    <option>Professor Bilíngue</option>
                  </select>
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined pointer-events-none">expand_more</span>
                </div>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo de Vínculo</span>
                <div className="relative">
                  <select
                    value={newStaff.contractType}
                    onChange={(e) => setNewStaff({ ...newStaff, contractType: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecione o vínculo</option>
                    <option>Efetivo</option>
                    <option>Efetivo Função</option>
                    <option>Efetivo Cargo</option>
                    <option>Temporário</option>
                  </select>
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined pointer-events-none">expand_more</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Carga Horária Mensal</span>
                <div className="relative">
                  <select
                    value={newStaff.hoursTotal}
                    onChange={(e) => setNewStaff({ ...newStaff, hoursTotal: parseInt(e.target.value) })}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="100">100h</option>
                    <option value="150">150h</option>
                    <option value="200">200h</option>
                  </select>
                  <span className="absolute right-3 top-3 text-slate-400 material-symbols-outlined pointer-events-none">schedule</span>
                </div>
              </label>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button onClick={handleSaveStaff} icon="how_to_reg" isLoading={saveLoading}>
                {editingId ? 'Salvar Alterações' : 'Finalizar Cadastro'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Servidores e Disponibilidade</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie a carga horária e alocação dos profissionais da rede.</p>
        </div>
        <div className="flex gap-2">
          <BulkImporter type="staff" onSuccess={fetchStaff} label="Importar Servidores" />
          <Button onClick={() => { setView('create'); setEditingId(null); setNewStaff({ name: '', role: '', contractType: '', hoursTotal: 100, avatar: '' }); }} icon="person_add">
            Novo Servidor
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-xl">search</span>
            <input
              type="text"
              placeholder="Buscar por nome, cargo ou matrícula..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark text-sm font-medium px-4 focus:ring-1 focus:ring-primary outline-none"
          >
            <option>Todos os Cargos</option>
            <option>Professor de Educação Especial</option>
            <option>Mediador</option>
            <option>Cuidador</option>
            <option>Professor de Braille</option>
            <option>Professor Bilíngue</option>
          </select>
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark text-sm font-medium px-4 focus:ring-1 focus:ring-primary outline-none"
          >
            <option>Todas as Disponibilidades</option>
            <option>Com Disponibilidade</option>
            <option>Sem Disponibilidade</option>
            <option>Totalmente Livre</option>
          </select>
        </div>

        <div className="overflow-x-auto pb-48">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500">
              <tr>
                <th className="px-6 py-4">Servidor</th>
                <th className="px-6 py-4">Cargo</th>
                <th className="px-6 py-4">Vínculo</th>
                <th className="px-6 py-4">Carga Horária</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold text-lg ring-2 ring-slate-50 dark:ring-slate-800">
                        {(staff.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{staff.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className={`material-symbols-outlined text-lg ${staff.role.includes('Professor') ? 'text-primary' : 'text-slate-400'
                        }`}>
                        {staff.role.includes('Professor') ? 'school' : 'badge'}
                      </span>
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${staff.contractType && staff.contractType.includes('Efetivo')
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                      {staff.contractType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 w-32">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{staff.hoursAvailable}h livres</span>
                        <span className="text-slate-400">{staff.hoursTotal}h total</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${(staff.hoursAvailable / staff.hoursTotal) > 0.5 ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                          style={{ width: `${(staff.hoursAvailable / staff.hoursTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative">
                      <button
                        onClick={() => setDropdownOpenId(dropdownOpenId === staff.id ? null : staff.id)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>

                      {dropdownOpenId === staff.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1">
                          <button
                            onClick={() => handleEditStaff(staff)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(staff.id)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            Excluir
                          </button>
                          <div className="my-1 border-t border-slate-100 dark:border-slate-800"></div>
                          <button
                            onClick={() => handleViewAllotment(staff.id)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                          >
                            <span className="material-symbols-outlined text-base">assignment</span>
                            Ver Lotação
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal View Allotment */}
      {viewAllotmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">assignment_ind</span>
                Lotações Ativas
              </h2>
              <button
                onClick={() => setViewAllotmentId(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {loadingAllotments ? (
              <div className="py-12 text-center text-slate-500">Carregando informações...</div>
            ) : staffAllotments.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <span className="material-symbols-outlined text-3xl">inbox</span>
                </div>
                <p className="text-slate-500 font-medium">Este servidor não possui lotações ativas.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Escola</th>
                      <th className="px-5 py-3">Turma</th>
                      <th className="px-5 py-3">Carga Horária</th>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {staffAllotments.map((allotment) => (
                      <tr key={allotment.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="px-5 py-3 font-medium text-sm">{allotment.school_name}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{allotment.className}</td>
                        <td className="px-5 py-3">
                          {editingAllotmentId === allotment.id ? (
                            <select
                              className="w-20 p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              value={newWorkload}
                              onChange={(e) => setNewWorkload(Number(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="100">100h</option>
                              <option value="150">150h</option>
                              <option value="200">200h</option>
                            </select>
                          ) : (
                            <span className="inline-flex rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 text-xs font-bold">
                              {allotment.hours}h
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">{allotment.date}</td>
                        <td className="px-5 py-3 text-right">
                          {editingAllotmentId === allotment.id ? (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={handleUpdateWorkload}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Salvar"
                              >
                                <span className="material-symbols-outlined text-lg">check</span>
                              </button>
                              <button
                                onClick={() => setEditingAllotmentId(null)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Cancelar"
                              >
                                <span className="material-symbols-outlined text-lg">close</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingAllotmentId(allotment.id);
                                setNewWorkload(Number(allotment.hours) || 100);
                              }}
                              className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition-colors"
                              title="Alterar Carga Horária"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setViewAllotmentId(null)} variant="secondary">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPage;
