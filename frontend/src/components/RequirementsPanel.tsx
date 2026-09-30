import { useEffect, useState } from "react";
import { getCourse, listProgramRequirements, listPrograms, listRequirementCourses, RequirementGroup } from "../api/client";

type Requirement = { code: string; title: string; credits: number };
type Group = RequirementGroup & { courses: Requirement[] };

function RequirementGroupView({ title, group }: { title: string; group: Group }) {
  return <div className="requirement-group"><div className="requirement-group-heading"><strong>{title}</strong><span>{group.courses.length} courses</span></div>{group.courses.slice(0, 4).map((course) => <div className="requirement-item" key={course.code}><span className="status-dot open" /><div><strong>{course.code}</strong><span>{course.title}</span></div><b>{course.credits} cr</b></div>)}</div>;
}

export function RequirementsPanel() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [programName, setProgramName] = useState("Degree requirements");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequirements() {
      try {
        const matchingPrograms = await listPrograms("computer");
        const program = matchingPrograms.data[0] ?? (await listPrograms()).data[0];
        if (!program) { setGroups([]); return; }
        setProgramName(program.name);
        const requirementResult = await listProgramRequirements(program.id);
        const loadedGroups = await Promise.all(requirementResult.data.map(async (group) => {
          const links = await listRequirementCourses(group.id);
          const courses = await Promise.all(links.data.map(async (link) => {
            const result = await getCourse(link.courseId);
            return { code: result.data.code, title: result.data.title, credits: link.creditsOverride ?? result.data.credits };
          }));
          return { ...group, courses };
        }));
        setGroups(loadedGroups);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load degree requirements");
      } finally { setLoading(false); }
    }
    void loadRequirements();
  }, []);

  const major = groups.filter((group) => ["REQUIRED", "CONCENTRATION", "CAPSTONE"].includes(group.requirementType));
  const general = groups.filter((group) => group.requirementType === "GENERAL_EDUCATION");
  const electives = groups.filter((group) => ["ELECTIVE", "OTHER"].includes(group.requirementType));
  const electiveCredits = electives.reduce((total, group) => total + (group.minCredits ?? group.maxCredits ?? group.courses.reduce((sum, course) => sum + course.credits, 0)), 0);

  return <aside className="card requirements-card"><div className="section-heading"><div><p className="eyebrow">Degree audit</p><h2>Requirements</h2></div><span className="result-count">{programName}</span></div>{loading && <p className="muted">Loading requirements…</p>}{error && <p className="error-message">{error}</p>}{!loading && !error && groups.length === 0 && <p className="muted">No requirements found for this program.</p>}{!loading && !error && groups.length > 0 && <><>{major.slice(0, 1).map((group) => <RequirementGroupView key={group.id} title="Major requirements" group={group} />)}</><>{general.slice(0, 1).map((group) => <RequirementGroupView key={group.id} title="General education" group={group} />)}</><div className="requirement-group elective-group"><div className="requirement-group-heading"><strong>Electives counting toward degree</strong><span>{electiveCredits} cr</span></div><div className="elective-progress"><i /></div><p className="muted">Elective options are pulled from the selected program requirements.</p></div></>}</aside>;
}
