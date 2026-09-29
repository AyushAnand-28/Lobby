import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";

import { GrainOverlay } from "@/components/motion/grain-overlay";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

import "./globals.css";

/**
 * One face for everything — display and body.
 *
 * The reference sets its entire interface in a single variable grotesque and
 * leans on weight and scale for hierarchy rather than mixing families. Host
 * Grotesk ships 300–800 in one variable file, so the whole range costs one
 * request.
 */
const hostGrotesk = Host_Grotesk({
  variable: "--font-host-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lobby: run your tournament from your phone",
    template: "%s · Lobby",
  },
  description:
    "Lobby is tournament software for local and college organizers. Badminton, " +
    "cricket, football, basketball, volleyball and more: register teams, generate " +
    "fixtures, enter scores at the venue, and share one public link.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      /**
       * `suppressHydrationWarning` because Lenis writes a class onto <html> as
       * soon as it initialises, which the server render cannot know about.
       */
      suppressHydrationWarning
      className={`${hostGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SmoothScroll>
          {children}
          <GrainOverlay />
        </SmoothScroll>
      </body>
    </html>
  );
}
