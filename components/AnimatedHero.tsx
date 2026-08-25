'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import * as THREE from 'three';
import { PhoneCall } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/LanguageContext';
import { CallBookingModal } from '@/components/CallBookingModal';

const FLOATING_BALLS = [
  { x: '18%', y: '22%', delay: 0 },
  { x: '78%', y: '16%', delay: 0.4 },
  { x: '30%', y: '68%', delay: 0.8 },
  { x: '85%', y: '62%', delay: 1.2 },
  { x: '55%', y: '12%', delay: 1.6 },
  { x: '10%', y: '55%', delay: 2 },
];

export default function AnimatedHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const t = useTranslations('home').hero;
  const tCall = useTranslations('callBooking');
  const [callModalOpen, setCallModalOpen] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const canvasY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const orbsY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 9;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const group = new THREE.Group();
    scene.add(group);

    const nodeCount = 26;
    const nodes: THREE.Mesh[] = [];
    const nodeGeometry = new THREE.IcosahedronGeometry(0.09, 1);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xd97706 });

    for (let i = 0; i < nodeCount; i += 1) {
      const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      const radius = 3.2 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      mesh.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
      );
      group.add(mesh);
      nodes.push(mesh);
    }

    const linePositions: number[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (nodes[i].position.distanceTo(nodes[j].position) < 2.2) {
          linePositions.push(
            nodes[i].position.x, nodes[i].position.y, nodes[i].position.z,
            nodes[j].position.x, nodes[j].position.y, nodes[j].position.z,
          );
        }
      }
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.5 });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(lines);

    let frameId: number | null = null;
    let isVisible = true;
    let isTabVisible = document.visibilityState === 'visible';
    const clock = new THREE.Clock();

    function renderFrame() {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.12;
      group.rotation.x = Math.sin(t * 0.15) * 0.15;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderFrame);
    }

    // Only burn CPU/GPU on this continuous WebGL render while the hero is
    // actually on screen and the tab is focused — this was previously
    // running forever regardless, a major source of jank on the rest of
    // the site.
    function updateLoop() {
      const shouldRun = isVisible && isTabVisible;
      if (shouldRun && frameId === null) {
        frameId = requestAnimationFrame(renderFrame);
      } else if (!shouldRun && frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    }

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
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
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <motion.div style={{ y: orbsY }} className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[10%] h-[400px] w-[400px] rounded-full bg-brand-200/20 blur-[120px]" />
        <div className="absolute right-[-5%] bottom-[5%] h-[300px] w-[300px] rounded-full bg-brand-100/30 blur-[100px]" />
      </motion.div>

      <motion.div style={{ y: canvasY }} className="pointer-events-none absolute inset-0">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </motion.div>

      <div className="no-theme-transition pointer-events-none absolute inset-0 overflow-hidden">
        {FLOATING_BALLS.map((ball, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.3 }}
            whileInView={{ y: [0, -24, 12], opacity: [0.3, 0.7, 0.2] }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 6, delay: ball.delay, repeat: Infinity, repeatType: 'reverse' }}
            className="absolute h-8 w-8 rounded-full bg-brand-500 blur-md"
            style={{ left: ball.x, top: ball.y }}
          />
        ))}
      </div>

      <motion.div style={{ y: textY, opacity: textOpacity }} className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-32 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400"
        >
          {t.badge}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl"
        >
          {t.titleLine1}
          <br />
          <span className="text-brand-600">{t.titleLine2}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-400"
        >
          {t.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              {t.cta}
            </Link>
            <button
              onClick={() => setCallModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700"
            >
              <PhoneCall className="h-4 w-4" />
              {tCall.button}
            </button>
          </div>
          <Link
            href="/demo?direct=1"
            className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-brand-600 hover:underline dark:text-slate-400 dark:hover:text-brand-400"
          >
            {t.demoLink}
          </Link>
          <span className="text-xs text-slate-400 dark:text-slate-500">{t.ctaNote}</span>
        </motion.div>
      </motion.div>
    </section>

    {/* Hors de la section ci-dessus : celle-ci a overflow-hidden, ce qui
        clippait la modale (position: fixed) à sa hauteur — les clics sur
        le bas du formulaire tombaient alors sur le contenu de la page en
        dessous au lieu d'atteindre les boutons de la modale. */}
    <CallBookingModal open={callModalOpen} onClose={() => setCallModalOpen(false)} />
    </>
  );
}
