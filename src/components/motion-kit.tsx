import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';

// Original implementations informed by Rare UI and Transitions.dev; see docs/ui-references.md.
export function AnimatedValue({ value }: { value: string }) {
  const reduce = useReducedMotion();
  return <span className="animated-value"><span className="sr-only">{value}</span><span aria-hidden="true" className="animated-value-digits">{Array.from(value).map((digit, index) => <span className="animated-digit" key={index}><motion.span key={digit} initial={reduce ? false : { y: '85%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: reduce ? 0 : .3, delay: reduce ? 0 : index * .018, ease: 'easeOut' }}>{digit === ' ' ? '\u00a0' : digit}</motion.span></span>)}</span></span>;
}

export function ChoiceGroup({ options, value, onChange, label, className }: { options: { id: string; content: ReactNode }[]; value: string; onChange: (value: string) => void; label: string; className: string }) {
  const id = useId();
  const reduce = useReducedMotion();
  return <LayoutGroup id={id}><div className={`${className} motion-choices`} role="group" aria-label={label}>{options.map(option => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{value === option.id && <motion.span className="choice-indicator" layoutId="choice" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} aria-hidden="true" />}<span className="choice-content">{option.content}</span></button>)}</div></LayoutGroup>;
}
