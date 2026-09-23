/**
 * What every form action hands back. React resets an uncontrolled form once its
 * action settles, so a rejected submission returns what was typed in `values`
 * and the form puts it back — nobody retypes a note because of a typo.
 */
export type ActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
  values?: Record<string, string>;
};

/** Every submitted text field, for echoing back on failure. */
export function echo(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) values[key] = value;
  }
  return values;
}
