"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-1.5 text-sm ${
        active ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const assetsActive = pathname.startsWith("/links") || pathname.startsWith("/qr");
  const [assetsOpen, setAssetsOpen] = useState(assetsActive);

  return (
    <nav className="w-56 shrink-0 space-y-1 border-r border-border p-4">
      <NavLink href="/">Overview</NavLink>

      <div>
        <button
          type="button"
          onClick={() => setAssetsOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Assets
          <span>{assetsOpen ? "▾" : "▸"}</span>
        </button>
        {assetsOpen && (
          <div className="ml-3 space-y-1 border-l border-border pl-3">
            <NavLink href="/links">Links</NavLink>
            <NavLink href="/qr">QR Codes</NavLink>
          </div>
        )}
      </div>

      <NavLink href="/campaigns">Campaigns</NavLink>
      <NavLink href="/audit">Audit Log</NavLink>

      <span className="block cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-muted-foreground/50">
        Settings
      </span>
    </nav>
  );
}
