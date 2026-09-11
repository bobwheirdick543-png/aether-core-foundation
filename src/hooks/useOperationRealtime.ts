import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Refreshes an operation query from durable Supabase state whenever the task or
 * one of its execution events changes. The browser never owns execution state;
 * realtime is only a wake-up signal and the server function remains the source
 * of truth.
 */
export function useOperationRealtime(operationId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!operationId) return;

    const channel = supabase
      .channel(`aether-operation:${operationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `id=eq.${operationId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["my-operation", operationId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_events", filter: `task_id=eq.${operationId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["my-operation", operationId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [operationId, queryClient]);
}
