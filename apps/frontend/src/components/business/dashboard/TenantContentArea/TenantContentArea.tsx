import { ComingSoonCard } from '@/components/ui/feedback/ComingSoonCard';
import type { TenantContentAreaProps } from './TenantContentArea.types';

export function TenantContentArea({ title, description }: TenantContentAreaProps) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto rounded-xl border bg-card p-6">
      <ComingSoonCard title={title} description={description} />
    </div>
  );
}
