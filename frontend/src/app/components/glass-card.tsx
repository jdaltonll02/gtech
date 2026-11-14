import { ReactNode } from 'react';
import { cn } from './ui/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

// Name kept for compatibility; renders a white surface card (16px radius, hairline border, soft shadow).
export function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white border border-black/[0.07]',
        'shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_-8px_rgba(20,22,26,0.10)]',
        hover && 'transition-all duration-300 hover:border-primary/30 hover:shadow-[0_2px_4px_rgba(20,22,26,0.05),0_16px_32px_-12px_rgba(139,21,34,0.22)] hover:-translate-y-1',
        className
      )}
    >
      {children}
    </div>
  );
}
