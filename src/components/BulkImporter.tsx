import React, { useState } from 'react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface BulkImporterProps {
    type: 'schools' | 'staff' | 'students';
    onSuccess?: () => void;
    label?: string;
}

export const BulkImporter: React.FC<BulkImporterProps> = ({ type, onSuccess, label = 'Importar (Excel/CSV)' }) => {
    const [loading, setLoading] = useState(false);

    const processFile = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result;
                try {
                    // Usar 'array' é mais seguro para CSVs com encoding misto e XLSX
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Tentar converter para JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }); // defval garante campos vazios como string vazia
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            // readAsArrayBuffer é superior a BinaryString para xlsx/csv modernos
            reader.readAsArrayBuffer(file);
        });
    };

    /**
     * Função auxiliar para encontrar o valor de uma coluna independentemente de Case Sensitive e Acentos
     */
    const getValue = (row: any, possibleKeys: string[]): any => {
        const rowKeys = Object.keys(row);

        // 1. Tentar match exato primeiro
        for (const key of possibleKeys) {
            if (row[key] !== undefined) return row[key];
        }

        // 2. Tentar match "slugify" (trim, lowercase, remove accents)
        const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        for (const pKey of possibleKeys) {
            const normalizedPKey = normalize(pKey);
            const foundKey = rowKeys.find(rKey => normalize(rKey) === normalizedPKey);
            if (foundKey) return row[foundKey];
        }

        // Retorna undefined se não encontrar
        return undefined;
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm(`Tem certeza que deseja importar dados para ${type}? Isso adicionará novos registros ao banco de dados.`)) {
            e.target.value = '';
            return;
        }

        setLoading(true);
        let lastErrorMsg = '';

        try {
            const jsonData = await processFile(file);
            console.log(`Dados brutos de ${type}:`, jsonData);

            let successCount = 0;
            let errorCount = 0;

            if (jsonData.length === 0) {
                throw new Error('A planilha está vazia, não pôde ser lida ou o formato está incorreto.');
            }

            if (type === 'schools') {
                for (const [index, row] of jsonData.entries()) {
                    const name = getValue(row, ['Nome da Escola', 'nome', 'Nome', 'Escola']);

                    // Validação básica
                    if (!name) {
                        console.warn(`Linha ${index + 2} ignorada: Nome da escola não encontrado.`, row);
                        errorCount++;
                        if (!lastErrorMsg) lastErrorMsg = `Linha ${index + 2}: Nome da escola é obrigatório.`;
                        continue;
                    }

                    const { error } = await supabase.from('schools').insert({
                        name: name,
                        region: getValue(row, ['Região', 'regiao', 'Regiao']) || 'Campo',
                        director_name: getValue(row, ['Diretor', 'diretor', 'Nome do Diretor']),
                        vice_director_name: getValue(row, ['Vice-Diretor', 'vice_diretor', 'Vice Diretor']),
                        description: getValue(row, ['Descrição', 'descricao', 'Descricao', 'Obs']) || '',
                        students_count: 0,
                        classes_count: 0,
                        active: true
                    });

                    if (error) {
                        console.error('Erro na linha escola:', row, error);
                        errorCount++;
                        if (!lastErrorMsg) lastErrorMsg = `Linha ${index + 2}: ${error.message || error.details}`;
                    }
                    else successCount++;
                }
            }
            else if (type === 'staff') {
                for (const [index, row] of jsonData.entries()) {
                    const name = getValue(row, ['Nome Completo', 'Nome', 'nome']);

                    if (!name) {
                        console.warn(`Linha ${index + 2} ignorada: Nome não encontrado.`);
                        errorCount++;
                        if (!lastErrorMsg) lastErrorMsg = `Linha ${index + 2}: Nome do servidor é obrigatório.`;
                        continue;
                    }

                    const { error } = await supabase.from('staff').insert({
                        name: name,
                        registration: String(getValue(row, ['Matrícula', 'matricula', 'Matricula']) || Math.floor(Math.random() * 100000)),
                        role: getValue(row, ['Cargo', 'cargo']) || 'Não Informado',
                        contract_type: getValue(row, ['Vínculo', 'vinculo', 'Vinculo']) || 'Contrato',
                        hours_total: Number(getValue(row, ['Carga Horária (Total)', 'carga_horaria', 'horas_total']) || 0),
                        hours_available: Number(getValue(row, ['Carga Horária (Disp.)', 'carga_disponivel', 'disponivel']) || 0),
                    });
                    if (error) {
                        console.error('Erro na linha servidor:', row, error);
                        errorCount++;
                        if (!lastErrorMsg) lastErrorMsg = `Linha ${index + 2}: ${error.message}`;
                    }
                    else successCount++;
                }
            }
            else if (type === 'students') {
                const { data: allSchools } = await supabase.from('schools').select('id, name');

                for (const [index, row] of jsonData.entries()) {
                    const name = getValue(row, ['Nome do Estudante', 'Nome', 'nome', 'Aluno']);

                    if (!name) {
                        errorCount++;
                        if (!lastErrorMsg) lastErrorMsg = `Linha ${index + 2}: Nome do estudante não encontrado.`;
                        continue;
                    }

                    let schoolId = null;
                    const schoolNameRef = getValue(row, ['Escola Atual', 'escola', 'Escola', 'Unidade']);

                    if (schoolNameRef && allSchools) {
                        const found = allSchools.find(s => s.name.toLowerCase().trim() === String(schoolNameRef).toLowerCase().trim());
                        if (found) schoolId = found.id;
                    }

                    const needsRaw = getValue(row, ['Necessidades', 'necessidades', 'Apoio']);

                    const { error } = await supabase.from('students').insert({
                        name: name,
                        age: Number(getValue(row, ['Idade', 'idade']) || 0),
                        school_id: schoolId,
                        series: getValue(row, ['Série/Turma', 'serie', 'turma']) || '',
                        cid: getValue(row, ['CID', 'cid', 'Diagnóstico']) || '',
                        special_group: getValue(row, ['Grupo Especial', 'grupo', 'Grupo']) || '',
                        needs_support: needsRaw ? String(needsRaw).split(',').map(s => s.trim()) : [],
                        additional_info: getValue(row, ['Observações', 'obs', 'Obs']) || ''
                    });

                    if (error) {
                        console.error('Erro na linha estudante:', row, error);
                        errorCount++;
                        if (!lastErrorMsg) lastErrorMsg = `Linha ${index + 2}: ${error.message}`;
                    }
                    else successCount++;
                }
            }

            let msg = `Processamento concluído!\nSucessos: ${successCount}\nErros: ${errorCount}`;
            if (errorCount > 0 && lastErrorMsg) {
                msg += `\n\nExemplo de erro (último detectado): ${lastErrorMsg}\n\nVerifique se o arquivo segue o modelo correto (Excel é recomendável). CSVs podem ter problemas de codificação.`;
            }

            alert(msg);
            if (onSuccess && successCount > 0) onSuccess();

        } catch (err: any) {
            console.error(err);
            alert('Erro crítico na importação: ' + (err.message || 'Erro desconhecido.'));
        } finally {
            setLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    return (
        <div className="relative inline-block">
            <Button
                variant="secondary"
                icon="upload_file"
                isLoading={loading}
                className="relative overflow-hidden cursor-pointer"
                type="button"
            >
                {label}
                <input
                    type="file"
                    accept=".xlsx, .csv"
                    onChange={handleImport}
                    disabled={loading}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Selecione um arquivo Excel (.xlsx) ou CSV"
                />
            </Button>
        </div>
    );
};
