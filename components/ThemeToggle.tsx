import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className={buttonVariants({ variant: "ghost", size: "icon" })}
        aria-label="切换主题"
      >
        <span className="h-5 w-5 block" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === "system") setTheme("dark");
    else if (theme === "dark") setTheme("light");
    else setTheme("system");
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "text-muted-foreground"
      )}
      aria-label="切换主题"
      title="切换主题"
    >
      {theme === "system" ? (
        <Monitor className="h-5 w-5 transition-transform duration-300" />
      ) : resolvedTheme === "dark" ? (
        <Moon className="h-5 w-5 transition-transform duration-300" />
      ) : (
        <Sun className="h-5 w-5 transition-transform duration-300" />
      )}
    </button>
  );
}
