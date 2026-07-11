import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "KizamiTask",
  description: "A simple hierarchical todo MVP.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Extend under the home-indicator area so safe-area insets apply (the tab
  // bar already pads with env(safe-area-inset-bottom)).
  viewportFit: "cover",
  // Android Chrome: shrink the layout viewport when the keyboard opens so
  // fixed bottom sheets sit above it natively. iOS ignores this and is handled
  // by the visual-viewport pinning in KeyboardInsetManager.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
