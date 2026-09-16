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
    // Centre autour duquel chaque point dérive (mouvement organique propre à
    // chaque point, indépendant des autres) plutôt qu'une position figée
    // qui ne bouge qu'en bloc avec la rotation du groupe entier.
    const nodeCenters: THREE.Vector3[] = [];
    // Amplitude et vitesse de dérive propres à chaque point (des valeurs
    // toutes identiques donneraient un mouvement qui reste synchronisé et
    // donc visuellement figé malgré le bougé).
    const nodeDrift: { amp: THREE.Vector3; speed: THREE.Vector3; phase: THREE.Vector3 }[] = [];
    const nodeGeometry = new THREE.IcosahedronGeometry(0.09, 1);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xd97706 });

    for (let i = 0; i < nodeCount; i += 1) {
      const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      const radius = 3.2 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const pos = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
      );
      // Le texte du hero occupe la colonne centrale de l'écran, mais "quel
      // x évite le centre" dépend de la distance à la caméra (position z=9,
      // fov 45°) : un point plus loin (z très négatif, donc distance à la
      // caméra plus grande) reste comprimé près du centre à l'écran même
      // avec un x nettement plus grand qu'un point proche — projection
      // perspective oblige. La marge nécessaire est donc calculée à partir
      // de la vraie formule de projection plutôt qu'un seuil fixe, sous
      // peine de ne dégager que les points les plus proches et de laisser
      // les points plus lointains empiéter sur le texte quand même.
      const ndcHalfWidthClearance = 0.5; // un peu plus que la largeur du bloc de texte en NDC
      // La hauteur de la section hero n'est pas 900px (elle s'ajuste à son
      // contenu) — utiliser le vrai ratio du canvas ici, pas une valeur
      // arbitraire, sous peine de sous-estimer la marge nécessaire (ratio
      // trop bas = facteur de perspective trop petit = points pas assez
      // repoussés pour vraiment dégager le texte à l'écran).
      const perspectiveFactor = Math.tan((45 * Math.PI) / 180 / 2) * (width / height); // tan(fovY/2) * aspect
      const cameraDistanceZ = 9;
      const distanceToCamera = cameraDistanceZ - pos.z;
      const requiredX = ndcHalfWidthClearance * perspectiveFactor * distanceToCamera;
      if (Math.abs(pos.x) < requiredX) {
        const side = pos.x >= 0 ? 1 : -1;
        pos.x = side * (requiredX + Math.random() * 0.5);
      }
      mesh.position.copy(pos);
      group.add(mesh);
      nodes.push(mesh);
      nodeCenters.push(pos.clone());
      nodeDrift.push({
        amp: new THREE.Vector3(0.15 + Math.random() * 0.2, 0.35 + Math.random() * 0.35, 0.3 + Math.random() * 0.3),
        speed: new THREE.Vector3(0.12 + Math.random() * 0.18, 0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.15),
        phase: new THREE.Vector3(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2),
      });
    }

    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.5 });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(lines);
    const maxLinePairs = (nodeCount * (nodeCount - 1)) / 2;
    const linePositionArray = new Float32Array(maxLinePairs * 2 * 3);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositionArray, 3));
    lineGeometry.setDrawRange(0, 0);

    // Recalculée chaque frame à partir des positions courantes (voir
    // renderFrame) : comme les points dérivent maintenant individuellement,
    // les traits doivent se faire et se défaire en direct plutôt que rester
    // figés sur les distances calculées une seule fois au montage.
    function updateLines() {
      let vertexCount = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          if (nodes[i].position.distanceTo(nodes[j].position) < 2.2) {
            const base = vertexCount * 3;
            linePositionArray[base] = nodes[i].position.x;
            linePositionArray[base + 1] = nodes[i].position.y;
            linePositionArray[base + 2] = nodes[i].position.z;
            linePositionArray[base + 3] = nodes[j].position.x;
            linePositionArray[base + 4] = nodes[j].position.y;
            linePositionArray[base + 5] = nodes[j].position.z;
            vertexCount += 2;
          }
        }
      }
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.setDrawRange(0, vertexCount);
    }
    updateLines();

    let frameId: number | null = null;
    let isVisible = true;
    let isTabVisible = document.visibilityState === 'visible';
    let isPausedForThemeTransition = false;
    const clock = new THREE.Clock();

    function renderFrame() {
      const t = clock.getElapsedTime();
      // Rotation d'ensemble beaucoup plus douce qu'avant : la dérive de
      // chaque point ci-dessous porte maintenant l'essentiel du mouvement,
      // celle-ci ne sert plus qu'à un léger effet de parallaxe.
      group.rotation.y = t * 0.04;
      group.rotation.x = Math.sin(t * 0.08) * 0.06;

      for (let i = 0; i < nodes.length; i += 1) {
        const center = nodeCenters[i];
        const d = nodeDrift[i];
        nodes[i].position.set(
          center.x + Math.sin(t * d.speed.x + d.phase.x) * d.amp.x,
          center.y + Math.sin(t * d.speed.y + d.phase.y) * d.amp.y,
          center.z + Math.sin(t * d.speed.z + d.phase.z) * d.amp.z,
        );
      }
      updateLines();

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderFrame);
    }

    // Only burn CPU/GPU on this continuous WebGL render while the hero is
    // actually on screen and the tab is focused — this was previously
    // running forever regardless, a major source of jank on the rest of
    // the site.
    function updateLoop() {
      const shouldRun = isVisible && isTabVisible && !isPausedForThemeTransition;
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

    // Le cercle de bascule clair/sombre (voir ThemeToggle.tsx) anime deux
    // captures figées de la page : le rendu 3D continu ici n'est visible
    // par personne pendant ce court instant, mais consommait quand même du
    // temps GPU/CPU en concurrence avec l'animation du cercle, la rendant
    // saccadée. On coupe donc le rendu le temps de la transition.
    function handleThemeTransitionStart() {
      isPausedForThemeTransition = true;
      updateLoop();
    }
    function handleThemeTransitionEnd() {
      isPausedForThemeTransition = false;
      updateLoop();
    }
    document.addEventListener('theme-transition-start', handleThemeTransitionStart);
    document.addEventListener('theme-transition-end', handleThemeTransitionEnd);

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
      document.removeEventListener('theme-transition-start', handleThemeTransitionStart);
      document.removeEventListener('theme-transition-end', handleThemeTransitionEnd);
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
