import { describe, expect, it } from "bun:test";
import type { UIMessage } from "ai";
import { createConversationTree } from "../src/id-tree";

function makeText(
  id: string,
  role: "user" | "assistant",
  text: string
): UIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

function ids(messages: UIMessage[]): string[] {
  return messages.map((m) => m.id);
}

describe("ConversationTree serialization (UIMessage v5)", () => {
  it("serializes a linear path (root → … → target) via serializeToNode", async () => {
    const { addMessage, serializeToNode } = createConversationTree("conv");
    const U1 = makeText("U1", "user", "hi");
    const A1 = makeText("A1", "assistant", "hello");
    const U2 = makeText("U2", "user", "more");

    addMessage(U1);
    addMessage(A1);
    addMessage(U2);

    const msgs = await serializeToNode("U2");
    expect(ids(msgs)).toEqual(["U1", "A1", "U2"]);
  });

  it("serializes by explicit message id list (no path validation)", async () => {
    const { addMessage, serializeByMessageIds } =
      createConversationTree("conv");
    const U1 = makeText("U1", "user", "hi");
    const A1 = makeText("A1", "assistant", "hello");
    const U2 = makeText("U2", "user", "more");

    addMessage(U1);
    addMessage(A1);
    addMessage(U2);

    const msgs = await serializeByMessageIds(["U1", "U2"]);
    expect(ids(msgs)).toEqual(["U1", "U2"]);
  });

  it("throws on invalid node path steps in serializeFromNodePath", async () => {
    const { addMessage, serializeFromNodePath } =
      createConversationTree("conv");
    const U1 = makeText("U1", "user", "hi");
    const A1 = makeText("A1", "assistant", "hello");

    addMessage(U1);
    addMessage(A1);

    // "A1" is not a child of root directly in node-path terms; path must include "U1" first.
    await expect(serializeFromNodePath(["A1"])).rejects.toThrow(/not a child/i);
  });

  it("handles multiple branches: choose the correct path among siblings", async () => {
    const {
      tree,
      addMessage,
      beginBranch,
      serializeFromNodePath,
      serializeToNode,
    } = createConversationTree("conv");

    // Top node under root
    const M1 = makeText("1", "user", "root message");
    addMessage(M1);

    // Left child line: 1 -> 2L -> 3
    const M2L = makeText("2L", "assistant", "left branch, first reply");
    addMessage(M2L); // appended under "1"

    const M3 = makeText("3", "user", "left line continues");
    addMessage(M3); // under "2L"

    // Right sibling off "1": create branch root under "1" and append 2R there
    const { branchRootId: B1 } = beginBranch("1", "alt");
    const M2R = makeText("2R", "assistant", "right branch from root");
    addMessage(M2R, B1);

    // Now split again under "3": two alternatives 4A and 4B under a new branch node
    const { branchRootId: B3 } = beginBranch("3", "split");
    const M4A = makeText("4A", "assistant", "left leaf A");
    const M4B = makeText("4B", "assistant", "left leaf B");
    addMessage(M4A, B3);
    addMessage(M4B, B3);

    // Sanity: node layout (ids only)
    // conv
    //  └─ 1
    //      ├─ 1::part-0:text
    //      ├─ 2L
    //      │   ├─ 2L::part-0:text
    //      │   └─ 3
    //      │       ├─ 3::part-0:text
    //      │       └─ 3::split
    //      │           ├─ 4A
    //      │           └─ 4B
    //      └─ 1::alt
    //          └─ 2R

    // Path 1: go left path to leaf 4A
    const pathTo4A = ["1", "2L", "3", B3, "4A"];
    const msgs4A = await serializeFromNodePath(pathTo4A);
    expect(ids(msgs4A)).toEqual(["1", "2L", "3", "4A"]);

    // Path 2: same, but choose 4B at the split
    const pathTo4B = ["1", "2L", "3", B3, "4B"];
    const msgs4B = await serializeFromNodePath(pathTo4B);
    expect(ids(msgs4B)).toEqual(["1", "2L", "3", "4B"]);

    // Path 3: directly choose the right branch from root (1 -> alt -> 2R)
    const pathTo2R = ["1", B1, "2R"];
    const msgs2R = await serializeFromNodePath(pathTo2R);
    expect(ids(msgs2R)).toEqual(["1", "2R"]);

    // Also verify serializeToNode can discover the correct route to a deep leaf
    const autoMsgs = await serializeToNode("4B");
    expect(ids(autoMsgs)).toEqual(["1", "2L", "3", "4B"]);

    // Confirm branch nodes themselves are structural and not emitted as messages
    expect(ids(msgs2R)).not.toContain(B1);
    expect(ids(msgs4A)).not.toContain(B3);

    // Bonus: ensure no stray children underneath branch leaves
    expect(tree.find("4A")!.children.length).toBe(1); // its part node only
    expect(tree.find("4B")!.children.length).toBe(1);
  });
});
