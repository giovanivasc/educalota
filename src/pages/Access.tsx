import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Tipagem para os usuários carregados do banco
interface UserData {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

const Access: React.FC = () => {
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ASSESSOR');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const permList = [
    { id: 'dashboard', title: 'Dashboard', desc: 'Visualização de indicadores', icon: 'dashboard', color: 'bg-blue-100 text-blue-600' },
    { id: 'schools', title: 'Cadastro de Escolas', desc: 'Editar dados das unidades', icon: 'school', color: 'bg-indigo-100 text-indigo-600' },
    { id: 'staff', title: 'Cadastro Profissionais', desc: 'Gerir dados de servidores', icon: 'badge', color: 'bg-teal-100 text-teal-600' },
    { id: 'students', title: 'Cadastro Alunos', desc: 'Matrículas e turmas', icon: 'backpack', color: 'bg-orange-100 text-orange-600' },
    { id: 'cees', title: 'CEES: Solicitações', desc: 'Gerir avaliações e triagem', icon: 'fact_check', color: 'bg-pink-100 text-pink-600' },
    { id: 'allotment', title: 'Gestão de Lotação', desc: 'Atribuir servidores', icon: 'location_on', color: 'bg-purple-100 text-purple-600' },
    { id: 'reports', title: 'Relatórios', desc: 'Acesso aos relatórios', icon: 'bar_chart', color: 'bg-green-100 text-green-600' },
    { id: 'admin', title: 'Acesso Total', desc: 'Privilégios administrativos', icon: 'shield', color: 'bg-red-100 text-red-600' },
    { id: 'assessor', title: 'CEES: Minhas Avaliações', desc: 'Acesso ao painel do assessor e relatórios', icon: 'clinical_notes', color: 'bg-emerald-100 text-emerald-600' },
    { id: 'consulta', title: 'Consulta Equipe', desc: 'Acesso à busca pública de alunos', icon: 'search', color: 'bg-yellow-100 text-yellow-600' }
  ];

  // Carregar os usuários ao abrir a página
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Chama a função segura que criamos no Supabase
      const { data, error } = await supabase.rpc('get_all_users');
      
      if (error) throw error;
      setUsersList(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSelectUser = (user: UserData) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPassword(''); // Não mostramos a senha existente
    setRole(user.role || 'ASSESSOR');
    setPermissions(user.permissions || []);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setEmail('');
    setPassword('');
    setRole('ASSESSOR');
    setPermissions([]);
  };

  const togglePermission = (id: string) => {
    setPermissions(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSaveUser = async () => {
    if (!email) {
      alert('Por favor, preencha o email.');
      return;
    }

    setLoading(true);
    try {
      if (selectedUser) {
        // ATUALIZAR USUÁRIO EXISTENTE via RPC
        const { error } = await supabase.rpc('update_user_access', {
          target_user_id: selectedUser.id,
          new_role: role,
          new_permissions: permissions
        });

        if (error) throw error;
        alert('Permissões do usuário atualizadas com sucesso!');
        fetchUsers(); // Recarrega a lista
      } else {
        // CRIAR NOVO USUÁRIO
        if (!password) {
          alert('Por favor, preencha a senha para novos usuários.');
          setLoading(false);
          return;
        }

        // Fazer a requisição via fetch bruto para a API GoTrue (Auth)
        // Isso contorna a biblioteca do Supabase, evitando que ela dispare
        // eventos de BroadcastChannel que deslogam o Admin pelas costas.
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email,
            password,
            data: { role, permissions }
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.msg || data.message || 'Erro ao criar usuário na API!');
        }
        alert('Usuário criado com sucesso! Verifique o email para confirmação.');
        fetchUsers(); // Recarrega a lista
      }
    } catch (error: any) {
      alert('Erro ao salvar usuário: ' + error.message);
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
          <p className="mt-1 text-slate-500 dark:text-slate-400">Gerencie usuários, permissões e baixe modelos para importação.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* COLUNA ESQUERDA: LISTA DE USUÁRIOS */}
        <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-surface-dark h-[600px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Usuários</h3>
            <Button size="sm" variant="outline" onClick={handleClearSelection} icon="add">
              Novo
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loadingUsers ? (
              <p className="text-sm text-slate-500 text-center py-4">Carregando usuários...</p>
            ) : (
              usersList.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedUser?.id === u.id ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800'}`}
                >
                  <p className="font-medium text-sm truncate">{u.email}</p>
                  <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                    {u.role}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE EDIÇÃO/CRIAÇÃO */}
        <section className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-surface-dark">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                {selectedUser ? 'manage_accounts' : 'person_add'}
              </span>
              {selectedUser ? 'Editar Permissões do Usuário' : 'Criar Novo Usuário'}
            </h2>
          </div>
          
          <div className="p-6">
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold">Email do Usuário</label>
                <input
                  type="email"
                  value={email}
                  disabled={!!selectedUser}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@educacao.gov.br"
                  className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900 disabled:opacity-50"
                />
              </div>

              {!selectedUser && (
                <div>
                  <label className="mb-2 block text-sm font-bold">Senha Inicial</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-bold">Perfil (Role)</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900 font-medium"
                >
                  <option value="ADMIN">ADMIN (Acesso Total)</option>
                  <option value="SECRETARIO">SECRETÁRIO (Lotação/RH)</option>
                  <option value="DIRETOR">DIRETOR (Acompanhamento)</option>
                  <option value="ASSESSOR">ASSESSOR (Visualização)</option>
                </select>
              </div>
            </div>

            <h3 className="mb-4 font-bold text-slate-700 dark:text-slate-300">Permissões de Telas</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {permList.map((perm) => (
                <div key={perm.id} className={`rounded-xl border p-4 transition-all group ${permissions.includes(perm.id) ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/30 dark:border-slate-800'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${perm.color} dark:bg-opacity-10`}>
                        <span className="material-symbols-outlined">{perm.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{perm.title}</h3>
                      </div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full dark:bg-slate-800"></div>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              {selectedUser && (
                <Button variant="outline" onClick={handleClearSelection}>
                  Cancelar Edição
                </Button>
              )}
              <Button icon={selectedUser ? 'save' : 'person_add'} onClick={handleSaveUser} isLoading={loading}>
                {selectedUser ? 'Salvar Alterações' : 'Criar Usuário'}
              </Button>
            </div>
          </div>
        </section>
      </div>

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
