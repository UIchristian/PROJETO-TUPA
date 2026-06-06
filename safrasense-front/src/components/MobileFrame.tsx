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
    <div className="min-h-screen w-full flex justify-center bg-[#E2D9CD]">
      <div
        className={`relative w-full max-w-[390px] min-h-screen ${bg} flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.06)]`}
      >
        <div className="flex-1 flex flex-col">{children}</div>
        {withNav && <BottomNav />}
      </div>
    </div>
  );
}
