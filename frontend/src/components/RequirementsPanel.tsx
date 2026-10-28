import { useEffect, useState } from "react";
import {
  getCourse,
  listProgramRequirements,
  listRequirementCourses,
  Program,
  RequirementGroup,
} from "../api/client";

type Requirement = { code: string; title: string; credits: number };
type Group = RequirementGroup & { courses: Requirement[] };
type ProgramGroups = { program: Program; groups: Group[] };

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
  const requirementResult = await listProgramRequirements(program.id);
  const groups = await Promise.all(
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
  return { program, groups };
}

export function RequirementsPanel({ programs }: { programs: Program[] }) {
  const [programGroups, setProgramGroups] = useState<ProgramGroups[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const programKey = programs.map((program) => program.id).join(",");

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
      {!loading &&
        !error &&
        programGroups.map(({ program, groups }) => (
          <section className="program-requirements" key={program.id}>
            <div className="program-requirements-heading">
              <span>{program.degreeType === "MINOR" ? "MINOR" : "MAJOR"}</span>
              <strong>{program.name}</strong>
            </div>
            {groups.length === 0 ? (
              <p className="muted">
                No requirements are listed for this program yet.
              </p>
            ) : (
              groups.map((group) => (
                <RequirementGroupView key={group.id} group={group} />
              ))
            )}
          </section>
        ))}
    </aside>
  );
}
