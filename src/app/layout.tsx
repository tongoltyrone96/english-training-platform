import type { Metadata } from "next";
import "./globals.css";
import "./training/training.css";
import "./calendar.css";
import "./admin/admin-ui.css";
import "./presentation-ui.css";

export const metadata: Metadata = { title: "English Training", description: "팀 영어 말하기 훈련 플랫폼" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
