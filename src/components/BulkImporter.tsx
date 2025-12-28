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

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm(`Tem certeza que deseja importar dados para ${type}? Isso adicionará novos registros ao banco de dados.`)) {
            e.target.value = '';
            return;
        }

        setLoading(true);
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
                    const { error } = await supabase.from('schools').insert({
                        name: row['Nome da Escola'] || row['nome'] || row['Nome'],
                        region: row['Região'] || row['regiao'] || 'Campo',
                        director_name: row['Diretor'] || row['diretor'],
                        vice_director_name: row['Vice-Diretor'] || row['vice_diretor'],
                        description: row['Descrição'] || row['descricao'] || '',
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
                        name: row['Nome Completo'] || row['Nome'] || row['nome'],
                        registration: String(row['Matrícula'] || row['matricula'] || Math.floor(Math.random() * 100000)),
                        role: row['Cargo'] || row['cargo'],
                        contract_type: row['Vínculo'] || row['vinculo'],
                        hours_total: Number(row['Carga Horária (Total)'] || row['carga_horaria'] || 0),
                        hours_available: Number(row['Carga Horária (Disp.)'] || row['carga_disponivel'] || 0),
                    });
                    if (error) { console.error('Erro na linha servidor:', row, error); errorCount++; }
                    else successCount++;
                }
            }
            else if (type === 'students') {
                const { data: allSchools } = await supabase.from('schools').select('id, name');

                for (const row of jsonData as any[]) {
                    let schoolId = null;
                    const schoolNameRef = row['Escola Atual'] || row['escola'] || row['Escola'];

                    if (schoolNameRef && allSchools) {
                        const found = allSchools.find(s => s.name.toLowerCase().trim() === String(schoolNameRef).toLowerCase().trim());
                        if (found) schoolId = found.id;
                    }

                    const { error } = await supabase.from('students').insert({
                        name: row['Nome do Estudante'] || row['Nome'] || row['nome'],
                        age: Number(row['Idade'] || row['idade']),
                        school_id: schoolId,
                        series: row['Série/Turma'] || row['serie'],
                        cid: row['CID'] || row['cid'],
                        special_group: row['Grupo Especial'] || row['grupo'],
                        needs_support: (row['Necessidades'] || row['necessidades']) ? String(row['Necessidades'] || row['necessidades']).split(',').map(s => s.trim()) : [],
                        additional_info: row['Observações'] || row['obs']
                    });
                    if (error) { console.error('Erro na linha estudante:', row, error); errorCount++; }
                    else successCount++;
                }
            }

            alert(`Processamento concluído!\nSucessos: ${successCount}\nErros: ${errorCount}`);
            if (onSuccess) onSuccess();

        } catch (err: any) {
            console.error(err);
            alert('Erro na importação: ' + (err.message || 'Erro desconhecido.'));
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
                    title="Selecione um arquivo Excel ou CSV"
                />
            </Button>
        </div>
    );
};
