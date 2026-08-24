import { Card } from '../components/ui';
import { usePageTitle } from '../lib/page-title';

export interface PlaceholderPageProps {
  description: string;
  title: string;
}

export function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  usePageTitle(title);

  return (
    <div>
      <header>
        <p className="type-small font-semibold tracking-wide text-primary uppercase">
          Frontend foundation
        </p>
        <h1 className="mt-2 type-heading-1 font-semibold text-foreground sm:type-display">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl type-body-large text-muted">{description}</p>
      </header>
      <Card className="mt-8 max-w-2xl" variant="glass">
        <h2 className="type-heading-3 font-semibold text-foreground">Page shell is ready</h2>
        <p className="mt-2 type-body text-muted">
          Product data and interactions will be connected in a dedicated implementation phase.
        </p>
      </Card>
    </div>
  );
}
