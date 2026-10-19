import { Suspense, use, type ReactNode } from 'react';
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary.tsx';
import { RetryIcon } from '../../../shared/ui/icons.tsx';
import { resetTranslations, vizCoreLoader, type VizCore } from '../viz-data.ts';
import styles from './controls.module.css';
import { LoadingArcs } from './LoadingArcs.tsx';
import { createCachedLoader } from '../../../shared/lib/cached-loader.ts';
import { landLoadingArcs } from '../loading-handoff.ts';

interface VizDataBoundaryProps {
  readonly children: (core: VizCore) => ReactNode;
}

/**
 * The data, once the loading arcs in the air have landed (loading-handoff.ts): the first time
 * only, since a reader coming back to the explorer finds the data already here.
 */
const shownLoader = createCachedLoader(async (): Promise<VizCore> => {
  const core = await vizCoreLoader.load();
  await landLoadingArcs();
  return core;
});

/** Forgets the data this boundary showed, so the next mount loads it again (for tests). */
export function resetShownData(): void {
  shownLoader.reset();
}

function Loaded({ children }: VizDataBoundaryProps) {
  return children(use(shownLoader.load()));
}

/**
 * Loads the shared data with Suspense and shows a retryable error if it fails. The text of a
 * translation loads inside (see `Explorer`), and a failure there lands in this boundary too, so
 * retrying forgets both.
 */
export function VizDataBoundary({ children }: VizDataBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div role="alert" style={{ padding: 'var(--space-6)' }}>
          <p>{error.message}</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              vizCoreLoader.reset();
              shownLoader.reset();
              resetTranslations();
              reset();
            }}
          >
            <RetryIcon />
            Retry
          </button>
        </div>
      )}
    >
      <Suspense
        fallback={<LoadingArcs label="Loading 31,102 verses and 344,799 cross-references…" />}
      >
        <Loaded>{children}</Loaded>
      </Suspense>
    </ErrorBoundary>
  );
}
