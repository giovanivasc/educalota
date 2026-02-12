import React, { useState, useEffect, useRef, useMemo } from 'react';
// Mocks removed
import { School, Staff, Student } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { sortClasses } from '../lib/sorting';
import { normalizeText } from '../lib/stringUtils';
import { generateExcel, generateDoc, generatePDF, generatePendingPDF, generateRealizedPDF } from '../lib/reports';

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
  const [selectedShift, setSelectedShift] = useState(''); // New state for shift filter
  const [classObs, setClassObs] = useState(''); // New state for class observations
  const [savingObs, setSavingObs] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [allotmentDate, setAllotmentDate] = useState('2026-02-19'); // Default fixed date per user request
  const [vacancyRole, setVacancyRole] = useState('Mediador'); // New state for vacancy role registration
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingAllotments, setPendingAllotments] = useState<any[]>([]);
  const pendingClassTarget = useRef<string | null>(null);

  // States for Pending Modal Filtering
  const [pendingRoleFilter, setPendingRoleFilter] = useState('');
  const [pendingSchoolFilter, setPendingSchoolFilter] = useState('');
  const [pendingModalityFilter, setPendingModalityFilter] = useState('');
  const [pendingSeriesFilter, setPendingSeriesFilter] = useState('');
  const [pendingShiftFilter, setPendingShiftFilter] = useState('');
  const [pendingDateFilter, setPendingDateFilter] = useState('all'); // all, week, month, custom
  const [pendingStartDate, setPendingStartDate] = useState('');
  const [pendingEndDate, setPendingEndDate] = useState('');

  // States for Realized Modal
  const [showRealizedModal, setShowRealizedModal] = useState(false);
  const [realizedAllotments, setRealizedAllotments] = useState<any[]>([]);
  // States for Realized Modal Filtering
  const [realizedRoleFilter, setRealizedRoleFilter] = useState('');
  const [realizedDateFilter, setRealizedDateFilter] = useState('all');
  const [realizedStartDate, setRealizedStartDate] = useState('');
  const [realizedEndDate, setRealizedEndDate] = useState('');

  // Filter Logic for Realized Allotments
  const filteredRealizedAllotments = useMemo(() => {
    return realizedAllotments.filter(item => {
      // Role Filter (matches part of the string e.g. "Mediador" in "Mediador - 100h")
      if (realizedRoleFilter && !item.staff_role.includes(realizedRoleFilter)) return false;

      if (realizedDateFilter !== 'all') {
        const itemDateParts = (item.date || '').split('/');
        if (itemDateParts.length !== 3) return false;

        const itemDate = new Date(
          parseInt(itemDateParts[2]),
          parseInt(itemDateParts[1]) - 1,
          parseInt(itemDateParts[0])
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (realizedDateFilter === 'week') {
          const lastWeek = new Date(today);
          lastWeek.setDate(today.getDate() - 7);
          if (itemDate < lastWeek) return false;
        } else if (realizedDateFilter === 'month') {
          const lastMonth = new Date(today);
          lastMonth.setMonth(today.getMonth() - 1);
          if (itemDate < lastMonth) return false;
        } else if (realizedDateFilter === 'custom') {
          if (realizedStartDate) {
            const [y, m, d] = realizedStartDate.split('-').map(Number);
            const start = new Date(y, m - 1, d);
            if (itemDate < start) return false;
          }
          if (realizedEndDate) {
            const [y, m, d] = realizedEndDate.split('-').map(Number);
            const end = new Date(y, m - 1, d);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) return false;
          }
        }
      }
      return true;
    });
  }, [realizedAllotments, realizedRoleFilter, realizedDateFilter, realizedStartDate, realizedEndDate]);

  const handlePrintRealized = () => {
    let periodText = "Período: Geral";
    if (realizedDateFilter === 'week') periodText = "Período: Última Semana";
    if (realizedDateFilter === 'month') periodText = "Período: Último Mês";
    if (realizedDateFilter === 'custom') {
      const startStr = realizedStartDate ? realizedStartDate.split('-').reverse().join('/') : '...';
      const endStr = realizedEndDate ? realizedEndDate.split('-').reverse().join('/') : '...';
      periodText = `Período: ${startStr} a ${endStr}`;
    }

    generateRealizedPDF(filteredRealizedAllotments, periodText);
  };


  const filteredPendingAllotments = useMemo(() => {
    return pendingAllotments.filter(item => {
      // Role Filter
      if (pendingRoleFilter && item.staff_role !== pendingRoleFilter) return false;

      // School Filter (match part of name)
      if (pendingSchoolFilter && !normalizeText(item.school_name || '').includes(normalizeText(pendingSchoolFilter))) return false;

      // Modality Filter
      if (pendingModalityFilter && item.classDetails?.modality !== pendingModalityFilter) return false;

      // Series Filter (match part of series name)
      if (pendingSeriesFilter && !normalizeText(item.classDetails?.series || '').includes(normalizeText(pendingSeriesFilter))) return false;

      // Shift Filter
      if (pendingShiftFilter && item.classDetails?.shift !== pendingShiftFilter) return false;


      if (pendingDateFilter !== 'all') {
        const itemDateParts = (item.date || '').split('/');
        if (itemDateParts.length !== 3) return false;

        // Parse DD/MM/YYYY
        const itemDate = new Date(
          parseInt(itemDateParts[2]),
          parseInt(itemDateParts[1]) - 1,
          parseInt(itemDateParts[0])
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (pendingDateFilter === 'week') {
          const lastWeek = new Date(today);
          lastWeek.setDate(today.getDate() - 7);
          if (itemDate < lastWeek) return false;
        } else if (pendingDateFilter === 'month') {
          const lastMonth = new Date(today);
          lastMonth.setMonth(today.getMonth() - 1);
          if (itemDate < lastMonth) return false;
        } else if (pendingDateFilter === 'custom') {
          if (pendingStartDate) {
            // Fix: Parse YYYY-MM-DD from input explicitly to avoid timezone issues with Date constructor string parsing
            const [y, m, d] = pendingStartDate.split('-').map(Number);
            const start = new Date(y, m - 1, d);
            if (itemDate < start) return false;
          }
          if (pendingEndDate) {
            const [y, m, d] = pendingEndDate.split('-').map(Number);
            const end = new Date(y, m - 1, d);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) return false;
          }
        }
      }
      return true;
    });
  }, [pendingAllotments, pendingRoleFilter, pendingDateFilter, pendingStartDate, pendingEndDate, pendingSchoolFilter, pendingModalityFilter, pendingSeriesFilter, pendingShiftFilter]);

  const handlePrintPending = () => {
    let periodText = "Período: Geral";
    if (pendingDateFilter === 'week') periodText = "Período: Última Semana";
    if (pendingDateFilter === 'month') periodText = "Período: Último Mês";
    if (pendingDateFilter === 'custom') {
      const startStr = pendingStartDate ? pendingStartDate.split('-').reverse().join('/') : '...';
      const endStr = pendingEndDate ? pendingEndDate.split('-').reverse().join('/') : '...';
      periodText = `Período: ${startStr} a ${endStr}`;
    }

    generatePendingPDF(filteredPendingAllotments, periodText);
  };

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

      // Check if we have a pending target class to select
      if (pendingClassTarget.current) {
        const targetExists = sorted.find(c => c.id === pendingClassTarget.current);
        if (targetExists) {
          setSelectedClass(pendingClassTarget.current);
        } else if (sorted.length > 0) {
          setSelectedClass(sorted[0].id);
        }
        pendingClassTarget.current = null; // Reset target
      } else if (sorted.length > 0) {
        setSelectedClass(sorted[0].id);
      } else {
        setSelectedClass('');
      }
    } else {
      setClasses([]);
      setSelectedClass('');
    }
  };

  const fetchPendingAllotments = async () => {
    setLoading(true);
    try {
      // Fetch allotments marked as available/vacancy
      const { data: allotments } = await supabase
        .from('allotments')
        .select('*')
        .eq('staff_name', 'Disponível')
        .eq('status', 'Ativo');

      if (!allotments || allotments.length === 0) {
        setPendingAllotments([]);
        return;
      }

      // Get unique class IDs to fetch details
      const classIds = [...new Set(allotments.map(a => a.class_id))];

      // Fetch class details
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, series, section, shift, obs, modality')
        .in('id', classIds);

      // Merge data
      const merged = allotments.map(a => {
        const classInfo = classesData?.find(c => c.id === a.class_id);
        return {
          ...a,
          classDetails: classInfo
        };
      });

      setPendingAllotments(merged);
    } catch (error) {
      console.error('Error fetching pending allotments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealizedAllotments = async () => {
    setLoading(true);
    try {
      // Fetch active allotments that are NOT vacancies
      const { data: allotments } = await supabase
        .from('allotments')
        .select('*')
        .neq('staff_name', 'Disponível')
        .eq('status', 'Ativo');

      if (!allotments || allotments.length === 0) {
        setRealizedAllotments([]);
        return;
      }

      // Unique IDs
      const schoolIds = [...new Set(allotments.map(a => a.school_id).filter(Boolean))];
      const staffIds = [...new Set(allotments.map(a => a.staff_id).filter(Boolean))];

      // Fetch details in parallel
      const [classesRes, staffRes] = await Promise.all([
        supabase.from('classes').select('*').in('school_id', schoolIds),
        supabase.from('staff').select('id, contract_type').in('id', staffIds)
      ]);

      const classesData = classesRes.data || [];
      const staffData = staffRes.data || [];



      // Merge
      const merged = allotments.map(a => {
        const classInfo = classesData.find(c => c.id === a.class_id);
        const staffInfo = staffData.find(s => s.id === a.staff_id);
        const staffDetails = staffInfo ? { contractType: staffInfo.contract_type } : null;

        return {
          ...a,
          classDetails: classInfo,
          staffDetails
        };
      });

      setRealizedAllotments(merged);
    } catch (error) {
      console.error('Error fetching realized allotments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolvePending = (schoolId: string, classId: string) => {
    pendingClassTarget.current = classId;
    setSelectedSchool(schoolId); // This triggers fetchClasses via useEffect
    setShowPendingModal(false);
  };

  // Auto-save effect for observation
  useEffect(() => {
    if (!selectedClass) return;

    // Don't save on initial load (empty or matching DB content handled by not setting dirty flag or just comparing?)
    // Simplest debounce:
    const timer = setTimeout(async () => {
      // Only update if we have a valid class and value changed (Supabase won't error if same but efficient to check? 
      // Actually comparing with 'classes' state is hard since we update 'classes' only on save.
      // Let's just save.
      setSavingObs(true);
      try {
        await supabase.from('classes').update({ obs: classObs }).eq('id', selectedClass);
        // Update local classes store to reflect saved state
        setClasses(prev => prev.map(c => c.id === selectedClass ? { ...c, obs: classObs } : c));
      } catch (err) {
        console.error("Auto-save obs error", err);
      } finally {
        setSavingObs(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [classObs, selectedClass]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudentsForClass(selectedClass);
      fetchExistingAllotments(selectedClass);
      // Load observation
      const cls = classes.find(c => c.id === selectedClass);
      // We only set if it's different to avoid loop with the auto-save effect above if not careful
      // But selecting class changes selectedClass, triggering this.
      // We should probably safeguard the auto-save to not run immediately on selection change if value is just loaded.
      // However, setting state here will trigger the other effect.
      // A common pattern is using a ref 'isLoaded' or ensuring the first render doesn't save.
      // But given simpler requirements:
      setClassObs(cls?.obs || '');
    } else {
      setStudents([]);
      setExistingAllotments([]);
      setClassObs('');
    }
  }, [selectedClass]); // Removed 'classes' from deps to avoid re-triggering when we update local state after save

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
      id: s.id, name: s.name, birthDate: s.birth_date, series: s.series, cid: s.cid,
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
      // if (schoolsData.length > 0 && !selectedSchool) setSelectedSchool(schoolsData[0].id); // DISABLED auto-select
    }

    // 2. Staff
    const { data: staffData } = await supabase.from('staff').select('*');
    if (staffData) {
      setStaffList(staffData.map((s: any) => ({
        id: s.id, name: s.name, registration: s.registration, role: s.role,
        contractType: s.contract_type, hoursTotal: s.hours_total, hoursAvailable: s.hours_available, avatar: s.avatar,
        observations: s.observations
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
    const matchesSearch = normalizeText(staff.name).includes(normalizeText(staffSearch)) ||
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
        // Bypass availability check if we are dealing with overtime logic expansion (150 -> 200) handled by system rules?
        // Use user logic: 150h base, expansion to 200h (50h overtime).
        // If current available is < workload, check if this fits the expansion criteria.
        // Actually the availability in database should reflect the 200h cap if updated correctly.
        // Assuming staff.hours_available tracks the remaining from TOTAL (which might be 150 or 200).
        // Let's trust existing validation for now, or assume 200h total for these roles was set in Staff page.

        if ((staff?.hoursAvailable || 0) < workload) {
          alert(`O servidor ${staff?.name} não possui ${workload}h disponíveis. Saldo atual: ${staff?.hoursAvailable}h.`);
          continue; // Skip this staff instead of throwing entire error
        }

        // --- Logic for Overtime (Mediador/Cuidador) ---
        let finalRoleString = `${staff?.role} - ${workload}h`;
        const isSpecialRole = ['Mediador', 'Cuidador'].includes(staff?.role);

        // Fetch current active allotments to check hierarchy
        const { data: currentAllotments } = await supabase
          .from('allotments')
          .select('id, class_id, staff_role')
          .eq('staff_id', staffId)
          .eq('status', 'Ativo');

        // Validação de Turno Duplicado
        const newClassShift = cls?.shift;
        if (newClassShift && currentAllotments && currentAllotments.length > 0) {
          let conflictSync = false;
          for (const existAllot of currentAllotments) {
            if (!existAllot.class_id) continue;
            // Busca o turno da turma existente
            const { data: existClass } = await supabase.from('classes').select('shift').eq('id', existAllot.class_id).single();
            if (existClass && existClass.shift === newClassShift) {
              conflictSync = true;
              break;
            }
          }

          if (conflictSync) {
            alert(`O servidor ${staff?.name} já possui uma lotação no turno ${newClassShift}.`);
            continue;
          }
        }

        if (isSpecialRole && currentAllotments && currentAllotments.length > 0) {
          // Get shift weights
          const shiftWeight: Record<string, number> = { 'Manhã': 1, 'Tarde': 2, 'Noite': 3, 'Integral': 4 };

          // New Class Shift
          const newClassShift = cls?.shift || 'Manhã';
          const newWeight = shiftWeight[newClassShift] || 0;

          // Check current total hours to see if we reached 200h cap scenario
          // Extract current hours sum
          const currentHoursSum = currentAllotments.reduce((acc, curr) => {
            const m = (curr.staff_role || '').match(/- (\d+)h/);
            return acc + (m ? parseInt(m[1]) : 0);
          }, 0);

          if (currentHoursSum + workload >= 200) {
            const overtimeSuffix = ' (50h em regime de hora extra)';
            let updatedOld = false;

            for (const existing of currentAllotments) {
              // Fetch class for existing allotment to know shift
              if (existing.class_id) {
                const { data: existingClass } = await supabase.from('classes').select('shift').eq('id', existing.class_id).single();
                if (existingClass) {
                  const oldWeight = shiftWeight[existingClass.shift] || 0;

                  // Compare Logic
                  if (newWeight > oldWeight) {
                    // New is later (inferior) -> New gets overtime
                    // Check if not already added to avoid duplication if logic runs multiple times (unlikely here)
                    if (!finalRoleString.includes(overtimeSuffix)) {
                      finalRoleString += overtimeSuffix;
                    }
                  } else if (oldWeight > newWeight) {
                    // Old is later -> Old gets overtime
                    // We need to update the existing allotment in DB
                    if (!existing.staff_role.includes(overtimeSuffix)) {
                      const newOldRole = existing.staff_role + overtimeSuffix;
                      await supabase.from('allotments').update({ staff_role: newOldRole }).eq('id', existing.id);
                      updatedOld = true;
                    }
                  }
                  // If weights equal? (e.g. Afternoon + Afternoon). Usually shouldn't happen for same person, but if so, maybe just mark the new one as extra.
                  else if (newWeight === oldWeight) {
                    finalRoleString += overtimeSuffix;
                  }
                }
              }
            }
          }
        }

        inserts.push({
          staff_id: staffId,
          school_id: selectedSchool,
          class_id: selectedClass || null,
          staff_name: staff?.name,
          staff_role: finalRoleString,
          school_name: school?.name,
          status: 'Ativo',
          date: allotmentDate.split('-').reverse().join('/') // Convert YYYY-MM-DD to DD/MM/YYYY for storage
        });

        // Update Staff Availability (Decrement)
        const newAvailable = (staff?.hoursAvailable || 0) - workload;
        const { error: updateError } = await supabase
          .from('staff')
          .update({ hours_available: newAvailable })
          .eq('id', staffId);

        if (updateError) {
          console.error('Error updating staff hours:', updateError);
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

  const handleSaveObs = async () => {
    if (!selectedClass) return;
    setSavingObs(true);
    try {
      const { error } = await supabase
        .from('classes')
        .update({ obs: classObs })
        .eq('id', selectedClass);

      if (error) throw error;

      // Update local state
      setClasses(prev => prev.map(c => c.id === selectedClass ? { ...c, obs: classObs } : c));
      alert('Observação salva com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar observação.');
    } finally {
      setSavingObs(false);
    }
  };

  const handleAddVacancy = async () => {
    if (!selectedSchool || !selectedClass) return;

    setLoading(true);
    try {
      const school = schools.find(s => s.id === selectedSchool);

      // Insert Vacancy
      const { error } = await supabase.from('allotments').insert({
        staff_id: null,
        school_id: selectedSchool,
        class_id: selectedClass,
        staff_name: 'Disponível',
        staff_role: vacancyRole,
        school_name: school?.name,
        status: 'Ativo',
        date: allotmentDate.split('-').reverse().join('/')
      });

      if (error) throw error;

      alert('Necessidade registrada com sucesso!');
      fetchExistingAllotments(selectedClass);
    } catch (e) {
      console.error(e);
      alert('Erro ao registrar necessidade.');
    } finally {
      setLoading(false);
    }
  };

  const isSelectionLocked = !!(selectedSchool && selectedClass && selectedStaff.length > 0);
  const lockMessage = isSelectionLocked ? "Desmarque os servidores selecionados ou confirme a lotação para alterar a escola/turma." : "";

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-32">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Lotação de Servidores e Estudantes</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Gerencie a vinculação de profissionais de apoio e alunos às turmas de educação especial.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Unidade de Ensino</label>
          <div className="relative">
            <input
              disabled={isSelectionLocked}
              className={`w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-primary ${isSelectionLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="Pesquisar unidade..."
              title={isSelectionLocked ? lockMessage : "Selecionar Unidade de Ensino"}
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
                {schools.filter(s => normalizeText(s.name).includes(normalizeText(schoolSearchTerm))).map(s => (
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
                {schools.filter(s => normalizeText(s.name).includes(normalizeText(schoolSearchTerm))).length === 0 && (
                  <div className="px-4 py-3 text-slate-400 text-sm">Nenhuma unidade encontrada</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Filtro de Turno</label>
          <select
            className={`w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-primary ${isSelectionLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isSelectionLocked ? lockMessage : "Selecionar Turno"}
            disabled={isSelectionLocked}
            value={selectedShift}
            onChange={(e) => {
              setSelectedShift(e.target.value);
              setSelectedClass(''); // Clear class when shift changes to force re-selection
            }}
          >
            <option value="">Todos os Turnos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
            <option value="Noite">Noite</option>
            <option value="Integral">Integral</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Turma</label>
          <select
            className={`w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-primary ${isSelectionLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isSelectionLocked ? lockMessage : "Selecionar Turma"}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={!selectedSchool || isSelectionLocked}
          >
            <option value="">Selecione a turma...</option>
            {classes
              .filter(c => !selectedShift || c.shift === selectedShift)
              .map(c => (
                <option key={c.id} value={c.id}>{c.series} {c.section ? '- ' + c.section : ''} - {c.shift}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Class Observations */}
      {selectedClass && (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Observações da Turma</label>
              {savingObs && <span className="text-xs text-slate-400 animate-pulse">Salvando...</span>}
            </div>
            <textarea
              className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-1 focus:ring-primary resize-y"
              placeholder="Adicione observações importantes sobre esta turma e sua lotação..."
              value={classObs}
              onChange={(e) => setClassObs(e.target.value)}
            />
          </div>
        </div>
      )
      }

      <div className="flex justify-end relative">
        <Button
          variant="outline"
          size="sm"
          icon="description"
          onClick={() => setShowReportMenu(!showReportMenu)}
          disabled={!selectedSchool}
        >
          Gerar Pré-Lotação
        </Button>

        <Button
          variant="ghost"
          className="ml-2 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
          icon="warning"
          onClick={() => {
            fetchPendingAllotments();
            setShowPendingModal(true);
          }}
        >
          Lotações Pendentes
        </Button>

        <Button
          variant="ghost"
          className="ml-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          icon="check_circle"
          onClick={() => {
            fetchRealizedAllotments();
            setShowRealizedModal(true);
          }}
        >
          Lotações Realizadas
        </Button>

        {showReportMenu && (
          <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 overflow-hidden">
            <button
              className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              onClick={() => {
                if (selectedSchool) generateDoc(selectedSchool, "2026");
                setShowReportMenu(false);
              }}
            >
              <span className="material-symbols-outlined text-base">description</span>
              Baixar .DOCX
            </button>
            <button
              className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              onClick={() => {
                if (selectedSchool) generatePDF(selectedSchool, "2026");
                setShowReportMenu(false);
              }}
            >
              <span className="material-symbols-outlined text-base">print</span>
              Imprimir / PDF
            </button>
          </div>
        )}
      </div>

      {/* Pending Allotments Modal */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-primary/5">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">pending_actions</span>
                Lotações Pendentes (Vagas Sinalizadas)
              </h2>
              <button
                onClick={() => setShowPendingModal(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Filters Bar */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 flex flex-col gap-4">
              {/* Row 1: Primary Filters */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1 w-48">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Escola</label>
                  <input
                    className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Filtrar escola..."
                    value={pendingSchoolFilter}
                    onChange={e => setPendingSchoolFilter(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1 w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Modalidade</label>
                  <select
                    className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                    value={pendingModalityFilter}
                    onChange={e => setPendingModalityFilter(e.target.value)}
                  >
                    <option value="">Todas</option>
                    <option value="Educação Infantil">Ed. Infantil</option>
                    <option value="Ensino Fundamental - Anos Iniciais">Anos Iniciais</option>
                    <option value="Ensino Fundamental - Anos Finais">Anos Finais</option>
                    <option value="EJA">EJA</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Série/Turma</label>
                  <input
                    className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Filtrar série..."
                    value={pendingSeriesFilter}
                    onChange={e => setPendingSeriesFilter(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1 w-28">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Turno</label>
                  <select
                    className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                    value={pendingShiftFilter}
                    onChange={e => setPendingShiftFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noite">Noite</option>
                    <option value="Integral">Integral</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Secondary Filters & Action */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1 w-48">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Cargo Solicitado</label>
                  <select
                    className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                    value={pendingRoleFilter}
                    onChange={e => setPendingRoleFilter(e.target.value)}
                  >
                    <option value="">Todos os Cargos</option>
                    <option>Mediador</option>
                    <option>Cuidador</option>
                    <option>Professor de Educação Especial</option>
                    <option>Professor de Braille</option>
                    <option>Professor Bilíngue</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Período</label>
                  <select
                    className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                    value={pendingDateFilter}
                    onChange={e => setPendingDateFilter(e.target.value)}
                  >
                    <option value="all">Todo o Período</option>
                    <option value="week">Última Semana</option>
                    <option value="month">Último Mês</option>
                    <option value="custom">Período Específico</option>
                  </select>
                </div>

                {pendingDateFilter === 'custom' && (
                  <div className="flex gap-2 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Início</label>
                      <input
                        type="date"
                        className="h-9 px-2 rounded border border-slate-200 text-xs outline-none"
                        value={pendingStartDate}
                        onChange={e => setPendingStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Fim</label>
                      <input
                        type="date"
                        className="h-9 px-2 rounded border border-slate-200 text-xs outline-none"
                        value={pendingEndDate}
                        onChange={e => setPendingEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    icon="print"
                    onClick={() => {
                      // Use the filtered list directly
                      let periodText = "Período: Geral";
                      if (pendingDateFilter === 'week') periodText = "Período: Última Semana";
                      if (pendingDateFilter === 'month') periodText = "Período: Último Mês";
                      if (pendingDateFilter === 'custom') {
                        const startStr = pendingStartDate ? pendingStartDate.split('-').reverse().join('/') : '...';
                        const endStr = pendingEndDate ? pendingEndDate.split('-').reverse().join('/') : '...';
                        periodText = `Período: ${startStr} a ${endStr}`;
                      }

                      generatePendingPDF(filteredPendingAllotments, periodText);
                    }}
                  >
                    Imprimir Lista
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {filteredPendingAllotments.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                  <p>Nenhuma vaga pendente encontrada com os filtros selecionados.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Escola</th>
                      <th className="px-5 py-3">Turma</th>
                      <th className="px-5 py-3">Vaga Disponível</th>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Observações</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPendingAllotments.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-300">
                          {item.school_name}
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                          {item.classDetails ? (
                            `${item.classDetails.series} ${item.classDetails.section ? '- ' + item.classDetails.section : ''} (${item.classDetails.shift})`
                          ) : 'Turma não encontrada'}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <span className="material-symbols-outlined text-[14px]">person_search</span>
                            {item.staff_role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {item.date}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 max-w-[200px] truncate" title={item.classDetails?.obs || ''}>
                          {item.classDetails?.obs || '-'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleResolvePending(item.school_id, item.class_id)}
                            icon="arrow_forward"
                          >
                            Resolver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Realized Allotments Modal */}
      {showRealizedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-7xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/10">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                Lotações Realizadas
              </h2>
              <button
                onClick={() => setShowRealizedModal(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Filters Bar */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cargo</label>
                <select
                  className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                  value={realizedRoleFilter}
                  onChange={e => setRealizedRoleFilter(e.target.value)}
                >
                  <option value="">Todos os Cargos</option>
                  <option>Mediador</option>
                  <option>Cuidador</option>
                  <option>Professor de Educação Especial</option>
                  <option>Professor de Braille</option>
                  <option>Professor Bilíngue</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Período</label>
                <select
                  className="h-9 px-2 rounded border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-primary"
                  value={realizedDateFilter}
                  onChange={e => setRealizedDateFilter(e.target.value)}
                >
                  <option value="all">Todo o Período</option>
                  <option value="week">Última Semana</option>
                  <option value="month">Último Mês</option>
                  <option value="custom">Período Específico</option>
                </select>
              </div>

              {realizedDateFilter === 'custom' && (
                <div className="flex gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Início</label>
                    <input
                      type="date"
                      className="h-9 px-2 rounded border border-slate-200 text-xs outline-none"
                      value={realizedStartDate}
                      onChange={e => setRealizedStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Fim</label>
                    <input
                      type="date"
                      className="h-9 px-2 rounded border border-slate-200 text-xs outline-none"
                      value={realizedEndDate}
                      onChange={e => setRealizedEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  icon="print"
                  onClick={handlePrintRealized}
                >
                  Imprimir Lista
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {filteredRealizedAllotments.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                  <p>Nenhuma lotação realizada encontrada com os filtros selecionados.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Escola</th>
                      <th className="px-5 py-3">Servidor</th>
                      <th className="px-5 py-3">Vínculo</th>
                      <th className="px-5 py-3">Cargo</th>
                      <th className="px-5 py-3">Turma</th>
                      <th className="px-5 py-3">Turno</th>
                      <th className="px-5 py-3">CH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRealizedAllotments.map(item => {
                      const roleParts = (item.staff_role || '').split(' - ');
                      const roleName = roleParts[0];
                      const hours = roleParts[1] || '-';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-300">
                            {item.school_name}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                            {item.staff_name}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500">
                            {item.staffDetails?.contractType || '-'}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              {roleName}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                            {item.classDetails ? (
                              `${item.classDetails.series} ${item.classDetails.section ? '- ' + item.classDetails.section : ''}`
                            ) : 'Turma não encontrada'}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                            {item.classDetails?.shift || '-'}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500">
                            {hours}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

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
                title="Buscar Servidor"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  className="text-xs p-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-1/2"
                  title="Filtrar por Cargo"
                  value={staffRoleFilter}
                  onChange={e => setStaffRoleFilter(e.target.value)}
                >
                  <option value="">Todos Cargos</option>
                  <option>Professor de Educação Especial</option>
                  <option>Mediador</option>
                  <option>Cuidador</option>
                  <option>Professor de Braille</option>
                  <option>Professor Bilíngue</option>
                </select>
                <select
                  className="text-xs p-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-1/2"
                  title="Filtrar por Disponibilidade"
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
                        title={`Selecionar ${staff.name}`}
                        checked={selectedStaff.includes(staff.id)}
                        onChange={() => { }}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold flex items-center gap-2">
                        {staff.name}
                        {staff.observations && (
                          <span
                            className="material-symbols-outlined text-[16px] text-blue-400 hover:text-blue-600 cursor-help transition-colors"
                            title={staff.observations}
                            onClick={(e) => { e.stopPropagation(); alert(`Observações de ${staff.name}:\n\n${staff.observations}`); }}
                          >
                            info
                          </span>
                        )}
                      </p>
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
                          title="Definir Carga Horária"
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
          <>
            {/* Vacancy Registration */}
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 space-y-2 w-full md:w-auto">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Registrar Necessidade (Vaga)</label>
                <div className="flex gap-4">
                  <select
                    className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-1 focus:ring-primary"
                    value={vacancyRole}
                    onChange={(e) => setVacancyRole(e.target.value)}
                  >
                    <option>Mediador</option>
                    <option>Cuidador</option>
                    <option>Professor de Educação Especial</option>
                    <option>Professor de Braille</option>
                    <option>Professor Bilíngue</option>
                  </select>
                  <Button
                    variant="outline"
                    icon="add_circle"
                    onClick={handleAddVacancy}
                    isLoading={loading}
                    size="sm"
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
              <div className="text-xs text-slate-400 max-w-md leading-tight pb-2 hidden md:block">
                Adicione uma vaga pendente para indicar a necessidade de um profissional para esta turma.
              </div>
            </div>

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
                        const isVacancy = !allotment.staff_id || allotment.staff_name === 'Disponível';

                        return (
                          <tr key={allotment.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className={`font-bold text-sm flex items-center gap-2 ${isVacancy ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                {isVacancy ? (
                                  <>
                                    <span className="material-symbols-outlined text-lg">person_search</span>
                                    Disponível
                                  </>
                                ) : (
                                  allotment.staff_name
                                )}
                                {!isVacancy && staffList.find(s => s.id === allotment.staff_id)?.observations && (
                                  <span
                                    className="material-symbols-outlined text-[16px] text-blue-400 hover:text-blue-600 cursor-help transition-colors"
                                    title={staffList.find(s => s.id === allotment.staff_id)?.observations}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      alert(`Observações de ${allotment.staff_name}:\n\n${staffList.find(s => s.id === allotment.staff_id)?.observations}`);
                                    }}
                                  >
                                    info
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${isVacancy ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                {/* If Vacancy, the whole staff_role might be just the Role Name (e.g. "Mediador") without hours */}
                                {isVacancy ? allotment.staff_role : roleName}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                              {hoursVal}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              <div className="flex items-center gap-2 group">
                                <span>{allotment.date}</span>
                                <button
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-primary transition-opacity"
                                  title="Alterar Data"
                                  onClick={() => {
                                    const newDate = prompt("Nova data de lotação (DD/MM/AAAA):", allotment.date);
                                    // Regex validation roughly DD/MM/YYYY
                                    if (newDate && /^\d{2}\/\d{2}\/\d{4}$/.test(newDate)) {
                                      supabase.from('allotments').update({ date: newDate }).eq('id', allotment.id)
                                        .then(({ error }) => {
                                          if (!error) {
                                            setExistingAllotments(prev => prev.map(a => a.id === allotment.id ? { ...a, date: newDate } : a));
                                          } else {
                                            alert('Erro ao atualizar data.');
                                          }
                                        });
                                    } else if (newDate) {
                                      alert('Formato inválido. Use DD/MM/AAAA.');
                                    }
                                  }}
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                              </div>
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
          </>
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
        <div className="flex gap-3 items-center">
          <div className="flex flex-col mr-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data da Lotação</label>
            <input
              type="date"
              className="h-9 px-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-1 focus:ring-primary w-32"
              value={allotmentDate}
              onChange={(e) => setAllotmentDate(e.target.value)}
            />
          </div>
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
