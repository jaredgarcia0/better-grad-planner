import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDegreePlan } from "./api/client";
import type { GraduationPlan } from "./components/PlanLibrary";
import { importedLocalPlanIds, loadLocalPlans, loadRemotePlans, markLocalPlanImported, saveLocalPlans, saveRemotePlan } from "./planRepository";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Your changes could not be saved. Please try again.";
}

export function usePlanWorkspace(workspaceId: string | null, authenticated: boolean) {
  const [plans, setPlans] = useState<GraduationPlan[]>([]);
  const plansRef = useRef(plans);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [localCandidates, setLocalCandidates] = useState<GraduationPlan[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const generation = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const publish = useCallback((next: GraduationPlan[]) => {
    plansRef.current = next;
    setPlans(next);
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    queue.current = Promise.resolve();
    publish([]);
    setLoading(Boolean(workspaceId));
    setLoadError(null);
    setSaveError(null);
    setPending(0);
    setLocalCandidates([]);
    if (!workspaceId) return;
    async function load() {
      try {
        const next = authenticated ? await loadRemotePlans() : loadLocalPlans(workspaceId!);
        if (generation.current !== current) return;
        publish(next);
        if (authenticated) {
          const existing = new Set(next.map((plan) => plan.id));
          const imported = importedLocalPlanIds(workspaceId!);
          setLocalCandidates(loadLocalPlans(workspaceId!).filter((plan) => {
            if (existing.has(plan.id)) markLocalPlanImported(workspaceId!, plan.id);
            return !existing.has(plan.id) && !imported.has(plan.id);
          }));
        }
      } catch (error) {
        if (generation.current === current) setLoadError(message(error));
      } finally {
        if (generation.current === current) setLoading(false);
      }
    }
    void load();
    return () => { generation.current++; };
  }, [workspaceId, authenticated, loadAttempt, publish]);

  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  function enqueue<T>(operation: () => Promise<T>) {
    const current = generation.current;
    setPending((value) => value + 1);
    const task = queue.current.catch(() => undefined).then(async () => {
      if (current !== generation.current) throw new Error("This workspace is no longer open.");
      return operation();
    });
    queue.current = task;
    return task.then((value) => {
      if (current === generation.current) setSaveError(null);
      return value;
    }, (error: unknown) => {
      if (current === generation.current) setSaveError(message(error));
      throw error;
    }).finally(() => {
      if (current === generation.current) setPending((value) => Math.max(0, value - 1));
    });
  }

  async function persist(next: GraduationPlan) {
    if (!workspaceId) throw new Error("Open a workspace before saving a plan.");
    const duplicate = plansRef.current.find((plan) => plan.id !== next.id && plan.name === next.name);
    if (duplicate) throw new Error("You already have a plan with that name. Choose another name.");
    const current = generation.current;
    if (authenticated) await saveRemotePlan(next);
    const updated = plansRef.current.some((plan) => plan.id === next.id)
      ? plansRef.current.map((plan) => plan.id === next.id ? next : plan)
      : [...plansRef.current, next];
    if (current !== generation.current) return;
    if (!authenticated) saveLocalPlans(workspaceId, updated);
    publish(updated);
  }

  function savePlan(plan: GraduationPlan) {
    // Commit only after storage succeeds. A failed save leaves the editor open for retry.
    return enqueue(() => persist(plan));
  }

  function updatePlan(id: string, update: (plan: GraduationPlan) => GraduationPlan) {
    // Build the snapshot inside the queue so rapid course moves cannot overwrite one another.
    return enqueue(async () => {
      const plan = plansRef.current.find((item) => item.id === id);
      if (!plan) throw new Error("This plan could not be found. Reload your plans and try again.");
      await persist(update(plan));
    });
  }

  function deletePlan(id: string) {
    return enqueue(async () => {
      if (!workspaceId) return;
      const current = generation.current;
      if (authenticated) await deleteDegreePlan(id);
      if (current !== generation.current) return;
      const next = plansRef.current.filter((plan) => plan.id !== id);
      if (!authenticated) saveLocalPlans(workspaceId, next);
      publish(next);
    });
  }

  function importLocalPlans() {
    return enqueue(async () => {
      if (!authenticated) return;
      const current = generation.current;
      for (const candidate of localCandidates) {
        if (plansRef.current.some((plan) => plan.id === candidate.id)) continue;
        const names = new Set(plansRef.current.map((plan) => plan.name));
        let name = candidate.name;
        for (let suffix = 2; names.has(name); suffix++) {
          const ending = ` (${suffix})`;
          name = `${candidate.name.slice(0, 80 - ending.length)}${ending}`;
        }
        await persist({ ...candidate, name });
        if (current !== generation.current) return;
        markLocalPlanImported(workspaceId!, candidate.id);
        setLocalCandidates((remaining) => remaining.filter((plan) => plan.id !== candidate.id));
      }
      // Retain the original browser data as a backup; server IDs make imports safe to retry.
    });
  }

  return {
    plans, loading, loadError, saveError, isSaving: pending > 0,
    localPlanCount: localCandidates.length,
    reload: () => setLoadAttempt((attempt) => attempt + 1),
    dismissSaveError: () => setSaveError(null),
    savePlan, updatePlan, deletePlan, importLocalPlans,
  };
}
