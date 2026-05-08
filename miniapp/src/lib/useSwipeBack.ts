"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EDGE_THRESHOLD = 30;
const DISTANCE_THRESHOLD = 60;
const SLIDE_DURATION = 220; // ms

export function useSwipeBack(destination?: string) {
  const router = useRouter();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let animating = false;

    function target(): HTMLElement | null {
      return document.querySelector("main");
    }

    function resetTarget(el: HTMLElement) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.willChange = "";
    }

    function onTouchStart(e: TouchEvent) {
      if (animating) return;
      const touch = e.touches[0];
      if (touch.clientX > EDGE_THRESHOLD) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      const el = target();
      if (el) { el.style.transition = "none"; el.style.willChange = "transform"; }
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      // Cancel if gesture turns vertical early
      if (dy > dx && dx < 12) { tracking = false; const el = target(); if (el) resetTarget(el); return; }
      const progress = Math.max(0, dx);
      const el = target();
      if (el) el.style.transform = `translateX(${progress}px)`;
    }

    function commitSlide(el: HTMLElement | null, go: () => void) {
      animating = true;
      if (!el) { go(); animating = false; return; }
      el.style.transition = `transform ${SLIDE_DURATION}ms cubic-bezier(0.32, 0, 0.67, 0)`;
      el.style.transform = `translateX(100%)`;
      el.addEventListener("transitionend", () => {
        animating = false;
        resetTarget(el);
        go();
      }, { once: true });
    }

    function snapBack(el: HTMLElement | null) {
      if (!el) return;
      el.style.transition = `transform 200ms cubic-bezier(0.32, 0, 1, 1)`;
      el.style.transform = "translateX(0)";
      el.addEventListener("transitionend", () => resetTarget(el), { once: true });
    }

    function onTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      const el = target();
      if (dx >= DISTANCE_THRESHOLD && dy < dx) {
        commitSlide(el, () => destination ? router.push(destination) : router.back());
      } else {
        snapBack(el);
      }
    }

    function onTouchCancel() {
      if (!tracking) return;
      tracking = false;
      snapBack(target());
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [router, destination]);
}
