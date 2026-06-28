import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Camera,
  Download,
  ImagePlus,
  Layers,
  Palette,
  RefreshCcw,
  Sparkles,
  Waves,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MAX_IMAGE_SIZE = 220;
const EMPTY_IMAGE_NAME = 'Built-in demo portrait';

const makeDemoImage = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 520;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const sky = ctx.createLinearGradient(0, 0, 520, 520);
  sky.addColorStop(0, '#fffaf0');
  sky.addColorStop(1, '#f3eadb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 520, 520);

  ctx.fillStyle = '#1d2324';
  ctx.beginPath();
  ctx.ellipse(260, 232, 116, 124, 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f1c7b3';
  ctx.beginPath();
  ctx.ellipse(260, 270, 82, 106, 0.02, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2c3434';
  ctx.beginPath();
  ctx.ellipse(224, 258, 10, 14, 0.2, 0, Math.PI * 2);
  ctx.ellipse(298, 258, 10, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#6f3c43';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(224, 320);
  ctx.bezierCurveTo(248, 342, 281, 342, 306, 319);
  ctx.stroke();

  ctx.strokeStyle = '#c18770';
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(258, 272);
  ctx.bezierCurveTo(246, 296, 248, 306, 264, 308);
  ctx.stroke();

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#6f3c43';
  ctx.beginPath();
  ctx.ellipse(218, 294, 26, 14, -0.2, 0, Math.PI * 2);
  ctx.ellipse(306, 294, 26, 14, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getLuminance = (data, index) =>
  (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;

const calculateEdge = (luma, width, height, x, y) => {
  const at = (px, py) => luma[clamp(py, 0, height - 1) * width + clamp(px, 0, width - 1)];
  const gx =
    -at(x - 1, y - 1) -
    2 * at(x - 1, y) -
    at(x - 1, y + 1) +
    at(x + 1, y - 1) +
    2 * at(x + 1, y) +
    at(x + 1, y + 1);
  const gy =
    -at(x - 1, y - 1) -
    2 * at(x, y - 1) -
    at(x + 1, y - 1) +
    at(x - 1, y + 1) +
    2 * at(x, y + 1) +
    at(x + 1, y + 1);

  return clamp(Math.sqrt(gx * gx + gy * gy), 0, 1);
};

const calculateGradient = (luma, width, height, x, y) => {
  const at = (px, py) => luma[clamp(py, 0, height - 1) * width + clamp(px, 0, width - 1)];
  const gx =
    -at(x - 1, y - 1) -
    2 * at(x - 1, y) -
    at(x - 1, y + 1) +
    at(x + 1, y - 1) +
    2 * at(x + 1, y) +
    at(x + 1, y + 1);
  const gy =
    -at(x - 1, y - 1) -
    2 * at(x, y - 1) -
    at(x + 1, y - 1) +
    at(x - 1, y + 1) +
    2 * at(x, y + 1) +
    at(x + 1, y + 1);

  return { gx, gy, edge: clamp(Math.sqrt(gx * gx + gy * gy), 0, 1) };
};

const noise = (x, y, layer = 0) => {
  const raw = Math.sin(x * 12.9898 + y * 78.233 + layer * 37.719) * 43758.5453;
  return raw - Math.floor(raw);
};

const processImage = async (source, settings) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const ratio = image.width / image.height;
      const width = ratio >= 1 ? MAX_IMAGE_SIZE : Math.max(90, Math.round(MAX_IMAGE_SIZE * ratio));
      const height = ratio >= 1 ? Math.max(90, Math.round(MAX_IMAGE_SIZE / ratio)) : MAX_IMAGE_SIZE;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, width, height);

      const pixels = ctx.getImageData(0, 0, width, height);
      const luma = new Float32Array(width * height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        luma[i / 4] = getLuminance(pixels.data, i);
      }

      const positions = [];
      const colors = [];
      const bounds = Math.max(width, height);
      const spacing = settings.density;
      const layerCount = settings.layers;
      const depthScale = settings.depth / 95;
      const detailStrength = settings.detail / 100;
      const colorStrength = settings.color / 100;
      const inkCutoff = settings.threshold / 150;
      const gradients = new Array(width * height);

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          gradients[y * width + x] = calculateGradient(luma, width, height, x, y);
        }
      }

      const pushSegment = (a, b, colorA, colorB) => {
        positions.push(...a, ...b);
        colors.push(...colorA, ...colorB);
      };

      const pointAt = (px, py, brightness, edge, lift = 0) => [
        ((px - width / 2) / bounds) * 8.2,
        -((py - height / 2) / bounds) * 8.2,
        ((1 - brightness) * 1.55 + edge * 1.15 + lift) * depthScale,
      ];

      const colorAt = (rgbaIndex, ink, edge) => {
        const tint = [
          pixels.data[rgbaIndex] / 255,
          pixels.data[rgbaIndex + 1] / 255,
          pixels.data[rgbaIndex + 2] / 255,
        ];
        const graphite = clamp(0.07 + (1 - ink) * 0.28 - edge * 0.08, 0.03, 0.34);
        const colorMix = 0.3 + colorStrength * 0.68;
        const graphiteMix = 0.9 - colorStrength * 0.54;
        return tint.map((channel) => clamp(channel * colorMix + graphite * graphiteMix, 0.025, 0.92));
      };

      const makeStroke = (cx, cy, angle, length, brightness, edge, ink, layer, rgbaIndex) => {
        const bow = (noise(cx, cy, layer + 13) - 0.5) * settings.flow * 0.09;
        const jitter = (noise(cx + 5, cy - 3, layer) - 0.5) * 0.65;
        const dx = Math.cos(angle + bow) * length;
        const dy = Math.sin(angle + bow) * length;
        const midLift = (noise(cx - 7, cy + 9, layer) - 0.5) * 0.16;
        const start = pointAt(clamp(cx - dx + jitter, 1, width - 2), clamp(cy - dy, 1, height - 2), brightness, edge);
        const mid = pointAt(cx + jitter * 0.4, cy, brightness, edge, midLift);
        const end = pointAt(clamp(cx + dx + jitter, 1, width - 2), clamp(cy + dy, 1, height - 2), brightness, edge);
        const color = colorAt(rgbaIndex, ink, edge);
        pushSegment(start, mid, color, color);
        pushSegment(mid, end, color, color);
      };

      for (let layer = 0; layer < layerCount; layer += 1) {
        const hatchAngle = [-0.78, 0.12, 0.78, -0.28, 0.48, -1.05, 1.05][layer % 7];
        const offset = (layer * 2) % spacing;

        for (let y = 3 + offset; y < height - 3; y += spacing) {
          for (let x = 3 + ((y + layer) % spacing); x < width - 3; x += spacing) {
            const sx = clamp(Math.round(x + (noise(x, y, layer) - 0.5) * spacing * 0.75), 1, width - 2);
            const sy = clamp(Math.round(y + (noise(y, x, layer) - 0.5) * spacing * 0.75), 1, height - 2);
            const pixelIndex = sy * width + sx;
            const rgbaIndex = pixelIndex * 4;
            const brightness = luma[pixelIndex];
            const gradient = gradients[pixelIndex] || { gx: 0, gy: 0, edge: calculateEdge(luma, width, height, sx, sy) };
            const edge = gradient.edge;
            const darkness = 1 - brightness;
            const ink = clamp(edge * 1.24 + darkness * 0.72, 0, 1);
            const chance = clamp(ink * (1.1 + detailStrength * 0.55), 0.12, 0.96);

            if (ink < inkCutoff || noise(sx, sy, layer + 31) > chance) {
              continue;
            }

            const contourAngle =
              Math.abs(gradient.gx) + Math.abs(gradient.gy) > 0.001
                ? Math.atan2(gradient.gy, gradient.gx) + Math.PI / 2
                : hatchAngle;
            const angle = edge > 0.22 ? contourAngle : hatchAngle + (noise(sx, sy, layer + 9) - 0.5) * 0.2;
            const length = clamp(1.6 + edge * 5.5 + darkness * 3.5 - spacing * 0.12, 1.8, 6.8);

            makeStroke(sx, sy, angle, length, brightness, edge, ink, layer, rgbaIndex);
          }
        }
      }

      const detailStep = Math.max(2, Math.round(spacing * (1.1 - detailStrength * 0.45)));
      const detailCutoff = 0.11 + (1 - detailStrength) * 0.12;

      for (let y = 2; y < height - 2; y += detailStep) {
        for (let x = 2 + (y % detailStep); x < width - 2; x += detailStep) {
          const pixelIndex = y * width + x;
          const gradient = gradients[pixelIndex] || { gx: 0, gy: 0, edge: calculateEdge(luma, width, height, x, y) };
          const brightness = luma[pixelIndex];
          const edge = gradient.edge;
          const darkness = 1 - brightness;
          const localContrast =
            Math.abs(luma[pixelIndex] - luma[y * width + clamp(x + 2, 0, width - 1)]) +
            Math.abs(luma[pixelIndex] - luma[clamp(y + 2, 0, height - 1) * width + x]);
          const ink = clamp(edge * 1.45 + darkness * 0.46 + localContrast * 0.9, 0, 1);

          if (ink < detailCutoff || noise(x, y, 99) > clamp(ink * detailStrength * 1.3, 0.18, 0.94)) {
            continue;
          }

          const rgbaIndex = pixelIndex * 4;
          const angle = Math.atan2(gradient.gy, gradient.gx) + Math.PI / 2 + (noise(x, y, 111) - 0.5) * 0.32;
          const length = clamp(1.2 + edge * 4.2 + localContrast * 5.5, 1.1, 4.8);
          makeStroke(x, y, angle, length, brightness, edge, ink, 20, rgbaIndex);
        }
      }

      resolve({
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        width,
        height,
        segments: positions.length / 6,
      });
    };
    image.onerror = () => reject(new Error('Could not load that image.'));
    image.src = source;
  });

