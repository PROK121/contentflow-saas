"use client";

import React from "react";
import { Bell, Settings } from "lucide-react";
import { BackgroundEffects } from "../BackgroundEffects";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";
import { CreateMenu } from "./CreateMenu";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <BackgroundEffects />

      {/* Left sidebar */}
      <Sidebar />

      {/* Right: topbar + scrollable content */}
      <div className="flex flex-1 min-w-0 flex-col relative z-0">

        {/* Topbar */}
        <header className="glass-topbar flex shrink-0 items-center gap-3 px-4 py-2.5 relative z-10">
          {/* Search */}
          <GlobalSearch />

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-1.5">
            <CreateMenu />

            <button
              type="button"
              aria-label="Уведомления"
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-foreground/60 hover:bg-black/[0.09] hover:text-foreground transition-colors"
            >
              <Bell className="h-[15px] w-[15px]" strokeWidth={1.8} />
              <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full bg-[#d85a30] ring-2 ring-background" />
            </button>

            <button
              type="button"
              aria-label="Настройки"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-foreground/60 hover:bg-black/[0.09] hover:text-foreground transition-colors"
            >
              <Settings className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto px-5 py-5 md:px-8 md:py-6">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
