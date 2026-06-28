import { useRef, useState } from 'react';
import type { LoadedFile } from '../types';
import { loadFile } from '../utils/parseFile';

interface Props {
  label: string;
  file: LoadedFile | null;
  onLoaded: (file: LoadedFile) => void;
  onClear: () => void;
}

export function FileUploader({ label, file, onLoaded, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const loaded = await loadFile(files[0]);
      if (!loaded.portfolio && loaded.dataset.rows.length === 0) {
        throw new Error('No data rows found in the file.');
      }
      onLoaded(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="uploader">
      <div className="uploader-label">{label}</div>

      {file ? (
        <div className="uploader-loaded">
          <div className="file-info">
            <span className="file-name" title={file.fileName}>
              📄 {file.fileName}
            </span>
            <span className="file-meta">
              {file.portfolio
                ? `${file.portfolio.holdings.length} holdings · ${file.portfolio.statementDate}`
                : `${file.dataset.rows.length} rows · ${file.dataset.columns.length} columns`}
            </span>
            {file.portfolio && <span className="portfolio-tag">Portfolio detected</span>}
          </div>
          <button
            className="btn-ghost"
            onClick={() => {
              onClear();
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`dropzone${dragOver ? ' drag' : ''}`}
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
            onChange={(e) => handleFiles(e.target.files)}
            hidden
          />
          {loading ? (
            <span>Parsing…</span>
          ) : (
            <>
              <span className="dz-icon">⬆️</span>
              <span className="dz-title">Drop CSV / Excel here</span>
              <span className="dz-sub">or click to browse</span>
            </>
          )}
        </label>
      )}

      {error && <div className="uploader-error">⚠️ {error}</div>}
    </div>
  );
}
