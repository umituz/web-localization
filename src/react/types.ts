/**
 * Translation function contract.
 *
 * `params` feeds `{{placeholder}}` interpolation. The signature is
 * deliberately compatible with i18next's `t`, so apps bridge their
 * own runtime directly: `<I18nProvider t={i18n.t}>`.
 */

export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;
