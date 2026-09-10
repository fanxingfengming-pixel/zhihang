"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
        theme: "light";
        language: string;
      }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileCaptcha({
  siteKey,
  resetKey,
  onToken,
}: {
  siteKey: string;
  resetKey: number;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(Boolean(globalThis.window?.turnstile));

  useEffect(() => {
    const container = containerRef.current;
    const turnstile = window.turnstile;
    if (!scriptReady || !container || !turnstile) return;
    const widgetId = turnstile.render(container, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
      theme: "light",
      language: "zh-cn",
    });
    return () => {
      onToken("");
      turnstile.remove(widgetId);
    };
  }, [onToken, resetKey, scriptReady, siteKey]);

  return (
    <div className="turnstile-field">
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
      <small>完成安全验证后才能提交账号操作。</small>
    </div>
  );
}
