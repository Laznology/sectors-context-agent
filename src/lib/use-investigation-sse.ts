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
  reason?: string;
}

export interface InvestigationEventData {
  status: PipelineStatus;
  currentTool?: ToolCallInfo;
  error?: string;
  message?: string;
}

/**
 * Streams an investigation's progress from `GET /api/investigations/:id/events`.
 *
 * The backend emits named SSE events (`step`, `tool`, `completed`, `error`,
 * `snapshot`), not unnamed `message` events, so each is subscribed explicitly
 * and folded into one progress object.
 */
export function useInvestigationSSE(investigationId: string) {
  const [eventData, setEventData] = useState<InvestigationEventData>({ status: "pending" });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!investigationId) return;

    const eventSource = new EventSource(`/api/investigations/${investigationId}/events`);
    const merge = (patch: Partial<InvestigationEventData>) =>
      setEventData((prev) => ({ ...prev, ...patch }));

    const onOpen = () => setIsConnected(true);

    const onStatus = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { status?: PipelineStatus; error?: string };
        if (data.status) merge({ status: data.status, error: data.error });
        if (data.status === "completed" || data.status === "failed") close();
      } catch (err) {
        console.error("Failed to parse investigation event:", err);
      }
    };

    const onCompleted = () => {
      merge({ status: "completed" });
      close();
    };

    const onTool = (event: MessageEvent) => {
      try {
        const { toolCall } = JSON.parse(event.data) as { toolCall: ToolCallInfo };
        merge({ currentTool: { toolName: toolCall.toolName, reason: toolCall.reason } });
      } catch (err) {
        console.error("Failed to parse tool event:", err);
      }
    };

    const onError = (event: Event) => {
      if (event instanceof MessageEvent && event.data) {
        try {
          const { message } = JSON.parse(event.data) as { message?: string };
          merge({ status: "failed", error: message });
        } catch {
          merge({ status: "failed" });
        }
      }
      close();
    };

    const close = () => {
      eventSource.close();
      setIsConnected(false);
    };

    eventSource.addEventListener("open", onOpen);
    eventSource.addEventListener("step", onStatus);
    eventSource.addEventListener("snapshot", onStatus);
    eventSource.addEventListener("completed", onCompleted);
    eventSource.addEventListener("tool", onTool);
    eventSource.addEventListener("error", onError);

    return () => {
      eventSource.close();
    };
  }, [investigationId]);

  return { eventData, isConnected };
}
