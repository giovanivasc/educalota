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
    classes: 118, // Mock for now as we didn't migrate classes yet
    staff: 0
  });
  const [recentAllotments, setRecentAllotments] = useState<AllotmentRecord[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    // Parallel fetches
    const [
      { count: studentsCount },
      { count: schoolsCount },
      { count: staffCount },
      { data: allotmentsData }
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('schools').select('*', { count: 'exact', head: true }),
      supabase.from('staff').select('*', { count: 'exact', head: true }),
      supabase.from('allotments').select('*').order('created_at', { ascending: false }).limit(5)
    ]);

    setStats({
      students: studentsCount || 0,
      schools: schoolsCount || 0,
      classes: 118,
      staff: staffCount || 0
    });

    if (allotmentsData) {
      setRecentAllotments(allotmentsData.map((a: any) => ({
        id: a.id,
        staffName: a.staff_name,
        staffRole: a.staff_role,
        schoolName: a.school_name,
        date: a.date,
        status: a.status as any
      })));
    }
  };

  const staffDistData = [
    { name: 'Monitores', value: 192, color: '#1142d4' },
    { name: 'Intérpretes', value: 120, color: '#60a5fa' },
    { name: 'Prof. Braille', value: 70, color: '#a5b4fc' },
    { name: 'Apoio', value: 105, color: '#cbd5e1' },
  ];

  const groupDistData = [
    { name: 'TEA', value: 45, color: '#1142d4' },
    { name: 'Intelectual', value: 25, color: '#60a5fa' },
    { name: 'Auditiva', value: 20, color: '#a5b4fc' },
    { name: 'Outros', value: 10, color: '#cbd5e1' },
  ];

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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Estudantes', value: stats.students, icon: 'school', trend: '+5%', color: 'text-primary' },
          { label: 'Total Escolas', value: stats.schools, icon: 'domain', trend: '0%', color: 'text-blue-500' },
          { label: 'Turmas Ativas', value: stats.classes, icon: 'class', trend: '+2%', color: 'text-indigo-500' },
          { label: 'Profissionais Alocados', value: stats.staff, icon: 'badge', trend: '+12%', color: 'text-teal-500' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-slate-500 dark:text-slate-400">
              <p className="text-sm font-medium">{stat.label}</p>
              <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            <div className="mt-2 flex items-center text-sm">
              <span className="material-symbols-outlined text-green-600 text-lg">trending_up</span>
              <span className="ml-1 font-bold text-green-600">{stat.trend}</span>
              <span className="ml-1 text-slate-400">vs mês ant.</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Atendimento por Tipo de Profissional</h3>
              <p className="text-sm text-slate-500">Distribuição atual da equipe de apoio</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffDistData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(17, 66, 212, 0.05)' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {staffDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold">Distribuição por Grupo</h3>
            <p className="text-sm text-slate-500">Estudantes por necessidade</p>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={groupDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {groupDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {groupDistData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h3 className="text-lg font-bold">Últimas Lotações Realizadas</h3>
          <button className="text-sm font-bold text-primary hover:underline">Ver todas</button>
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
  );
};

export default Dashboard;
