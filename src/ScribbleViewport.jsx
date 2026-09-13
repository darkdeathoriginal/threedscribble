import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { revealLayout, revealWeights, shortestTurn } from './collection.js';
import { recordCanvas } from './recording.js';

const disposeDrawing = group => group?.traverse(object => {
  object.geometry?.dispose();
  object.material?.dispose();
});

function turnCamera(state, position, target = [0, 0, 0], zoom = 1) {
  // Clear pointer momentum before starting an arc around the artwork.
  const damping = state.controls.enableDamping;
  state.controls.enableDamping = false;
  state.controls.update(0);
  state.controls.enableDamping = damping;
  const targetTo = new THREE.Vector3(...target);
  const from = new THREE.Spherical().setFromVector3(state.camera.position.clone().sub(state.controls.target));
  const to = new THREE.Spherical().setFromVector3(new THREE.Vector3(...position).sub(targetTo));
  to.theta = from.theta + shortestTurn(from.theta, to.theta);
  state.transition = {
    started: performance.now(), from, to,
    targetFrom: state.controls.target.clone(), targetTo,
    zoomFrom: state.camera.zoom, zoomTo: zoom,
  };
}

export const VIEWS = [
  { id: 'front', label: 'Front', position: [0, 0, 16], zoom: 1 },
  { id: 'detail', label: 'Detail', position: [0.8, 0.6, 16], zoom: 2.2, target: [0, 0.7, 0] },
  { id: 'angle', label: 'Three-quarter', position: [10, 3, 12], zoom: 1.05 },
  { id: 'side', label: 'Side', position: [16, 0, 1], zoom: 1 },
  { id: 'top', label: 'Above', position: [0, 12, 10], zoom: 1.1 },
];

