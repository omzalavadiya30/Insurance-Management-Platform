"use client";

import Link from "next/link";
import { ComponentType, SVGProps } from "react";

export type SidebarNavItem = {
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  href?: string;
};

type SidebarNavProps = {
  items: SidebarNavItem[];
  selectedKey: string;
  onSelect?: (key: string) => void;
  className?: string;
};

export default function SidebarNav({ items, selectedKey, onSelect, className = "" }: SidebarNavProps) {
  return (
    <aside className={`hidden border-r border-[#d9e2ea] bg-white lg:block lg:sticky lg:top-0 lg:h-screen ${className}`}>
      <div className="flex h-full flex-col justify-between px-5 py-6">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-3xl bg-[#0f766e] text-white">
              IB
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#718096]">InsureBook</p>
              <p className="text-sm font-black text-[#102a43]">Dashboard</p>
            </div>
          </div>

          <nav className="space-y-2 text-sm font-semibold text-[#334155]">
            {items.map(({ key, label, Icon, href }) => {
              const isActive = selectedKey === key;
              const buttonClass = `flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition ${
                isActive
                  ? "border border-[#0f766e] bg-[#e8f8f6] text-[#0f766e]"
                  : "hover:bg-[#edf7f8]"
              }`;

              if (href && !onSelect) {
                return (
                  <Link key={key} href={href} className={buttonClass}>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect?.(key)}
                  className={buttonClass}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fbfd] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#718096]">Support</p>
          <p className="mt-3 text-sm font-black text-[#102a43]">
            Help desk and policy assistance available 24/7.
          </p>
        </div>
      </div>
    </aside>
  );
}
