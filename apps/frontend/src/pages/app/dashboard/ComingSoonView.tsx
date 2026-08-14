/**
 * ComingSoonView — placeholder for unimplemented tool pages.
 */
import { ComingSoonCard } from '@/components/ui/feedback/ComingSoonCard';

export interface ComingSoonViewProps {
  title: string;
  description?: string;
}

export function ComingSoonView({ title, description }: ComingSoonViewProps) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto rounded-xl border bg-card p-6">
      <ComingSoonCard title={title} description={description} />
    </div>
  );
}
