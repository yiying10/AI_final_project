'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { useLayoutEffect, useState } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    
    document.body.classList.remove('vsc-initialized');
  }, []);

  if (!mounted) {
    return (
      <html lang="en">
        <body>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
