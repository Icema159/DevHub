import {
  Bell,
  CircleAlert,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

import { ChatMessage, CitationSource, DocumentRow, SidebarNavItem } from '../components/composed';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  ListSkeleton,
  Modal,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from '../components/ui';
import { usePageTitle } from '../lib/page-title';

const sectionClassName = 'grid gap-5';

function SectionHeading({ children, description }: { children: string; description: string }) {
  return (
    <div>
      <h2 className="type-heading-2 font-semibold text-foreground">{children}</h2>
      <p className="mt-1 type-body text-muted">{description}</p>
    </div>
  );
}

export function UiKitPage() {
  usePageTitle('UI Kit');

  const [searchValue, setSearchValue] = useState('authentication');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<'default' | 'destructive'>('default');
  const [currentPage, setCurrentPage] = useState(2);
  const { showToast } = useToast();

  return (
    <div className="pb-16">
      <header>
        <p className="type-small font-semibold tracking-wide text-primary uppercase">
          Development route
        </p>
        <h1 className="mt-2 type-heading-1 font-semibold text-foreground sm:type-display">
          Design System
        </h1>
        <p className="mt-2 max-w-3xl type-body-large text-muted">
          Reusable Tailwind foundations for the Liquid Glass workspace. All content below is static
          component preview data.
        </p>
      </header>

      <div className="mt-10 grid gap-10 xl:grid-cols-2">
        <section className={sectionClassName}>
          <SectionHeading description="Inter type scale with semantic hierarchy.">
            Typography
          </SectionHeading>
          <Card className="grid gap-4" variant="solid">
            <p className="type-display font-semibold">Display — 32 / 40</p>
            <p className="type-heading-1 font-semibold">Heading one — 24 / 32</p>
            <p className="type-heading-2 font-semibold">Heading two — 20 / 28</p>
            <p className="type-heading-3 font-semibold">Heading three — 16 / 24</p>
            <p className="type-body-large">Body large — 16 / 24</p>
            <p className="type-body">Body — 14 / 20</p>
            <p className="type-small">Small — 12 / 16</p>
            <p className="type-caption">Caption — 11 / 14</p>
          </Card>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Semantic colors shared across product components.">
            Color tokens
          </SectionHeading>
          <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4" variant="solid">
            {[
              ['Primary', 'bg-primary'],
              ['Success', 'bg-success'],
              ['Warning', 'bg-warning'],
              ['Danger', 'bg-danger'],
              ['Info', 'bg-info'],
              ['Surface', 'bg-surface border'],
              ['Background', 'bg-background border'],
              ['Muted', 'bg-muted'],
            ].map(([label, className]) => (
              <div key={label}>
                <div className={`h-14 rounded-control ${className}`} aria-hidden="true" />
                <p className="mt-2 type-small font-medium text-secondary">{label}</p>
              </div>
            ))}
          </Card>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Four variants, three sizes, disabled/loading behavior, and a shared keyboard focus language.">
            Buttons
          </SectionHeading>
          <Card className="flex flex-wrap items-center gap-3" variant="glass">
            <Button size="small">Small</Button>
            <Button>Primary</Button>
            <Button size="large">Large</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
            <Button isLoading loadingLabel="Saving">
              Save changes
            </Button>
            <IconButton label="Notifications">
              <Bell className="size-5" aria-hidden="true" />
            </IconButton>
            <IconButton label="Primary icon action" variant="primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </IconButton>
            <IconButton label="Destructive icon action" variant="destructive">
              <CircleAlert className="size-5" aria-hidden="true" />
            </IconButton>
          </Card>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Labels, helper copy, errors, icons, and native select behavior.">
            Form controls
          </SectionHeading>
          <Card className="grid gap-5 sm:grid-cols-2" variant="solid">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              helperText="Used for account access."
              leadingIcon={<Mail className="size-4" />}
              required
            />
            <Input
              label="Document label"
              defaultValue="Architecture"
              error="Use at least 3 characters."
            />
            <SearchInput
              label="Search preview"
              placeholder="Search documents"
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <Select
              label="Document status"
              defaultValue="ready"
              options={[
                { label: 'Ready', value: 'ready' },
                { label: 'Processing', value: 'processing' },
                { label: 'Failed', value: 'failed' },
              ]}
            />
            <Input label="Disabled input" defaultValue="Unavailable" disabled />
            <SearchInput
              label="Disabled search"
              value="Search unavailable"
              onValueChange={() => undefined}
              disabled
            />
            <SearchInput
              label="Search with error"
              value="Unsupported query"
              onValueChange={() => undefined}
              error="Check the search query and try again."
            />
            <Select
              label="Disabled select"
              defaultValue="ready"
              options={[{ label: 'Ready', value: 'ready' }]}
              disabled
            />
            <Select
              label="Select with error"
              defaultValue=""
              placeholder="Choose a status"
              options={[{ label: 'Ready', value: 'ready' }]}
              error="Choose a document status."
            />
          </Card>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Only user-facing document states appear in the interface.">
            Status badges
          </SectionHeading>
          <Card className="flex flex-wrap items-start gap-3" variant="glass">
            <StatusBadge status="ready" />
            <StatusBadge status="processing" />
            <StatusBadge status="failed" />
          </Card>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Each material has one role; blur is never the hierarchy by itself.">
            Material hierarchy
          </SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="material-navigation elevation-1 rounded-card border p-5">
              <h3 className="type-heading-3 font-semibold">Navigation Glass</h3>
              <p className="mt-2 type-body text-muted">Signature material for global navigation.</p>
            </div>
            <Card variant="glass">
              <h3 className="type-heading-3 font-semibold">Workspace Glass</h3>
              <p className="mt-2 type-body text-muted">For lightweight workspace chrome.</p>
            </Card>
            <Card variant="solid">
              <h3 className="type-heading-3 font-semibold">Solid Knowledge Surface</h3>
              <p className="mt-2 type-body text-muted">For dense, highly readable content.</p>
            </Card>
            <Card variant="elevated">
              <h3 className="type-heading-3 font-semibold">Elevated Interaction Glass</h3>
              <p className="mt-2 type-body text-muted">For dialogs and floating controls.</p>
            </Card>
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Three deliberate levels replace accumulated colored shadow variants.">
            Elevation
          </SectionHeading>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="material-knowledge elevation-0 rounded-card border p-4">
              <p className="type-small font-semibold text-secondary">0 · Content</p>
            </div>
            <div className="material-workspace elevation-1 rounded-card border p-4">
              <p className="type-small font-semibold text-secondary">1 · Workspace</p>
            </div>
            <div className="material-interaction elevation-2 rounded-card border p-4">
              <p className="type-small font-semibold text-secondary">2 · Interaction</p>
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="A selected item forms a thin layer above its base surface and remains identifiable by more than color.">
            Selected surface
          </SectionHeading>
          <Card variant="glass">
            <Button
              className="material-selected w-full justify-start border-primary/15 text-primary"
              variant="ghost"
              onClick={() =>
                showToast({
                  title: 'Selected surface',
                  message: 'Keyboard focus and selected-state contrast remain distinct.',
                  variant: 'info',
                })
              }
            >
              Selected workspace item
            </Button>
          </Card>
        </section>

        <section className={`${sectionClassName} xl:col-span-2`}>
          <SectionHeading description="Short, calm feedback with icon and text—not color alone.">
            Alerts
          </SectionHeading>
          <div className="grid gap-3 lg:grid-cols-2">
            <Alert title="Information">Your document will be processed in the background.</Alert>
            <Alert title="Ready" variant="success">
              The document is available for grounded search.
            </Alert>
            <Alert title="Still processing" variant="warning">
              This may take a few moments for larger documents.
            </Alert>
            <Alert title="Could not process" variant="error">
              Use a safe, user-facing message without infrastructure details.
            </Alert>
          </div>
        </section>

        <section className={`${sectionClassName} xl:col-span-2`}>
          <SectionHeading description="Rows adapt to narrow widths without becoming a compressed table.">
            Document rows
          </SectionHeading>
          <Card className="divide-y divide-border overflow-hidden p-0" variant="solid">
            <DocumentRow
              filename="Authentication Guide.pdf"
              status="ready"
              timestamp="2 hours ago"
            />
            <DocumentRow
              filename="Distributed Systems Architecture.pdf"
              status="processing"
              timestamp="Yesterday"
            />
            <DocumentRow filename="Legacy API Notes.pdf" status="failed" timestamp="3 days ago" />
          </Card>
        </section>

        <section className={`${sectionClassName} xl:col-span-2`}>
          <SectionHeading description="Assistant copy remains grounded and citations lead to document details.">
            Chat and citations
          </SectionHeading>
          <div className="grid gap-4">
            <ChatMessage role="user">How does JWT authentication work?</ChatMessage>
            <ChatMessage
              role="assistant"
              citations={[
                {
                  documentId: 'document-auth',
                  filename: 'Authentication Guide.pdf',
                  page: 12,
                  sourceLabel: '[S1]',
                },
                {
                  documentId: 'document-security',
                  filename: 'Security Practices.pdf',
                  page: 5,
                  sourceLabel: '[S2]',
                },
              ]}
              onCopy={() =>
                showToast({
                  title: 'Answer copied',
                  message: 'The preview answer was copied safely.',
                  variant: 'success',
                })
              }
            >
              JWT authentication uses a signed token that the server verifies on subsequent
              requests. Retrieved document chunks remain the factual source for the answer.
            </ChatMessage>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <CitationSource
                to="/documents/document-architecture"
                filename="System Architecture.pdf"
                page={8}
                sourceLabel="[S3]"
              />
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Modal, toast, and feedback foundations are previewed locally.">
            Overlays and notifications
          </SectionHeading>
          <Card className="flex flex-wrap gap-3" variant="glass">
            <Button
              onClick={() => {
                setModalVariant('default');
                setModalOpen(true);
              }}
            >
              Open modal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setModalVariant('destructive');
                setModalOpen(true);
              }}
            >
              Open destructive modal
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                showToast({
                  title: 'Preview saved',
                  message: 'This is local Design System feedback only.',
                  variant: 'success',
                })
              }
            >
              Show success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                showToast({
                  title: 'Preview unavailable',
                  message: 'A safe user-facing error belongs here.',
                  variant: 'error',
                })
              }
            >
              Show error toast
            </Button>
          </Card>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Reduced-motion preferences disable skeleton animation.">
            Loading states
          </SectionHeading>
          <Card className="grid gap-4" variant="solid">
            <Skeleton className="max-w-xs" />
            <Skeleton className="max-w-md" />
            <Skeleton variant="card" />
            <ListSkeleton count={2} />
          </Card>
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Optional actions remain semantic React elements.">
            Empty state
          </SectionHeading>
          <EmptyState
            icon={<FilePlus2 className="size-6" aria-hidden="true" />}
            title="No preview documents"
            description="Upload a PDF to add it to your private knowledge workspace."
            primaryAction={<Button>Add a document</Button>}
            secondaryAction={<Button variant="ghost">Learn about processing</Button>}
          />
        </section>

        <section className={sectionClassName}>
          <SectionHeading description="Boundaries are disabled and the page count stays compact.">
            Pagination
          </SectionHeading>
          <Card className="grid gap-5" variant="glass">
            <Pagination currentPage={1} totalPages={6} onPageChange={() => undefined} />
            <Pagination currentPage={currentPage} totalPages={6} onPageChange={setCurrentPage} />
            <Pagination currentPage={6} totalPages={6} onPageChange={() => undefined} />
          </Card>
        </section>

        <section className={`${sectionClassName} xl:col-span-2`}>
          <SectionHeading description="The product navigation has only currently approved destinations.">
            Sidebar navigation
          </SectionHeading>
          <Card className="max-w-sm" variant="glass">
            <nav className="grid gap-2" aria-label="Sidebar component preview">
              <SidebarNavItem active icon={LayoutDashboard} label="Dashboard" to="/dashboard" />
              <SidebarNavItem icon={FileText} label="Documents" to="/documents" />
              <SidebarNavItem icon={MessagesSquare} label="Chat" to="/chat" />
            </nav>
          </Card>
        </section>
      </div>

      <Modal
        open={modalOpen}
        title={
          modalVariant === 'destructive'
            ? 'Destructive confirmation example'
            : 'Accessible modal foundation'
        }
        description={
          modalVariant === 'destructive'
            ? 'This preview demonstrates the destructive visual state without changing product data.'
            : 'Native dialog behavior provides a reliable accessibility baseline.'
        }
        confirmLabel={
          modalVariant === 'destructive' ? 'Confirm destructive action' : 'Confirm example'
        }
        onConfirm={() => {
          setModalOpen(false);
          showToast({
            title:
              modalVariant === 'destructive'
                ? 'Destructive example confirmed'
                : 'Example confirmed',
            message: 'No product data was changed.',
            variant: 'info',
          });
        }}
        onOpenChange={setModalOpen}
        variant={modalVariant}
      >
        Focus moves into the dialog, Escape closes it, and focus returns to the trigger.
      </Modal>
    </div>
  );
}
