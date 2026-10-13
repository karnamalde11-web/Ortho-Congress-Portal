"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  ANALYTICS_IDLE_MS,
  campaignTag,
  sources,
  mediums,
  campaigns,
  deviceCategory,
  type ClientAnalyticsEvent,
} from "./analytics-policy";
export function useVisitorAnalytics(country: string) {
  const currentCountry = useRef(country);
  useEffect(() => {
    currentCountry.current = country;
  }, [country]);
  const pending = useRef<ClientAnalyticsEvent[]>([]);
  const seen = useRef(new Set<string>());
  const lastActivity = useRef(0);
  const lastSent = useRef(0);
  const started = useRef(false);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowed = () =>
    window.location.pathname === "/" &&
    navigator.doNotTrack !== "1" &&
    !(navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl;
  const flush = useCallback(async function flushQueue(): Promise<void> {
    if (!allowed() || !pending.current.length) return;
    if (running.current) {
      await running.current;
      if (pending.current.length) await flushQueue();
      return;
    }
    const events = pending.current.splice(0, 10);
    lastSent.current = Date.now();
    const parameters = new URLSearchParams(window.location.search);
    let referrerHost: string | undefined;
    try {
      if (document.referrer) referrerHost = new URL(document.referrer).hostname;
    } catch {}
    running.current = (async () => {
      try {
        await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            path: "/",
            country: currentCountry.current,
            device: deviceCategory(window.innerWidth),
            referrerHost,
            utmSource: campaignTag(parameters.get("utm_source"), sources),
            utmMedium: campaignTag(parameters.get("utm_medium"), mediums),
            utmCampaign: campaignTag(parameters.get("utm_campaign"), campaigns),
            events,
          }),
        });
      } catch {}
    })();
    await running.current;
    running.current = null;
    if (pending.current.length) await flushQueue();
  }, []);
  const track = useCallback(
    (event: ClientAnalyticsEvent) => {
      if (!allowed()) return;
      const now = Date.now();
      if (
        lastActivity.current &&
        now - lastActivity.current >= ANALYTICS_IDLE_MS
      ) {
        seen.current.clear();
        pending.current.push({ type: "OPENED" });
      }
      lastActivity.current = now;
      const key = JSON.stringify(event);
      if (!seen.current.has(key)) {
        seen.current.add(key);
        pending.current.push(event);
      } else if (
        now - lastSent.current >= 60000 &&
        !pending.current.some((item) => item.type === "ACTIVITY")
      )
        pending.current.push({ type: "ACTIVITY" });
      else return;
      if (!timer.current)
        timer.current = setTimeout(() => {
          timer.current = null;
          void flush();
        }, 250);
    },
    [flush],
  );
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      track({ type: "OPENED" });
      void flush();
    }
    const leave = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", leave);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      void flush();
    };
  }, [flush, track]);
  const beforeBooking = useCallback(async () => {
    await Promise.race([
      flush(),
      new Promise<void>((resolve) => setTimeout(resolve, 200)),
    ]);
  }, [flush]);
  return { track, beforeBooking };
}
