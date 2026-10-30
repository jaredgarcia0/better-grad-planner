import { useEffect, useMemo, useState } from "react";
import {
  getCourse,
  getProgram,
  listProgramRequirements,
  listPrograms,
  listRequirementCourses,
  RequirementGroup,
  RequirementSectionId,
} from "../api/client";

type Requirement = { code: string; title: string; credits: number };
type Group = RequirementGroup & { courses: Requirement[] };

function RequirementGroupView({
  title,
  group,
}: {
  title: string;
  group: Group;
}) {
  return (
    <div className="requirement-group">
      <div className="requirement-group-heading">
        <strong>{title}</strong>
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
    </div>
  );
}

type RequirementsPanelProps = {
  programId?: string;
  layout?: RequirementSectionId[] | null;
  onLayoutChange?: (layout: RequirementSectionId[]) => void;
};

export function RequirementsPanel({
  programId,
  layout,
  onLayoutChange,
}: RequirementsPanelProps = {}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [programName, setProgramName] = useState("Degree requirements");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedSection, setDraggedSection] = useState<RequirementSectionId | null>(null);
  const [sectionOrder, setSectionOrder] = useState<RequirementSectionId[]>(
    layout?.length ? layout : ["major", "general", "electives"],
  );

  useEffect(() => {
    setSectionOrder(layout?.length ? layout : ["major", "general", "electives"]);
  }, [layout]);

  useEffect(() => {
    let cancelled = false;
    async function loadRequirements() {
      setLoading(true);
      setError(null);
      try {
        const program = programId
          ? (await getProgram(programId)).data
          : (await listPrograms("computer")).data[0] ??
            (await listPrograms()).data[0];
        if (!program?.id) {
          if (!cancelled) setGroups([]);
          return;
        }
        const requirementResult = await listProgramRequirements(program.id);
        const loadedGroups = await Promise.all(
          requirementResult.data.map(async (group) => {
            const links = await listRequirementCourses(group.id);
            const courses = await Promise.all(
              links.data.map(async (link) => {
                const result = await getCourse(link.courseId);
                return {
                  code: result.data.code,
                  title: result.data.title,
                  credits: link.creditsOverride ?? result.data.credits,
                };
              }),
            );
            return { ...group, courses };
          }),
        );
        if (!cancelled) {
          setProgramName(program.name);
          setGroups(loadedGroups);
        }
      } catch (requestError) {
        if (!cancelled)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load degree requirements",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRequirements();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const major = groups.filter((group) =>
    ["REQUIRED", "CONCENTRATION", "CAPSTONE"].includes(group.requirementType),
  );
  const general = groups.filter(
    (group) => group.requirementType === "GENERAL_EDUCATION",
  );
  const electives = groups.filter((group) =>
    ["ELECTIVE", "OTHER"].includes(group.requirementType),
  );
  const electiveCredits = electives.reduce(
    (total, group) =>
      total +
      (group.minCredits ??
        group.maxCredits ??
        group.courses.reduce((sum, course) => sum + course.credits, 0)),
    0,
  );

  const orderedSections = useMemo(() => {
    const defaults: RequirementSectionId[] = ["major", "general", "electives"];
    return Array.from(new Set([...sectionOrder, ...defaults])) as RequirementSectionId[];
  }, [sectionOrder]);

  function moveSection(section: RequirementSectionId, target: RequirementSectionId) {
    if (section === target) return;
    const next = [...orderedSections];
    const fromIndex = next.indexOf(section);
    const toIndex = next.indexOf(target);
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, section);
    setSectionOrder(next);
    onLayoutChange?.(next);
  }

  function shiftSection(section: RequirementSectionId, direction: -1 | 1) {
    const index = orderedSections.indexOf(section);
    const target = orderedSections[index + direction];
    if (target) moveSection(section, target);
  }

  function renderSection(section: RequirementSectionId) {
    const sectionContent = {
      major: (
        <>
          {major.slice(0, 1).map((group) => (
            <RequirementGroupView key={group.id} title="Major requirements" group={group} />
          ))}
          {major.length === 0 && <p className="muted requirement-empty">No major requirements found.</p>}
        </>
      ),
      general: (
        <>
          {general.slice(0, 1).map((group) => (
            <RequirementGroupView key={group.id} title="General education" group={group} />
          ))}
          {general.length === 0 && <p className="muted requirement-empty">No general education requirements found.</p>}
        </>
      ),
      electives: (
        <div className="requirement-group elective-group">
          <div className="requirement-group-heading">
            <strong>Electives counting toward degree</strong>
            <span>{electiveCredits} cr</span>
          </div>
          <div className="elective-progress"><i /></div>
          <p className="muted">Elective options are pulled from the selected program requirements.</p>
        </div>
      ),
    }[section];
    const titles = { major: "Major requirements", general: "General education", electives: "Electives" };
    const index = orderedSections.indexOf(section);

    return (
      <section
        className={`requirement-layout-section${draggedSection === section ? " is-dragging" : ""}`}
        key={section}
        draggable
        onDragStart={() => setDraggedSection(section)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggedSection) moveSection(draggedSection, section);
          setDraggedSection(null);
        }}
        onDragEnd={() => setDraggedSection(null)}
      >
        <header className="requirement-layout-section__header">
          <span className="requirement-drag-handle" aria-hidden="true">⠿</span>
          <strong>{titles[section]}</strong>
          <span className="requirement-layout-section__actions">
            <button type="button" onClick={() => shiftSection(section, -1)} disabled={index === 0} aria-label={`Move ${titles[section]} up`}>↑</button>
            <button type="button" onClick={() => shiftSection(section, 1)} disabled={index === orderedSections.length - 1} aria-label={`Move ${titles[section]} down`}>↓</button>
          </span>
        </header>
        {sectionContent}
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
        <span className="result-count">{programName}</span>
      </div>
      {loading && <p className="muted">Loading requirements…</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && groups.length === 0 && (
        <p className="muted">No requirements found for this program.</p>
      )}
      {!loading && !error && groups.length > 0 && (
        <div className="requirement-layout" aria-label="Reorderable degree requirement sections">
          <p className="requirement-layout__hint">Drag sections to arrange your plan</p>
          {orderedSections.map(renderSection)}
        </div>
      )}
    </aside>
  );
}
