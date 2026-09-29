// Scrapes degree programs from the BYU-Idaho academic catalog (hosted on Kuali)
// and writes them to prisma/data/byui-catalog.json for prisma/seed.ts to load.
//
// Usage: npx tsx scripts/scrape-byui-catalog.ts [programCode ...]
// Program codes are the catalog codes, e.g. 440 = Computer Science (BS).

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, HTMLElement } from "node-html-parser";

const KUALI = "https://byui.kuali.co/api/v1/catalog";
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(currentDir, "../prisma/data/byui-catalog.json");
const DEFAULT_PROGRAM_CODES = ["440"];

type DegreeType = "ASSOCIATE" | "BACHELOR" | "MASTER" | "DOCTORATE" | "CERTIFICATE" | "OTHER";
type RequirementType = "REQUIRED" | "ELECTIVE" | "CONCENTRATION" | "GENERAL_EDUCATION" | "CAPSTONE" | "OTHER";
type CourseLevel = "INTRODUCTORY" | "INTERMEDIATE" | "ADVANCED" | "GRADUATE";

interface RequirementCourse {
  code: string;
  minGrade?: string;
  creditsOverride?: number;
}

interface RequirementGroup {
  name: string;
  description?: string;
  requirementType: RequirementType;
  operator: "ALL" | "ANY";
  minCourses?: number;
  minCredits?: number;
  courses: RequirementCourse[];
  children: RequirementGroup[];
}

interface Course {
  code: string;
  title: string;
  description?: string;
  credits: number;
  level?: CourseLevel;
  departmentCode?: string;
  // Conjunctive normal form: every inner array must be satisfied by taking one
  // of its courses. Null when the catalog rule can't be expressed that way;
  // absent when the course was only scraped as another course's prerequisite.
  prerequisites?: string[][] | null;
  corequisites?: string[][] | null;
  prerequisiteText?: string;
  corequisiteText?: string;
}

// Boolean requirement tree parsed from Kuali's rendered rule HTML. "other"
// leaves are non-course conditions (test scores, retired courses, etc.).
type Rule =
  | { kind: "course"; code: string }
  | { kind: "other"; text: string }
  | { kind: "all" | "any"; children: Rule[] };

async function getJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function courseCodesIn(el: HTMLElement): string[] {
  return el.querySelectorAll('a[href^="#/courses/view/"]').map((a) => clean(a.text));
}

// A leaf rule is an <li data-test="ruleView-..."> element.
function parseLeafRule(li: HTMLElement): Rule {
  const text = clean(li.text);
  const codes = courseCodesIn(li);
  if (codes.length === 0) return { kind: "other", text };
  const children: Rule[] = codes.map((code) => ({ kind: "course", code }));
  if (/^Take the following course/i.test(text)) return { kind: "all", children };
  return { kind: "any", children };
}

// A group is an <li> whose first child is "<span>Complete N of the following</span>"
// followed by a <ul> of rules. Rules may be wrapped in <div>s that carry an
// "OR"/"Option N:" header.
function parseRuleItem(li: HTMLElement): Rule {
  if (li.getAttribute("data-test")?.startsWith("ruleView")) return parseLeafRule(li);
  const header = clean(li.querySelector(":scope > span")?.text ?? "");
  const list = li.querySelector(":scope > ul");
  const children = list ? parseRuleList(list) : [];
  return { kind: /^Complete all/i.test(header) ? "all" : "any", children };
}

function parseRuleList(ul: HTMLElement): Rule[] {
  const rules: Rule[] = [];
  for (const child of ul.childNodes) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.tagName === "LI") rules.push(parseRuleItem(child));
    else if (child.tagName === "DIV") {
      const li = child.querySelector(":scope > li");
      if (li) rules.push(parseRuleItem(li));
    }
  }
  return rules;
}

function parseRuleHtml(html: string | undefined): Rule | null {
  if (!html) return null;
  const top = parse(html).querySelector("ul");
  if (!top) return null;
  const rules = parseRuleList(top);
  return rules.length === 1 ? rules[0] : { kind: "all", children: rules };
}

// Converts a rule tree to CNF over course codes. Non-course conditions are
// treated as unavailable, so they drop out of "any" choices; required
// non-course conditions (e.g. "45 credits earned") are then ignored.
function toCnf(rule: Rule): string[][] {
  const cnf = (r: Rule): Set<string>[] => {
    switch (r.kind) {
      case "course":
        return [new Set([r.code])];
      case "other":
        return [new Set()];
      case "all":
        return r.children.flatMap(cnf);
      case "any": {
        let result: Set<string>[] = [new Set()];
        for (const child of r.children) {
          const clauses = cnf(child);
          result = result.flatMap((a) => clauses.map((b) => new Set([...a, ...b])));
        }
        return r.children.length ? result : [];
      }
    }
  };
  const clauses = cnf(rule).filter((c) => c.size > 0);
  // Drop duplicate and redundant clauses: if {A} is required, {A, B} adds nothing.
  const minimal = clauses.filter(
    (c, i) =>
      !clauses.some(
        (o, j) => j !== i && [...o].every((x) => c.has(x)) && (o.size < c.size || j < i),
      ),
  );
  return minimal.map((c) => [...c].sort());
}

