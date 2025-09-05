"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ConversationTree, createConversationTree } from "./id-tree";

/**
 * Extra helpers layered on top of the vanilla useChat() return type.
 */
export type BranchingChatHelpers<T extends UIMessage> = ReturnType<
  typeof useChat<T>
> & {
  /**
   * Start a new branch under the given anchor message (commonly the previous assistant reply).
   * The UI messages will be reset to the path up to the anchor (branch root itself is structural).
   * Returns the created branch root node id.
   */
  beginBranch(anchorMessageId: string, label?: string): Promise<string>;

  /**
   * Select a specific path by node ids (e.g., ["U1","A1","A1::edit","U1_edit","A2"]).
   * Rehydrates `messages` to match that path.
   */
  selectPathByNodePath(nodePath: string[]): Promise<void>;

  /**
   * Jump to any node (message id or structural branch id) by computing the root→target path.
   * Rehydrates `messages` for that path.
   */
  selectPathToNode(targetNodeId: string): Promise<void>;

  /**
   * Convenience: compute the root→target node path (ids) without mutating UI state.
   */
  getNodePath(targetNodeId: string): string[];

  /**
   * The currently active node path (best effort; derived whenever messages change or you select a path).
   */
  activeNodePath: string[];
};

/**
 * A wrapper around the vanilla useChat hook that adds branching capabilities.
 * @param opts - The options for the vanilla useChat hook.
 * @returns The branching chat helpers.
 */
export function useBranchingChat<T extends UIMessage>(
  opts: Parameters<typeof useChat<T>>[0]
): BranchingChatHelpers<T> {
  const base = useChat<T>({ ...opts });
  const {
    id,
    messages,
    setMessages: originalSetMessages,
    sendMessage: originalSendMessage,
  } = base;

  // --- conversation tree + bookkeeping ---
  const convRef = useRef<ConversationTree | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const [activeNodePath, setActiveNodePath] = useState<string[]>([]);

  // Lazily create the conversation tree (one per chat id).
  const treeId = useMemo(() => `chat:${id ?? "local"}`, [id]);
  if (!convRef.current) {
    convRef.current = createConversationTree(treeId);
  }

  /**
   * Compute node path root→target by following parent links.
   */
  function getNodePath(targetNodeId: string): string[] {
    const conv = convRef.current!;
    const pathRev: string[] = [];
    let cur: string | null = targetNodeId;
    const rootId = conv.tree.root.id;

    while (cur && cur !== rootId) {
      pathRev.push(cur);
      cur = conv.tree.parentIdOf(cur);
    }
    return pathRev.reverse();
  }

  /**
   * Sync any new UI messages coming from useChat into the tree (linear append under current tail).
   * Because we always render a single active path in the UI, this produces a linear segment.
   * When the UI switches paths (via helpers below), we rehydrate messages and continue syncing linearly.
   */
  useEffect(() => {
    const conv = convRef.current!;
    const known = knownMessageIdsRef.current;

    for (const m of messages) {
      if (!m?.id) continue;
      if (known.has(m.id)) continue;

      // Add new message to the tree (under the last top-level node).
      conv.addMessage(m);
      known.add(m.id);
    }

    // Update the derived active path: path to the last visible message.
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      setActiveNodePath(getNodePath(last.id));
    } else {
      setActiveNodePath([]);
    }
  }, [messages]);

  /**
   * Start a new branch under `anchorMessageId`. Resets the UI messages to the anchor path.
   */
  async function beginBranch(
    anchorMessageId: string,
    label = "branch"
  ): Promise<string> {
    const conv = convRef.current!;
    if (!conv.tree.has(anchorMessageId)) {
      // If anchor isn't in the tree yet (e.g., just hydrated), sync current UI first:
      for (const m of messages) {
        if (!knownMessageIdsRef.current.has(m.id)) {
          conv.addMessage(m);
          knownMessageIdsRef.current.add(m.id);
        }
      }
      if (!conv.tree.has(anchorMessageId)) {
        throw new Error(`Anchor "${anchorMessageId}" not found in tree.`);
      }
    }

    const { branchRootId } = conv.beginBranch(anchorMessageId, label);

    // Build UI messages for the path up to (and including) the anchor (branch root is structural).
    const upToAnchor = await conv.serializeToNode(anchorMessageId);
    originalSetMessages(upToAnchor as T[]);

    // Active node path becomes: path to anchor, then the branch root.
    const path = [...getNodePath(anchorMessageId), branchRootId];
    setActiveNodePath(path);

    return branchRootId;
  }

  async function selectPathByNodePath(nodePath: string[]): Promise<void> {
    const conv = convRef.current!;
    const msgs = await conv.serializeFromNodePath(nodePath);
    originalSetMessages(msgs as T[]);
    setActiveNodePath(nodePath);
  }

  async function selectPathToNode(targetNodeId: string): Promise<void> {
    const conv = convRef.current!;
    const msgs = await conv.serializeToNode(targetNodeId);
    originalSetMessages(msgs as T[]);
    setActiveNodePath(getNodePath(targetNodeId));
  }

  // Optional wrapper to keep the tree robust if callers replace messages wholesale.
  function setMessages(next: T[] | ((prev: T[]) => T[])) {
    const value =
      typeof next === "function"
        ? (next as (prev: T[]) => T[])(messages as T[])
        : next;
    // Reset our known set (we'll resync in the effect).
    knownMessageIdsRef.current.clear();
    originalSetMessages(value as T[]);
  }

  // You can keep the original sendMessage; syncing happens in the effect.
  // But if you want a convenience that *ensures* we’re appending to a specific parent segment,
  // you can expose a helper that first selects a path, then calls sendMessage.
  async function sendMessageOnPath(
    message: Parameters<typeof originalSendMessage>[0],
    nodePath: string[],
    options?: Parameters<typeof originalSendMessage>[1]
  ) {
    await selectPathByNodePath(nodePath);
    originalSendMessage(message as any, options as any);
  }

  return {
    ...base,
    // replaced setMessages so we can resync cleanly when callers overwrite state
    setMessages: setMessages as BranchingChatHelpers<T>["setMessages"],
    // branching helpers
    beginBranch,
    selectPathByNodePath,
    selectPathToNode,
    getNodePath,
    activeNodePath,
    // optional helper
    sendMessageOnPath,
  } as BranchingChatHelpers<T>;
}