const ScribbleViewport = forwardRef(function ScribbleViewport({ scribble, autoRotate, onInteract, onError, onRevealChange }, ref) {
  const mountRef = useRef(null);
  const api = useRef(null);
  const callbacks = useRef({ onInteract, onError, onRevealChange });
  callbacks.current = { onInteract, onError, onRevealChange };

  useImperativeHandle(ref, () => ({
    view(id) {
      const state = api.current;
      if (!state) return;
      const view = VIEWS.find(v => v.id === id) || VIEWS[0];
      turnCamera(state, view.position, view.target, view.zoom);
    },
    reveal(id) {
      const state = api.current;
      const view = state?.revealViews?.find(view => view.id === id);
      if (!view) return;
      turnCamera(state, [Math.sin(view.angle) * 16, 0, Math.cos(view.angle) * 16]);
    },
    zoom(factor) {
      const state = api.current;
      if (!state) return;
      state.transition = null;
      state.camera.zoom = THREE.MathUtils.clamp(state.camera.zoom * factor, 0.35, 12);
      state.camera.updateProjectionMatrix();
    },
    snapshot() {
      if (!api.current) return null;
      const { renderer, scene, camera } = api.current;
      api.current.updateReveal?.();
      renderer.render(scene, camera);
      return new Promise((resolve, reject) => renderer.domElement.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the drawing.'));
      }, 'image/png'));
    },
    recordVideo({ duration, onProgress }) {
      const state = api.current;
      if (!state || state.recording) throw new Error('The drawing is not ready for recording.');
      const { camera, controls, renderer, scene } = state;
      state.transition = null;
      controls.update(0);
      const position = camera.position.clone();
      const target = controls.target.clone();
      const offset = position.clone().sub(target);
      const axis = new THREE.Vector3(0, 1, 0);
      // Capture explicit 2D copies, independent of WebGL compositor updates.
      // Even dimensions also work with hardware H.264 encoders.
      const capture = document.createElement('canvas');
      capture.width = Math.max(2, renderer.domElement.width - renderer.domElement.width % 2);
      capture.height = Math.max(2, renderer.domElement.height - renderer.domElement.height % 2);
      const context = capture.getContext('2d');
      const restore = () => {
        camera.position.copy(position);
        controls.target.copy(target);
        camera.lookAt(target);
        controls.enabled = true;
        state.recording = null;
        state.resize?.();
      };
      controls.enabled = false;
      controls.autoRotate = false;
      try {
        const job = recordCanvas(capture, {
          duration, onProgress,
          onFrame(progress) {
            camera.position.copy(offset).applyAxisAngle(axis, progress * Math.PI * 2).add(target);
            camera.lookAt(target);
            state.updateReveal?.();
            renderer.render(scene, camera);
            context.drawImage(renderer.domElement, 0, 0, capture.width, capture.height);
          },
        });
        state.recording = job;
        return { cancel: job.cancel, promise: job.promise.finally(restore) };
      } catch (error) { restore(); throw error; }
    },
  }), []);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 0, 16);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      callbacks.current.onError('3D rendering is unavailable. Enable hardware acceleration in your browser and reload.');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', '3D drawing. Drag to orbit, scroll to zoom, right-drag to pan.');
    renderer.domElement.tabIndex = 0;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = -2;
    controls.minZoom = 0.35;
    controls.maxZoom = 12;
    controls.zoomToCursor = true;
    const state = { renderer, camera, controls, scene, lines: null, transition: null };
    const direction = new THREE.Vector3();
    state.updateReveal = () => {
      if (!state.revealViews?.length) return;
      camera.getWorldDirection(direction);
      const angle = Math.atan2(-direction.x, -direction.z);
      const weights = revealWeights(state.revealViews, angle);
      let best = 0;
      state.revealViews.forEach((view, index) => {
        view.uniform.value = weights[index];
        view.lines.renderOrder = weights[index] > 0.5 ? 2 : 1;
        if (weights[index] > weights[best]) best = index;
      });
      const id = state.revealViews[best].id;
      if (state.currentReveal !== id) {
        state.currentReveal = id;
        callbacks.current.onRevealChange?.(id);
      }
    };
    api.current = state;
    const interaction = () => {
      state.transition = null;
      controls.autoRotate = false;
      callbacks.current.onInteract();
    };
    controls.addEventListener('start', interaction);
    const resize = () => {
      if (state.recording) return;
      const width = mount.clientWidth, height = mount.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const halfHeight = aspect < 1 ? 5.1 / aspect : 5.1;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    state.resize = resize;
    observer.observe(mount);
    resize();
    const lost = event => {
      event.preventDefault();
      state.recording?.cancel();
      callbacks.current.onError('The graphics context was interrupted. Reload to restore the drawing.');
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    let frame, lastTime = performance.now();
    const animate = now => {
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (state.recording) {
        // The recorder renders the orbit; don't let controls overwrite it.
      } else if (state.transition) {
        const transition = state.transition;
        const t = Math.min(1, (now - transition.started) / 1100);
        const ease = t * t * (3 - 2 * t);
        controls.target.lerpVectors(transition.targetFrom, transition.targetTo, ease);
        const spherical = new THREE.Spherical(
          THREE.MathUtils.lerp(transition.from.radius, transition.to.radius, ease),
          THREE.MathUtils.lerp(transition.from.phi, transition.to.phi, ease),
          THREE.MathUtils.lerp(transition.from.theta, transition.to.theta, ease),
        );
        camera.position.setFromSpherical(spherical).add(controls.target);
        camera.zoom = THREE.MathUtils.lerp(transition.zoomFrom, transition.zoomTo, ease);
        camera.updateProjectionMatrix();
        camera.lookAt(controls.target);
        if (t === 1) state.transition = null;
      } else controls.update(delta);
      if (!state.recording) {
        state.updateReveal();
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      state.recording?.cancel();
      observer.disconnect();
      controls.removeEventListener('start', interaction);
      controls.dispose();
      disposeDrawing(state.lines);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    if (!api.current || !scribble) return;
    const state = api.current;
    if (state.lines) {
      state.scene.remove(state.lines);
      disposeDrawing(state.lines);
    }
    const items = scribble.items || [scribble];
    const layout = revealLayout(items.length);
    state.lines = new THREE.Group();
    state.revealViews = [];
    state.currentReveal = null;
    const geometries = items.map(item => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(item.positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(item.colors, 4));
      geometry.computeBoundingSphere();
      return geometry;
    });
    layout.forEach(view => {
      const item = items[view.imageIndex];
      const geometry = geometries[view.imageIndex];
      const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
      const uniform = { value: 1 };
      material.onBeforeCompile = shader => {
        shader.uniforms.uReveal = uniform;
        shader.fragmentShader = `uniform float uReveal;\n${shader.fragmentShader}`.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // Leave loose strands from the other directions woven through the
          // volume, while the facing image supplies the readable detail.
          float loose = 1.0 - step(0.999, vColor.a);
          diffuseColor.a *= mix(0.035 * loose, 1.0, uReveal);`,
        );
      };
      material.customProgramCacheKey = () => 'angle-reveal-v1';
      const lines = new THREE.LineSegments(geometry, material);
      lines.name = item.name || 'Drawing';
      lines.rotation.y = view.angle;
      lines.scale.z = items.length > 1 ? 2.4 : 1;
      // No offsets or tiles: all image strands intersect in this volume.
      lines.position.set(0, 0, 0);
      state.lines.add(lines);
      state.revealViews.push({ ...view, id: item.id, lines, uniform });
    });
    state.scene.add(state.lines);
    state.updateReveal();
  }, [scribble]);

  useEffect(() => {
    if (api.current) api.current.controls.autoRotate = autoRotate;
  }, [autoRotate]);

  return <div className="viewport" ref={mountRef} />;
});

export default ScribbleViewport;
