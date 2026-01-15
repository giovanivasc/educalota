import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { AllotmentRecord } from '../types';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    students: 0,
    schools: 0,
    classes: 0,
    staff: 0,
    allottedStaff: 0,
    distortion: 0
  });
  const [recentAllotments, setRecentAllotments] = useState<AllotmentRecord[]>([]);
  const [staffDistData, setStaffDistData] = useState<any[]>([]);
  const [groupDistData, setGroupDistData] = useState<any[]>([]);
  const [distortionList, setDistortionList] = useState<any[]>([]);
  const [showDistortionModal, setShowDistortionModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Basic Counts and Distributions Data
      const [
        { count: studentsCount, data: studentsData },
        { count: schoolsCount },
        { count: classesCount },
        { count: staffCount, data: staffData },
        { data: activeAllotments },
        { data: recentAllotmentsData }
      ] = await Promise.all([
        supabase.from('students').select('id, name, special_group, birth_date, schools(name), classes:class_id(modality, series)', { count: 'exact' }),
        supabase.from('schools').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('role', { count: 'exact' }),
        supabase.from('allotments').select('staff_id').eq('status', 'Ativo'),
        supabase.from('allotments').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      // Calculate Allotted Staff (Unique IDs)
      const uniqueAllottedStaff = new Set((activeAllotments || []).map((a: any) => a.staff_id)).size;

      // Calculate Distortion
      let distortionCount = 0;
      const distortionDetails: any[] = [];
      const refDate = new Date(new Date().getFullYear(), 2, 31); // 31st March

      (studentsData || []).forEach((s: any) => {
        if (!s.birth_date) return;

        // Calculate Age on Ref Date
        const birth = new Date(s.birth_date);
        let age = refDate.getFullYear() - birth.getFullYear();
        const m = refDate.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) {
          age--;
        }

        // Determine Expected Age
        let expectedAge: number | null = null;
        let series = '';
        let modality = '';

        if (s.classes) {
          series = (s.classes.series || '').toLowerCase();
          modality = (s.classes.modality || '').toLowerCase();
        }

        // Fallback or explicit check
        // Se não tem classe vinculada, mas tem o campo series no aluno? O select atual não pega s.series direto, mas s.classes.
        // Vou assumir que link com classes é necessário para ter Modalidade confiável.

        if (!series) return;

        // Logic Mapping
        if (modality.includes('infantil') || series.includes('infantil') || series.includes('creche')) {
          if (series.includes('2 anos')) expectedAge = 2;
          else if (series.includes('3 anos')) expectedAge = 3;
          else if (series.includes('4 anos')) expectedAge = 4;
          else if (series.includes('5 anos')) expectedAge = 5;
        }
        else if (modality.includes('fundamental') || series.includes('ano') || series.includes('série')) {
          if (series.includes('1º') || series.includes('1o') || series.includes('primeiro')) expectedAge = 6;
          else if (series.includes('2º') || series.includes('2o') || series.includes('segundo')) expectedAge = 7;
          else if (series.includes('3º') || series.includes('3o') || series.includes('terceiro')) expectedAge = 8;
          else if (series.includes('4º') || series.includes('4o') || series.includes('quarto')) expectedAge = 9;
          else if (series.includes('5º') || series.includes('5o') || series.includes('quinto')) expectedAge = 10;
          else if (series.includes('6º') || series.includes('6o') || series.includes('sexto')) expectedAge = 11;
          else if (series.includes('7º') || series.includes('7o') || series.includes('sétimo')) expectedAge = 12;
          else if (series.includes('8º') || series.includes('8o') || series.includes('oitavo')) expectedAge = 13;
          else if (series.includes('9º') || series.includes('9o') || series.includes('nono')) expectedAge = 14;
        }

        if (expectedAge !== null && age > expectedAge) {
          distortionCount++;
          distortionDetails.push({
            id: s.id,
            name: s.name,
            age,
            series: s.classes?.series,
            modality: s.classes?.modality,
            schoolName: s.schools?.name || 'Não informado',
            gap: age - expectedAge
          });
        }
      });

      setDistortionList(distortionDetails);

      setStats({
        students: studentsCount || 0,
        schools: schoolsCount || 0,
        classes: classesCount || 0,
        staff: staffCount || 0,
        allottedStaff: uniqueAllottedStaff,
        distortion: distortionCount
      });

      // Process Staff Distribution
      const roleCounts: Record<string, number> = {};
      const targetRoles = [
        'Professor de Educação Especial',
        'Professor Bilíngue',
        'Professor de Braille',
        'Mediador',
        'Cuidador'
      ];

      staffData?.forEach((s: any) => {
        if (targetRoles.includes(s.role)) {
          roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
        } else {
          // Optional: Group others? Or ignore?
          // roleCounts['Outros'] = (roleCounts['Outros'] || 0) + 1;
        }
      });

      const processedStaffDist = targetRoles.map(role => ({
        name: role.replace('Professor de ', 'Prof. ').replace('Educação Especial', 'AEE'), // Shorten for chart
        fullName: role,
        value: roleCounts[role] || 0,
        color: role === 'Mediador' ? '#1142d4' :
          role === 'Cuidador' ? '#60a5fa' :
            role.includes('Braille') ? '#818cf8' :
              role.includes('Bilíngue') ? '#a78bfa' : '#c084fc'
      })).filter(d => d.value > 0); // Only show existing? Or show all 0? Showing > 0 is cleaner.

      setStaffDistData(processedStaffDist.length > 0 ? processedStaffDist : [{ name: 'Sem dados', value: 0 }]);


      // Process Group Distribution
      const groupCounts: Record<string, number> = {};
      studentsData?.forEach((s: any) => {
        const group = s.special_group || 'Não Informado';
        groupCounts[group] = (groupCounts[group] || 0) + 1;
      });

      // Top groups + Others logic could be here, but for now map top 5
      const sortedGroups = Object.entries(groupCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5) // Top 5
        .map(([name, value], index) => ({
          name: name.length > 15 ? name.substring(0, 15) + '...' : name,
          value,
          color: ['#1142d4', '#3b82f6', '#60a5fa', '#93c5fd', '#cbd5e1'][index % 5]
        }));
      setGroupDistData(sortedGroups);


      // Recent Allotments
      if (recentAllotmentsData) {
        setRecentAllotments(recentAllotmentsData.map((a: any) => ({
          id: a.id,
          staffName: a.staff_name,
          staffRole: a.staff_role,
          schoolName: a.school_name,
          date: a.date,
          status: a.status as any
        })));
      }

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Visão Geral</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Monitoramento em tempo real da educação especial</p>
        </div>
        <Button onClick={() => navigate('/allotment')} icon="add">
          Nova Lotação
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Estudantes', value: stats.students, icon: 'school', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Escolas', value: stats.schools, icon: 'domain', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Turmas', value: stats.classes, icon: 'class', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          { label: 'Servidores Totais', value: stats.staff, icon: 'group', color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-800' },
          { label: 'Servidores Lotados', value: stats.allottedStaff, icon: 'badge', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Defasagem Idade-Série', value: stats.distortion, icon: 'warning', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', onClick: () => setShowDistortionModal(true) },
        ].map((stat, i) => (
          <div
            key={i}
            className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-5 shadow-sm hover:shadow-md transition-all ${stat.onClick ? 'cursor-pointer hover:border-red-200 hover:ring-2 hover:ring-red-100' : ''}`}
            onClick={stat.onClick}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
              </div>
              {/* Trend Removed as we don't have historical data yet */}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar Chart: Profissionais */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm lg:col-span-2">
          <div className="mb-6">
            <h3 className="text-lg font-bold">Atendimento por Cargo</h3>
            <p className="text-sm text-slate-500">Distribuição dos profissionais da rede</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffDistData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0, 0.04)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {staffDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Grupos */}
        <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold">Distribuição por Grupo</h3>
            <p className="text-sm text-slate-500">Estudantes por necessidade</p>
          </div>
          <div className="flex flex-1 items-center justify-center min-h-[200px]">
            {groupDistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={groupDistData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {groupDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm">Sem dados de estudantes.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            {groupDistData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h3 className="text-lg font-bold">Últimas Lotações Realizadas</h3>
          <button type="button" className="text-sm font-bold text-primary hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 font-semibold">
              <tr>
                <th className="px-6 py-3">Profissional</th>
                <th className="px-6 py-3">Cargo</th>
                <th className="px-6 py-3">Escola Destino</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentAllotments.map((allotment) => (
                <tr key={allotment.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{allotment.staffName}</td>
                  <td className="px-6 py-4">{allotment.staffRole}</td>
                  <td className="px-6 py-4">{allotment.schoolName}</td>
                  <td className="px-6 py-4">{allotment.date}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${allotment.status === 'Concluído'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                      {allotment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Distortion Modal */ }
  {
    showDistortionModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-surface-dark">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-red-600">
                <span className="material-symbols-outlined">warning</span>
                Estudantes em Defasagem Idade-Série
              </h2>
              <p className="text-sm text-slate-500">
                Total de {distortionList.length} estudantes identificados com idade acima do esperado para a série.
              </p>
            </div>
            <button
              onClick={() => setShowDistortionModal(false)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-slate-500">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {distortionList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                <p>Nenhuma distorção encontrada.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-6 py-4">Estudante</th>
                    <th className="px-6 py-4">Idade</th>
                    <th className="px-6 py-4">Escola / Série</th>
                    <th className="px-6 py-4 text-center">Defasagem (Anos)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {distortionList.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        {student.name}
                      </td>
                      <td className="px-6 py-4">
                        {student.age} anos
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{student.schoolName}</span>
                          <span className="text-xs text-slate-500">{student.series} ({student.modality})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 text-xs font-bold">
                          +{student.gap} anos
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
            <Button onClick={() => setShowDistortionModal(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    )
  }
    </div >
  );
};

export default Dashboard;
