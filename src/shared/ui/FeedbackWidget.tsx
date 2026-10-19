import { useRef, useState } from 'react';
import { FEEDBACK_ENDPOINT, FEEDBACK_REPO } from '../../site.ts';
import styles from './FeedbackWidget.module.css';

const KINDS = [
  { value: 'bug', label: 'Bug', label_github: 'bug' },
  { value: 'feature', label: 'New feature', label_github: 'feature' },
  { value: 'improvement', label: 'Improvement', label_github: 'enhancement' },
] as const;

type Kind = (typeof KINDS)[number]['value'];
type Status = 'idle' | 'sending' | 'sent' | 'failed';

/** GitHub's own new-issue page, filled in: the way out when the site cannot file the issue. */
function githubIssueUrl(kind: Kind, title: string, details: string): string {
  const label = KINDS.find((entry) => entry.value === kind)?.label_github ?? 'bug';
  const query = new URLSearchParams({ title, body: details, labels: label });
  return `https://github.com/${FEEDBACK_REPO}/issues/new?${query.toString()}`;
}

/**
 * The footer's feedback form. A report becomes an issue in the open-source repo (a bug, a new
 * feature or an improvement). If the site cannot file it, the reader gets a link to GitHub's
 * new-issue page with the report already written.
 */
export function FeedbackWidget() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<Kind>('bug');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const open = () => {
    setStatus('idle');
    dialogRef.current?.showModal();
  };
  const close = () => {
    dialogRef.current?.close();
  };

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (FEEDBACK_ENDPOINT === null) {
      // No server of its own: GitHub's new-issue page, with the report already written.
      window.open(githubIssueUrl(kind, title, details), '_blank', 'noopener');
      setTitle('');
      setDetails('');
      dialogRef.current?.close();
      return;
    }
    setStatus('sending');
    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          title,
          details,
          page: window.location.pathname + window.location.search,
          website: honeypot.current?.value ?? '',
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as { url?: string };
      setIssueUrl(result.url ?? null);
      setTitle('');
      setDetails('');
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={open} aria-label="Feedback">
        <span className={styles.label}>Feedback</span>
        {/* On a phone the word gives way to a speech bubble, so the footer stays on one line. */}
        <svg
          className={styles.mark}
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
        </svg>
      </button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="feedback-title">
        <form onSubmit={(event) => void submit(event)} className={styles.form}>
          <h2 id="feedback-title" className={styles.heading}>
            Feedback
          </h2>
          {status === 'sent' ? (
            <>
              <p>
                Thank you. Your report is now an issue
                {issueUrl ? (
                  <>
                    {' '}
                    <a href={issueUrl} target="_blank" rel="noreferrer">
                      on GitHub
                    </a>
                  </>
                ) : null}
                .
              </p>
              <button type="button" className={styles.primary} onClick={close}>
                Close
              </button>
            </>
          ) : (
            <>
              <fieldset className={styles.kinds}>
                <legend className={styles.legend}>Type</legend>
                {KINDS.map((entry) => (
                  <label key={entry.value} className={styles.kind}>
                    <input
                      type="radio"
                      name="kind"
                      value={entry.value}
                      checked={kind === entry.value}
                      onChange={() => {
                        setKind(entry.value);
                      }}
                    />
                    {entry.label}
                  </label>
                ))}
              </fieldset>
              <label className={styles.field}>
                Title
                <input
                  required
                  minLength={4}
                  maxLength={120}
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </label>
              <label className={styles.field}>
                Description
                <textarea
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                  value={details}
                  onChange={(event) => {
                    setDetails(event.target.value);
                  }}
                />
              </label>
              <input
                ref={honeypot}
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className={styles.trap}
              />
              {status === 'failed' && (
                <p role="alert" className={styles.error}>
                  The report did not go through.{' '}
                  <a href={githubIssueUrl(kind, title, details)} target="_blank" rel="noreferrer">
                    Open it on GitHub
                  </a>
                  .
                </p>
              )}
              <div className={styles.actions}>
                <button type="button" onClick={close}>
                  Cancel
                </button>
                <button type="submit" className={styles.primary} disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending' : 'Send'}
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
