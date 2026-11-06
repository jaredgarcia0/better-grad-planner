import { useEffect, useState } from "react";
import {
  Course,
  CoursePrerequisite,
  getCourse,
  listCoursePrerequisites,
} from "../api/client";

type PrerequisiteWithCourse = CoursePrerequisite & { course: Course | null };

type CourseDetailsModalProps = {
  course: Course;
  creditsOverride?: number | null;
  minGrade?: string | null;
  plannedTermLabel?: string;
  onClose: () => void;
  onPlan?: (course: Course) => void;
};

export function CourseDetailsModal({
  course,
  creditsOverride,
  minGrade,
  plannedTermLabel,
  onClose,
  onPlan,
}: CourseDetailsModalProps) {
  const [courseDetails, setCourseDetails] = useState<Course>(course);
  const [courseDetailsLoading, setCourseDetailsLoading] = useState(false);
  const [prerequisites, setPrerequisites] = useState<PrerequisiteWithCourse[]>(
    [],
  );
  const [prerequisitesLoading, setPrerequisitesLoading] = useState(false);
  const [prerequisitesError, setPrerequisitesError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCourseDetails(course);
    setCourseDetailsLoading(true);
    setPrerequisites([]);
    setPrerequisitesLoading(true);
    setPrerequisitesError(false);

    getCourse(course.id)
      .then((result) => {
        if (!cancelled) setCourseDetails(result.data);
      })
      .catch(() => {
        // The embedded course summary remains useful if full details are unavailable.
      })
      .finally(() => {
        if (!cancelled) setCourseDetailsLoading(false);
      });
    listCoursePrerequisites(course.id)
      .then(async (result) =>
        Promise.all(
          result.data.map(async (prerequisite) => {
            try {
              const prerequisiteCourse = await getCourse(
                prerequisite.prerequisiteCourseId,
              );
              return { ...prerequisite, course: prerequisiteCourse.data };
            } catch {
              return { ...prerequisite, course: null };
            }
          }),
        ),
      )
      .then((loadedPrerequisites) => {
        if (!cancelled) setPrerequisites(loadedPrerequisites);
      })
      .catch(() => {
        if (!cancelled) setPrerequisitesError(true);
      })
      .finally(() => {
        if (!cancelled) setPrerequisitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [course]);

  return (
    <div className="placement-overlay" role="presentation">
      <div
        className="placement-dialog course-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-details-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Course information</p>
            <h2 id="course-details-title">{courseDetails.code}</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            aria-label="Close course information"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="placement-course">
          <strong>{courseDetails.title}</strong>
        </p>
        {plannedTermLabel && (
          <p className="course-planned-term">Planned for {plannedTermLabel}</p>
        )}
        <dl className="course-details-list">
          <div>
            <dt>Credits</dt>
            <dd>{creditsOverride ?? courseDetails.credits}</dd>
          </div>
          {courseDetails.department &&
            (courseDetails.department.name || courseDetails.department.code) && (
              <div>
                <dt>Department</dt>
                <dd>
                  {[courseDetails.department.code, courseDetails.department.name]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
          {courseDetails.level && (
            <div>
              <dt>Level</dt>
              <dd>{courseDetails.level}</dd>
            </div>
          )}
          {minGrade && (
            <div>
              <dt>Required grade</dt>
              <dd>{minGrade} or higher</dd>
            </div>
          )}
        </dl>
        {courseDetailsLoading && <p className="muted">Loading details…</p>}
        {courseDetails.description && (
          <p className="course-details-description">{courseDetails.description}</p>
        )}
        <section className="course-prerequisites" aria-labelledby="course-prerequisites-title">
          <h3 id="course-prerequisites-title">Prerequisites</h3>
          {prerequisitesLoading ? (
            <p className="muted">Loading prerequisites…</p>
          ) : prerequisitesError ? (
            <p className="muted">Prerequisites are unavailable right now.</p>
          ) : prerequisites.length ? (
            <ul>
              {prerequisites.map((prerequisite) => (
                <li key={prerequisite.id}>
                  <div>
                    <strong>
                      {prerequisite.course?.code ?? prerequisite.prerequisiteCourseId}
                    </strong>
                    <span>
                      {prerequisite.course?.title ?? "Course details unavailable"}
                    </span>
                  </div>
                  <small>
                    {prerequisite.type === "COREQUISITE" ? "Corequisite" : "Prerequisite"}
                    {prerequisite.isAlternative
                      ? ` · Choose one from option group ${prerequisite.groupNumber}`
                      : ""}
                    {prerequisite.minimumGrade
                      ? ` · ${prerequisite.minimumGrade} or higher`
                      : ""}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No prerequisites listed.</p>
          )}
        </section>
        <div className="placement-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
          {onPlan && (
            <button
              className="primary-button"
              type="button"
              onClick={() => onPlan(courseDetails)}
            >
              Plan course
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
