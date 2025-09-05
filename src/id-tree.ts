export interface IdNode {
  readonly id: string;
  children: IdNode[]; // order matters
}

export class IdTree {
  private _root: IdNode;
  private readonly index: Map<string, IdNode>;

  constructor(rootId: string) {
    const root: IdNode = { id: rootId, children: [] };
    this._root = root;
    this.index = new Map([[rootId, root]]);
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

  /**
   * Append a new child under `parentId` (enforces unique childId).
   * Returns the new node.
   */
  appendChild(parentId: string, childId: string): IdNode {
    const parent = this.index.get(parentId);
    if (!parent) throw new Error(`Parent "${parentId}" not found.`);

    if (this.index.has(childId)) throw new Error(`Duplicate id "${childId}".`);

    const child: IdNode = { id: childId, children: [] };
    parent.children.push(child);
    this.index.set(childId, child);

    return child;
  }

  /**
   * Insert a node (that already exists) under a new parent at the end.
   * Useful if you implement move/branch rewiring later.
   */
  reparent(nodeId: string, newParentId: string): void {
    if (nodeId === this._root.id) throw new Error("Cannot reparent root.");
    const node = this.index.get(nodeId);
    const newParent = this.index.get(newParentId);
    if (!node) throw new Error(`Node "${nodeId}" not found.`);
    if (!newParent) throw new Error(`Parent "${newParentId}" not found.`);

    // Find and remove from old parent's children
    const oldParent = this.findParent(nodeId);
    if (!oldParent) throw new Error(`Parent of "${nodeId}" not found.`);
    const i = oldParent.children.findIndex((c) => c.id === nodeId);
    if (i >= 0) oldParent.children.splice(i, 1);

    // Append to new parent (order-preserving)
    newParent.children.push(node);
  }

  /**
   * Find the parent node (O(n)). Acceptable for tree ops; if needed, keep a parent index.
   */
  findParent(id: string): IdNode | null {
    if (!this.index.has(id) || id === this._root.id) return null;

    // Iterative DFS to locate the parent
    const stack: IdNode[] = [this._root];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const child of cur.children) {
        if (child.id === id) return cur;
        stack.push(child);
      }
    }

    return null;
  }

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

    while (stack.length) {
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

  toJSON(): IdNode {
    function clone(n: IdNode): IdNode {
      return { id: n.id, children: n.children.map(clone) };
    }

    return clone(this._root);
  }
}
