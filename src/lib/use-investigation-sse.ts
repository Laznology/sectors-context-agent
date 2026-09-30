// src/lib/use-investigation-sse.ts

import { useEffect, useState } from "react";

export type PipelineStatus =
  | "pending"
  | "collecting_baseline"
  | "calculating_signals"
  | "planning"
  | "investigating"
  | "synthesizing"
  | "completed"
  | "failed";

export interface ToolCallInfo {
  toolName: string;
  reason: string;
}

export interface InvestigationEventData {
  status: PipelineStatus;
  currentTool?: ToolCallInfo;
  error?: string;
  message?: string;
}

export function useInvestigationSSE(investigationId: string) {
  const [eventData, setEventData] = useState<InvestigationEventData>({
    status: "pending",
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!investigationId) return;

    const eventSource = new EventSource(`/api/investigations/${investigationId}/events`);

    const handleOpen = () => setIsConnected(true);

    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed: InvestigationEventData = JSON.parse(event.data);
        setEventData(parsed);

        if (parsed.status === "completed" || parsed.status === "failed") {
          eventSource.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error("Gagal membaca data dari backend API:", err);
      }
    };

    const handleError = () => {
      setIsConnected(false);
      eventSource.close();
    };

    eventSource.addEventListener("open", handleOpen);
    eventSource.addEventListener("message", handleMessage);
    eventSource.addEventListener("error", handleError);

    return () => {
      eventSource.removeEventListener("open", handleOpen);
      eventSource.removeEventListener("message", handleMessage);
      eventSource.removeEventListener("error", handleError);
      eventSource.close();
    };
  }, [investigationId]);

  return { eventData, isConnected };
}
