import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "next-themes";
import DynamicFavicon from "@/components/DynamicFavicon";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DynamicFavicon />
      <Component {...pageProps} />
      <SpeedInsights />
    </ThemeProvider>
  );
}
