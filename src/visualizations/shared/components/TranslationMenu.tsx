import { useId } from 'react';
import type { TranslationId } from '../../../core/datasets/ids.ts';
import {
  attributionOf,
  availableTranslationManifests,
  PERSONAL_USE_NOTICE,
} from '../../../translations/registry.ts';
import { useOwnTextIds } from '../../../translations/own-texts.ts';
import type { TranslationManifest } from '../../../translations/translation-manifest.ts';
import styles from './controls.module.css';
import { MenuButton } from './MenuButton.tsx';
import { OwnCopyDialog } from './OwnCopyDialog.tsx';

interface TranslationMenuProps {
  readonly current: TranslationManifest;
  readonly onChange: (id: TranslationId) => void;
  /** True while the chosen text is still downloading. */
  readonly pending?: boolean;
  /** Why the last choice did not take effect, if it did not. */
  readonly error?: string | null;
}

/**
 * Chooses the translation the verses are shown in. The button wears the abbreviation rather than
 * the word "Translation": it is shorter, it is what a reader looks for, and it says at a glance
 * which text is on screen. The licence of the chosen text is in the menu, where it is chosen.
 */
export function TranslationMenu({
  current,
  onChange,
  pending = false,
  error = null,
}: TranslationMenuProps) {
  // Both visualizations stay mounted, so each one's radios need a group name of their own.
  const group = useId();
  const ownIds = useOwnTextIds();
  const manifests = availableTranslationManifests(undefined, ownIds);
  return (
    <MenuButton label="Translation" value={current.abbreviation} busy={pending}>
      <div className={styles.field} role="radiogroup" aria-label="Translation">
        {manifests.map((translation) => (
          <label key={translation.id} className={styles.choice}>
            <input
              type="radio"
              name={group}
              value={translation.id}
              checked={translation.id === current.id}
              onChange={() => {
                onChange(translation.id);
              }}
            />
            {translation.name}
            <span className={styles.choiceAbbreviation}>{translation.abbreviation}</span>
          </label>
        ))}
      </div>
      {error !== null && (
        <p role="alert" className={styles.menuError}>
          {error} Check your connection and try again.
        </p>
      )}
      <p className={styles.hint}>
        {attributionOf(current)}
        {current.access === 'licensed' && ` ${PERSONAL_USE_NOTICE}`}
      </p>
      <OwnCopyDialog onAdded={onChange} />
    </MenuButton>
  );
}
