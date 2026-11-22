import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ChangeEvent, MouseEvent } from "react";
import {
  getLanguageFlag,
  getLanguageNativeName,
  getLanguageDisplayName,
} from "../core/constants/languages.constants";
import { useLanguagePreference } from "./useLanguagePreference";

export interface LanguageSwitcherProps {
  availableLocales?: readonly string[];
  variant?: "select" | "dropdown" | "segmented";
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  itemClassName?: string;
  ariaLabel?: string;
  onLanguageChange?: (locale: string) => void | Promise<void>;
  style?: CSSProperties;
}

const DEFAULT_LOCALES: readonly string[] = [
  "en-US",
  "tr-TR",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
];

const BASE_BUTTON_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  fontSize: "13px",
  fontWeight: 500,
  borderRadius: "6px",
  border: "1px solid rgba(128, 128, 128, 0.25)",
  background: "transparent",
  cursor: "pointer",
  color: "inherit",
  fontFamily: "inherit",
};

const BASE_MENU_STYLE: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: "4px",
  minWidth: "160px",
  maxHeight: "260px",
  overflowY: "auto",
  background: "#ffffff",
  border: "1px solid rgba(128, 128, 128, 0.2)",
  borderRadius: "8px",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
  padding: "4px",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const BASE_ITEM_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "6px 8px",
  fontSize: "13px",
  borderRadius: "4px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  color: "inherit",
  fontFamily: "inherit",
};

export function LanguageSwitcher({
  availableLocales = DEFAULT_LOCALES,
  variant = "dropdown",
  showFlag = true,
  showNativeName = true,
  className,
  triggerClassName,
  menuClassName,
  itemClassName,
  ariaLabel = "Select language",
  onLanguageChange,
  style,
}: LanguageSwitcherProps) {
  const { currentLocale, setLocale } = useLanguagePreference({
    supportedLocales: availableLocales,
  });

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    async (locale: string) => {
      await setLocale(locale);
      if (onLanguageChange) {
        await onLanguageChange(locale);
      }
      setIsOpen(false);
    },
    [onLanguageChange, setLocale],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: Event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const getLabel = (locale: string) => {
    return showNativeName
      ? getLanguageNativeName(locale)
      : getLanguageDisplayName(locale);
  };

  if (variant === "select") {
    return createElement(
      "select",
      {
        value: currentLocale,
        onChange: (e: ChangeEvent<HTMLSelectElement>) => {
          void handleSelect(e.target.value);
        },
        className: className ?? "uloc-select",
        "aria-label": ariaLabel,
        style: {
          ...BASE_BUTTON_STYLE,
          ...style,
        },
      },
      availableLocales.map((loc) =>
        createElement(
          "option",
          { key: loc, value: loc },
          showFlag ? `${getLanguageFlag(loc)} ${getLabel(loc)}` : getLabel(loc),
        ),
      ),
    );
  }

  if (variant === "segmented") {
    return createElement(
      "div",
      {
        role: "radiogroup",
        "aria-label": ariaLabel,
        className: className ?? "uloc-segmented",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: "2px",
          padding: "2px",
          borderRadius: "8px",
          border: "1px solid rgba(128, 128, 128, 0.2)",
          ...style,
        },
      },
      availableLocales.map((loc) => {
        const isActive = loc === currentLocale;
        return createElement(
          "button",
          {
            key: loc,
            type: "button",
            role: "radio",
            "aria-checked": isActive,
            onClick: () => {
              void handleSelect(loc);
            },
            className: itemClassName ?? `uloc-segment ${isActive ? "active" : ""}`,
            style: {
              border: "none",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "12px",
              fontWeight: isActive ? 600 : 400,
              background: isActive ? "rgba(128, 128, 128, 0.15)" : "transparent",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "inherit",
            },
          },
          showFlag ? createElement("span", { "aria-hidden": "true" }, getLanguageFlag(loc)) : null,
          createElement("span", null, getLabel(loc)),
        );
      }),
    );
  }

  return createElement(
    "div",
    {
      ref: containerRef,
      className: className ?? "uloc-switcher",
      style: {
        position: "relative",
        display: "inline-block",
        ...style,
      },
    },
    createElement(
      "button",
      {
        type: "button",
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
        "aria-label": ariaLabel,
        onClick: (e: MouseEvent) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        },
        className: triggerClassName ?? "uloc-trigger",
        style: BASE_BUTTON_STYLE,
      },
      showFlag
        ? createElement(
            "span",
            { "aria-hidden": "true" },
            getLanguageFlag(currentLocale),
          )
        : null,
      createElement("span", null, getLabel(currentLocale)),
      createElement(
        "svg",
        {
          width: "12",
          height: "12",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: {
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          },
        },
        createElement("polyline", { points: "6 9 12 15 18 9" }),
      ),
    ),
    isOpen
      ? createElement(
          "div",
          {
            role: "menu",
            "aria-label": ariaLabel,
            className: menuClassName ?? "uloc-menu",
            style: BASE_MENU_STYLE,
          },
          availableLocales.map((loc) => {
            const isSelected = loc === currentLocale;
            return createElement(
              "button",
              {
                key: loc,
                type: "button",
                role: "menuitem",
                "aria-current": isSelected,
                onClick: () => {
                  void handleSelect(loc);
                },
                className: itemClassName ?? `uloc-item ${isSelected ? "selected" : ""}`,
                style: {
                  ...BASE_ITEM_STYLE,
                  background: isSelected ? "rgba(128, 128, 128, 0.08)" : "transparent",
                  fontWeight: isSelected ? 600 : 400,
                },
              },
              createElement(
                "span",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  },
                },
                showFlag
                  ? createElement(
                      "span",
                      { "aria-hidden": "true" },
                      getLanguageFlag(loc),
                    )
                  : null,
                createElement("span", null, getLabel(loc)),
              ),
              isSelected
                ? createElement(
                    "svg",
                    {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: "2",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    },
                    createElement("polyline", { points: "20 6 9 17 4 12" }),
                  )
                : null,
            );
          }),
        )
      : null,
  );
}
