import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Box, Check, ChevronLeft, ChevronRight, ImagePlus, Maximize, Minus, Pause, Play, Plus, RotateCcw, SlidersHorizontal, Waves, X } from 'lucide-react';
import ScribbleViewport, { VIEWS } from './ScribbleViewport.jsx';
import { DEFAULT_SETTINGS } from './scribble.js';
import { makeDemoImage } from './demo.js';
import VideoExportDialog from './VideoExportDialog.jsx';

function loadPixels(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 620 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(context.getImageData(0, 0, canvas.width, canvas.height));
      } catch { reject(new Error('This image could not be processed. Try a smaller JPG, PNG, or WebP.')); }
    };
    image.onerror = () => reject(new Error('This image could not be opened. Try a JPG, PNG, or WebP.'));
    image.src = source;
  });
}

const CONTROL_FIELDS = [
  ['density', 'Strand density', 'More overlapping strands for a fuller drawing.'],
  ['detail', 'Fine detail', 'Follow small edges and facial features.'],
  ['depth', '3D depth', 'Spread the strands into a sculptural volume.'],
  ['flow', 'Stroke looseness', 'Length and curvature of individual strands.'],
  ['fringe', 'Loose threads', 'Long expressive lines around the subject.'],
  ['color', 'Original color', 'Blend between graphite and the image colors.'],
  ['threshold', 'White removal', 'Omit bright areas to leave open white space.'],
];

