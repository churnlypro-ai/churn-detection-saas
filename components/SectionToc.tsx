'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface TocItem {
  id: string;
  label: string;
}

export default function SectionToc({ items }: { items: TocItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const { dict } = useLanguage();

  useEffect(() => {
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = elements.findIndex((el) => el === entry.target);
          if (idx !== -1) setActiveIndex(idx);
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  function handleClick(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav
      aria-label={dict.common.tocLabel}
      className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
    >
      <div ref={railRef} className="relative flex flex-col gap-5 pl-4">
        <div className="absolute left-[3px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-800">
          <motion.div
            className="w-px bg-brand-400 dark:bg-brand-500"
            initial={false}
            animate={{ height: `${(activeIndex / Math.max(1, items.length - 1)) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {items.map((item, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className="group relative flex items-center gap-2.5 text-left"
            >
              <span
                className={`absolute -left-4 h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  active ? 'scale-125 bg-brand-500' : 'bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-700 dark:group-hover:bg-slate-600'
                }`}
              />
              <span
                className={`text-xs transition-all duration-300 ${
                  active
                    ? 'font-semibold text-slate-900 opacity-100 dark:text-white'
                    : 'font-medium text-slate-400 opacity-60 group-hover:opacity-90 dark:text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
