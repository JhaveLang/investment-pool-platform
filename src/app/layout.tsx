import type { Metadata, Viewport } from "next";
import { Afacad_Flux, Instrument_Sans, Source_Code_Pro } from "next/font/google";
import { LocaleProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import "./globals.css";

// Instrument Sans carries data and body text; its tabular figures keep amounts aligned.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

// Afacad Flux sets headlines and large figures; its digits are all the same width.
const afacadFlux = Afacad_Flux({
  variable: "--font-afacad",
  subsets: ["latin"],
});

// Source Code Pro sets notice dates and references, with a zero that can't be mistaken for an O. Variable, so
// references inside semibold labels get a real semibold instead of a smeared synthetic one.
const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return {
    title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
    description: messages.app.description,
  };
}

export const viewport: Viewport = {
  themeColor: "#fff7fb",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getI18n();

  return (
    <html lang={locale} className={`${instrumentSans.variable} ${afacadFlux.variable} ${sourceCodePro.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