// The schema stores each prerequisite course once per course, so a course may
// only appear in a single OR-group.
function isRepresentable(cnf: string[][]): boolean {
  const all = cnf.flat();
  return new Set(all).size === all.length;
}

function ruleCourses(rule: Rule | null): string[] {
  if (!rule) return [];
  if (rule.kind === "course") return [rule.code];
  if (rule.kind === "other") return [];
  return rule.children.flatMap(ruleCourses);
}

function ruleText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const root = parse(html);
  root.querySelectorAll("li").forEach((li) => li.insertAdjacentHTML("afterbegin", " ; "));
  return clean(root.text).replace(/^;\s*/, "") || undefined;
}

// 100-level is introductory, 200-level intermediate, 300/400-level advanced.
function courseLevel(code: string): CourseLevel | undefined {
  const n = Number(/\d+/.exec(code)?.[0]);
  if (!n) return undefined;
  if (n < 200) return "INTRODUCTORY";
  if (n < 300) return "INTERMEDIATE";
  if (n < 500) return "ADVANCED";
  return "GRADUATE";
}

function degreeType(program: any): DegreeType {
  const s = `${program.degree7?.name ?? ""} ${program.programType?.name ?? ""}`;
  if (/Bachelor/i.test(s)) return "BACHELOR";
  if (/Associate/i.test(s)) return "ASSOCIATE";
  if (/Master/i.test(s)) return "MASTER";
  if (/Doctor/i.test(s)) return "DOCTORATE";
  if (/Certificate/i.test(s)) return "CERTIFICATE";
  return "OTHER";
}

// Parses one leaf rule from a program's requirement section into a group.
function parseProgramRule(
  li: HTMLElement,
  name: string,
  minGrade: string | undefined,
): RequirementGroup {
  const text = clean(li.text);
  const codes = courseCodesIn(li);
  const credits = Number(/Take at least (\d+) credit/i.exec(text)?.[1]) || undefined;
  const group: RequirementGroup = {
    name,
    requirementType: "REQUIRED",
    operator: "ALL",
    courses: codes.map((code) => ({ code, minGrade })),
    children: [],
  };

  if (/complete the following program/i.test(text)) {
    group.requirementType = /GE\b|General Education/i.test(text) ? "GENERAL_EDUCATION" : "OTHER";
    group.minCredits = credits;
    group.description = text;
  } else if (/^Take the following course/i.test(text)) {
    group.minCredits = undefined;
  } else if (/^Take \d+ of the following/i.test(text)) {
    group.operator = "ANY";
    group.minCourses = Number(/^Take (\d+) of/i.exec(text)![1]);
  } else if (credits) {
    group.operator = "ANY";
    group.minCredits = credits;
    group.requirementType = codes.length > 1 || codes.length === 0 ? "ELECTIVE" : "REQUIRED";
    if (codes.length === 0) group.description = text;
    if (codes.length === 1) group.courses[0].creditsOverride = credits;
  } else {
    group.requirementType = "OTHER";
    group.description = text;
  }
  return group;
}

function parseProgramRequirements(html: string, minGrade: string | undefined): RequirementGroup[] {
  const root = parse(html);
  return root.querySelectorAll("section").map((section) => {
    const name = clean(section.querySelector("h2")?.text ?? "Requirements");
    const totalCredits = Number(clean(section.querySelector("header > div:nth-child(2) > span")?.text ?? "")) || undefined;
    const list = section.querySelector(":scope > div > div > ul")!;
    const item = list.querySelector(":scope > li")!;
    let group: RequirementGroup;

    if (item.getAttribute("data-test")?.startsWith("ruleView")) {
      group = parseProgramRule(item, name, minGrade);
    } else {
      // "Complete 1 of the following" with an option per child rule.
      const header = clean(item.querySelector(":scope > span")?.text ?? "");
      const options = item.querySelector(":scope > ul")!.childNodes.filter(
        (n): n is HTMLElement => n instanceof HTMLElement,
      );
      group = {
        name,
        description: header,
        requirementType: "REQUIRED",
        operator: /^Complete all/i.test(header) ? "ALL" : "ANY",
        courses: [],
        children: options.map((opt, i) => {
          const label = opt.querySelector(":scope > span")?.text.trim() ?? "";
          const [optionName, ...notes] = label.split("\n");
          const li = opt.tagName === "LI" ? opt : opt.querySelector(":scope > li")!;
          const child = parseProgramRule(li, clean(optionName) || `Option ${i + 1}`, minGrade);
          if (notes.length) child.description = clean(notes.join(" "));
          return child;
        }),
      };
      if (group.operator === "ANY") group.minCourses = undefined;
    }

    if (/elective/i.test(name) && group.requirementType === "REQUIRED") group.requirementType = "ELECTIVE";
    group.minCredits ??= totalCredits;
    return group;
  });
}

