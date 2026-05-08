"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EDGE_THRESHOLD = 30;  // px from left edge to start swipe
const DISTANCE_THRESHOLD = 60; // px rightward to trigger

export function useSwipeBack(destination?: string) {
  const router = useRouter();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_THRESHOLD) {
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dx >= DISTANCE_THRESHOLD && dy < dx) {
        destination ? router.push(destination) : router.back();
      }
    }

    function onTouchCancel() { tracking = false; }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [router, destination]);
}
