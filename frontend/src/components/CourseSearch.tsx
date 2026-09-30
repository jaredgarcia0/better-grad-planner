import { useEffect, useState } from "react";
import { Course, listCourses } from "../api/client";

type CourseSearchProps = { plannedCourseIds: Set<string>; onAdd: (course: Course) => void };

export function CourseSearch({ plannedCourseIds, onAdd }: CourseSearchProps) {
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await listCourses(query);
        setCourses(result.data);
        setTotal(result.pagination.total);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load courses");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <section className="card course-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2>Find a course</h2>
        </div>
        <span className="result-count">{total} results</span>
      </div>
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by course code or title" />
      </label>
      {loading && <p className="muted">Loading courses…</p>}
      {error && <p className="error-message">{error}. Is the backend running on port 3000?</p>}
      {!loading && !error && (
        <div className="course-list">
          {courses.map((course) => (
            <article className="course-row" key={course.id}>
              <div>
                <strong>{course.code}</strong>
                <p>{course.title}</p>
              </div>
              <button className="add-course-button" type="button" onClick={() => onAdd(course)} disabled={plannedCourseIds.has(course.id)}>
                {plannedCourseIds.has(course.id) ? "Added" : "+ Add"}
              </button>
            </article>
          ))}
          {courses.length === 0 && <p className="muted">No courses matched your search.</p>}
        </div>
      )}
    </section>
  );
}
