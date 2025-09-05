import type { UIMessage } from "ai";

export interface IdNode {
  readonly id: string;
  children: IdNode[];
}

export class IdTree {
  private _root: IdNode;
  private readonly index = new Map<string, IdNode>();

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

  appendChild(parentId: string, childId: string): IdNode {
    const parent = this.index.get(parentId);
    if (!parent) throw new Error(`Parent "${parentId}" not found.`);
    if (this.index.has(childId)) throw new Error(`Duplicate id "${childId}".`);
    const child: IdNode = { id: childId, children: [] };
    parent.children.push(child);
    this.index.set(childId, child);
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
  tree: IdTree;
  addMessage(message: UIMessage, parentId?: string): IdNode;
  beginBranch(anchorId: string, branchLabel?: string): { branchRootId: string };
}

export function createConversationTree(
  rootId = "conversation"
): ConversationTree {
  const tree = new IdTree(rootId);
  let lastTopLevelId = rootId;
  let lastBranchId: string | null = null;

  function nextUniqueId(base: string) {
    if (!tree.has(base)) return base;
    let i = 1;
    while (tree.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  function attachParts(parentMessageId: string, parts: UIMessage["parts"]) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const partBase = `${parentMessageId}::part-${i}:${p.type}`;
      const partId = nextUniqueId(partBase);
      tree.appendChild(parentMessageId, partId);
      // If you want to persist payloads (e.g., text/tool input/output) as nodes,
      // you can append grandchildren here based on p.type.
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

    let resolvedParent: string;
    if (parentId) {
      // If parentId is provided, check if it's a branch root
      // If so, and we have a lastBranchId, use that instead for linear chaining
      if (lastBranchId && parentId.includes("::")) {
        resolvedParent = lastBranchId;
      } else {
        resolvedParent = parentId;
      }
    } else {
      resolvedParent = lastTopLevelId;
    }

    const node = tree.appendChild(resolvedParent, message.id);
    attachParts(message.id, message.parts);

    // Update tracking variables
    if (!parentId) {
      lastTopLevelId = message.id;
      lastBranchId = null;
    } else if (parentId.includes("::")) {
      // We're adding to a branch
      lastBranchId = message.id;
    }

    return node;
  }

  function beginBranch(anchorId: string, branchLabel = "branch") {
    if (!tree.has(anchorId)) throw new Error(`Anchor "${anchorId}" not found.`);
    const branchRootId = nextUniqueId(`${anchorId}::${branchLabel}`);
    tree.appendChild(anchorId, branchRootId);
    lastTopLevelId = branchRootId;
    lastBranchId = null; // Reset branch tracking when starting a new branch
    return { branchRootId };
  }

  return { tree, addMessage, beginBranch };
}
