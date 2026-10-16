import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface ActionIconProps { icon: Icon; className?: string }
export function ActionIcon({ icon: Glyph, className }: ActionIconProps) {
  return <span aria-hidden="true" className={cn('icon-circle bg-card text-foreground [&_svg]:size-5!', className)}><Glyph size={20} weight="light" /></span>;
}