import React, { useEffect, useRef, useState } from 'react';
import { getVideoFormat } from './recording.js';

export default function VideoExportDialog({ viewport, onClose, onRecordingChange, collectionCount }) {
  const dialog = useRef(null);
  const recording = useRef(null);
  const resultUrl = useRef(null);
  const [duration, setDuration] = useState(12);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const format = getVideoFormat();
  useEffect(() => {
    dialog.current.showModal();
    return () => {
      recording.current?.cancel();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
  }, []);
  const start = async () => {
    setError(''); setBusy(true); setProgress(0); onRecordingChange(true);
    try {
      const job = viewport.current.recordVideo({ duration, onProgress: setProgress });
      recording.current = job;
      const video = await job.promise;
      if (recording.current !== job) return;
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = URL.createObjectURL(video.blob);
      setResult({ url: resultUrl.current, extension: video.extension, size: (video.blob.size / 1024 / 1024).toFixed(1) });
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { recording.current = null; setBusy(false); onRecordingChange(false); }
  };
  const close = () => { recording.current?.cancel(); recording.current = null; onRecordingChange(false); onClose(); };
  return <dialog className="video-dialog" ref={dialog} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="video-title">
    <div className="video-heading"><h2 id="video-title">Export video</h2><button aria-label="Close video export" onClick={close}>×</button></div>
    {result ? <>
      <video src={result.url} controls playsInline aria-label="Exported orbit video" />
      <p>Your {duration}-second orbit is ready · {result.extension.toUpperCase()} · {result.size} MB</p>
      <div className="video-actions"><button onClick={() => setResult(null)}>Make another</button><a className="export-button" href={result.url} download={`3d-scribble-${collectionCount > 1 ? 'collection' : 'orbit'}.${result.extension}`}>Download video</a></div>
    </> : <>
      <p>{collectionCount > 1 ? `Record a full turn of the artwork, revealing all ${collectionCount} images from their different angles.` : 'Record a complete 360° orbit of the selected drawing.'}</p>
      <label className="video-duration">Video length<select disabled={busy} value={duration} onChange={event => setDuration(Number(event.target.value))}><option value="6">6 seconds</option><option value="12">12 seconds</option><option value="20">20 seconds</option></select></label>
      <p className="video-note">{format ? `${format.extension.toUpperCase()} · 30 fps · current canvas resolution` : 'Video recording is not supported in this browser.'}</p>
      {busy && <div role="status"><progress max="100" value={progress} /><p>Recording {progress}% — keep this tab visible.</p></div>}
      {error && <p className="video-error" role="alert">{error}</p>}
      <div className="video-actions">{busy ? <button onClick={() => recording.current?.cancel()}>Cancel recording</button> : <button className="export-button" disabled={!format} onClick={start}>Start recording</button>}</div>
    </>}
  </dialog>;
}
