import { useEffect, useRef } from 'react';
import type { SourceDocument } from '$lib/workspace/project';
export function SourceEditor({
  file,
  disabled = false,
  selection,
  onChange,
}: {
  file: SourceDocument;
  disabled?: boolean;
  selection?: { start: number; end: number };
  onChange: (value: string) => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (selection && area.current) {
      area.current.focus();
      area.current.setSelectionRange(selection.start, selection.end);
    }
  }, [selection, file.name]);
  return (
    <section className="editor-pane" aria-label="Source editor">
      <header className="pane-heading">
        <strong title={file.name}>{file.name}</strong>
        <span>SysML v2</span>
      </header>
      <label className="sr-only" htmlFor="source-text">
        SysML source
      </label>
      <textarea
        ref={area}
        id="source-text"
        value={file.text}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        wrap="off"
      />
    </section>
  );
}
