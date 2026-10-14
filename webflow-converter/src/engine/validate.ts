/**
 * Structural validation of a payload before it is copied (spec checklist 7.6).
 *
 * Ownership: engine.
 */

import { isTextNode, XSCP_TYPE, type XscpData } from './types';

/**
 * Checks that `data` is structurally sound for paste:
 * correct `type`; unique node and style ids; `nodes[0]` is the only root; every child id exists;
 * no node has two parents; every class id exists; every style has a non-empty name and
 * `type: "class"`; every style `children` entry exists.
 *
 * @returns A list of human-readable problems. Empty means valid.
 */
export function validateXscp(data: XscpData): string[] {
  const problems: string[] = [];
  if (data.type !== XSCP_TYPE) problems.push(`type must be "${XSCP_TYPE}"`);

  const { nodes, styles } = data.payload;
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (nodeIds.has(n._id)) problems.push(`duplicate node id ${n._id}`);
    nodeIds.add(n._id);
  }
  const styleIds = new Set<string>();
  for (const s of styles) {
    if (styleIds.has(s._id) || nodeIds.has(s._id)) problems.push(`duplicate style id ${s._id}`);
    styleIds.add(s._id);
    if (s.type !== 'class') problems.push(`style ${s._id} must have type "class"`);
    if (!s.name.trim()) problems.push(`style ${s._id} has an empty name`);
  }
  for (const s of styles) {
    for (const c of s.children) if (!styleIds.has(c)) problems.push(`style ${s.name} child ${c} not found`);
  }

  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    if (isTextNode(n)) continue;
    for (const c of n.children) {
      if (!nodeIds.has(c)) problems.push(`node ${n._id} child ${c} not found`);
      if (parentOf.has(c)) problems.push(`node ${c} has more than one parent`);
      parentOf.set(c, n._id);
    }
    for (const cls of n.classes) if (!styleIds.has(cls)) problems.push(`node ${n._id} class ${cls} not found`);
  }

  if (nodes.length > 0) {
    const first = nodes[0]!;
    if (parentOf.has(first._id)) problems.push('nodes[0] must be the root');
    const roots = nodes.filter((n) => !parentOf.has(n._id));
    if (roots.length > 1) problems.push(`payload has ${roots.length} roots; expected 1`);
  }
  return problems;
}
