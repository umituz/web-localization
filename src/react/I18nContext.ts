/**
 * React i18n injection seam.
 *
 * The package ships the runtime separately (`./setup`); UI layers that
 * must stay runtime-agnostic consume translations through this port:
 * the app wraps its tree once with its own `t` —
 * `createElement(I18nProvider, { t: i18n.t }, children)` — and
 * components read it via `useT()`. Without a provider, `useT()`
 * falls back to `defaultT`, which humanizes catalog keys into
 * readable English.
 */

import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";
import { defaultT } from "./defaultT";
import type { TranslateFn } from "./types";

export interface I18nProviderProps {
  /** App translation function (e.g. i18next's `t`). */
  t: TranslateFn;
  children: ReactNode;
}

const I18nContext = createContext<TranslateFn | null>(null);

export const I18nProvider = ({ t, children }: I18nProviderProps) =>
  createElement(I18nContext.Provider, { value: t }, children);

export const useT = (): TranslateFn => useContext(I18nContext) ?? defaultT;
