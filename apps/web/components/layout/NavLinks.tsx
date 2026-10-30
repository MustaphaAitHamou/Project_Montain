'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, House, Map, Megaphone, UserRound } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: 'home' | 'map' | 'report' | 'alerts' | 'profile';
}

const ICONS = { home: House, map: Map, report: Megaphone, alerts: Bell, profile: UserRound };

function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav className="top-nav" aria-label={label}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label={label}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const current = isCurrent(pathname, item.href);
        if (item.icon === 'report') {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="report-tab"
              aria-current={current ? 'page' : undefined}
            >
              <span className="report-bubble">
                <Icon size={20} aria-hidden="true" />
              </span>
              {item.label}
            </Link>
          );
        }
        return (
          <Link key={item.href} href={item.href} aria-current={current ? 'page' : undefined}>
            <Icon size={22} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
