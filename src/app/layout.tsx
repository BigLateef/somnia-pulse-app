import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Somnia Pulse — live on-chain intelligence',
  description: 'A real-time alpha terminal for Somnia.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
