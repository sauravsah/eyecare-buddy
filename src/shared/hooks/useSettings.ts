import { useCallback, useEffect, useState } from "react";
import type { UserSettings } from "../../domain/types";
import { DEFAULT_STORAGE } from "../storage/defaults";
import { getStorage, setStorage } from "../storage/storage";

interface UseSettingsResult {
  settings: UserSettings;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<UserSettings>(
    DEFAULT_STORAGE.settings
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings(): Promise<void> {
      setIsLoading(true);
      try {
        const storedSettings = {
          ...DEFAULT_STORAGE.settings,
          ...(await getStorage("settings"))
        };
        if (isMounted) {
          setSettings(storedSettings);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError("Your local settings could not be loaded.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>): Promise<void> => {
      const current = {
        ...DEFAULT_STORAGE.settings,
        ...(await getStorage("settings"))
      };
      const next = { ...current, ...patch };
      try {
        await setStorage("settings", next);
        setSettings(next);
        setError(null);
      } catch (cause) {
        setError("Your local settings could not be saved.");
        throw cause;
      }
    },
    []
  );

  return { settings, isLoading, error, reload, updateSettings };
}
