import { ConversationNode, RoleplaySession, TokenUsage } from '../types';

/**
 * Traverses from a leaf node backwards up to the root,
 * returning the linear active path in chronological order.
 */
export function getActiveTimeline(session: RoleplaySession): ConversationNode[] {
  const nodes = session.nodes;
  if (!session.activeLeafId || !nodes[session.activeLeafId]) {
    if (session.rootNodeId && nodes[session.rootNodeId]) {
      return [nodes[session.rootNodeId]];
    }
    return [];
  }

  const path: ConversationNode[] = [];
  let currentId: string | null = session.activeLeafId;
  const visited = new Set<string>();

  while (currentId && nodes[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    path.push(nodes[currentId]);
    currentId = nodes[currentId].parentId;
  }

  return path.reverse();
}

/**
 * Finds the deepest/latest leaf node from a given starting node
 */
export function findDeepestLeaf(nodes: Record<string, ConversationNode>, startNodeId: string): string {
  const startNode = nodes[startNodeId];
  if (!startNode || startNode.childrenIds.length === 0) {
    return startNodeId;
  }

  // Follow the last child down to the leaf
  const lastChildId = startNode.childrenIds[startNode.childrenIds.length - 1];
  return findDeepestLeaf(nodes, lastChildId);
}

/**
 * Information about a node's sibling position
 */
export interface SiblingInfo {
  currentIndex: number; // 0-based
  totalSiblings: number;
  hasSiblings: boolean;
  siblingIds: string[];
}

export function getSiblingInfo(session: RoleplaySession, nodeId: string): SiblingInfo {
  const node = session.nodes[nodeId];
  if (!node || !node.parentId) {
    return {
      currentIndex: 0,
      totalSiblings: 1,
      hasSiblings: false,
      siblingIds: [nodeId],
    };
  }

  const parent = session.nodes[node.parentId];
  if (!parent) {
    return {
      currentIndex: 0,
      totalSiblings: 1,
      hasSiblings: false,
      siblingIds: [nodeId],
    };
  }

  const index = parent.childrenIds.indexOf(nodeId);
  return {
    currentIndex: index >= 0 ? index : 0,
    totalSiblings: parent.childrenIds.length,
    hasSiblings: parent.childrenIds.length > 1,
    siblingIds: parent.childrenIds,
  };
}

/**
 * Switches the active branch to an alternate sibling (prev: -1, next: +1)
 */
export function switchBranch(
  session: RoleplaySession,
  nodeId: string,
  direction: 'prev' | 'next'
): RoleplaySession {
  const siblingInfo = getSiblingInfo(session, nodeId);
  if (!siblingInfo.hasSiblings) return session;

  const newIndex = direction === 'prev'
    ? (siblingInfo.currentIndex - 1 + siblingInfo.totalSiblings) % siblingInfo.totalSiblings
    : (siblingInfo.currentIndex + 1) % siblingInfo.totalSiblings;

  const targetSiblingId = siblingInfo.siblingIds[newIndex];
  if (!targetSiblingId) return session;

  // Find the deepest leaf under the selected sibling branch
  const newActiveLeafId = findDeepestLeaf(session.nodes, targetSiblingId);

  return {
    ...session,
    activeLeafId: newActiveLeafId,
    updatedAt: Date.now(),
  };
}

/**
 * Creates a new child node under parentId and sets it as the active leaf
 */
export function appendChildNode(
  session: RoleplaySession,
  parentId: string,
  role: 'user' | 'assistant',
  content: string,
  tokenUsage?: TokenUsage
): { session: RoleplaySession; newNodeId: string } {
  const newNodeId = 'node_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
  const parentNode = session.nodes[parentId];

  const newNode: ConversationNode = {
    id: newNodeId,
    parentId,
    childrenIds: [],
    role,
    content,
    timestamp: Date.now(),
    tokenUsage,
  };

  const updatedParent: ConversationNode = parentNode
    ? {
        ...parentNode,
        childrenIds: [...parentNode.childrenIds, newNodeId],
      }
    : {
        id: parentId,
        parentId: null,
        childrenIds: [newNodeId],
        role: 'user',
        content: '',
        timestamp: Date.now(),
      };

  const updatedNodes = {
    ...session.nodes,
    [parentId]: updatedParent,
    [newNodeId]: newNode,
  };

  const updatedSession: RoleplaySession = {
    ...session,
    nodes: updatedNodes,
    activeLeafId: newNodeId,
    updatedAt: Date.now(),
  };

  return { session: updatedSession, newNodeId };
}

/**
 * Updates an existing node's content and/or token usage in place
 */
export function updateNodeContent(
  session: RoleplaySession,
  nodeId: string,
  content: string,
  tokenUsage?: TokenUsage
): RoleplaySession {
  const existingNode = session.nodes[nodeId];
  if (!existingNode) return session;

  return {
    ...session,
    nodes: {
      ...session.nodes,
      [nodeId]: {
        ...existingNode,
        content,
        tokenUsage: tokenUsage !== undefined ? tokenUsage : existingNode.tokenUsage,
      },
    },
    updatedAt: Date.now(),
  };
}

/**
 * Removes a leaf node (e.g. a failed generation placeholder) and rewinds the
 * active leaf to its parent. Refuses to remove nodes that have children so a
 * failed retry can never orphan an existing branch.
 */
export function removeLeafNode(
  session: RoleplaySession,
  nodeId: string
): RoleplaySession {
  const target = session.nodes[nodeId];
  if (!target || target.childrenIds.length > 0) return session;

  const parentId = target.parentId;
  const nodes = { ...session.nodes };
  delete nodes[nodeId];

  if (parentId && nodes[parentId]) {
    const parent = nodes[parentId];
    nodes[parentId] = {
      ...parent,
      childrenIds: parent.childrenIds.filter((id) => id !== nodeId),
    };
  }

  return {
    ...session,
    nodes,
    activeLeafId: parentId && nodes[parentId] ? parentId : session.rootNodeId,
    updatedAt: Date.now(),
  };
}

/**
 * Formats active timeline into a clean plain text script
 */
export function exportTranscript(session: RoleplaySession): string {
  const timeline = getActiveTimeline(session);
  const characterName = session.character.name || 'Character';
  const userName = session.userPersona.name || 'User';

  const lines: string[] = [
    `=============================================================`,
    `ROLEPLAY TRANSCRIPT: ${session.title}`,
    `Character: ${characterName}`,
    `User Persona: ${userName}`,
    `Model: minimax/minimax-m2-her (via Puter.js)`,
    `Exported: ${new Date().toLocaleString()}`,
    `=============================================================`,
    ``,
    `[SYSTEM INSTRUCTIONS]`,
    session.systemInstructions || '(Default instructions)',
    ``,
    `[CHARACTER SCENARIO & PERSONA]`,
    session.character.scenario,
    ``,
    `-------------------- BEGIN ROLEPLAY --------------------`,
    ``,
  ];

  for (let i = 0; i < timeline.length; i++) {
    const node = timeline[i];
    const speaker = node.role === 'assistant' ? characterName : userName;
    const time = new Date(node.timestamp).toLocaleTimeString();

    lines.push(`[${speaker}] - Turn ${i} (${time})`);
    lines.push(node.content.trim());
    lines.push(``);
  }

  lines.push(`-------------------- END OF ROLEPLAY --------------------`);
  return lines.join('\n');
}

/**
 * Exports complete session data including entire branching tree
 */
export function exportRawJson(session: RoleplaySession): string {
  const backup = {
    version: '1.0',
    app: 'Roleplay Playground',
    exportedAt: new Date().toISOString(),
    session,
  };
  return JSON.stringify(backup, null, 2);
}
