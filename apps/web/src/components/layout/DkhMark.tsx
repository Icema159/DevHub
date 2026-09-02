import { cn } from '../../lib/cn';

export interface DkhMarkProps {
  className?: string;
}

/**
 * The Developer Knowledge Hub monogram: an interlocking D + K + H mark in a
 * blue-to-cyan gradient, produced as a polished illustrated asset (rich
 * gradients/shading that a hand-coded flat SVG could not reproduce) rather
 * than drawn as inline vector paths. Ships as a transparent PNG so it drops
 * cleanly onto any Shell surface (dark Sidebar, light auth screens, glass
 * cards) without a background box of its own.
 *
 * The same source art, composited onto a dark rounded-square tile, is the
 * favicon/app-icon asset at apps/web/public/favicon-32.png and
 * apps/web/public/favicon-512.png.
 */
export function DkhMark({ className }: DkhMarkProps) {
  return (
    <img
      src="/dkh-monogram.png"
      alt=""
      className={cn('block object-contain', className)}
      width={512}
      height={512}
    />
  );
}
