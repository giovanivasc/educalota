export const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

export const matchesSearch = (text: string, searchTerm: string): boolean => {
    return normalizeText(text).includes(normalizeText(searchTerm));
};
