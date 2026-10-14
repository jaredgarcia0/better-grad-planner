// Scrapes every course and program (majors, minors, clusters, certificates and
// GE programs) from the BYU-Idaho academic catalog (hosted on Kuali) and writes
// them to prisma/data/byui-catalog.json for prisma/seed.ts to load.
//
// Usage: npx tsx scripts/scrape-byui-catalog.ts [programCode ...]
// Program codes are the catalog codes, e.g. 440 = Computer Science (BS). With
// no codes, all programs are scraped. All courses are scraped either way.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, HTMLElement } from "node-html-parser";

const KUALI = "https://byui.kuali.co/api/v1/catalog";
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(currentDir, "../prisma/data/byui-catalog.json");
const CONCURRENCY = 8;

type DegreeType =
  | "ASSOCIATE"
  | "BACHELOR"
  | "MASTER"
  | "DOCTORATE"
  | "CERTIFICATE"
  | "MINOR"
  | "CLUSTER"
  | "GENERAL_EDUCATION"
  | "OTHER";
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
  maxCredits?: number;
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

async function getJson<T = any>(url: string, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

// Maps items through fn with at most CONCURRENCY requests in flight.
async function mapPool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
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

// Courses missing from the catalog (retired, typos) can't be linked, so they
// become non-course conditions.
function withKnownCourses(rule: Rule, known: Set<string>): Rule {
  if (rule.kind === "course") return known.has(rule.code) ? rule : { kind: "other", text: rule.code };
  if (rule.kind === "other") return rule;
  return { kind: rule.kind, children: rule.children.map((r) => withKnownCourses(r, known)) };
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
  if (/Minor/i.test(s)) return "MINOR";
  if (/Cluster/i.test(s)) return "CLUSTER";
  if (/General Education/i.test(s)) return "GENERAL_EDUCATION";
  return "OTHER";
}

// Parses one leaf rule from a program's requirement section into a group.
function parseProgramRule(
  li: HTMLElement,
  name: string,
  minGrade: string | undefined,
): RequirementGroup {
  const text = clean(li.text);
  const codes = [...new Set(courseCodesIn(li))];
  const credits = Number(/Take at least (\d+(?:\.\d+)?) credit/i.exec(text)?.[1]) || undefined;
  const creditRange = /Take between (\d+(?:\.\d+)?) and (\d+(?:\.\d+)?) credit/i.exec(text);
  const group: RequirementGroup = {
    name,
    requirementType: "REQUIRED",
    operator: "ALL",
    courses: codes.map((code) => ({ code, minGrade })),
    children: [],
  };

  if (creditRange) {
    group.operator = "ANY";
    group.requirementType = "ELECTIVE";
    group.minCredits = Number(creditRange[1]);
    group.maxCredits = Number(creditRange[2]);
    if (codes.length === 0) group.description = text;
  } else if (/complete the following program/i.test(text)) {
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

interface ProgramRuleItem {
  li: HTMLElement;
  label: string;
}

// A program rule list holds <li>s, or <div>s wrapping an <li> under a <span>
// label: a connector ("AND"/"OR"), an option name, or a note.
function programRuleItems(ul: HTMLElement): ProgramRuleItem[] {
  return ul.childNodes
    .filter((n): n is HTMLElement => n instanceof HTMLElement)
    .flatMap((child) => {
      if (child.tagName === "LI") return [{ li: child, label: "" }];
      const li = child.querySelector(":scope > li");
      return li ? [{ li, label: child.querySelector(":scope > span")?.text.trim() ?? "" }] : [];
    });
}

const isLeafRule = (li: HTMLElement) => li.getAttribute("data-test")?.startsWith("ruleView") ?? false;

// Leaf rules such as "GE103 is for Online students only." are notes, not
// requirements; as children of an ANY group they would count as satisfied.
const isNoteRule = (li: HTMLElement) =>
  isLeafRule(li) && courseCodesIn(li).length === 0 && !/^Take\b|complete the following program/i.test(clean(li.text));

// Parses a rule, or a "Complete all/N of the following" group of rules, into a
// requirement group. Groups nest arbitrarily deep.
function parseProgramItem(item: ProgramRuleItem, fallbackName: string, minGrade: string | undefined): RequirementGroup {
  const [firstLine, ...rest] = item.label.split("\n");
  let label = clean(firstLine);
  let notes = clean(rest.join(" "));
  if (/^(AND|OR)$/i.test(label)) label = "";
  else if (/^NOTE\b/i.test(label) || (!/^Option\b/i.test(label) && label.split(" ").length > 5)) {
    notes = clean(item.label);
    label = "";
  }
  const name = label || fallbackName;

  let group: RequirementGroup;
  if (isLeafRule(item.li)) {
    group = parseProgramRule(item.li, name, minGrade);
  } else {
    const header = clean(item.li.querySelector(":scope > span")?.text ?? "");
    const operator = /^Complete all/i.test(header) ? "ALL" : "ANY";
    const list = item.li.querySelector(":scope > ul");
    const items = list ? programRuleItems(list) : [];
    const ruleNotes = items.filter((c) => isNoteRule(c.li)).map((c) => clean(c.li.text));
    group = {
      name,
      description: [header, ...ruleNotes].join(" ") || undefined,
      requirementType: "REQUIRED",
      operator,
      courses: [],
      children: items
        .filter((c) => !isNoteRule(c.li))
        .map((c, i) => parseProgramItem(c, operator === "ANY" ? `Option ${i + 1}` : name, minGrade)),
    };
  }
  if (notes) group.description = [notes, group.description].filter(Boolean).join(" ");
  return group;
}

function parseProgramRequirements(html: string, minGrade: string | undefined): RequirementGroup[] {
  const root = parse(html);
  return root.querySelectorAll("section").flatMap((section) => {
    const name = clean(section.querySelector("h2")?.text ?? "Requirements");
    const totalCredits = Number(clean(section.querySelector("header > div:nth-child(2) > span")?.text ?? "")) || undefined;
    const list = section.querySelector(":scope > div > div > ul");
    const items = list ? programRuleItems(list) : [];
    if (items.length === 0) return [];
    const group: RequirementGroup =
      items.length === 1
        ? parseProgramItem(items[0], name, minGrade)
        : {
            name,
            requirementType: "REQUIRED",
            operator: "ALL",
            courses: [],
            children: items.map((c) => parseProgramItem(c, name, minGrade)),
          };

    if (/elective/i.test(name) && group.requirementType === "REQUIRED") group.requirementType = "ELECTIVE";
    group.minCredits ??= totalCredits;
    return [group];
  });
}

async function main() {
  const requestedCodes = process.argv.slice(2);

  const catalog = await getJson(`${KUALI}/public/catalogs/current`);
  const catalogYear = Number(/(\d{4})/.exec(catalog.title)?.[1]);
  if (!catalogYear) throw new Error(`Couldn't read a catalog year from "${catalog.title}"`);
  console.log(`Catalog: ${catalog.title} (${catalog._id})`);

  const [programList, courseList] = await Promise.all([
    getJson<any[]>(`${KUALI}/programs/${catalog._id}`),
    getJson<any[]>(`${KUALI}/courses/${catalog._id}`),
  ]);
  const knownCourses = new Set<string>(courseList.map((c) => c.__catalogCourseId));

  const programSummaries = requestedCodes.length
    ? requestedCodes.map((code) => {
        const summary = programList.find((p) => p.code === code);
        if (!summary) throw new Error(`Program ${code} not found in catalog`);
        return summary;
      })
    : programList;

  console.log(`Fetching ${programSummaries.length} programs...`);
  const programDetails = await mapPool(programSummaries, (p) => getJson(`${KUALI}/program/${catalog._id}/${p.pid}`));
  console.log(`Fetching ${courseList.length} courses...`);
  const courseDetails = await mapPool(courseList, (c) => getJson(`${KUALI}/course/${catalog._id}/${c.pid}`));

  // Program rules occasionally name courses missing from the catalog; those
  // can't be linked, so they're dropped (the rule text is kept in descriptions).
  const droppedCourses = new Map<string, Set<string>>();
  const dropUnknownCourses = (group: RequirementGroup, programCode: string) => {
    group.courses = group.courses.filter((c) => {
      if (knownCourses.has(c.code)) return true;
      droppedCourses.set(c.code, (droppedCourses.get(c.code) ?? new Set()).add(programCode));
      return false;
    });
    group.children.forEach((child) => dropUnknownCourses(child, programCode));
  };

  const programs = programDetails.map((program) => {
    const minGrade = /grades of (\S+) or higher in major courses/i.exec(program.programNotes ?? "")?.[1];
    const html: string = program.newProgramRules1 ?? "";
    const requirementGroups = parseProgramRequirements(html, minGrade);
    requirementGroups.forEach((g) => dropUnknownCourses(g, program.code));
    return {
      code: program.code,
      name: program.title,
      degreeType: degreeType(program),
      catalogYear,
      description: program.description || undefined,
      totalCredits: Number(/Grand Total Credits:\s*(?:<[^>]+>)*\s*(\d+(?:\.\d+)?)/.exec(html)?.[1]) || undefined,
      requirementGroups,
    };
  });
  programs.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const unrepresentable: string[] = [];
  const courses: Course[] = courseList.map((summary, i) => {
    const d = courseDetails[i];
    const code: string = summary.__catalogCourseId;
    const credits = d.credits?.credits ?? {};
    const course: Course = {
      code,
      title: d.title,
      description: d.description || undefined,
      credits: Number(credits.min ?? d.credits?.value ?? 0) || 0,
      level: courseLevel(code),
      departmentCode: d.department?.customFields?.["CX Department Code"],
      prerequisites: [],
      corequisites: [],
    };
    for (const [field, html] of [
      ["prerequisites", d.prerequisites],
      ["corequisites", d.coRequisites],
    ] as const) {
      const rule = parseRuleHtml(html);
      if (!rule) continue;
      const cnf = toCnf(withKnownCourses(rule, knownCourses));
      course[field] = isRepresentable(cnf) ? cnf : null;
      if (!isRepresentable(cnf)) unrepresentable.push(`${code} ${field}`);
      course[field === "prerequisites" ? "prerequisiteText" : "corequisiteText"] = ruleText(html);
    }
    return course;
  });
  courses.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const departments = new Map<string, string>();
  for (const d of courseDetails) {
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
  for (const [code, programCodes] of droppedCourses) {
    console.warn(`Dropped ${code} (not in catalog) from programs: ${[...programCodes].join(", ")}`);
  }
  if (unrepresentable.length) {
    console.warn(`${unrepresentable.length} rules too complex for the schema (left null, see *Text fields): ${unrepresentable.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
