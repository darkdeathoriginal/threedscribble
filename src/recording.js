export function getVideoFormat(Recorder = globalThis.MediaRecorder) {
  if (!Recorder) return null;
  const mimeType = ['video/mp4;codecs=avc1.42001E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => Recorder.isTypeSupported(type));
  return mimeType ? { mimeType, extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm' } : null;
}

export function recordCanvas(canvas, { duration, onFrame, onProgress }) {
  const format = getVideoFormat();
  if (!format || !canvas.captureStream) throw new Error('Video recording is unavailable in this browser. Open the app in Chrome or Edge to export a video.');
  let recorder, stream, frame, fail, settled = false;
  const cleanup = () => {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
    document.removeEventListener('visibilitychange', visibility);
  };
  const visibility = () => {
    if (document.hidden) fail(new Error('Recording stopped because the tab was hidden. Keep this tab visible while exporting.'));
  };
  const promise = new Promise((resolve, reject) => {
    fail = error => {
      if (settled) return;
      settled = true;
      if (recorder?.state === 'recording') recorder.stop();
      cleanup();
      reject(error);
    };
    try {
      onFrame(0);
      stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 8_000_000 });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => fail(new Error('The browser could not encode this video. Try a shorter recording.'));
      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const blob = new Blob(chunks, { type: recorder.mimeType || format.mimeType });
        if (blob.size) resolve({ blob, extension: format.extension });
        else reject(new Error('The recording was empty. Please try again.'));
      };
      recorder.start();
      document.addEventListener('visibilitychange', visibility);
      const started = performance.now();
      let lastPercent = -1;
      const tick = now => {
        if (settled) return;
        try {
          const progress = Math.min(1, (now - started) / (duration * 1000));
          onFrame(progress);
          const percent = Math.floor(progress * 100);
          if (percent !== lastPercent) { onProgress(percent); lastPercent = percent; }
          if (progress === 1) recorder.stop();
          else frame = requestAnimationFrame(tick);
        } catch (error) { fail(error); }
      };
      frame = requestAnimationFrame(tick);
    } catch (error) { fail(error); }
  });
  return { promise, cancel: () => fail(new DOMException('Recording cancelled.', 'AbortError')) };
}
