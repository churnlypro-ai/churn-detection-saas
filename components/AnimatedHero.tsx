'use client';

import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import * as THREE from 'three';

export default function AnimatedHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

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
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-b from-white via-white to-slate-50">
      <motion.div style={{ y: orbsY }} className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[10%] h-[400px] w-[400px] rounded-full bg-brand-200/20 blur-[120px]" />
        <div className="absolute right-[-5%] bottom-[5%] h-[300px] w-[300px] rounded-full bg-brand-100/30 blur-[100px]" />
      </motion.div>

      <motion.div style={{ y: canvasY }} className="pointer-events-none absolute inset-0">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </motion.div>

      <motion.div style={{ y: textY, opacity: textOpacity }} className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-32 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm"
        >
          Analyse par IA · Prévention de churn en temps réel
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl"
        >
          Churnly
          <br />
          <span className="text-brand-600">Sauvez votre revenue.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-lg text-slate-600"
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
          <a
            href="/signup"
            className="rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Commencer gratuitement
          </a>
          <span className="text-xs text-slate-400">Pas de carte bancaire requise · Aperçu gratuit</span>
        </motion.div>
      </motion.div>
    </section>
  );
}
