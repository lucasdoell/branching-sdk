import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

export function useBranchingChat<T extends UIMessage>(
  opts: Parameters<typeof useChat<T>>[0]
) {
  const { messages } = useChat<T>({
    ...opts,
  });

  return {
    messages,
  };
}
