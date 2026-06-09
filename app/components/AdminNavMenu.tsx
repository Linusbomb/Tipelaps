'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getAdminNavGroups,
  isAdminNavGroupActive,
  isAdminNavItemActive,
  type AdminNavGroup,
  type AdminNavItem,
} from '@/lib/adminNav'
import { filterAdminNavGroups } from '@/lib/adminNavModules'
import type { CompanyModuleId } from '@/lib/companyModules'
import { DEFAULT_START_PACKAGE_MODULES } from '@/lib/companyModules'

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 opacity-80 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function topLevelClassName(active: boolean, mobile: boolean, open = false): string {
  if (mobile) {
    return active
      ? 'flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold bg-[#2D5016] text-white shadow-sm'
      : 'flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold bg-[#EEF6E8] text-[#2D5016] border border-[#2D5016]/10 hover:bg-[#E2F0D9]'
  }
  return [
    'inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition-all duration-150',
    active
      ? 'bg-[#2D5016] text-white shadow-md ring-2 ring-[#2D5016]/15'
      : open
        ? 'bg-[#E2F0D9] text-[#2D5016] border border-[#2D5016]/25 shadow-sm'
        : 'bg-[#EEF6E8] text-[#2D5016] border border-[#2D5016]/10 hover:bg-[#E2F0D9] hover:border-[#2D5016]/20',
  ].join(' ')
}

function subLinkClassName(active: boolean, mobile: boolean): string {
  const base = mobile
    ? 'block rounded-lg px-3 py-2.5 text-sm'
    : 'block px-4 py-2.5 text-sm whitespace-nowrap transition-colors'
  return active
    ? `${base} font-semibold bg-[#E8F5DC] text-[#2D5016]`
    : `${base} text-[#2D5016]/90 hover:bg-[#F3FAEE]`
}

function NavDropdownPortal({
  open,
  anchorRef,
  children,
  onClose,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, minWidth: 200 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = () => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 6,
      left: rect.left,
      minWidth: Math.max(rect.width, 200),
    })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePosition()
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, anchorRef, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[9999] overflow-hidden rounded-xl border border-[#2D5016]/12 bg-white py-1.5 shadow-xl ring-1 ring-black/5"
      style={{
        top: position.top,
        left: position.left,
        minWidth: position.minWidth,
      }}
    >
      {children}
    </div>,
    document.body
  )
}

function NavGroupDropdown({
  group,
  pathname,
  mobile = false,
  onNavigate,
}: {
  group: Extract<AdminNavGroup, { items: AdminNavItem[] }>
  pathname: string
  mobile?: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const groupActive = isAdminNavGroupActive(pathname, group)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (mobile) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          className={topLevelClassName(groupActive, true, open)}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span>{group.label}</span>
          <ChevronDown open={open} />
        </button>
        {open ? (
          <div className="ml-2 space-y-1 border-l-2 border-[#2D5016]/15 pl-3">
            {group.items.map((item) => {
              const active = isAdminNavItemActive(pathname, item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={subLinkClassName(active, true)}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${topLevelClassName(groupActive, false, open)} shrink-0`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {group.label}
        <ChevronDown open={open} />
      </button>
      <NavDropdownPortal open={open} anchorRef={buttonRef} onClose={() => setOpen(false)}>
        {group.items.map((item) => {
          const active = isAdminNavItemActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className={subLinkClassName(active, false)}
              aria-current={active ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          )
        })}
      </NavDropdownPortal>
    </>
  )
}

function NavSingleLink({
  href,
  label,
  pathname,
  mobile = false,
  matchPrefixes,
  onNavigate,
}: {
  href: string
  label: string
  pathname: string
  mobile?: boolean
  matchPrefixes?: string[]
  onNavigate?: () => void
}) {
  const active = isAdminNavItemActive(pathname, { href, matchPrefixes })
  return (
    <Link
      href={href}
      className={`${topLevelClassName(active, mobile)} ${mobile ? '' : 'shrink-0'}`}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  )
}

export default function AdminNavMenu({
  pathname,
  mobile = false,
  onNavigate,
  enabledModules,
}: {
  pathname: string
  mobile?: boolean
  onNavigate?: () => void
  enabledModules?: CompanyModuleId[]
}) {
  const groups = filterAdminNavGroups(
    getAdminNavGroups(),
    enabledModules && enabledModules.length > 0 ? enabledModules : DEFAULT_START_PACKAGE_MODULES
  )

  if (mobile) {
    return (
      <div className="space-y-1.5">
        {groups.map((group) => {
          if ('href' in group) {
            return (
              <NavSingleLink
                key={group.id}
                href={group.href}
                label={group.label}
                pathname={pathname}
                mobile
                matchPrefixes={group.matchPrefixes}
                onNavigate={onNavigate}
              />
            )
          }
          return (
            <NavGroupDropdown
              key={group.id}
              group={group}
              pathname={pathname}
              mobile
              onNavigate={onNavigate}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 lg:gap-7"
      role="menubar"
      aria-label="Adminmeny"
    >
      {groups.map((group) => {
        if ('href' in group) {
          return (
            <NavSingleLink
              key={group.id}
              href={group.href}
              label={group.label}
              pathname={pathname}
              matchPrefixes={group.matchPrefixes}
              onNavigate={onNavigate}
            />
          )
        }
        return (
          <NavGroupDropdown
            key={group.id}
            group={group}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        )
      })}
    </div>
  )
}
