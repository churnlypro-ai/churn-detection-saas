'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export type HexagonStatus = 'idle' | 'loading' | 'success' | 'error';
export type HexagonVariant = 'small' | 'medium' | 'large';

interface MagicHexagonProps {
  clientCount?: number;
  churnRate?: number;
  monthlyRevenue?: number;
  isLocked?: boolean;
  status?: HexagonStatus;
  variant?: HexagonVariant;
}

const VARIANT_SIZE: Record<HexagonVariant, number> = {
  small: 140,
  medium: 220,
  large: 360,
};

function getChurnColor(churn: number): THREE.Color {
  if (churn < 5) return new THREE.Color(0x10b981);
  if (churn < 10) return new THREE.Color(0x84cc16);
  if (churn < 15) return new THREE.Color(0xf59e0b);
  if (churn < 20) return new THREE.Color(0xf97316);
  return new THREE.Color(0xdc2626);
}

function getRotationSpeed(churn: number): number {
  if (churn < 5) return 0.15;
  if (churn < 10) return 0.3;
  if (churn < 15) return 0.6;
  if (churn < 20) return 0.9;
  return 1.4;
}

function getHexSize(clients: number): number {
  return 1.2 + Math.min(clients / 500, 1.5);
}

function getLineThickness(revenue: number): number {
  return 0.01 + Math.min(revenue / 200000, 1) * 0.04;
}

