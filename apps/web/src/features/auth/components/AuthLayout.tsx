import { BookOpenCheck, Search, Sparkles } from 'lucide-react';
import { Outlet } from 'react-router';

import { AmbientLightLayer } from '../../../components/layout/AmbientLightLayer';
import { Brand } from '../../../components/layout';
import { DkhMark } from '../../../components/layout/DkhMark';

const productBenefits = [
  { icon: BookOpenCheck, text: 'Keep technical knowledge in one private workspace.' },
  { icon: Search, text: 'Search documents after secure background processing.' },
  { icon: Sparkles, text: 'Get grounded answers from your own sources.' },
] as const;

export function AuthLayout() {
  return (
    <div className="app-canvas overview-v4-identity auth-v4-identity relative isolate min-h-dvh overflow-x-hidden">
      <a
        href="#auth-content"
        className="focus-material fixed top-3 left-3 z-50 -translate-y-20 rounded-control bg-primary px-4 py-2 type-body font-semibold text-on-primary transition focus:translate-y-0"
      >
        Skip to authentication form
      </a>

      <AmbientLightLayer />

      <header className="relative z-10 mx-auto flex w-full max-w-[90rem] px-5 pt-6 sm:px-8 sm:pt-8">
        <Brand />
      </header>

      <main
        id="auth-content"
        className="relative z-10 mx-auto grid min-h-[calc(100dvh-5.5rem)] w-full max-w-[90rem] items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,30rem)] lg:gap-16 lg:py-12 xl:gap-24"
      >
        <section className="hidden max-w-xl lg:block" aria-labelledby="auth-product-heading">
          <DkhMark className="size-14" />
          <p className="mt-6 type-small font-semibold tracking-wide text-primary uppercase">
            Your private developer workspace
          </p>
          <h2
            id="auth-product-heading"
            className="mt-4 text-[2.5rem] leading-[1.15] font-semibold tracking-tight text-foreground xl:text-[3rem]"
          >
            Turn technical documents into useful, searchable knowledge.
          </h2>
          <p className="mt-5 max-w-lg type-body-large text-muted">
            Upload PDFs, keep your sources organized, and ask questions grounded in the documents
            you trust.
          </p>
          <ul className="mt-8 grid gap-4">
            {productBenefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 type-body text-secondary">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-border-strong bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto w-full max-w-[30rem]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
