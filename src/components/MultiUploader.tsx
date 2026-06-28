import { useRef, useState } from 'react';
import type { LoadedFile } from '../types';
import { loadFile } from '../utils/parseFile';
import type { FileEntry } from '../utils/timeline';

interface Props {
  entries: FileEntry[];
  onAdd: (files: LoadedFile[]) => void;
  onRemove: (id: number) => void;
  onClearAll: () => void;
  onDemo: () => void;
}

export function MultiUploader({ entries, onAdd, onRemove, onClearAll, onDemo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setLoading(true);
    const loaded: LoadedFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const lf = await loadFile(file);
        if (!lf.portfolio && lf.dataset.rows.length === 0) {
          errors.push(`${file.name}: no data rows found`);
          continue;
        }
        loaded.push(lf);
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : 'parse failed'}`);
      }
    }
    if (loaded.length) onAdd(loaded);
    if (errors.length) setError(errors.join(' · '));
    setLoading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="multi-uploader">
      <label
        className={`dropzone big${dragOver ? ' drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          hidden
        />
        {loading ? (
          <span>Parsing…</span>
        ) : (
          <>
            <span className="dz-icon">⬆️</span>
            <span className="dz-title">Drop one or more CSV / Excel statements</span>
            <span className="dz-sub">or click to browse · upload 2+ quarters to compare</span>
          </>
        )}
      </label>

      <div className="uploader-row">
        <button className="btn-ghost" type="button" onClick={onDemo}>
          ✨ Try demo data
        </button>
        {entries.length > 0 && (
          <button className="btn-ghost" type="button" onClick={onClearAll}>
            Clear all
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="file-chips">
          {entries.map((e) => (
            <div className="file-chip" key={e.id} title={e.file.fileName}>
              <span className="chip-icon">{e.file.portfolio ? '📑' : '📄'}</span>
              <span className="chip-body">
                <span className="chip-name">
                  {e.file.portfolio?.statementDate || e.file.fileName}
                </span>
                <span className="chip-meta">
                  {e.file.portfolio
                    ? `${e.file.portfolio.holdings.length} holdings`
                    : `${e.file.dataset.rows.length} rows`}
                </span>
              </span>
              <button className="chip-remove" onClick={() => onRemove(e.id)} title="Remove" aria-label="Remove file">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="uploader-error">⚠️ {error}</div>}
    </div>
  );
}
