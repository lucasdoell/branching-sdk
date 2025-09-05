// A single node in the ID tree.
export interface IdNode {
  readonly id: string; // id is immutable from the outside
  children: IdNode[]; // order matters
}

/**
 * Ordered ID tree with guaranteed-unique IDs and pre-order DFS traversal.
 * - O(1) `find` using an internal index
 * - Appends preserve child order (push)
 * - Early-exit traversal
 */
export class IdTree {
  private _root: IdNode;
  private readonly index: Map<string, IdNode>;

  constructor(rootId: string) {
    const root = { id: rootId, children: [] } as IdNode;
    this._root = root;
    this.index = new Map<string, IdNode>([[rootId, root]]);
  }

  get root(): IdNode {
    return this._root;
  }

  /**
   * O(1) lookup by id. Returns null if not found.
   */
  find(id: string): IdNode | null {
    return this.index.get(id) ?? null;
  }

  /**
   * Append a new child under `parentId`. Enforces unique `childId`.
   * Returns the newly created node.
   */
  appendChild(parentId: string, childId: string): IdNode {
    const parent = this.index.get(parentId);
    if (!parent) {
      throw new Error(`Parent with id "${parentId}" not found.`);
    }
    if (this.index.has(childId)) {
      throw new Error(`A node with id "${childId}" already exists.`);
    }

    const child = { id: childId, children: [] } as IdNode;
    parent.children.push(child);
    this.index.set(childId, child);
    return child;
  }

  /**
   * Visit each node in pre-order DFS. Return `false` from `visit` to stop early.
   */
  traverseDepthFirst(
    visit: (
      node: IdNode,
      depth: number,
      parent: IdNode | null
    ) => boolean | void
  ): void {
    type Frame = {
      node: IdNode;
      depth: number;
      parent: IdNode | null;
      i: number;
    };
    const stack: Frame[] = [
      { node: this._root, depth: 0, parent: null, i: -1 },
    ];

    while (stack.length > 0) {
      const top = stack[stack.length - 1];

      if (top.i === -1) {
        const cont = visit(top.node, top.depth, top.parent);
        if (cont === false) return;
        top.i = 0;
      }

      if (top.i >= top.node.children.length) {
        stack.pop();
        continue;
      }

      const child = top.node.children[top.i++];
      stack.push({
        node: child,
        depth: top.depth + 1,
        parent: top.node,
        i: -1,
      });
    }
  }

  /**
   * Convenience: does a node with this id exist?
   */
  has(id: string): boolean {
    return this.index.has(id);
  }

  /**
   * JSON-safe deep copy (avoids exposing internal references).
   */
  toJSON(): IdNode {
    function clone(node: IdNode): IdNode {
      return {
        id: node.id,
        children: node.children.map(clone),
      };
    }
    return clone(this._root);
  }
}
