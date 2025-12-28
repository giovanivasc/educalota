import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

const Access: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState<string | null>(null);

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

  // --- LÓGICA DE IMPORTAÇÃO ---

  const processFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        try {
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const handleImport = async (type: 'schools' | 'staff' | 'students', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(type);
    try {
      const jsonData = await processFile(file);
      console.log(`Dados brutos de ${type}:`, jsonData);

      let successCount = 0;
      let errorCount = 0;

      if (jsonData.length === 0) {
        throw new Error('A planilha está vazia ou não pôde ser lida.');
      }

      if (type === 'schools') {
        for (const row of jsonData as any[]) {
          // Mapear colunas do Excel para colunas do Banco
          const { error } = await supabase.from('schools').insert({
            name: row['Nome da Escola'],
            region: row['Região'] || 'Campo',
            director_name: row['Diretor'],
            vice_director_name: row['Vice-Diretor'],
            description: row['Descrição'] || '',
            students_count: 0,
            classes_count: 0,
            active: true
          });
          if (error) { console.error('Erro na linha escola:', row, error); errorCount++; }
          else successCount++;
        }
      }
      else if (type === 'staff') {
        for (const row of jsonData as any[]) {
          const { error } = await supabase.from('staff').insert({
            name: row['Nome Completo'],
            registration: String(row['Matrícula'] || ''),
            role: row['Cargo'],
            contract_type: row['Vínculo'],
            hours_total: Number(row['Carga Horária (Total)']) || 0,
            hours_available: Number(row['Carga Horária (Disp.)']) || 0,
          });
          if (error) { console.error('Erro na linha servidor:', row, error); errorCount++; }
          else successCount++;
        }
      }
      else if (type === 'students') {
        // Buscar todas escolas para vincular pelo nome
        const { data: allSchools } = await supabase.from('schools').select('id, name');

        for (const row of jsonData as any[]) {
          // Tentar encontrar ID da escola pelo Nome (Case Insensitive)
          let schoolId = null;
          if (row['Escola Atual'] && allSchools) {
            const found = allSchools.find(s => s.name.toLowerCase().trim() === String(row['Escola Atual']).toLowerCase().trim());
            if (found) schoolId = found.id;
          }

          const { error } = await supabase.from('students').insert({
            name: row['Nome do Estudante'],
            age: Number(row['Idade']),
            school_id: schoolId,
            series: row['Série/Turma'], // Apenas informativo se não tiver vinculo real de turma
            cid: row['CID'],
            special_group: row['Grupo Especial'],
            needs_support: row['Necessidades'] ? String(row['Necessidades']).split(',').map(s => s.trim()) : [],
            additional_info: row['Observações']
          });
          if (error) { console.error('Erro na linha estudante:', row, error); errorCount++; }
          else successCount++;
        }
      }

      alert(`Processamento concluído!\nSucessos: ${successCount}\nErros: ${errorCount}\nConsulte o console para detalhes dos erros.`);
      if (e.target) e.target.value = ''; // Limpar input

    } catch (err: any) {
      console.error(err);
      alert('Erro na importação: ' + (err.message || 'Erro desconhecido. Verifique o formato da planilha.'));
    } finally {
      setImportLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Administração de Acesso</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Gerencie permissões de usuários e realize importações de dados em massa.</p>
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
            <span className="material-symbols-outlined text-primary">cloud_upload</span>
            Importação de Dados em Massa
          </h2>
          <button className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-base">download</span>
            Baixar Modelos (.xlsx)
          </button>
        </div>
        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { type: 'schools', title: 'Escolas', icon: 'domain', color: 'text-indigo-500' },
              { type: 'staff', title: 'Servidores', icon: 'groups', color: 'text-teal-500' },
              { type: 'students', title: 'Estudantes', icon: 'face', color: 'text-orange-500' },
            ].map((imp, i) => (
              <div key={i} className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 text-center transition-all hover:border-primary hover:bg-primary/5">
                <div className="mb-4 rounded-full bg-white dark:bg-slate-800 p-3 shadow-sm group-hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined text-3xl ${imp.color}`}>{imp.icon}</span>
                </div>
                <h3 className="mb-1 font-bold">{imp.title}</h3>
                <p className="mb-4 text-xs text-slate-500">Formato Excel (.xlsx)</p>
                <div className="relative">
                  <Button size="sm" variant="secondary" className="border pointer-events-none" isLoading={importLoading === imp.type}>
                    {importLoading === imp.type ? 'Processando...' : 'Selecionar Arquivo'}
                  </Button>
                  <input
                    type="file"
                    className="absolute inset-0 cursor-pointer opacity-0 w-full h-full"
                    accept=".xlsx"
                    onChange={(e) => handleImport(imp.type as any, e)}
                    disabled={importLoading !== null}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-lg">
            <p className="text-xs text-orange-700 font-medium">
              ⚠️ Observação: Certifique-se de que os nomes das colunas na planilha correspondem EXATAMENTE ao modelo especificado. Linhas com erros serão ignoradas e reportadas no Console do Navegador (F12).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Access;
