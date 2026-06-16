import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PosteLink Studio',
  description: 'Analyse de liens PDF et Excel'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
