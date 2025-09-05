import { describe, expect, it } from "bun:test";
import type { UIMessage } from "ai";

import { createConversationTree } from "../src/id-tree";

function makeText(
  id: string,
  role: "user" | "assistant",
  text: string
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

function makeWithParts(
  id: string,
  role: "user" | "assistant",
  parts: UIMessage["parts"]
): UIMessage {
  return { id, role, parts };
}

function childIds(node: { children: { id: string }[] }): string[] {
  return node.children.map((c) => c.id);
}

describe("ConversationTree (UIMessage v5)", () => {
  it("builds a mostly-linear tree and always includes parts", () => {
    const { tree, addMessage } = createConversationTree("conv");

    const U1 = makeText("U1", "user", "What's up?");
    const A1 = makeText("A1", "assistant", "All good!");

    addMessage(U1);
    addMessage(A1);

    // root -> U1
    expect(tree.root.children.length).toBe(1);
    expect(tree.root.children[0].id).toBe("U1");

    // U1 has its parts first, then the next message (A1)
    const u1 = tree.find("U1")!;
    expect(childIds(u1)).toEqual(["U1::part-0:text", "A1"]);

    // A1 exists and has its own parts
    const a1 = tree.find("A1")!;
    expect(childIds(a1)).toEqual(["A1::part-0:text"]);
  });

  it("preserves part order for a multi-part message", () => {
    const { tree, addMessage } = createConversationTree("conv");

    const U1 = makeWithParts("U1", "user", [
      { type: "step-start" }, // no payload
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ]);
    const A1 = makeText("A1", "assistant", "ok");

    addMessage(U1);
    addMessage(A1);

    const u1 = tree.find("U1")!;
    expect(childIds(u1)).toEqual([
      "U1::part-0:step-start",
      "U1::part-1:text",
      "U1::part-2:text",
      "A1",
    ]);
  });

  it("supports branching: beginBranch(anchor) + addMessage under the branch root", () => {
    const { tree, addMessage, beginBranch } = createConversationTree("conv");

    const U1 = makeText("U1", "user", "Hi");
    const A1 = makeText("A1", "assistant", "Hello");

    addMessage(U1);
    addMessage(A1);

    // Start a branch under the previous assistant response (A1), e.g. user edited message
    const { branchRootId } = beginBranch("A1", "edit");

    // Add edited user message / recomputed answer into that branch
    const U1_EDIT = makeText("U1_edit", "user", "Hi (edited)");
    const A2 = makeText("A2", "assistant", "Hello (recomputed)");

    addMessage(U1_EDIT, branchRootId);
    addMessage(A2, branchRootId);

    const a1 = tree.find("A1")!;
    // A1's children: its own parts first, then the branch node
    expect(childIds(a1)).toEqual(["A1::part-0:text", branchRootId]);

    const branch = tree.find(branchRootId)!;
    expect(childIds(branch)).toEqual(["U1_edit"]);

    const u1Edit = tree.find("U1_edit")!;
    expect(childIds(u1Edit)).toEqual(["U1_edit::part-0:text", "A2"]);
  });

  it("throws on duplicate message IDs", () => {
    const { addMessage } = createConversationTree("conv");
    const U1 = makeText("U1", "user", "Hi");

    addMessage(U1);
    expect(() => addMessage(U1)).toThrow(/Duplicate message id/i);
  });

  it("throws when branching from a missing anchor", () => {
    const { beginBranch } = createConversationTree("conv");
    expect(() => beginBranch("nope")).toThrow(/Anchor "nope" not found/i);
  });

  it("de-duplicates part IDs if they collide with existing nodes", () => {
    // Create a message whose ID collides with a future part label
    // (parts use `${messageId}::part-${i}:${type}`)
    const { tree, addMessage } = createConversationTree("conv");

    // This ID will collide with U1's part-0:text label.
    const COLLIDER = makeText("U1::part-0:text", "user", "dummy");
    addMessage(COLLIDER);

    const U1 = makeText("U1", "user", "real message");
    addMessage(U1);

    const u1 = tree.find("U1")!;
    // The first part should get a "-1" suffix due to collision
    expect(childIds(u1)[0]).toBe("U1::part-0:text-1");
  });
});
