import type { Metadata } from "next";
import "./globals.css";
import "./training/training.css";
import "./calendar.css";
import "./admin/admin-ui.css";
import "./presentation-ui.css";

export const metadata: Metadata = { title: "English Training", description: "Team English speaking training platform" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