export default function App() {
  const demo = useMemo(() => ({ id: 'demo', source: makeDemoImage(), name: 'Studio portrait' }), []);
  const [images, setImages] = useState([demo]);
  const [activeId, setActiveId] = useState('demo');
  const active = images.find(image => image.id === activeId) || demo;
  const [layout, setLayout] = useState('together');
  const singleId = layout === 'single' ? activeId : null;
  const visibleImages = useMemo(() => layout === 'single'
    ? [images.find(image => image.id === singleId) || demo]
    : images.length > 1 ? images.filter(image => image.id !== 'demo') : [demo], [images, layout, singleId, demo]);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [scribble, setScribble] = useState(null);
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');
  const [renderError, setRenderError] = useState('');
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedView, setSelectedView] = useState('front');
  const [showOriginal, setShowOriginal] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('Building strands…');
  const viewport = useRef(null);
  const fileInput = useRef(null);
  const urls = useRef(new Set());
  const pixelCache = useRef(new Map());
  const geometryCache = useRef({ settings: null, items: new Map() });
  const uploadVersion = useRef(0);
  const pendingRevealTour = useRef(false);
  const [uploading, setUploading] = useState(false);
  const stage = useRef(null);

  useEffect(() => () => {
    uploadVersion.current++;
    urls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let worker;
    setProcessing(true);
    const timer = setTimeout(async () => {
      try {
        if (geometryCache.current.settings !== settings) geometryCache.current = { settings, items: new Map() };
        const cache = geometryCache.current.items;
        worker = new Worker(new URL('./scribble.worker.js', import.meta.url), { type: 'module' });
        const items = [];
        for (const [index, image] of visibleImages.entries()) {
          if (cancelled) return;
          setProcessingLabel(`Building drawing ${index + 1} of ${visibleImages.length}…`);
          let result = cache.get(image.id);
          if (!result) {
            let pixels = pixelCache.current.get(image.id);
            if (!pixels) pixels = await loadPixels(image.source);
            if (cancelled) return;
            pixelCache.current.set(image.id, pixels);
            result = await new Promise((resolve, reject) => {
              worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data);
              worker.onerror = () => reject(new Error('The drawing could not be generated. Reduce strand density and try again.'));
              worker.postMessage({ image: { data: pixels.data, width: pixels.width, height: pixels.height }, settings });
            });
            if (cancelled) return;
            cache.set(image.id, result);
          }
          items.push({ ...result, id: image.id, name: image.name });
        }
        if (!cancelled) {
          setScribble({ items, strokes: items.reduce((sum, item) => sum + item.strokes, 0) });
          setProcessing(false);
          if (pendingRevealTour.current && items.length > 1) {
            setAutoRotate(true);
            setSelectedView('custom');
          }
          pendingRevealTour.current = false;
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); setProcessing(false); }
      } finally { worker?.terminate(); }
    }, 140);
    return () => { cancelled = true; clearTimeout(timer); worker?.terminate(); };
  }, [visibleImages, settings]);

  const selectView = id => {
    setSelectedView(id);
    setAutoRotate(false);
    setShowOriginal(false);
    viewport.current?.view(id);
  };
  const selectImage = id => {
    setActiveId(id);
    setAutoRotate(false);
    setShowOriginal(false);
    if (layout === 'together' && visibleImages.some(image => image.id === id)) {
      setSelectedView('custom');
      viewport.current?.reveal(id);
    } else {
      setLayout('single');
      selectView('front');
    }
  };
  const addFiles = async files => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const version = ++uploadVersion.current;
    setUploading(true);
    setError('');
    const accepted = [], failures = [];
    for (const file of list) {
      if (!file.type.startsWith('image/')) { failures.push(`${file.name}: choose an image file.`); continue; }
      if (file.size > 30 * 1024 * 1024) { failures.push(`${file.name}: keep images under 30 MB.`); continue; }
      const source = URL.createObjectURL(file);
      try {
        await loadPixels(source);
        if (version !== uploadVersion.current) { URL.revokeObjectURL(source); break; }
        urls.current.add(source);
        accepted.push({ id: crypto.randomUUID(), source, name: file.name });
      } catch { URL.revokeObjectURL(source); failures.push(`${file.name}: unsupported or damaged image.`); }
    }
    if (version !== uploadVersion.current) {
      accepted.forEach(item => { URL.revokeObjectURL(item.source); urls.current.delete(item.source); });
      return;
    }
    if (accepted.length) { pendingRevealTour.current = true; setImages(current => [...current, ...accepted]); setActiveId(accepted[0].id); setLayout('together'); selectView('front'); }
    setUploading(false);
    if (failures.length) setError(failures.join(' '));
  };
  const removeImage = image => {
    if (image.id === activeId) { setActiveId(images.find(item => item.id !== image.id && item.id !== 'demo')?.id || 'demo'); selectView('front'); }
    setImages(current => current.filter(item => item.id !== image.id));
    pixelCache.current.delete(image.id);
    geometryCache.current.items.delete(image.id);
    URL.revokeObjectURL(image.source);
    urls.current.delete(image.source);
  };
  const exportSnapshot = async () => {
    try {
      const blob = await viewport.current?.snapshot();
      if (!blob) return;
      const source = URL.createObjectURL(blob);
      urls.current.add(source);
      const link = document.createElement('a');
      link.download = `${visibleImages.length > 1 ? 'collection' : active.name.replace(/\.[^.]+$/, '')}-3d-scribble.png`;
      link.href = source;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => { URL.revokeObjectURL(source); urls.current.delete(source); }, 60000);
    } catch { setError('Could not export this view. Please try again.'); }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current.requestFullscreen();
    } catch { setError('Fullscreen is not available in this browser.'); }
  };
  const cycleView = direction => {
    if (layout === 'together' && visibleImages.length > 1) {
      const index = Math.max(0, visibleImages.findIndex(image => image.id === activeId));
      selectImage(visibleImages[(index + direction + visibleImages.length) % visibleImages.length].id);
      return;
    }
    const index = VIEWS.findIndex(view => view.id === selectedView);
    selectView(VIEWS[(Math.max(0, index) + direction + VIEWS.length) % VIEWS.length].id);
  };

  return (
    <main className="app-shell" onDragOver={event => { event.preventDefault(); if (!videoOpen && event.dataTransfer.types.includes('Files')) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!videoOpen) addFiles(event.dataTransfer.files); }}>
      <header className="app-header">
        <div className="brand"><span className="brand-mark"><Waves size={22} /></span><div><h1>3D Scribble<span> Studio</span></h1><p>Images, reimagined in threads.</p></div></div>
        <div className="header-actions"><span className="local-note"><span /> On your device</span><button className="mobile-settings icon-button" aria-label="Toggle controls" aria-expanded={panelOpen} onClick={() => setPanelOpen(open => !open)}><SlidersHorizontal size={18} /></button><button className="png-button" onClick={exportSnapshot} disabled={!scribble || processing || recording || !!renderError}><ArrowDownToLine size={16} /><span>PNG</span></button><button className="export-button" onClick={() => { setShowOriginal(false); setAutoRotate(false); setPanelOpen(false); setVideoOpen(true); }} disabled={!scribble || processing || uploading || !!renderError}><Play size={15} /><span>Export video</span></button></div>
      </header>
      <div className="workspace">
        <aside className={`control-panel ${panelOpen ? 'is-open' : ''}`}>
          <div className="section-heading"><span>01 / SOURCE IMAGE</span><button className="text-button" onClick={() => fileInput.current.click()}>Add <Plus size={13} /></button></div>
          <button className="source-preview" onClick={() => fileInput.current.click()} aria-label="Upload images"><img src={active.source} alt={active.name} /><span><ImagePlus size={15} /> {uploading ? 'Opening images…' : 'Add your images'}</span></button>
          <div className="source-name" title={active.name}>{active.name}</div>
          <input ref={fileInput} className="file-input" type="file" accept="image/*" multiple aria-label="Choose images" onChange={event => { addFiles(event.target.files); event.target.value = ''; }} />
          <p className="source-hint">Drop images anywhere. Portraits on light backgrounds work especially well.</p>
          <div className="panel-divider" />
          <div className="section-heading"><span>02 / THREAD STYLE</span><button className="text-button" onClick={() => { setError(''); setSettings({ ...DEFAULT_SETTINGS }); }} title="Reset style"><RotateCcw size={13} /> Reset</button></div>
          <div className="preset-row"><button className={settings.fringe === 50 && settings.flow === 45 ? 'selected' : ''} onClick={() => setSettings({ ...DEFAULT_SETTINGS })}>Expressive</button><button className={settings.fringe === 15 && settings.flow === 18 ? 'selected' : ''} onClick={() => setSettings({ ...DEFAULT_SETTINGS, density: 90, detail: 100, flow: 18, fringe: 15 })}>Fine ink</button><button className={settings.color === 0 ? 'selected' : ''} onClick={() => setSettings({ ...DEFAULT_SETTINGS, color: 0, flow: 65, fringe: 65 })}>Graphite</button></div>
          <div className="sliders">{CONTROL_FIELDS.map(([key, label, hint]) => <label className="slider-row" key={key} title={hint}><span><span>{label}</span><output>{settings[key]}<small>%</small></output></span><input aria-label={label} type="range" min={key === 'density' ? 10 : 0} max={key === 'threshold' ? 60 : 100} value={settings[key]} onChange={event => setSettings(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div>
          <div className="panel-footer"><Box size={17} /><p>Real 3D strands. Drag the artwork to discover another angle.</p></div>
        </aside>
        <section className="gallery">
          <div className="collection-controls"><div role="group" aria-label="Artwork mode"><button aria-pressed={layout === 'together'} className={layout === 'together' ? 'active' : ''} onClick={() => { setLayout('together'); selectView('front'); }}>3D reveal ({images.length > 1 ? images.length - 1 : 1})</button><button aria-pressed={layout === 'single'} className={layout === 'single' ? 'active' : ''} onClick={() => { setLayout('single'); selectView('front'); }}>Single image</button></div><span>{visibleImages.length > 1 ? 'One artwork · Different images from different angles' : layout === 'single' ? 'Inspect the selected image' : 'Add images to reveal them as you rotate'}</span></div>
          <section className={`stage ${showOriginal ? 'show-original' : ''}`} ref={stage} aria-label="Interactive artwork">
            <ScribbleViewport ref={viewport} scribble={scribble} autoRotate={autoRotate && !showOriginal} onInteract={() => { setAutoRotate(false); setSelectedView('custom'); }} onError={setRenderError} onRevealChange={id => { if (id && layout === 'together' && !processing) setActiveId(id); }} />
            {showOriginal && <div className="original-overlay"><img src={active.source} alt={`Original: ${active.name}`} /></div>}
            <div className="stage-top"><div className="canvas-label"><span className={`status-dot ${processing ? 'busy' : ''}`} />{processing ? 'Weaving your drawing' : showOriginal ? 'Original image' : '3D thread drawing'}</div><div className="canvas-actions"><button aria-pressed={showOriginal} className={showOriginal ? 'active' : ''} onClick={() => setShowOriginal(value => !value)}>{showOriginal ? <Check size={14} /> : <ImagePlus size={14} />} Original</button><button className="icon-button" onClick={fullscreen} aria-label="Toggle fullscreen"><Maximize size={16} /></button></div></div>
            {processing && <div className="processing-indicator" role="status"><span className="spinner" /> {processingLabel}</div>}
            {(error || renderError) && <div className="error-banner" role="alert">{renderError || error}<button aria-label="Dismiss error" onClick={() => { setError(''); setRenderError(''); }}><X size={16} /></button></div>}
            {!processing && scribble?.strokes === 0 && <div className="empty-message">No visible strands. Lower white removal or choose an image with more contrast.</div>}
            <div className="view-navigation"><button className="icon-button" aria-label="Previous view" onClick={() => cycleView(-1)}><ChevronLeft size={19} /></button><div><span>{showOriginal ? 'SOURCE' : visibleImages.length > 1 ? `REVEAL ${Math.max(0, visibleImages.findIndex(image => image.id === activeId)) + 1} / ${visibleImages.length}` : selectedView === 'custom' ? 'FREE ORBIT' : VIEWS.find(view => view.id === selectedView)?.label.toUpperCase()}</span><small>{showOriginal ? 'Your uploaded image' : visibleImages.length > 1 ? 'Rotate to reveal · Click a thumbnail to turn to its image' : 'Drag to orbit · Scroll to zoom · Right-drag to pan'}</small></div><button className="icon-button" aria-label="Next view" onClick={() => cycleView(1)}><ChevronRight size={19} /></button></div>
            <div className="zoom-controls"><button className="icon-button" aria-label="Zoom out" onClick={() => viewport.current?.zoom(1 / 1.25)}><Minus size={17} /></button><button className="icon-button" aria-label="Reset camera" onClick={() => selectView('front')}><RotateCcw size={15} /></button><button className="icon-button" aria-label="Zoom in" onClick={() => viewport.current?.zoom(1.25)}><Plus size={17} /></button></div>
          </section>
          <div className="view-bar"><div className="view-tabs" aria-label="Camera views">{VIEWS.map(view => <button key={view.id} aria-pressed={!showOriginal && selectedView === view.id} className={!showOriginal && selectedView === view.id ? 'active' : ''} onClick={() => selectView(view.id)}>{view.label}</button>)}</div><button className={`tour-button ${autoRotate ? 'active' : ''}`} aria-pressed={autoRotate} onClick={() => { setShowOriginal(false); setAutoRotate(value => !value); setSelectedView('custom'); }}>{autoRotate ? <Pause size={14} /> : <Play size={14} />}{autoRotate ? 'Pause tour' : 'Play tour'}</button></div>
          <div className="filmstrip"><div className="filmstrip-title"><span>YOUR COLLECTION</span><small>{images.length.toString().padStart(2, '0')} images</small></div><div className="thumbnails">{images.map((image, index) => <div className={`thumbnail-wrap ${image.id === active.id ? 'selected' : ''}`} key={image.id}><button className="thumbnail" aria-label={`Open ${image.name}`} aria-pressed={image.id === active.id} onClick={() => selectImage(image.id)}><img src={image.source} alt={image.name} /><span>{(index + 1).toString().padStart(2, '0')}</span></button>{image.id !== 'demo' && <button className="remove-image" aria-label={`Remove ${image.name}`} onClick={() => removeImage(image)}><X size={11} /></button>}</div>)}<button className="add-image" onClick={() => fileInput.current.click()} aria-label="Add images to collection"><Plus size={21} /></button></div><div className="art-stats"><span>{processing ? 'Generating…' : `${(scribble?.strokes || 0).toLocaleString()} strands`}</span><small>Made of lines. Made to explore.</small></div></div>
        </section>
      </div>
      {dragging && <div className="drop-overlay"><ImagePlus size={36} /><strong>Drop your images here</strong><span>Create a collection of 3D thread drawings</span></div>}
      {videoOpen && <VideoExportDialog viewport={viewport} collectionCount={visibleImages.length} onClose={() => setVideoOpen(false)} onRecordingChange={setRecording} />}
    </main>
  );
}
