import type { ElementType, ReactNode } from "react";
import { createElement, Fragment } from "react";
import { useT } from "./I18nContext";

export interface TranslateProps {
  k: string;
  fallback?: string;
  params?: Record<string, unknown>;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

export function Translate({
  k,
  fallback,
  params,
  as,
  className,
  children,
}: TranslateProps) {
  const t = useT();
  const translated = t(k, params);

  const isMissing = !translated || translated === k;
  const content = isMissing && fallback !== undefined ? fallback : isMissing && children !== undefined ? children : translated;

  if (as) {
    return createElement(as, { className }, content);
  }

  if (className) {
    return createElement("span", { className }, content);
  }

  return createElement(Fragment, null, content);
}

export { Translate as T };
