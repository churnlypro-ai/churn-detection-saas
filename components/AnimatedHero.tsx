'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import MagicHexagon from '@/components/MagicHexagon';

const FLOATING_BALLS = [
  { x: '18%', y: '22%', delay: 0 },
  { x: '78%', y: '16%', delay: 0.4 },
  { x: '30%', y: '68%', delay: 0.8 },
  { x: '85%', y: '62%', delay: 1.2 },
  { x: '55%', y: '12%', delay: 1.6 },
  { x: '10%', y: '55%', delay: 2 },
];

export default function AnimatedHero() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [modalData, setModalData] = useState({ email: '', clients: 50, revenue: 50000 });

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

    let frameId: number;
    const clock = new THREE.Clock();

    function animate() {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.12;
      group.rotation.x = Math.sin(t * 0.15) * 0.15;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

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
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <motion.div style={{ y: orbsY }} className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[10%] h-[400px] w-[400px] rounded-full bg-brand-200/20 blur-[120px]" />
        <div className="absolute right-[-5%] bottom-[5%] h-[300px] w-[300px] rounded-full bg-brand-100/30 blur-[100px]" />
      </motion.div>

      <motion.div style={{ y: canvasY }} className="pointer-events-none absolute inset-0">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
          Analyse par IA · Prévention de churn en temps réel
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl"
        >
          Churnly
          <br />
          <span className="text-brand-600">Sauvez votre revenue.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-400"
        >
          Prédisez qui va partir avant qu&apos;il ne parte. Uploadez vos données clients, notre IA
          détecte les signaux de risque et vous dit exactement quoi faire.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Commencer gratuitement
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">Pas de carte bancaire requise · Aperçu gratuit</span>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="absolute right-6 top-6 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>

              {modalStep === 1 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Prêt à voir votre churn ?</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Remplissez 3 infos pour démarrer.</p>

                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Email</label>
                    <input
                      type="email"
                      value={modalData.email}
                      onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                      placeholder="vous@entreprise.com"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Nombre de clients: {modalData.clients}
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={10000}
                      step={5}
                      value={modalData.clients}
                      onChange={(e) => setModalData({ ...modalData, clients: Number(e.target.value) })}
                      className="w-full accent-brand-600"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">CA mensuel</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">€</span>
                      <input
                        type="number"
                        value={modalData.revenue}
                        onChange={(e) => setModalData({ ...modalData, revenue: Number(e.target.value) })}
                        className="flex-1 rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => {
                      setModalStep(2);
                      setTimeout(() => router.push('/signup'), 2500);
                    }}
                    disabled={!modalData.email}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    Valider et analyser
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-8"
                >
                  <MagicHexagon variant="medium" churnRate={5} status="loading" />
                  <p className="mt-6 text-slate-600 dark:text-slate-400">On calcule votre risque…</p>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
