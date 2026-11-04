'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type FadeInSectionProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function FadeInSection({
  children,
  className = '',
  delay = 0,
}: FadeInSectionProps): ReactNode {
  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
}
