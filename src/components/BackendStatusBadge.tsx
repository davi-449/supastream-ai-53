import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, OctagonAlert, WifiOff } from "lucide-react";

export type BackendStatus = "ok" | "warn" | "error";

interface BackendStatusBadgeProps {
  healthUrl?: string;
  intervalMs?: number;
  className?: string;
}

export default function BackendStatusBadge({ healthUrl = "https://emfddmyurnlsvpvlplzj.supabase.co/functions/v1/gemini", intervalMs = 15000, className }: BackendStatusBadgeProps) {
  const [status, setStatus] = useState<BackendStatus>("warn");
  const timer = useRef<number | null>(null);

  const runCheck = async () => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(healthUrl, { signal: controller.signal, cache: "no-store" });
      clearTimeout(id);
      if (res.ok) {
        setStatus("ok");
      } else if (res.status >= 500) {
        setStatus("error");
      } else {
        setStatus("warn");
      }
    } catch (e) {
      setStatus("error");
    }
  };

  useEffect(() => {
    runCheck();
    timer.current = window.setInterval(runCheck, intervalMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [healthUrl, intervalMs]);

  const ui = useMemo(() => {
    if (status === "ok") return { label: "Funcionando", className: "badge-success", Icon: CheckCircle2 };
    if (status === "warn") return { label: "Atenção", className: "badge-warning", Icon: AlertTriangle };
    return { label: "Erro", className: "badge-error", Icon: OctagonAlert };
  }, [status]);

  const { Icon } = ui;

  return (
    <Badge className={`${ui.className} ${className || ''}`} role="status" aria-live="polite" aria-label={`Status do backend: ${ui.label}`}>
      <Icon className="h-3 w-3 mr-1" />
      {ui.label}
    </Badge>
  );
}
