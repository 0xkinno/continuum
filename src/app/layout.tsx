import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import Nav from '@/components/Nav'
import MotionLayout from '@/components/MotionLayout'
import { WorkspaceProvider } from '@/context/WorkspaceContext'
import '../styles/globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif-loaded',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Continuum — Creative Continuity Engine',
  description:
    'Upload your chapters, scripts, and character sheets. Continuum builds a structured model of established facts and flags contradictions in new drafts — instantly.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${GeistSans.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <WorkspaceProvider>
          <Nav />
          <MotionLayout>
            {children}
          </MotionLayout>
        </WorkspaceProvider>
      </body>
    </html>
  )
}
