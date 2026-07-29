const STORAGE_KEY = "personalhealth.activeUsername";
const DEFAULT_USERNAME = "campbell.lowe";

export function normalizeUsername(value) {
  const trimmed = String(value || "").trim();
  return trimmed || DEFAULT_USERNAME;
}

export function getActiveUsername() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return normalizeUsername(stored);
  } catch {
    return DEFAULT_USERNAME;
  }
}

export function setActiveUsername(value) {
  const normalized = normalizeUsername(value);

  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Ignore storage errors and still return normalized value.
  }

  return normalized;
}

export { DEFAULT_USERNAME };
