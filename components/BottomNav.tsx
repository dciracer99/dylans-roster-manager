"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import LogInteractionForm from "./LogInteractionForm";
import BottomSheet from "./BottomSheet";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogForm, setShowLogForm] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-rm-border bg-rm-bg/95 backdrop-blur-sm pb-safe">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {/* Pulse */}
          <button
            onClick={() => router.push("/")}
            className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/" ? "#e91e8c" : "#666666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span className={`text-[10px] ${pathname === "/" ? "text-rm-accent" : "text-rm-muted"}`}>Pulse</span>
          </button>

          {/* Roster */}
          <button
            onClick={() => router.push("/contacts")}
            className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname.startsWith("/contacts") ? "#e91e8c" : "#666666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className={`text-[10px] ${pathname.startsWith("/contacts") ? "text-rm-accent" : "text-rm-muted"}`}>Roster</span>
          </button>

          {/* Add */}
          <button
            onClick={() => setShowLogForm(true)}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-rm-accent -mt-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Stats */}
          <button
            onClick={() => router.push("/stats")}
            className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/stats" ? "#e91e8c" : "#666666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span className={`text-[10px] ${pathname === "/stats" ? "text-rm-accent" : "text-rm-muted"}`}>Stats</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push("/settings")}
            className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/settings" ? "#e91e8c" : "#666666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className={`text-[10px] ${pathname === "/settings" ? "text-rm-accent" : "text-rm-muted"}`}>Settings</span>
          </button>
        </div>
      </nav>

      <BottomSheet open={showLogForm} onClose={() => setShowLogForm(false)}>
        <LogInteractionForm onComplete={() => setShowLogForm(false)} />
      </BottomSheet>
    </>
  );
}