function ScribbleViewport({ scribble, settings }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const lineRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f7f4ef');
    scene.fog = new THREE.Fog('#f7f4ef', 12, 28);

    const camera = new THREE.PerspectiveCamera(44, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.4, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 5;
    controls.maxDistance = 24;
    controls.autoRotate = settings.autoRotate;
    controls.autoRotateSpeed = 0.8;

    const ambient = new THREE.AmbientLight('#ffffff', 1.9);
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(4, 6, 8);
    scene.add(ambient, key);

    const grid = new THREE.GridHelper(12, 16, '#cabfb2', '#e6ddd2');
    grid.position.y = -4.85;
    grid.position.z = -0.75;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    scene.add(grid);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 9.2),
      new THREE.MeshBasicMaterial({ color: '#fffdf8', transparent: true, opacity: 0.72 }),
    );
    plane.position.z = -0.28;
    scene.add(plane);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !scribble) return;

    if (lineRef.current) {
      sceneRef.current.remove(lineRef.current);
      lineRef.current.geometry.dispose();
      lineRef.current.material.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(scribble.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(scribble.colors, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      linewidth: 1,
    });

    const lines = new THREE.LineSegments(geometry, material);
    lines.rotation.x = -0.08;
    sceneRef.current.add(lines);
    lineRef.current = lines;
  }, [scribble]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = settings.autoRotate;
    if (lineRef.current) lineRef.current.scale.z = settings.relief / 50;
  }, [settings.autoRotate, settings.relief]);

  return <div className="viewport" ref={mountRef} aria-label="Interactive 3D scribble preview" />;
}