async function main() {
  const programCodes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PROGRAM_CODES;

  const catalog = await getJson(`${KUALI}/public/catalogs/current`);
  const catalogYear = Number(/(\d{4})/.exec(catalog.title)?.[1]);
  console.log(`Catalog: ${catalog.title} (${catalog._id})`);

  const [programList, courseList] = await Promise.all([
    getJson<any[]>(`${KUALI}/programs/${catalog._id}`),
    getJson<any[]>(`${KUALI}/courses/${catalog._id}`),
  ]);
  const coursesByCode = new Map(courseList.map((c) => [c.__catalogCourseId, c]));

  const courseDetails = new Map<string, any>();
  async function loadCourse(code: string) {
    if (courseDetails.has(code)) return courseDetails.get(code);
    const summary = coursesByCode.get(code);
    if (!summary) throw new Error(`Course ${code} not found in catalog`);
    const detail = await getJson(`${KUALI}/course/${catalog._id}/${summary.pid}`);
    courseDetails.set(code, detail);
    return detail;
  }

  const programs = [];
  const programCourseCodes = new Set<string>();
  for (const code of programCodes) {
    const summary = programList.find((p) => p.code === code);
    if (!summary) throw new Error(`Program ${code} not found in catalog`);
    const program = await getJson(`${KUALI}/program/${catalog._id}/${summary.pid}`);
    const minGrade = /grades of (\S+) or higher in major courses/i.exec(program.programNotes ?? "")?.[1];
    const html: string = program.newProgramRules1 ?? "";
    courseCodesIn(parse(html)).forEach((c) => programCourseCodes.add(c));

    programs.push({
      code: program.code,
      name: program.title,
      degreeType: degreeType(program),
      catalogYear,
      description: program.description,
      totalCredits: Number(/Grand Total Credits:\s*(?:<[^>]+>)*\s*(\d+)/.exec(html)?.[1]) || undefined,
      requirementGroups: parseProgramRequirements(html, minGrade),
    });
    console.log(`Program: ${program.title} (${program.code})`);
  }

  // Program courses get full prerequisite data. Courses they reference as
  // prerequisites are included too, so those links resolve, but their own
  // prerequisites are left out to keep the scope to this program.
  const courses: Course[] = [];
  const unrepresentable: string[] = [];
  const referenced = new Set<string>();
  const toCourse = (code: string, d: any, withRules: boolean): Course => {
    const credits = d.credits?.credits ?? {};
    const course: Course = {
      code,
      title: d.title,
      description: d.description || undefined,
      credits: Number(credits.min ?? d.credits?.value ?? 0),
      level: courseLevel(code),
      departmentCode: d.department?.customFields?.["CX Department Code"],
    };
    if (!withRules) return course;
    course.prerequisites = [];
    course.corequisites = [];
    for (const [field, html] of [
      ["prerequisites", d.prerequisites],
      ["corequisites", d.coRequisites],
    ] as const) {
      const rule = parseRuleHtml(html);
      if (!rule) continue;
      ruleCourses(rule).forEach((c) => referenced.add(c));
      const cnf = toCnf(rule);
      course[field] = isRepresentable(cnf) ? cnf : null;
      if (!isRepresentable(cnf)) unrepresentable.push(`${code} ${field}`);
      course[field === "prerequisites" ? "prerequisiteText" : "corequisiteText"] = ruleText(html);
    }
    return course;
  };

  for (const code of programCourseCodes) courses.push(toCourse(code, await loadCourse(code), true));
  for (const code of referenced) {
    if (programCourseCodes.has(code)) continue;
    if (!coursesByCode.has(code)) {
      console.warn(`  Skipping unknown prerequisite course ${code}`);
      continue;
    }
    courses.push(toCourse(code, await loadCourse(code), false));
  }
  courses.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const departments = new Map<string, string>();
  for (const d of courseDetails.values()) {
    const dept = d.department;
    if (dept?.customFields?.["CX Department Code"]) departments.set(dept.customFields["CX Department Code"], dept.name);
  }

  const data = {
    source: {
      url: "https://www.byui.edu/catalog/#/programs",
      catalogId: catalog._id,
      catalogTitle: catalog.title,
      scrapedAt: new Date().toISOString(),
    },
    university: { name: "Brigham Young University-Idaho", shortName: "BYU-Idaho", websiteUrl: "https://www.byui.edu" },
    departments: [...departments].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
    courses,
    programs,
  };

  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${courses.length} courses, ${programs.length} program(s) to ${path.relative(process.cwd(), OUTPUT)}`);
  if (unrepresentable.length) {
    console.warn(`Rules too complex for the schema (left null, see *Text fields): ${unrepresentable.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
