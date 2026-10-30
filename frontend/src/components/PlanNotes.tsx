import { useCallback, useEffect, useState } from "react";
type NotesPlan = { id: string; name: string; notes?: string | null };

type PlanNotesProps = {
  plan: NotesPlan;
  onSave: (notes: string) => Promise<void>;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PlanNotes({
  plan,
  onSave,
  onBack,
  onDirtyChange,
}: PlanNotesProps) {
  const initialNotes = plan.notes ?? "";
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isDirty = notes !== savedNotes;
  const isSaving = saveStatus === "saving";

  useEffect(() => {
    const nextNotes = plan.notes ?? "";
    setNotes(nextNotes);
    setSavedNotes(nextNotes);
    setSaveStatus("idle");
    setErrorMessage("");
  }, [plan.id]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange(false);
    },
    [onDirtyChange],
  );

  useEffect(() => {
    if (!isDirty) return;

    const warnAboutUnsavedNotes = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnAboutUnsavedNotes);
    return () =>
      window.removeEventListener("beforeunload", warnAboutUnsavedNotes);
  }, [isDirty]);

  const saveNotes = useCallback(async () => {
    if (isSaving || !isDirty) return;

    const notesToSave = notes;
    setSaveStatus("saving");
    setErrorMessage("");

    try {
      await onSave(notesToSave);
      setSavedNotes(notesToSave);
      setSaveStatus("saved");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your notes could not be saved. Please try again.",
      );
      setSaveStatus("error");
    }
  }, [isDirty, isSaving, notes, onSave]);

  useEffect(() => {
    const saveWithKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNotes();
      }
    };

    window.addEventListener("keydown", saveWithKeyboard);
    return () => window.removeEventListener("keydown", saveWithKeyboard);
  }, [saveNotes]);

  const statusMessage = isSaving
    ? "Saving notes…"
    : saveStatus === "error"
      ? errorMessage
      : isDirty
        ? "Unsaved changes"
        : saveStatus === "saved"
          ? "Notes saved"
          : "All changes saved";

  return (
    <main className="plan-notes">
      <header className="plan-notes__header">
        <button
          className="plan-notes__back-button"
          type="button"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span> Back to plan
        </button>

        <div className="plan-notes__heading">
          <p className="plan-notes__eyebrow">Plan notes</p>
          <h1>{plan.name}</h1>
          <p className="plan-notes__description">
            Keep one living document for reminders, decisions, links, and other
            details about this graduation plan. You can use plain text or
            Markdown-style formatting.
          </p>
        </div>
      </header>

      <section className="plan-notes__editor" aria-labelledby="plan-notes-label">
        <label
          className="plan-notes__label"
          id="plan-notes-label"
          htmlFor="plan-notes-textarea"
        >
          Notes
        </label>
        <textarea
          className="plan-notes__textarea"
          id="plan-notes-textarea"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setSaveStatus("idle");
            setErrorMessage("");
          }}
          placeholder={
            "# Plan notes\n\nAdd reminders, important links, or anything else you want to remember."
          }
          rows={24}
          spellCheck="true"
          aria-describedby="plan-notes-help plan-notes-status"
        />

        <div className="plan-notes__footer">
          <div>
            <p className="plan-notes__help" id="plan-notes-help">
              Press Ctrl+S or Command+S to save.
            </p>
            <p
              className={`plan-notes__status plan-notes__status--${
                saveStatus === "error" ? "error" : isDirty ? "dirty" : saveStatus
              }`}
              id="plan-notes-status"
              role={saveStatus === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {statusMessage}
            </p>
          </div>

          <button
            className="plan-notes__save-button"
            type="button"
            onClick={() => void saveNotes()}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </section>
    </main>
  );
}
