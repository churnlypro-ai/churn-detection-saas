'use client';

import { motion } from 'framer-motion';

export default function SectionDivider() {
  return (
    <div className="relative h-24 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 2, ease: 'easeInOut' }}
        viewport={{ once: false, amount: 0.5 }}
        className="absolute left-1/2 top-1/2 h-px w-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-brand-400 to-transparent"
      />
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        viewport={{ once: false, amount: 0.5 }}
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-brand-50/20 to-transparent"
      />
    </div>
  );
}
