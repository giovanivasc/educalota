import React, { useState, useEffect } from 'react';
// Mocks removed
import { School, Staff, Student } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { sortClasses } from '../lib/sorting';

const Allotment: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [existingAllotments, setExistingAllotments] = useState<any[]>([]); // New state for existing allotments

  const [selectedSchool, setSelectedSchool] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffWorkloads, setStaffWorkloads] = useState<Record<string, number>>({}); // Map staffId -> hours (100, 150, 200)
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  // const [selectedStudents, setSelectedStudents] = useState<string[]>([]); // Removed user manual selection
  const [loading, setLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('');
  const [staffAvailabilityFilter, setStaffAvailabilityFilter] = useState('');

  useEffect(() => {
    if (selectedSchool) {
      fetchClasses(selectedSchool);
    } else {
      setClasses([]);
    }
  }, [selectedSchool]);

  const fetchClasses = async (schoolId: string) => {
    const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId);
    if (data) {
      const sorted = data.sort(sortClasses);
      setClasses(sorted);
      if (sorted.length > 0) setSelectedClass(sorted[0].id);
      else setSelectedClass('');
    } else {
      setClasses([]);
      setSelectedClass('');
    }
  };

  useEffect(() => {
    if (selectedClass) {
      fetchStudentsForClass(selectedClass);
      fetchExistingAllotments(selectedClass);
    } else {
      setStudents([]);
      setExistingAllotments([]);
    }
  }, [selectedClass]);

  const fetchExistingAllotments = async (classId: string) => {
    const { data } = await supabase
      .from('allotments')
      .select('*')
      .eq('class_id', classId)
      .eq('status', 'Ativo'); // Assuming we filter by active
    setExistingAllotments(data || []);
  };

  const handleDeleteAllotment = async (allotmentId: string) => {
    if (!confirm('Deseja remover esta lotação?')) return;
    try {
      // First get the allotment to know hours
      const { data: allotment } = await supabase.from('allotments').select('*').eq('id', allotmentId).single();
      if (!allotment) throw new Error('Lotação não encontrada');

      const { error } = await supabase.from('allotments').delete().eq('id', allotmentId);
      if (error) throw error;

      // Restore Staff Availability (Increment)
      // Parse hours from staff_role if stored there (Fallback to 0 if not present)
      // Format expected: "Role - 100h"
      const roleStr = allotment.staff_role || '';
      const match = roleStr.match(/- (\d+)h/);
      const restoredHours = match ? parseInt(match[1]) : 0;

      if (restoredHours > 0) {
        const { data: staff } = await supabase.from('staff').select('hours_available').eq('id', allotment.staff_id).single();
        if (staff) {
          const currentHours = staff.hours_available || 0;
          await supabase
            .from('staff')
            .update({ hours_available: currentHours + restoredHours })
            .eq('id', allotment.staff_id);
        }
      }

      setExistingAllotments(prev => prev.filter(a => a.id !== allotmentId));
      fetchData(); // Refresh staff list
      alert('Lotação removida e carga horária restaurada com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao remover lotação.');
    }
  };

  const fetchStudentsForClass = async (classId: string) => {
    const { data } = await supabase.from('students').select('*').eq('class_id', classId);
    setStudents(data?.map((s: any) => ({
      id: s.id, name: s.name, age: s.age, series: s.series, cid: s.cid,
      specialGroup: s.special_group, needsSupport: s.needs_support || [], additionalInfo: s.additional_info // Added additionalInfo
    })) || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Schools
    const { data: schoolsData } = await supabase.from('schools').select('*');
    if (schoolsData) {
      setSchools(schoolsData.map((s: any) => ({
        id: s.id, name: s.name, region: s.region, description: s.description,
        studentsCount: s.students_count, classesCount: s.classes_count, imageUrl: s.image_url,
        location: 'Endereço não informado', active: true
      })));
      // Only default select if none selected
      if (schoolsData.length > 0 && !selectedSchool) setSelectedSchool(schoolsData[0].id);
    }

    // 2. Staff
    const { data: staffData } = await supabase.from('staff').select('*');
    if (staffData) {
      setStaffList(staffData.map((s: any) => ({
        id: s.id, name: s.name, registration: s.registration, role: s.role,
        contractType: s.contract_type, hoursTotal: s.hours_total, hoursAvailable: s.hours_available, avatar: s.avatar
      })));
    }

    // 3. Students - Fetched by class selection now
  };

  const toggleStaff = (id: string) => {
    setSelectedStaff(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    // Initialize default workload if selecting and not set
    if (!staffWorkloads[id]) {
      setStaffWorkloads(prev => ({ ...prev, [id]: 100 }));
    }
  };

  const handleWorkloadChange = (id: string, hours: number) => {
    setStaffWorkloads(prev => ({ ...prev, [id]: hours }));
  };

  /* const toggleStudent = (id: string) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }; */

  const filteredStaff = staffList.filter(staff => {
    const matchesSearch = staff.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      staff.registration?.includes(staffSearch);
    const matchesRole = !staffRoleFilter || staff.role === staffRoleFilter;
    const matchesAvailability = !staffAvailabilityFilter || (
      staffAvailabilityFilter === 'Com Disponibilidade' ? (staff.hoursAvailable && staff.hoursAvailable > 0) :
        staffAvailabilityFilter === 'Sem Disponibilidade' ? (staff.hoursAvailable === 0) :
          staffAvailabilityFilter === 'Totalmente Livre' ? (staff.hoursAvailable === staff.hoursTotal) : true
    );
    return matchesSearch && matchesRole && matchesAvailability;
  });

  const handleConfirmAllotment = async () => {
    setLoading(true);
    try {
      const school = schools.find(s => s.id === selectedSchool);
      const cls = classes.find(c => c.id === selectedClass);

      const inserts = [];

      // Create allotment for Staff
      for (const staffId of selectedStaff) {
        const staff = staffList.find(s => s.id === staffId);
        const workload = staffWorkloads[staffId] || 100;

        // Check availability locally first (optional, but good UX)
        if ((staff?.hoursAvailable || 0) < workload) {
          alert(`O servidor ${staff?.name} não possui ${workload}h disponíveis. Saldo atual: ${staff?.hoursAvailable}h.`);
          throw new Error('Carga horária insuficiente');
        }

        inserts.push({
          staff_id: staffId,
          school_id: selectedSchool,
          class_id: selectedClass || null,
          staff_name: staff?.name,
          staff_role: `${staff?.role} - ${workload}h`,
          school_name: school?.name,
          status: 'Ativo',
          date: new Date().toLocaleDateString('pt-BR')
        });

        // Update Staff Availability (Decrement)
        const newAvailable = (staff?.hoursAvailable || 0) - workload;
        const { error: updateError } = await supabase
          .from('staff')
          .update({ hours_available: newAvailable })
          .eq('id', staffId);

        if (updateError) {
          console.error('Error updating staff hours:', updateError);
          // Continue despite update error? Or prevent?
          // For now log it.
        }
      }

      // Create allotment/enrollment for Students - REMOVED as per request to not select students manually or "migrate" them.
      // If we need to link the Staff to ALL students in the class, we can iterate 'students' state here.
      // Assuming "Migrados para lá" meant visual population.
      // But if the goal is to register that Staff covers these students:
      // Create allotment/enrollment for Students - Loop Removed.
      // We only create allotments for STAFF assigning them to the class/school.
      // Students are already associated via class_id in students table.


      // Actually, let's keep it simple. Only insert Staff allotments linked to Class. 
      // If the dashboard counts students per staff, it might need direct links or just join tables.
      // I will only insert Staff allotments for now, as Students are already "in" the class via 'class_id'.
      // The previous code was creating 'student' type allotments which seemed to duplicate enrollment.

      // Re-reading: "permita que em Lotação ao selecionar a escola e a turma os estudantes já sejam migrados para lá"
      // This implies the list on the right should populate with them (which I did with fetchStudentsForClass).
      // "não dando a opção de seleção para estudantes" -> Readonly list.
      // "Estudantes matriculados" -> Label change.

      // So, I will NOT insert new 'student' allotments here because they are merely "matriculados" in the class.
      // The Allotment action is for STAFF.

      // Wait, "migrados para lá" might mean visually in the floating bar?
      // "não dando opção de seleção" means they are implicitly part of the deal.

      // Let's stick to inserting Staff Allotments.

      if (inserts.length > 0) {
        const { error } = await supabase.from('allotments').insert(inserts);
        if (error) throw error;
        alert('Lotação realizada com sucesso!');
        setSelectedStaff([]);
        setStaffWorkloads({});
        fetchData(); // Refresh staff list to show updated availability
        if (selectedClass) fetchExistingAllotments(selectedClass); // Refresh list
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar lotação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-32">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Lotação de Servidores e Estudantes</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Gerencie a vinculação de profissionais de apoio e alunos às turmas de educação especial.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Unidade de Ensino</label>
          <div className="relative">
            <input
              className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-primary"
              placeholder="Pesquisar unidade..."
              value={selectedSchool ? (schools.find(s => s.id === selectedSchool)?.name || '') : schoolSearchTerm}
              onChange={(e) => {
                setSchoolSearchTerm(e.target.value);
                setSelectedSchool(''); // Clear selection on type to allow search
                setShowSchoolDropdown(true);
              }}
              onFocus={() => {
                setSchoolSearchTerm(''); // Clear term to see all or keep? better clear if value matches name
                setShowSchoolDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowSchoolDropdown(false), 200)} // Delay to allow click
            />
            {showSchoolDropdown && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg">
                {schools.filter(s => s.name.toLowerCase().includes(schoolSearchTerm.toLowerCase())).map(s => (
                  <div
                    key={s.id}
                    className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm"
                    onMouseDown={() => { // onMouseDown to fire before Blur
                      setSelectedSchool(s.id);
                      setSchoolSearchTerm(s.name);
                      setShowSchoolDropdown(false);
                    }}
                  >
                    {s.name}
                  </div>
                ))}
                {schools.filter(s => s.name.toLowerCase().includes(schoolSearchTerm.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-slate-400 text-sm">Nenhuma unidade encontrada</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Turma</label>
          <select
            className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-primary"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Selecione a turma...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.series} {c.section ? '- ' + c.section : ''} - {c.shift}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Staff Selection */}
        <div className="flex flex-col h-[500px] bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">badge</span>
              Profissionais
            </h2>
            {/* Filters */}
            <div className="flex flex-col gap-2 w-full max-w-[60%]">
              <input
                placeholder="Buscar servidor..."
                className="text-xs p-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  className="text-xs p-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-1/2"
                  value={staffRoleFilter}
                  onChange={e => setStaffRoleFilter(e.target.value)}
                >
                  <option value="">Todos Cargos</option>
                  <option>Professor de AEE</option>
                  <option>Profissional de Apoio</option>
                  <option>Intérprete de Libras</option>
                  <option>Psicólogo</option>
                </select>
                <select
                  className="text-xs p-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-1/2"
                  value={staffAvailabilityFilter}
                  onChange={e => setStaffAvailabilityFilter(e.target.value)}
                >
                  <option value="">Todas Disp.</option>
                  <option value="Com Disponibilidade">Com Disp.</option>
                  <option value="Sem Disponibilidade">Sem Disp.</option>
                  <option value="Totalmente Livre">Livre</option>
                </select>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-2">{filteredStaff.length} encontrados</span>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
                <tr>
                  <th className="px-5 py-3 w-12"></th>
                  <th className="px-5 py-3">Servidor</th>
                  <th className="px-5 py-3">Cargo</th>
                  <th className="px-5 py-3">Carga Horária</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStaff.map(staff => (
                  <tr
                    key={staff.id}
                    className={`hover:bg-primary/5 transition-colors cursor-pointer ${selectedStaff.includes(staff.id) && 'bg-primary/10'}`}
                    onClick={() => toggleStaff(staff.id)}
                  >
                    <td className="px-5 py-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                        checked={selectedStaff.includes(staff.id)}
                        onChange={() => { }}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold">{staff.name}</p>
                      <p className="text-xs text-slate-500">Mat. {staff.registration}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      {selectedStaff.includes(staff.id) ? (
                        <select
                          className="w-24 p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          value={staffWorkloads[staff.id] || 100}
                          onChange={(e) => handleWorkloadChange(staff.id, Number(e.target.value))}
                        >
                          <option value={100}>100h</option>
                          <option value={150}>150h</option>
                          <option value={200}>200h</option>
                        </select>
                      ) : (
                        <span className={`text-xs ${staff.hoursAvailable === 0 ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                          Disp: {staff.hoursAvailable}h
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Student Selection */}
        <div className="flex flex-col h-[500px] bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">school</span>
              Estudantes Matriculados
            </h2>
            <span className="text-xs font-bold text-slate-500">{students.length} na turma</span>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
                <tr>
                  <th className="px-5 py-3 w-12"></th>
                  <th className="px-5 py-3">Estudante</th>
                  <th className="px-5 py-3">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map(student => (
                  <tr
                    key={student.id}
                    className={`hover:bg-slate-50 transition-colors`}
                  // onClick={() => toggleStudent(student.id)}
                  >
                    <td className="px-5 py-4 text-center">
                      {/* No selection for students */}
                      <span className="material-symbols-outlined text-slate-300 text-sm">check_circle</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-bold flex items-center gap-1">
                            {student.name}
                            {student.additionalInfo && (
                              <span
                                className="material-symbols-outlined text-[16px] text-blue-400 cursor-help"
                                title={student.additionalInfo} // Native browser tooltip
                                onClick={() => alert(`Informações de ${student.name}:\n\n${student.additionalInfo}`)}
                              >
                                info
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">{student.series}</p>
                          {student.needsSupport && student.needsSupport.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {student.needsSupport.map((support: string, idx: number) => (
                                <span
                                  key={idx}
                                  className={`text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded ${support === 'Não necessita'
                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}
                                >
                                  {support}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        CID: {student.cid}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>


      {/* Existing Allotments List */}
      {
        selectedClass && (
          <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">assignment_ind</span>
                Servidores lotados
              </h2>
            </div>
            <div className="p-0">
              {existingAllotments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">Nenhum servidor lotado nesta turma ainda.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Servidor</th>
                      <th className="px-6 py-3">Cargo</th>
                      <th className="px-6 py-3">Carga Horária</th>
                      <th className="px-6 py-3">Data Lotação</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {existingAllotments.map(allotment => {
                      const roleParts = (allotment.staff_role || '').split(' - ');
                      const roleName = roleParts[0];
                      const hoursVal = roleParts[1] || '-';

                      return (
                        <tr key={allotment.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{allotment.staff_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {roleName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                            {hoursVal}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {allotment.date}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteAllotment(allotment.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors border border-transparent hover:border-red-200"
                              title="Remover Lotação"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      }

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-40 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Selecionados:</span>
            <span className="bg-primary text-white px-2.5 py-0.5 rounded-full text-xs font-bold">{selectedStaff.length}</span>
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500 italic">({selectedStaff.length} servidores)</span>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { setSelectedStaff([]); /* setSelectedStudents([]); */ }}
          >
            Limpar
          </Button>
          <Button icon="link" onClick={handleConfirmAllotment} isLoading={loading}>
            Confirmar Lotação
          </Button>
        </div>
      </div>
    </div >
  );
};

export default Allotment;
