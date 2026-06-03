import { ReactNode } from 'react';
import { cn } from './ui/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl backdrop-blur-md bg-black/[0.03] border border-black/10',
        'shadow-[0_8px_32px_0_rgba(139,0,0,0.10)]',
        hover && 'transition-all duration-300 hover:bg-black/[0.06] hover:border-primary/40 hover:shadow-[0_8px_32px_0_rgba(139,0,0,0.2)] hover:-translate-y-1',
        className
      )}
    >
      {children}
    </div>
  );
}