export default function MagicHexagon({
  clientCount = 100,
  churnRate = 5,
  monthlyRevenue = 50000,
  isLocked,
  status = 'idle',
  variant,
}: MagicHexagonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ clientCount, churnRate, monthlyRevenue, isLocked, status });
  propsRef.current = { clientCount, churnRate, monthlyRevenue, isLocked, status };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const group = new THREE.Group();
    scene.add(group);

    const layers: { mesh: THREE.LineLoop; baseRadius: number; speed: number }[] = [];
    for (let layer = 0; layer < 5; layer++) {
      const radius = 1 + layer * 0.35;
      const points: number[] = [];
      const sides = 6;
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        points.push(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          (layer - 2) * 0.15,
        );
      }
      const mat = new THREE.LineBasicMaterial({
        color: getChurnColor(churnRate),
        transparent: true,
        opacity: 0.2 + layer * 0.12,
        linewidth: getLineThickness(monthlyRevenue),
      });
      const loopGeom = new THREE.BufferGeometry();
      loopGeom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const loop = new THREE.LineLoop(loopGeom, mat);
      loop.userData.layer = layer;
      group.add(loop);
      layers.push({ mesh: loop, baseRadius: radius, speed: layer % 2 === 0 ? 1 : -1 });
    }

    const circles: THREE.LineLoop[] = [];
    for (let c = 0; c < 3; c++) {
      const radius = 0.6 + c * 0.5;
      const pts: number[] = [];
      const segs = 64;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const m = new THREE.LineBasicMaterial({
        color: getChurnColor(churnRate),
        transparent: true,
        opacity: 0.15,
      });
      const circle = new THREE.LineLoop(g, m);
      circle.userData.dir = c % 2 === 0 ? 1 : -1;
      group.add(circle);
      circles.push(circle);
    }

    const particleCount = 40;
    const particleGeom = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 4;
      particlePos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: getChurnColor(churnRate),
      size: 0.05,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    group.add(particles);

    const glowGeom = new THREE.IcosahedronGeometry(0.3, 1);
    const glowMat = new THREE.MeshBasicMaterial({
      color: getChurnColor(churnRate),
      transparent: true,
      opacity: 0.15,
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    group.add(glow);

    const spinnerGeom = new THREE.BufferGeometry();
    const spinnerSegs = 32;
    const spinnerPts: number[] = [];
    for (let i = 0; i <= spinnerSegs; i++) {
      const a = (i / spinnerSegs) * Math.PI * 2;
      spinnerPts.push(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.01);
    }
    spinnerGeom.setAttribute('position', new THREE.Float32BufferAttribute(spinnerPts, 3));
    const spinnerMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
    });
    const spinner = new THREE.LineLoop(spinnerGeom, spinnerMat);
    group.add(spinner);

    let frameId: number | null = null;
    let isVisible = true;
    let isTabVisible = document.visibilityState === 'visible';
    const clock = new THREE.Clock();
    let morphT = 0;
    let currentRotSpeed = getRotationSpeed(churnRate);
    let targetRotSpeed = currentRotSpeed;
    let shakeOffset = 0;
    let errorColorT = 0;

    function animate() {
      const t = clock.getElapsedTime();
      const props = propsRef.current;
      const baseSpeed = getRotationSpeed(props.churnRate);
      const size = getHexSize(props.clientCount);
      const baseColor = getChurnColor(props.churnRate);
      const locked = props.isLocked;
      const stat = props.status;

      if (stat === 'loading') targetRotSpeed = baseSpeed * 2.5;
      else if (stat === 'success') targetRotSpeed = baseSpeed;
      else if (stat === 'error') targetRotSpeed = 0;
      else targetRotSpeed = baseSpeed;

      currentRotSpeed += (targetRotSpeed - currentRotSpeed) * 0.05;

      if (stat === 'error') {
        shakeOffset = Math.sin(t * 40) * 0.05;
        errorColorT = Math.min(errorColorT + 0.05, 1);
      } else {
        shakeOffset = 0;
        errorColorT = Math.max(errorColorT - 0.05, 0);
      }

      group.position.x = shakeOffset;
      group.rotation.y = t * currentRotSpeed * 0.3;
      group.rotation.z = Math.sin(t * 0.2) * 0.1;

      const effectiveColor = errorColorT > 0
        ? baseColor.clone().lerp(new THREE.Color(0xdc2626), errorColorT)
        : baseColor;

      morphT += 0.005;
      const morphPhase = (Math.sin(morphT) + 1) / 2;

      const pulseFreq = stat === 'loading' ? 6 : stat === 'error' ? 8 : 2;

      layers.forEach((layer, idx) => {
        const sides = morphPhase < 0.5 ? 6 : 8;
        const r = layer.baseRadius * size * (locked ? 0.6 : 1);
        const pts: number[] = [];
        for (let i = 0; i <= sides; i++) {
          const a = (i / sides) * Math.PI * 2 + t * 0.1 * layer.speed;
          pts.push(Math.cos(a) * r, Math.sin(a) * r, (idx - 2) * 0.15);
        }
        const g = layer.mesh.geometry;
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        g.attributes.position.needsUpdate = true;
        (layer.mesh.material as THREE.LineBasicMaterial).color = effectiveColor;
        (layer.mesh.material as THREE.LineBasicMaterial).opacity = locked ? 0.05 : 0.2 + idx * 0.12;
      });

      circles.forEach((c, idx) => {
        c.rotation.z = t * 0.2 * c.userData.dir;
        const r = (0.6 + idx * 0.5) * size * (locked ? 0.5 : 1);
        const pts: number[] = [];
        const segs = 64;
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          pts.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        }
        const g = c.geometry;
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        g.attributes.position.needsUpdate = true;
        (c.material as THREE.LineBasicMaterial).color = effectiveColor;
        (c.material as THREE.LineBasicMaterial).opacity = locked ? 0.03 : 0.15;
      });

      const pPos = particles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pPos[i * 3 + 1] += Math.sin(t + i) * 0.002;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      (particleMat as THREE.PointsMaterial).color = effectiveColor;
      (particleMat as THREE.PointsMaterial).opacity = locked ? 0.1 : 0.6;

      const pulseScale = 1 + Math.sin(t * pulseFreq) * (stat === 'loading' || stat === 'error' ? 0.25 : 0.15);
      const brightnessBoost = stat === 'loading' ? 1.1 : 1;
      glow.scale.setScalar(pulseScale * (locked ? 0.3 : 1) * brightnessBoost);
      (glowMat as THREE.MeshBasicMaterial).color = effectiveColor;
      (glowMat as THREE.MeshBasicMaterial).opacity = locked ? 0.05 : 0.1 + Math.sin(t * pulseFreq) * 0.05;

      if (stat === 'loading') {
        spinner.rotation.z = t * 3;
        (spinnerMat as THREE.LineBasicMaterial).opacity = 0.6;
        (spinnerMat as THREE.LineBasicMaterial).color = new THREE.Color(0xf59e0b);
      } else {
        (spinnerMat as THREE.LineBasicMaterial).opacity = Math.max((spinnerMat as THREE.LineBasicMaterial).opacity - 0.02, 0);
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    // Cette animation WebGL tournait en continu du montage au démontage,
    // même quand le canvas était scrollé hors champ (ex: la version
    // "success" en arrière-plan décoratif de /pricing étape 2) ou l'onglet
    // en arrière-plan — un vrai foyer de ralentissement du site, comme
    // détecté et corrigé pour AnimatedHero. Même parade ici : on ne rend
    // que quand le canvas est visible à l'écran ET l'onglet actif.
    function updateLoop() {
      const shouldRun = isVisible && isTabVisible;
      if (shouldRun && frameId === null) {
        frameId = requestAnimationFrame(animate);
      } else if (!shouldRun && frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
        updateLoop();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(canvas);

    function handleVisibilityChange() {
      isTabVisible = document.visibilityState === 'visible';
      updateLoop();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    updateLoop();

    function handleResize() {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.LineLoop || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  const sizeStyle = variant ? { width: VARIANT_SIZE[variant], height: VARIANT_SIZE[variant] } : undefined;

  return (
    <div className="relative" style={sizeStyle}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <AnimatePresence>
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/90">
              <Check className="h-6 w-6 text-white" />
            </div>
          </motion.div>
        )}
        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/90">
              <X className="h-6 w-6 text-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
