export const getModalityOrder = (m: string | undefined | null) => {
    if (!m) return 99;
    const v = m.toLowerCase();
    if (v.includes("infantil")) return 1;
    if (v.includes("anos iniciais") || v.includes("1º/5º")) return 2;
    if (v.includes("anos finais") || v.includes("6º/9º")) return 3;
    if (v.includes("eja")) return 4;
    if (v.includes("especial")) return 5;
    return 99;
};

export const getSeriesOrder = (s: string | undefined | null) => {
    if (!s) return 999;
    const v = s.toLowerCase();

    // Check specific keywords first
    if (v.includes("berçário")) return 0;
    if (v.includes("maternal")) return 1;
    if (v.includes("pré") || v.includes("pre")) return 2;

    // Try to extract numbers
    const match = v.match(/(\d+)/);
    if (match) {
        const num = parseInt(match[1]);
        // Adjust for "stages" vs "years" if needed, but usually simple numeric sort works
        // If it's a "Stage" (Etapa) usually for EJA, we might want to group them after regular years
        if (v.includes("etapa")) return 20 + num;
        if (v.includes("ano")) return 10 + num; // 1º Ano -> 11, 9º Ano -> 19
        return 10 + num; // Fallback
    }

    return 999;
};

export const getSectionOrder = (s: string | undefined | null) => {
    if (!s) return 99;
    const v = s.toLowerCase().trim();

    // Extract single letter if present (e.g., "Turma A" -> "a")
    const match = v.match(/\b([a-z])\b$/) || v.match(/^([a-z])$/);
    if (match) {
        return match[1].charCodeAt(0) - 96; // 'a' -> 1, 'b' -> 2
    }

    if (v.includes("mista")) return 50;
    if (v.includes("multi")) return 51;
    if (v.includes("aee")) return 52;

    return 99;
};

export const getShiftOrder = (s: string | undefined | null) => {
    if (!s) return 99;
    const v = s.toLowerCase();
    if (v.includes("manhã") || v.includes("matutino")) return 1;
    if (v.includes("tarde") || v.includes("vespertino")) return 2;
    if (v.includes("noite") || v.includes("noturno")) return 3;
    if (v.includes("integral")) return 4;
    return 99;
};

export const sortClasses = (a: any, b: any) => {
    // 1. Modality
    const modA = getModalityOrder(a.modality);
    const modB = getModalityOrder(b.modality);
    if (modA !== modB) return modA - modB;

    // 2. Series (Numeric)
    const serA = getSeriesOrder(a.series);
    const serB = getSeriesOrder(b.series);
    if (serA !== serB) return serA - serB;

    // 3. Section (Turma)
    const secA = getSectionOrder(a.section || a.name);
    const secB = getSectionOrder(b.section || b.name);
    if (secA !== secB) return secA - secB;

    // 4. Shift
    const shiftA = getShiftOrder(a.shift);
    const shiftB = getShiftOrder(b.shift);
    return shiftA - shiftB;
};
