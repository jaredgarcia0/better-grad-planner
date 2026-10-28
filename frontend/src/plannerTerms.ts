export type PlanTerm = { id: string; label: string; date: string };
export type AcademicYear = { id: string; label: string; terms: PlanTerm[] };

export function buildAcademicYears(
  firstYear = 2026,
  lastYear = 2029,
): AcademicYear[] {
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const year = firstYear + index;
    return {
      id: `${year}`,
      label: `${year}`,
      terms: [
        { id: `winter-${year}`, label: `Winter ${year}`, date: "Jan – Apr" },
        { id: `spring-${year}`, label: `Spring ${year}`, date: "May – Aug" },
        { id: `fall-${year}`, label: `Fall ${year}`, date: "Sep – Dec" },
      ],
    };
  });
}

export const plannerYears = buildAcademicYears();

export function listPlanTerms() {
  return buildAcademicYears().flatMap((year) => year.terms);
}

// BYU-Idaho runs three semesters: Winter (Jan–Apr), Spring (May–Aug), Fall (Sep–Dec).
export function getCurrentTermId(today = new Date()) {
  const month = today.getMonth();
  const season = month < 4 ? "winter" : month < 8 ? "spring" : "fall";
  return `${season}-${today.getFullYear()}`;
}

// Defaults a new plan to the current semester through the fourth calendar year.
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
  return match?.[2] ?? "2026";
}
