import { motion } from 'motion/react';

export type TimelineEntry = {
  id: string;
  heading: string;
  subheading: string;
  period: string;
  location?: string | null;
  body?: string | null;
  extra?: React.ReactNode;
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="relative pl-10 sm:pl-14">
      {/* Vertical gradient line */}
      <div className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary/70 via-primary/30 to-transparent" />

      <div className="space-y-8">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.42, ease: 'easeOut', delay: i * 0.06 }}
            className="relative"
          >
            {/* Animated dot */}
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 340, damping: 22, delay: i * 0.06 + 0.06 }}
              className="absolute -left-10 sm:-left-14 top-5 w-[18px] h-[18px] rounded-full bg-primary border-[3px] border-white shadow-[0_0_0_4px_rgba(var(--tw-shadow-color,0,0,0)/0.08)]"
              style={{ boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-primary, #4f46e5) 15%, transparent)' }}
            />

            <div className="bg-white/80 backdrop-blur-sm border border-black/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5 mb-1">
                <h3 className="font-bold text-base sm:text-[1.05rem] leading-snug">{entry.heading}</h3>
                <div className="text-xs text-black/40 sm:text-right flex-shrink-0 sm:pl-6 mt-0.5">
                  <p className="font-medium">{entry.period}</p>
                  {entry.location && <p className="mt-0.5">{entry.location}</p>}
                </div>
              </div>
              <p className="text-primary font-semibold text-sm mb-2">{entry.subheading}</p>
              {entry.body && (
                <p className="text-black/60 text-sm leading-relaxed">{entry.body}</p>
              )}
              {entry.extra}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
