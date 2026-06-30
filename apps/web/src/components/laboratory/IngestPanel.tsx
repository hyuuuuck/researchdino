import { type FormEvent, useEffect, useState } from "react";
import {
  registerIngestFolder,
  scanIngestFolder,
  type IngestScanResult,
  type ResearchDataMode,
} from "../../api/researchApi";

interface IngestPanelProps {
  dataMode: ResearchDataMode;
  onScanComplete: () => void | Promise<void>;
}

export function IngestPanel({ dataMode, onScanComplete }: IngestPanelProps) {
  const [folderPath, setFolderPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    dataMode === "api" ? "Enter a local folder path and scan PDFs." : "API mode required for local folder scanning.",
  );
  const [lastResult, setLastResult] = useState<IngestScanResult>();

  const disabled = dataMode !== "api" || busy;

  useEffect(() => {
    setMessage(
      dataMode === "api"
        ? "Enter a local folder path and scan PDFs."
        : "API mode required for local folder scanning.",
    );
  }, [dataMode]);

  async function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPath = folderPath.trim();
    if (!trimmedPath) {
      setMessage("Enter a local folder path first.");
      return;
    }

    setBusy(true);
    setLastResult(undefined);
    try {
      const folder = await registerIngestFolder(trimmedPath);
      if (!folder.exists) {
        setMessage("Folder was registered, but it does not exist on this machine.");
        return;
      }

      const result = await scanIngestFolder();
      setLastResult(result);
      setMessage(
        result.parserAvailable
          ? `Scanned ${result.pdfCount} PDFs and created ${result.paperCardCount} paper cards.`
          : `Scanned ${result.pdfCount} PDFs. Text extraction awaits PyMuPDF.`,
      );
      await onScanComplete();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Scan failed: ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ingest-panel" aria-label="Local PDF ingest panel">
      <div className="panel-heading panel-heading--compact">
        <span className="panel-kicker">Collection Dock</span>
        <h2>PDF Ingest</h2>
      </div>
      <form onSubmit={handleScan}>
        <label className="field-label">
          Local folder path
          <input
            value={folderPath}
            onChange={(event) => setFolderPath(event.target.value)}
            disabled={dataMode !== "api" || busy}
            placeholder={"C:\\Users\\SH\\Documents\\Papers"}
          />
        </label>
        <button className="ingest-action" type="submit" disabled={disabled}>
          {busy ? "Scanning..." : "Register & Scan"}
        </button>
      </form>
      <p className="ingest-status">{message}</p>
      {lastResult && (
        <dl className="ingest-result">
          <div>
            <dt>PDFs</dt>
            <dd>{lastResult.pdfCount}</dd>
          </div>
          <div>
            <dt>Paper Cards</dt>
            <dd>{lastResult.paperCardCount}</dd>
          </div>
          <div>
            <dt>Error Cards</dt>
            <dd>{lastResult.errorCardCount}</dd>
          </div>
          <div>
            <dt>Parser</dt>
            <dd>{lastResult.parserAvailable ? "PyMuPDF" : "Missing"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
