import { describe, expect, it } from "vitest";
import { defaultPageIcon, flattenPageTree, type PageNode } from "./pageTree";

describe("page tree", () => {
  it("flattens vault pages with depth and fallback icons", () => {
    const tree: PageNode[] = [
      {
        id: "Project.md",
        icon: "",
        title: "Project",
        parentId: null,
        children: [
          {
            id: "Project/Notes.md",
            icon: "emoji:📝",
            title: "Notes",
            parentId: "Project.md",
            children: [],
          },
        ],
      },
    ];

    expect(flattenPageTree(tree)).toEqual([
      {
        id: "Project.md",
        icon: defaultPageIcon,
        title: "Project",
        parentId: null,
        depth: 0,
      },
      {
        id: "Project/Notes.md",
        icon: "emoji:📝",
        title: "Notes",
        parentId: "Project.md",
        depth: 1,
      },
    ]);
  });
});
