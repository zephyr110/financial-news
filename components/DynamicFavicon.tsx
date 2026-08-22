import { useTheme } from "next-themes";
import { useEffect } from "react";

const ICONS = {
  light: "/favicon-light.png",
  dark: "/favicon-dark.png",
} as const;

export default function DynamicFavicon() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const href = resolvedTheme === "dark" ? ICONS.dark : ICONS.light;
    document.querySelectorAll<HTMLLinkElement>("link[data-app-icon]").forEach((link) => {
      link.href = href;
    });
  }, [resolvedTheme]);

  return null;
}
