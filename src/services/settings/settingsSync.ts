import { onValue, ref, set } from 'firebase/database';

import { getFirebaseDatabase } from '@/lib/firebase';
import { useSettingsStore } from '@/stores/settingsStore';
import { useThemeStore } from '@/stores/themeStore';

const WRITE_DELAY_MS = 800;

/** What is stored at /userSettings/{uid}: the preferences plus the look of the app. */
function payload() {
  const { settings } = useSettingsStore.getState();
  const { mode, accent } = useThemeStore.getState();
  return { ...settings, themeMode: mode, themeAccent: accent, updatedAt: Date.now() };
}

/**
 * Keeps this user's settings in step across their devices. The last device to change a setting
 * wins. Settings applied from the server never count as local edits, so they aren't echoed back.
 */
export function startSettingsSync(uid: string): () => void {
  const target = ref(getFirebaseDatabase(), `userSettings/${uid}`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = true;

  const pushLocal = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Firebase refuses `undefined`; the JSON round trip drops it.
      void set(target, JSON.parse(JSON.stringify(payload()))).catch(() => undefined);
    }, WRITE_DELAY_MS);
  };

  const offRemote = onValue(
    target,
    (snapshot) => {
      const remote: unknown = snapshot.val();
      if (remote && typeof remote === 'object') {
        useSettingsStore.getState().applyRemote(remote);
        const { themeMode, themeAccent } = remote as { themeMode?: unknown; themeAccent?: unknown };
        const theme = useThemeStore.getState();
        if (themeMode === 'system' || themeMode === 'light' || themeMode === 'dark') {
          if (theme.mode !== themeMode) theme.setMode(themeMode);
        }
        if (typeof themeAccent === 'string' && theme.accent !== themeAccent) {
          theme.setAccent(themeAccent as never);
        }
      } else if (first && useSettingsStore.getState().revision > 0) {
        // Nothing stored yet but this device already has choices: keep them.
        pushLocal();
      }
      first = false;
    },
    () => undefined,
  );

  // Local edits (settings or theme) are written after a short pause, so dragging through a few
  // choices produces one write.
  let revision = useSettingsStore.getState().revision;
  const offSettings = useSettingsStore.subscribe((state) => {
    if (state.revision !== revision) {
      revision = state.revision;
      pushLocal();
    }
  });
  let themeKey = `${useThemeStore.getState().mode}/${useThemeStore.getState().accent}`;
  const offTheme = useThemeStore.subscribe((state) => {
    const key = `${state.mode}/${state.accent}`;
    if (key !== themeKey) {
      themeKey = key;
      pushLocal();
    }
  });

  return () => {
    clearTimeout(timer);
    offRemote();
    offSettings();
    offTheme();
  };
}
