export const getModalityOrder = (m: string | undefined | null) => {
    if (!m) return 99;
    const v = m.toLowerCase();
    if (v.includes("infantil")) return 1;
    if (v.includes("anos iniciais")) return 2;
    if (v.includes("anos finais")) return 3;
    if (v.includes("eja")) return 4;
    if (v.includes("especial")) return 5;
    return 99;
};

export const getSeriesOrder = (s: string | undefined | null) => {
    if (!s) return 99;
    const v = s.toLowerCase();
    if (v.includes("2 anos")) return 1;
    if (v.includes("3 anos")) return 2;
    if (v.includes("4 anos")) return 3;
    if (v.includes("5 anos")) return 4;
    if (v.includes("1º")) return 5;
    if (v.includes("2º")) return 6;
    if (v.includes("3º")) return 7;
    if (v.includes("4º")) return 8;
    if (v.includes("5º")) return 9;
    if (v.includes("6º")) return 10;
    if (v.includes("7º")) return 11;
    if (v.includes("8º")) return 12;
    if (v.includes("9º")) return 13;
    if (v.includes("1ª etapa")) return 14;
    if (v.includes("2ª etapa")) return 15;
    if (v.includes("srm")) return 16;
    return 99;
};

export const getSectionOrder = (s: string | undefined | null) => {
    if (!s) return 99;
    const v = s.toLowerCase();
    if (v === 'a') return 1;
    if (v === 'b') return 2;
    if (v === 'c') return 3;
    if (v === 'd') return 4;
    if (v.includes("mista")) return 5;
    if (v.includes("multi")) return 6;
    if (v.includes("aee")) return 7;
    return 50;
};

export const getShiftOrder = (s: string | undefined | null) => {
    if (!s) return 99;
    const v = s.toLowerCase();
    if (v.includes("matutino")) return 1;
    if (v.includes("vespertino")) return 2;
    if (v.includes("integral")) return 3;
    return 99;
};

export const sortClasses = (a: any, b: any) => {
    // 1. Modality
    const modA = getModalityOrder(a.modality);
    const modB = getModalityOrder(b.modality);
    if (modA !== modB) return modA - modB;

    // 2. Series
    const serA = getSeriesOrder(a.series);
    const serB = getSeriesOrder(b.series);
    if (serA !== serB) return serA - serB;

    // 3. Section (Turma)
    const secA = getSectionOrder(a.section || a.name); // Handle 'section' or generic name if needed? Usually section.
    const secB = getSectionOrder(b.section || b.name);
    if (secA !== secB) return secA - secB;

    // 4. Shift
    const shiftA = getShiftOrder(a.shift);
    const shiftB = getShiftOrder(b.shift);
    return shiftA - shiftB;
};
