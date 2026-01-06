import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

const Access: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const permList = [
    { id: 'dashboard', title: 'Dashboard', desc: 'Visualização de indicadores', icon: 'dashboard', color: 'bg-blue-100 text-blue-600' },
    { id: 'schools', title: 'Cadastro de Escolas', desc: 'Editar dados das unidades', icon: 'school', color: 'bg-indigo-100 text-indigo-600' },
    { id: 'staff', title: 'Cadastro Profissionais', desc: 'Gerir dados de servidores', icon: 'badge', color: 'bg-teal-100 text-teal-600' },
    { id: 'students', title: 'Cadastro Alunos', desc: 'Matrículas e turmas', icon: 'backpack', color: 'bg-orange-100 text-orange-600' },
    { id: 'allotment', title: 'Gestão de Lotação', desc: 'Atribuir servidores', icon: 'location_on', color: 'bg-purple-100 text-purple-600' },
    { id: 'admin', title: 'Acesso Total', desc: 'Privilégios administrativos', icon: 'shield', color: 'bg-red-100 text-red-600' },
  ];

  const togglePermission = (id: string) => {
    setPermissions(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleCreateUser = async () => {
    if (!email || !password) {
      alert('Por favor, preencha email e senha.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            permissions: permissions
          }
        }
      });

      if (error) throw error;

      alert('Usuário criado com sucesso! Verifique o email para confirmação.');
      setEmail('');
      setPassword('');
      setPermissions([]);

    } catch (error: any) {
      alert('Erro ao criar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = (type: 'schools' | 'staff' | 'students') => {
    let data = [];
    let filename = '';

    if (type === 'schools') {
      data = [{ 'Nome da Escola': '', 'Região': 'Urbano', 'Diretor': '', 'Vice-Diretor': '', 'Descrição': '' }];
      filename = 'modelo_escolas.xlsx';
    } else if (type === 'staff') {
      data = [{ 'Nome Completo': '', 'Matrícula': '', 'Cargo': 'Professor AEE', 'Vínculo': 'Efetivo', 'Carga Horária (Total)': 200, 'Carga Horária (Disp.)': 150 }];
      filename = 'modelo_servidores.xlsx';
    } else if (type === 'students') {
      data = [{ 'Nome do Estudante': '', 'Idade': 10, 'Escola Atual': '', 'Série/Turma': '', 'CID': '', 'Grupo Especial': '', 'Necessidades': 'Mediador, Cuidador', 'Observações': '' }];
      filename = 'modelo_estudantes.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Administração de Acesso</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Gerencie permissões de usuários e baixe modelos para importação.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" icon="history">
            Log de Auditoria
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
            Gerenciamento de Permissões
          </h2>
        </div>
        <div className="p-6">
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold">Email do Usuário</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="novo.usuario@educacao.gov.br"
                className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold">Senha de Acesso</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {permList.map((perm) => (
              <div key={perm.id} className={`rounded-xl border p-4 transition-all group ${permissions.includes(perm.id) ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-800 hover:border-primary/30'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${perm.color} dark:bg-opacity-10 transition-transform group-hover:scale-110`}>
                      <span className="material-symbols-outlined">{perm.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-bold">{perm.title}</h3>
                      <p className="text-xs text-slate-500">{perm.desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      title={`Conceder permissão de ${perm.title}`}
                      checked={permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full dark:bg-slate-800"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <Button icon="person_add" onClick={handleCreateUser} isLoading={loading}>
              Criar Usuário
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">cloud_download</span>
            Modelos para Importação de Dados
          </h2>
          <p className="text-sm text-slate-500">Baixe os modelos abaixo, preencha e utilize a função "Importar" nas respectivas páginas de cadastro.</p>
        </div>
        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { type: 'schools', title: 'Modelo Escolas', icon: 'domain', color: 'text-indigo-500' },
              { type: 'staff', title: 'Modelo Servidores', icon: 'groups', color: 'text-teal-500' },
              { type: 'students', title: 'Modelo Estudantes', icon: 'face', color: 'text-orange-500' },
            ].map((imp, i) => (
              <div key={i} className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 text-center transition-all hover:border-primary hover:bg-primary/5">
                <div className="mb-4 rounded-full bg-white dark:bg-slate-800 p-3 shadow-sm group-hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-3xl ${imp.color}`}>{imp.icon}</span>
                </div>
                <h3 className="mb-1 font-bold">{imp.title}</h3>
                <p className="mb-4 text-xs text-slate-500">Formato Excel (.xlsx)</p>
                <Button size="sm" variant="outline" className="border" onClick={() => downloadTemplate(imp.type as any)}>
                  Baixar Modelo
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Access;
