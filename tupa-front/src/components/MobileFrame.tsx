import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

/**
 * Mobile-first frame: portrait, max 390px wide, with optional bottom nav.
 */
export function MobileFrame({
  children,
  withNav = false,
  bg = "bg-background",
}: {
  children: ReactNode;
  withNav?: boolean;
  bg?: string;
}) {
  return (
    <div className="min-h-screen w-full flex justify-center bg-[#E2D9CD] dark:bg-[#0f0d0a]">
      <div
        className={`relative w-full max-w-[390px] min-h-screen ${bg} bg-dynamic-mesh flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.12)]`}
      >
        <div className="flex-1 flex flex-col">{children}</div>
        {withNav && <BottomNav />}
      </div>
    </div>
  );
}
