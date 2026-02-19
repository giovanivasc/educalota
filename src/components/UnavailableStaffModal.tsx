
import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Staff } from '../types';
import { Button } from './ui/Button';
import { normalizeText } from '../lib/stringUtils';

interface UnavailableStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    staffList: Staff[];
}

type SortConfig = {
    key: keyof Staff | 'observations'; // observations might not be in base type strictly properly typed everywhere but it is in the mapped object
    direction: 'asc' | 'desc';
};

export const UnavailableStaffModal: React.FC<UnavailableStaffModalProps> = ({ isOpen, onClose, staffList }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });

    // Filter for 0h staff specifically
    const unavailableStaff = useMemo(() => {
        return staffList.filter(s => s.hoursTotal === 0);
    }, [staffList]);

    // Apply Search and Sort
    const filteredAndSortedStaff = useMemo(() => {
        let result = [...unavailableStaff];

        if (searchTerm) {
            const normalizedSearch = normalizeText(searchTerm);
            result = result.filter(s =>
                normalizeText(s.name).includes(normalizedSearch) ||
                normalizeText(s.role).includes(normalizedSearch) ||
                normalizeText(s.contractType).includes(normalizedSearch) ||
                (s.observations && normalizeText(s.observations).includes(normalizedSearch))
            );
        }

        result.sort((a, b) => {
            const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
            const bValue = (b[sortConfig.key] || '').toString().toLowerCase();

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [unavailableStaff, searchTerm, sortConfig]);

    const handleSort = (key: keyof Staff) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const d = new Date();
        const dateText = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

        // Header
        doc.setFontSize(16);
        doc.text('Relatório de Servidores Indisponíveis (0h)', 14, 20);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${dateText}`, 14, 28);
        doc.text(`Total de registros: ${filteredAndSortedStaff.length}`, 14, 34);

        const tableColumn = ["Nome", "Cargo", "Vínculo", "Observações"];
        const tableRows = filteredAndSortedStaff.map(staff => [
            staff.name,
            staff.role,
            staff.contractType,
            staff.observations || '-'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 50 },
                2: { cellWidth: 30 },
                3: { cellWidth: 'auto' }
            }
        });

        doc.save(`servidores_indisponiveis_${d.getTime()}.pdf`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl h-[80vh] flex flex-col rounded-2xl bg-white dark:bg-surface-dark shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-red-500">block</span>
                            Servidores Indisponíveis (0h)
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Listando {filteredAndSortedStaff.length} servidores com carga horária zerada.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Filters & Actions */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-xl">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome, cargo, vínculo ou observações..."
                            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleExportPDF} variant="secondary" size="sm" icon="picture_as_pdf">
                        Exportar PDF
                    </Button>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th onClick={() => handleSort('name')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-1">Nome {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                                </th>
                                <th onClick={() => handleSort('role')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-1">Cargo {sortConfig.key === 'role' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                                </th>
                                <th onClick={() => handleSort('contractType')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-1">Vínculo {sortConfig.key === 'contractType' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                                </th>
                                <th onClick={() => handleSort('observations')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-1">Observações {sortConfig.key === 'observations' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredAndSortedStaff.length > 0 ? (
                                filteredAndSortedStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{staff.name}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{staff.role}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                                {staff.contractType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 italic max-w-xs truncate" title={staff.observations}>
                                            {staff.observations || '-'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        Nenhum servidor encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button onClick={onClose} variant="secondary">
                        Fechar
                    </Button>
                </div>
            </div>
        </div>
    );
};
