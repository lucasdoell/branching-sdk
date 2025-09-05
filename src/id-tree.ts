import type { UIMessage } from "ai";

export interface IdNode {
  readonly id: string;
  children: IdNode[];
}

export class IdTree {
  private _root: IdNode;
  private readonly index = new Map<string, IdNode>();
  private readonly parentOf = new Map<string, string>(); // childId -> parentId

  constructor(rootId: string) {
    const root: IdNode = { id: rootId, children: [] };
    this._root = root;
    this.index.set(rootId, root);
  }

  get root(): IdNode {
    return this._root;
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  find(id: string): IdNode | null {
    return this.index.get(id) ?? null;
  }

  parentIdOf(id: string): string | null {
    return this.parentOf.get(id) ?? null;
  }

  findParent(id: string): IdNode | null {
    const pid = this.parentIdOf(id);
    return pid ? (this.index.get(pid) ?? null) : null;
  }

  appendChild(parentId: string, childId: string): IdNode {
    const parent = this.index.get(parentId);
    if (!parent) throw new Error(`Parent "${parentId}" not found.`);
    if (this.index.has(childId)) throw new Error(`Duplicate id "${childId}".`);

    const child: IdNode = { id: childId, children: [] };
    parent.children.push(child);
    this.index.set(childId, child);
    this.parentOf.set(childId, parentId);
    return child;
  }

  toJSON(): IdNode {
    const clone = (n: IdNode): IdNode => ({
      id: n.id,
      children: n.children.map(clone),
    });
    return clone(this._root);
  }
}

// Conversation builder (UIMessage → IdTree)
export interface ConversationTree {
  /** The structural tree of nodes (root, branch roots, message nodes, part nodes). */
  tree: IdTree;

  /** Add a message (and its parts) under a chosen parent (default: last top-level). */
  addMessage(message: UIMessage, parentId?: string): IdNode;

  /** Start a new branch under `anchorId` (e.g., a previous assistant response). */
  beginBranch(anchorId: string, branchLabel?: string): { branchRootId: string };

  /** Serialize a UIMessage[] following a *node path* from root (branch-aware). */
  serializeFromNodePath(
    nodePath: string[],
    opts?: SerializeOptions
  ): Promise<UIMessage[]>;

  /** Serialize a UIMessage[] along the unique path from root to `targetNodeId`. */
  serializeToNode(
    targetNodeId: string,
    opts?: SerializeOptions
  ): Promise<UIMessage[]>;

  /** Serialize by an explicit list of *message IDs* (no path validation). */
  serializeByMessageIds(
    messageIds: string[],
    opts?: SerializeOptions
  ): Promise<UIMessage[]>;
}

export interface SerializeOptions {
  /**
   * Optionally validate the result with AI SDK v5's validators (if you import them).
   * Defaults to false.
   */
  validate?: boolean;
}

export function createConversationTree(
  rootId: string = "conversation"
): ConversationTree {
  const tree = new IdTree(rootId);

  // Registry of full UI messages for lossless serialization
  const messageIndex = new Map<string, UIMessage>();

  let lastTopLevelId: string = rootId;

  function nextUniqueId(base: string): string {
    if (!tree.has(base)) return base;
    let i = 1;
    while (tree.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  function attachParts(
    parentMessageId: string,
    parts: UIMessage["parts"]
  ): void {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const base = `${parentMessageId}::part-${i}:${p.type}`;
      const partId = nextUniqueId(base);
      tree.appendChild(parentMessageId, partId);
    }
  }

  function addMessage(message: UIMessage, parentId?: string): IdNode {
    if (!message?.id) throw new Error("UIMessage.id is required.");
    if (!Array.isArray(message.parts)) {
      throw new Error("UIMessage.parts is required in v5.");
    }
    if (tree.has(message.id)) {
      throw new Error(`Duplicate message id "${message.id}" detected.`);
    }
    const resolvedParent = parentId ?? lastTopLevelId;
    const node = tree.appendChild(resolvedParent, message.id);
    attachParts(message.id, message.parts);
    messageIndex.set(message.id, message);
    lastTopLevelId = message.id;
    return node;
  }

  function beginBranch(
    anchorId: string,
    branchLabel: string = "branch"
  ): { branchRootId: string } {
    if (!tree.has(anchorId)) throw new Error(`Anchor "${anchorId}" not found.`);
    const branchRootId = nextUniqueId(`${anchorId}::${branchLabel}`);
    tree.appendChild(anchorId, branchRootId);
    lastTopLevelId = branchRootId;
    return { branchRootId };
  }

  async function maybeValidate(
    messages: UIMessage[],
    validate?: boolean
  ): Promise<UIMessage[]> {
    if (!validate) return messages;
    // If you'd like runtime validation, uncomment import and lines below:
    // await validateUIMessages(messages); // throws on invalid shape
    return messages;
  }

  /** Collect message nodes encountered along the given node path. */
  async function serializeFromNodePath(
    nodePath: string[],
    opts?: SerializeOptions
  ): Promise<UIMessage[]> {
    if (nodePath.length === 0) return maybeValidate([], opts?.validate);

    // Walk from root through children, ensuring each step is a direct child
    let current: IdNode = tree.root;
    const out: UIMessage[] = [];

    for (const id of nodePath) {
      const next = current.children.find((c) => c.id === id);
      if (!next) {
        throw new Error(
          `Invalid path: node "${id}" is not a child of "${current.id}".`
        );
      }
      // Only collect if this node corresponds to a stored message
      const msg = messageIndex.get(id);
      if (msg) out.push(msg);

      current = next;
    }

    return maybeValidate(out, opts?.validate);
  }

  /** Compute path root→target via parent links, then serialize. */
  async function serializeToNode(
    targetNodeId: string,
    opts?: SerializeOptions
  ): Promise<UIMessage[]> {
    if (!tree.has(targetNodeId)) {
      throw new Error(`Target node "${targetNodeId}" not found.`);
    }
    // Climb parents to root, then reverse to get root→target node path
    const pathRev: string[] = [];
    let cur: string | null = targetNodeId;
    while (cur && cur !== tree.root.id) {
      pathRev.push(cur);
      cur = tree.parentIdOf(cur);
    }
    pathRev.reverse(); // now root's child → … → target
    return serializeFromNodePath(pathRev, opts);
  }

  /** Direct lookup by message IDs, preserving provided order. */
  async function serializeByMessageIds(
    messageIds: string[],
    opts?: SerializeOptions
  ): Promise<UIMessage[]> {
    const out: UIMessage[] = [];
    for (const id of messageIds) {
      const msg = messageIndex.get(id);
      if (!msg) throw new Error(`Message "${id}" not found in conversation.`);
      out.push(msg);
    }
    return maybeValidate(out, opts?.validate);
  }

  return {
    tree,
    addMessage,
    beginBranch,
    serializeFromNodePath,
    serializeToNode,
    serializeByMessageIds,
  };
}
