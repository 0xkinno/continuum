'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Nav.module.css'

const NAV_LINKS = [
  { href: '/manuscript', label: 'Manuscript' },
  { href: '/canon',      label: 'Canon'      },
  { href: '/history',    label: 'History'    },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      <Link href="/manuscript" className={styles.wordmark}>
        Continuum<span>.</span>
      </Link>
      <ul className={styles.links}>
        <li>
          <Link href="/" className={styles.link}>
            ← Landing
          </Link>
        </li>
        {NAV_LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={`${styles.link} ${pathname === href ? styles.active : ''}`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
