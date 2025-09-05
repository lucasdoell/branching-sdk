const messages = [
  {
    parts: [
      {
        type: "text",
        text: "What's the weather like in Trenton, NJ?",
      },
    ],
    id: "45AFXdX5VUfbVnvH",
    role: "user",
  },
  {
    id: "8eimz924dfi8xpyt",
    role: "assistant",
    parts: [
      {
        type: "step-start",
      },
      {
        type: "tool-weather",
        toolCallId: "call_TR7Iquht0EK20DHuEqkhANME",
        state: "output-available",
        input: {
          city: "Trenton, NJ",
        },
        output: {
          temperature: 10,
          conditions: "snowy",
          result:
            "The temperature in Trenton, NJ is 10°F and the conditions are snowy.",
        },
      },
      {
        type: "step-start",
      },
      {
        type: "text",
        text: "The current weather in Trenton, NJ is 10°F with snowy conditions. Be sure to bundle up and consider any travel advisories due to snow accumulation.",
        state: "done",
      },
    ],
  },
  {
    parts: [
      {
        type: "text",
        text: "How do I write a depth first search in TypeScript?",
      },
    ],
    id: "AObGLgP56XWhCMLA",
    role: "user",
  },
  {
    id: "rbL6cKUGhm469l8a",
    role: "assistant",
    parts: [
      {
        type: "step-start",
      },
      {
        type: "text",
        text: 'Here’s a simple, strongly-typed TypeScript example of a depth-first-search (DFS) on a directed graph represented with an adjacency list. You’ll see both a recursive and an iterative (stack-based) version.\n\n```ts\n// A generic Graph class using an adjacency list\nclass Graph<T> {\n  private adjList: Map<T, T[]> = new Map()\n\n  // Add a vertex\n  addVertex(v: T): void {\n    if (!this.adjList.has(v)) {\n      this.adjList.set(v, [])\n    }\n  }\n\n  // Add a directed edge from u → v\n  addEdge(u: T, v: T): void {\n    if (!this.adjList.has(u)) {\n      this.addVertex(u)\n    }\n    if (!this.adjList.has(v)) {\n      this.addVertex(v)\n    }\n    this.adjList.get(u)!.push(v)\n  }\n\n  // Get neighbors of a vertex\n  neighbors(v: T): T[] {\n    return this.adjList.get(v) || []\n  }\n}\n\n// === 1) Recursive DFS ===\nfunction dfsRecursive<T>(\n  graph: Graph<T>,\n  start: T,\n  visited: Set<T> = new Set(),\n  order: T[] = []\n): T[] {\n  if (visited.has(start)) {\n    return order\n  }\n\n  visited.add(start)\n  order.push(start)\n\n  for (const nbr of graph.neighbors(start)) {\n    if (!visited.has(nbr)) {\n      dfsRecursive(graph, nbr, visited, order)\n    }\n  }\n\n  return order\n}\n\n// === 2) Iterative DFS using a stack ===\nfunction dfsIterative<T>(graph: Graph<T>, start: T): T[] {\n  const visited = new Set<T>()\n  const stack: T[] = [start]\n  const order: T[] = []\n\n  while (stack.length > 0) {\n    const node = stack.pop()!\n    if (visited.has(node)) {\n      continue\n    }\n    visited.add(node)\n    order.push(node)\n\n    // Push neighbors onto stack.\n    // If you want the same order as recursive, you may need to reverse this array\n    for (const nbr of graph.neighbors(node)) {\n      if (!visited.has(nbr)) {\n        stack.push(nbr)\n      }\n    }\n  }\n\n  return order\n}\n\n// === Example Usage ===\nconst g = new Graph<string>()\ng.addEdge("A", "B")\ng.addEdge("A", "C")\ng.addEdge("B", "D")\ng.addEdge("C", "E")\ng.addEdge("D", "F")\n\nconsole.log("DFS recursive order:", dfsRecursive(g, "A"))\n// e.g. [ \'A\', \'B\', \'D\', \'F\', \'C\', \'E\' ]\n\nconsole.log("DFS iterative order:", dfsIterative(g, "A"))\n// e.g. [ \'A\', \'C\', \'E\', \'B\', \'D\', \'F\' ] (order may differ slightly depending on neighbor order)\n```\n\nExplanation:\n\n1. We store the graph in a `Map<T, T[]>` so it can be used with any node type `T`.\n2. In `dfsRecursive`, we mark the node as visited, record it in `order`, then recursively visit each neighbor.\n3. In `dfsIterative`, we use an explicit stack. We pop a node, mark it visited, record it, then push its unvisited neighbors onto the stack.\n4. Both versions return an array of nodes in the order they were first visited.\n\nFeel free to adapt this to undirected graphs (just add edges in both directions) or add extra logic (e.g. tracking parent pointers, detecting cycles, etc.).',
        state: "done",
      },
    ],
  },
  {
    parts: [
      {
        type: "text",
        text: "Can you explain the useEffect hook in React?",
      },
    ],
    id: "K0OxhZ0XZNlEtxs4",
    role: "user",
  },
  {
    id: "6Qyu4EEVLdF2tzaR",
    role: "assistant",
    parts: [
      {
        type: "step-start",
      },
      {
        type: "text",
        text: "In React function components, useEffect is the primary hook for running “side-effects” (anything that’s not purely rendering UI). Common side-effects include:\n\n• data fetching  \n• manual DOM mutations  \n• subscriptions or timers  \n• logging or analytics calls  \n\nHere’s what you need to know:\n\n1. import and signature  \n   • You import it from React:  \n     import React, { useEffect } from 'react'  \n   • Its basic form:  \n     useEffect(effect: () ⇒ (void | (() ⇒ void | undefined)), deps?: any[])\n\n2. When it runs  \n   • After the component renders (commit phase)  \n   • By default, after every render  \n   • Can be controlled by a “dependency array”  \n\n3. Dependency array  \n   • useEffect(() ⇒ { … }, [a, b, c])  \n     – Effect runs on first mount and whenever a, b or c change  \n   • If you pass [] (empty array), effect runs only once (on mount)  \n   • If you omit the array, effect runs after every single render  \n\n4. Cleanup function  \n   • If your effect returns a function, React will run it before the next effect or when the component unmounts  \n   • Useful for tearing down subscriptions, canceling timers, etc.  \n\n5. Examples  \n   a) Fetching data on mount  \n     function UserList() {  \n       const [users, setUsers] = React.useState<User[]>([])  \n       React.useEffect(() ⇒ {  \n         let cancelled = false  \n         fetch('/api/users')  \n           .then(r ⇒ r.json())  \n           .then(data ⇒ {  \n             if (!cancelled) setUsers(data)  \n           })  \n         return () ⇒ {  \n           cancelled = true  \n         }  \n       }, [])  \n       return (  \n         <ul>  \n           {users.map(u ⇒ <li key={u.id}>{u.name}</li>)}  \n         </ul>  \n       )  \n     }  \n\n   b) Subscribing to an event, with cleanup  \n     function WindowWidth() {  \n       const [width, setWidth] = React.useState(window.innerWidth)  \n       React.useEffect(() ⇒ {  \n         const handleResize = () ⇒ setWidth(window.innerWidth)  \n         window.addEventListener('resize', handleResize)  \n         return () ⇒ {  \n           window.removeEventListener('resize', handleResize)  \n         }  \n       }, [])  \n       return <div>Window width: {width}</div>  \n     }  \n\n6. Common pitfalls  \n   • You must include every external variable you use inside your effect in the dependency array (or consciously omit them with understanding of stale closures).  \n   • If you do async work, you can’t make the effect callback itself async—handle that inside:  \n     useEffect(() ⇒ {  \n       async function fetchData() { … }  \n       fetchData()  \n     }, [])  \n\n7. Rules of hooks still apply  \n   • Always call useEffect at the top level of your component (not inside loops or conditionals).  \n\nIn short, useEffect ties the component’s lifecycle (mount/update/unmount) to your side-effect code. Mastering its dependency array and cleanup mechanism is key to predictable, bug-free React apps.",
        state: "done",
      },
    ],
  },
];
