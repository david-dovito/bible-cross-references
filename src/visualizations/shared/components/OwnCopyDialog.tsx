import { useRef, useState } from 'react';
import type { TranslationId } from '../../../core/datasets/ids.ts';
import {
  licensedTranslationManifests,
  PERSONAL_USE_NOTICE,
} from '../../../translations/registry.ts';
import { removeOwnText, saveOwnText, useOwnTextIds } from '../../../translations/own-texts.ts';
import styles from './OwnCopyDialog.module.css';

interface OwnCopyDialogProps {
  /** Called with a translation once its copy is in, so the reader lands on it. */
  readonly onAdded: (id: TranslationId) => void;
}

type Mode = 'public' | 'own';

/**
 * The choice between the public translations and one the reader owns. A copyrighted translation
 * (NASB, NKJV) is not on this site: the reader loads their own file, and it stays in their browser.
 */
export function OwnCopyDialog({ onAdded }: OwnCopyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const choices = licensedTranslationManifests();
  const owned = useOwnTextIds();
  const [mode, setMode] = useState<Mode>('public');
  const [target, setTarget] = useState<TranslationId>(choices[0]?.id ?? 'nasb');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<readonly string[]>([]);

  const close = () => {
    dialogRef.current?.close();
  };

  const add = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setProblem('Choose the text file first.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result = await saveOwnText(target, file);
      setWarnings(result.warnings);
      onAdded(target);
      if (result.warnings.length === 0) {
        close();
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          dialogRef.current?.showModal();
        }}
      >
        Use my own copy of another translation…
      </button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="own-copy-title">
        <div className={styles.body}>
          <h2 id="own-copy-title" className={styles.heading}>
            Your own copy
          </h2>
          <p>
            Some translations are under copyright, so this site does not hold them. If you own a
            copy, you can load it here. It is read in your browser and stays on this device. It is
            never uploaded, and no one else can see it. {PERSONAL_USE_NOTICE}
          </p>
          <fieldset className={styles.modes}>
            <legend className={styles.legend}>Which do you want?</legend>
            <label className={styles.mode}>
              <input
                type="radio"
                name="own-copy-mode"
                checked={mode === 'public'}
                onChange={() => {
                  setMode('public');
                }}
              />
              <span>
                <strong>Use the public translations</strong>
                BSB, KJV, ASV, WEB and MSB. There is nothing to add.
              </span>
            </label>
            <label className={styles.mode}>
              <input
                type="radio"
                name="own-copy-mode"
                checked={mode === 'own'}
                onChange={() => {
                  setMode('own');
                }}
              />
              <span>
                <strong>Add a translation I own</strong>
                For personal use, from a text file you already have.
              </span>
            </label>
          </fieldset>
          {mode === 'own' && (
            <div className={styles.add}>
              <label className={styles.field}>
                Translation
                <select
                  value={target}
                  onChange={(event) => {
                    setTarget(event.target.value as TranslationId);
                  }}
                >
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name} ({choice.abbreviation})
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Text file
                <input ref={fileRef} type="file" accept=".txt,text/plain" />
              </label>
              <p className={styles.hint}>
                One verse per line, like “John 3:16 For God so loved the world…”. The publisher’s
                notice shows with the text. You are responsible for having the right to use your
                copy.
              </p>
              {problem !== null && (
                <p role="alert" className={styles.problem}>
                  {problem}
                </p>
              )}
              {warnings.length > 0 && (
                <ul className={styles.warnings}>
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                onClick={() => void add()}
              >
                {busy ? 'Reading…' : 'Add it'}
              </button>
            </div>
          )}
          {owned.length > 0 && (
            <ul className={styles.owned}>
              {owned.map((id) => (
                <li key={id}>
                  {choices.find((choice) => choice.id === id)?.abbreviation ?? id} is on this device
                  <button
                    type="button"
                    onClick={() => {
                      void removeOwnText(id);
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.actions}>
            <button type="button" onClick={close}>
              Done
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
