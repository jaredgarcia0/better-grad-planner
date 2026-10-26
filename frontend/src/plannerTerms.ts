export type PlanTerm = { id: string; label: string; date: string };
export type AcademicYear = { id: string; label: string; terms: PlanTerm[] };

export function buildAcademicYears(
  firstYear = 2026,
  lastYear = 2040,
): AcademicYear[] {
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const year = firstYear + index;
    const nextYear = year + 1;
    return {
      id: `${year}-${nextYear}`,
      label: `${year}–${nextYear}`,
      terms: [
        { id: `fall-${year}`, label: `Fall ${year}`, date: "Sep – Dec" },
        { id: `winter-${nextYear}`, label: `Winter ${nextYear}`, date: "Jan – Apr" },
        { id: `spring-${nextYear}`, label: `Spring ${nextYear}`, date: "May – Aug" },
      ],
    };
  });
}

export function listPlanTerms() {
  return buildAcademicYears().flatMap((year) => year.terms);
}

// BYU-Idaho runs three semesters: Winter (Jan–Apr), Spring (May–Aug), Fall (Sep–Dec).
export function getCurrentTermId(today = new Date()) {
  const month = today.getMonth();
  const season = month < 4 ? "winter" : month < 8 ? "spring" : "fall";
  return `${season}-${today.getFullYear()}`;
}

// Defaults a new plan to the current semester through the last semester of
// the fourth year (12 semesters total, e.g. Fall 2026 – Spring 2030).
export function getDefaultTermRange(today = new Date()) {
  const terms = listPlanTerms();
  const currentIndex = terms.findIndex(
    (term) => term.id === getCurrentTermId(today),
  );
  const startIndex = Math.max(currentIndex, 0);
  const endIndex = Math.min(startIndex + 11, terms.length - 1);
  return { startTerm: terms[startIndex].id, endTerm: terms[endIndex].id };
}

export function getTermLabel(termId: string) {
  return listPlanTerms().find((term) => term.id === termId)?.label ?? "";
}

export function getAcademicYearId(termId: string) {
  const match = /^(fall|winter|spring)-(\d{4})$/.exec(termId);
  if (!match) return "2026-2027";
  const termYear = Number(match[2]);
  const year = match[1] === "fall" ? termYear : termYear - 1;
  return `${year}-${year + 1}`;
}
