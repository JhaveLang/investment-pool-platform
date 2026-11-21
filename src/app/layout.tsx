import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { LocaleProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import "./globals.css";

// Inter carries data and body text; its tabular figures keep amounts aligned.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Plus Jakarta Sans sets headlines and large figures with tight tracking.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return {
    title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
    description: messages.app.description,
  };
}

export const viewport: Viewport = {
  themeColor: "#051424",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getI18n();

  return (
    <html lang={locale} className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
