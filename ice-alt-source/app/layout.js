import "./globals.css";

export const metadata = {
  title: "Videography — Viscous Ring Study",
  description:
    "Cathy Zhang's videography portfolio presented as an experimental WebGL ring.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
