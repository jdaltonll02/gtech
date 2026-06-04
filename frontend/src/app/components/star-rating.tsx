import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from './ui/utils';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  showLabel?: boolean;
}

const SIZE = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' };

export function StarRating({ value, onChange, size = 'md', readOnly = false, showLabel = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            SIZE[size],
            'transition-colors',
            active >= star ? 'fill-amber-400 text-amber-400' : 'fill-none text-black/20',
            !readOnly && 'cursor-pointer hover:scale-110',
          )}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          onClick={() => !readOnly && onChange?.(star)}
        />
      ))}
      {showLabel && value > 0 && (
        <span className="ml-1.5 text-sm text-black/60">{value.toFixed(1)}</span>
      )}
    </span>
  );
}

/** Display-only bar chart of rating distribution */
export function RatingDistribution({ distribution, total }: { distribution: Record<number, number>; total: number }) {
  return (
    <div className="space-y-1.5 w-full max-w-xs">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right text-black/50">{star}</span>
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
            <div className="flex-1 h-2 bg-black/8 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-right text-black/40">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