function App() {
  const demoImage = useMemo(makeDemoImage, []);
  const [source, setSource] = useState(demoImage);
  const [imageName, setImageName] = useState(EMPTY_IMAGE_NAME);
  const [settings, setSettings] = useState({
    density: 4,
    threshold: 14,
    depth: 38,
    flow: 2,
    layers: 6,
    relief: 34,
    color: 78,
    detail: 72,
    autoRotate: true,
  });
  const [scribble, setScribble] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsProcessing(true);
    setError('');

    processImage(source, settings)
      .then((result) => {
        if (!cancelled) setScribble(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsProcessing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    source,
    settings.density,
    settings.threshold,
    settings.depth,
    settings.flow,
    settings.layers,
    settings.color,
    settings.detail,
  ]);

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    setImageName(file.name);
    setSource(URL.createObjectURL(file));
  };

  const exportSnapshot = () => {
    const canvas = document.querySelector('.viewport canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = '3d-scribble-art.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const resetDemo = () => {
    setSource(demoImage);
    setImageName(EMPTY_IMAGE_NAME);
  };

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="3D scribble converter">
        <aside className="control-panel">
          <div className="brand-row">
            <div className="brand-mark">
              <Waves size={22} aria-hidden="true" />
            </div>
            <div>
              <h1>3D Scribble Art</h1>
              <p>Image to navigable relief drawing</p>
            </div>
          </div>

          <label className="upload-zone">
            <ImagePlus size={22} aria-hidden="true" />
            <span>{imageName}</span>
            <input type="file" accept="image/*" onChange={handleFile} />
          </label>

          <div className="button-row">
            <button type="button" onClick={resetDemo} title="Restore demo image">
              <RefreshCcw size={17} aria-hidden="true" />
              Demo
            </button>
            <button type="button" onClick={exportSnapshot} title="Download current view">
              <Download size={17} aria-hidden="true" />
              PNG
            </button>
          </div>

          <div className="toggle-row">
            <Camera size={18} aria-hidden="true" />
            <span>Auto orbit</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.autoRotate}
                onChange={(event) => updateSetting('autoRotate', event.target.checked)}
              />
              <span />
            </label>
          </div>

          <div className="sliders">
            <Slider
              icon={<Layers size={18} aria-hidden="true" />}
              label="Line density"
              min="3"
              max="10"
              value={settings.density}
              onChange={(value) => updateSetting('density', Number(value))}
              flipped
            />
            <Slider
              icon={<Sparkles size={18} aria-hidden="true" />}
              label="Ink threshold"
              min="8"
              max="58"
              value={settings.threshold}
              onChange={(value) => updateSetting('threshold', Number(value))}
            />
            <Slider
              icon={<Palette size={18} aria-hidden="true" />}
              label="Color strength"
              min="0"
              max="100"
              value={settings.color}
              onChange={(value) => updateSetting('color', Number(value))}
            />
            <Slider
              icon={<Sparkles size={18} aria-hidden="true" />}
              label="Fine detail"
              min="0"
              max="100"
              value={settings.detail}
              onChange={(value) => updateSetting('detail', Number(value))}
            />
            <Slider
              icon={<Box size={18} aria-hidden="true" />}
              label="Depth"
              min="20"
              max="95"
              value={settings.depth}
              onChange={(value) => updateSetting('depth', Number(value))}
            />
            <Slider
              icon={<Waves size={18} aria-hidden="true" />}
              label="Stroke looseness"
              min="0"
              max="9"
              value={settings.flow}
              onChange={(value) => updateSetting('flow', Number(value))}
            />
            <Slider
              icon={<Layers size={18} aria-hidden="true" />}
              label="Layer count"
              min="1"
              max="7"
              value={settings.layers}
              onChange={(value) => updateSetting('layers', Number(value))}
            />
          </div>
        </aside>

        <section className="stage">
          <ScribbleViewport scribble={scribble} settings={settings} />
          <div className="stage-toolbar" aria-live="polite">
            <span>{isProcessing ? 'Converting image...' : `${scribble?.segments ?? 0} scribble strokes`}</span>
            <span>Drag to rotate - Scroll to zoom</span>
          </div>
          {error && <div className="error-banner">{error}</div>}
        </section>
      </section>
    </main>
  );
}

function Slider({ icon, label, min, max, value, onChange, flipped = false }) {
  const displayValue = flipped ? Number(max) + Number(min) - value : value;

  return (
    <label className="slider-row">
      <span className="slider-heading">
        {icon}
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </span>
      <input min={min} max={max} value={value} type="range" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default App;
