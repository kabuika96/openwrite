export const defaultPageIcon = "emoji:📄";

export type PageNode = {
  id: string;
  icon: string;
  title: string;
  parentId: string | null;
  children: PageNode[];
};

export type FlatPage = {
  id: string;
  icon: string;
  title: string;
  parentId: string | null;
  depth: number;
};

export function flattenPageTree(tree: PageNode[]) {
  const pages: FlatPage[] = [];

  function visit(nodes: PageNode[], depth: number) {
    for (const node of nodes) {
      pages.push({
        id: node.id,
        icon: node.icon || defaultPageIcon,
        title: node.title,
        parentId: node.parentId,
        depth,
      });
      visit(node.children, depth + 1);
    }
  }

  visit(tree, 0);
  return pages;
}
