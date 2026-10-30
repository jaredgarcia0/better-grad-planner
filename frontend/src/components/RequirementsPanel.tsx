import { useEffect, useState } from "react";
import { getProgramRequirementTree, Program, RequirementNode, RequirementSectionId } from "../api/client";

type Requirement = { code: string; title: string; credits: number };
type Group = Omit<RequirementNode, "courses" | "children"> & { courses: Requirement[] };
type ProgramGroups = { program: Program; groups: Group[] };

function flattenRequirementNodes(nodes: RequirementNode[]): Group[] {
  return nodes.flatMap((node) => [
    {
      ...node,
      courses: node.courses.map((link) => ({
        code: link.course.code,
        title: link.course.title,
        credits: link.creditsOverride ?? link.course.credits,
      })),
    },
    ...flattenRequirementNodes(node.children),
  ]);
}

function RequirementGroupView({ group }: { group: Group }) {
  return (
    <div className="requirement-group">
      <div className="requirement-group-heading">
        <strong>{group.name}</strong>
        <span>{group.courses.length} courses</span>
      </div>
      {group.courses.slice(0, 4).map((course) => (
        <div className="requirement-item" key={course.code}>
          <span className="status-dot open" />
          <div>
            <strong>{course.code}</strong>
            <span>{course.title}</span>
          </div>
          <b>{course.credits} cr</b>
        </div>
      ))}
      {group.courses.length > 4 && (
        <p className="requirement-more">
          + {group.courses.length - 4} more courses
        </p>
      )}
    </div>
  );
}

async function loadProgramGroups(program: Program): Promise<ProgramGroups> {
  const requirementResult = await getProgramRequirementTree(program.id);
  const groups = flattenRequirementNodes(requirementResult.data);
  return { program, groups };
}

export function RequirementsPanel({
  programs,
  layout,
  onLayoutChange,
}: {
  programs: Program[];
  layout?: RequirementSectionId[];
  onLayoutChange?: (layout: RequirementSectionId[]) => void;
}) {
  const [programGroups, setProgramGroups] = useState<ProgramGroups[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<RequirementSectionId[]>(
    layout?.length ? layout : ["major", "general", "electives"],
  );
  const programKey = programs.map((program) => program.id).join(",");

  useEffect(() => {
    setSectionOrder(layout?.length ? layout : ["major", "general", "electives"]);
  }, [layout]);

  useEffect(() => {
    let cancelled = false;
    const selectedPrograms = programs;
    setLoading(true);
    setError(null);
    if (selectedPrograms.length === 0) {
      setProgramGroups([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    Promise.all(selectedPrograms.map(loadProgramGroups))
      .then((result) => {
        if (!cancelled) setProgramGroups(result);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load degree requirements",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programKey]);

  const orderedSections = Array.from(
    new Set([...sectionOrder, "major", "general", "electives"]),
  ) as RequirementSectionId[];

  function moveSection(section: RequirementSectionId, direction: -1 | 1) {
    const index = orderedSections.indexOf(section);
    const target = index + direction;
    if (target < 0 || target >= orderedSections.length) return;
    const next = [...orderedSections];
    [next[index], next[target]] = [next[target], next[index]];
    setSectionOrder(next);
    onLayoutChange?.(next);
  }

  function renderSection(section: RequirementSectionId) {
    if (section === "electives") {
      return (
        <section className="requirement-layout-section" key={section}>
          <header className="requirement-layout-section__header">
            <strong>Electives</strong>
            <span className="requirement-layout-section__actions">
              <button type="button" onClick={() => moveSection(section, -1)} aria-label="Move electives up">↑</button>
              <button type="button" onClick={() => moveSection(section, 1)} aria-label="Move electives down">↓</button>
            </span>
          </header>
          <p className="muted">Elective options are pulled from the selected program requirements.</p>
        </section>
      );
    }
    const program = section === "major"
      ? programGroups.find(({ program }) => program.degreeType !== "MINOR")
      : programGroups.find(({ program }) => program.degreeType === "MINOR");
    if (!program) return null;
    return (
      <section className="program-requirements requirement-layout-section" key={section}>
        <div className="program-requirements-heading">
          <span>{program.program.degreeType === "MINOR" ? "MINOR" : "MAJOR"}</span>
          <strong>{program.program.name}</strong>
          <span className="requirement-layout-section__actions">
            <button type="button" onClick={() => moveSection(section, -1)} aria-label={`Move ${section} up`}>↑</button>
            <button type="button" onClick={() => moveSection(section, 1)} aria-label={`Move ${section} down`}>↓</button>
          </span>
        </div>
        {program.groups.map((group) => <RequirementGroupView key={group.id} group={group} />)}
      </section>
    );
  }

  return (
    <aside className="card requirements-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Degree audit</p>
          <h2>Requirements</h2>
        </div>
        <span className="result-count">
          {programs.length > 1 ? "Major + minor" : "Selected major"}
        </span>
      </div>
      {loading && <p className="muted">Loading requirements…</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && programGroups.length === 0 && (
        <p className="muted">No requirements found for this program.</p>
      )}
      {!loading && !error && programGroups.length > 0 && (
        <div className="requirement-layout" aria-label="Reorderable degree requirement sections">
          <p className="requirement-layout__hint">Use the arrows to arrange your plan</p>
          {orderedSections.map(renderSection)}
        </div>
      )}
    </aside>
  );
}
