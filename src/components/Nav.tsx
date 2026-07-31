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
  const isLanding = pathname === '/'

  return (
    <nav className={styles.nav}>
      <Link href={isLanding ? '/' : '/manuscript'} className={styles.wordmark}>
        Continuum<span>.</span>
      </Link>
      <div className={styles.navRightGroup}>
        {isLanding ? (
          <Link href="/manuscript" className={styles.ctaBtn}>
            <span>Open workspace</span>
            <span className={styles.ctaArrow}>→</span>
          </Link>
        ) : (
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
        )}
      </div>
    </nav>
  )
}
