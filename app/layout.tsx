import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PosteLiens',
  description: 'Analyse locale de liens PDF et Excel'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
