import { beanDataStore, GraphTreeBuilder } from '../../helper/index.js';

/**
 * Utility and factory class responsible for building, mutating,
 * and navigating the D3 hierarchy tree representing Spring Bean dependencies.
 */
export class GraphHierarchyBuilder {

    /**
     * Extracts unique context IDs from an array of bean definitions.
     *
     * @param {Array<Object>} beanDefinitions - List of bean definitions
     * @returns {Array<string>} Unique context IDs
     */
    static extractUniqueContextIdentifiers(beanDefinitions) {
        const uniqueContextSet = new Set();
        for (let i = 0; i < beanDefinitions.length; i++) {
            const contextIdentifier = beanDefinitions[i]?.contextId;
            if (contextIdentifier) {
                uniqueContextSet.add(contextIdentifier);
            }
        }
        return Array.from(uniqueContextSet);
    }

    /**
     * Builds HTML option elements for the context dropdown filter.
     *
     * @param {Array<string>} uniqueContextIds - Array of context IDs
     * @param {string} selectedContextId - Currently active context ID
     * @returns {string} Formatted HTML options string
     */
    static buildContextFilterOptionsHtml(uniqueContextIds, selectedContextId) {
        const isDefaultOptionSelected = !selectedContextId ? 'selected' : '';
        const defaultOptionHtml = `<option value="" ${isDefaultOptionSelected} class="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">All Contexts (${uniqueContextIds.length})</option>`;

        const contextOptionsHtml = uniqueContextIds.map(contextIdentifier => {
            const isSelected = contextIdentifier === selectedContextId ? 'selected' : '';
            return `<option value="${contextIdentifier}" ${isSelected} class="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">${contextIdentifier}</option>`;
        }).join('');

        return `${defaultOptionHtml}${contextOptionsHtml}`;
    }

    /**
     * Filters bean definitions by the currently active context ID.
     *
     * @param {Array<Object>} beanDefinitions - List of bean definitions
     * @param {string} selectedContextId - Selected context ID or empty for all
     * @returns {Array<Object>} Filtered bean definitions
     */
    static filterBeanDefinitionsByActiveContext(beanDefinitions, selectedContextId) {
        if (!selectedContextId) {
            return beanDefinitions;
        }
        return beanDefinitions.filter(bean => bean?.contextId === selectedContextId);
    }

    /**
     * Cross-links inverse dependent relationships into target bean records in O(1) time.
     *
     * @param {Array<Object>} beanDefinitions - List of bean definitions
     */
    static buildAndCrossLinkBeanDependencies(beanDefinitions) {
        beanDataStore.addBeans(beanDefinitions);
        const beanCount = beanDefinitions.length;

        for (let i = 0; i < beanCount; i++) {
            const upstreamBean = beanDefinitions[i];
            const dependencyNames = upstreamBean?.dependencies ?? [];
            const upstreamContextId = upstreamBean?.contextId;

            for (let j = 0; j < dependencyNames.length; j++) {
                const dependencyName = dependencyNames[j];
                const targetDependencyBean = beanDataStore.findBeanByName(dependencyName, upstreamContextId)
                    || beanDataStore.findBeanByName(dependencyName);

                if (targetDependencyBean) {
                    if (!targetDependencyBean._dependentsSet) {
                        targetDependencyBean._dependentsSet = new Set(targetDependencyBean.dependents || []);
                        targetDependencyBean.dependents = Array.from(targetDependencyBean._dependentsSet);
                    }
                    if (!targetDependencyBean._dependentsSet.has(upstreamBean.beanName)) {
                        targetDependencyBean._dependentsSet.add(upstreamBean.beanName);
                        targetDependencyBean.dependents.push(upstreamBean.beanName);
                    }
                }
            }
        }
    }

    /**
     * Builds a full D3 hierarchy root from the given bean definitions and context selection.
     *
     * @param {Array<Object>} beanDefinitions - Raw or accumulated bean definitions
     * @param {string} selectedContextId - Context filter ID
     * @param {Function} calculateNodeWidthFn - Width calculator callback
     * @returns {d3.HierarchyNode|null} D3 hierarchy root node
     */
    static buildHierarchy(beanDefinitions, selectedContextId, calculateNodeWidthFn) {
        if (!beanDefinitions || beanDefinitions.length === 0) {
            return null;
        }

        const scopedBeanDefinitions = this.filterBeanDefinitionsByActiveContext(beanDefinitions, selectedContextId);
        this.buildAndCrossLinkBeanDependencies(scopedBeanDefinitions);

        const rawTreeHierarchyData = GraphTreeBuilder.buildByContext(scopedBeanDefinitions);
        if (!rawTreeHierarchyData) {
            return null;
        }

        return this.createD3HierarchyRootNode(rawTreeHierarchyData, calculateNodeWidthFn);
    }

    /**
     * Instantiates and configures a D3 hierarchy root node from raw tree data.
     *
     * @param {Object} treeData - Hierarchical tree object from GraphTreeBuilder
     * @param {Function} calculateNodeWidthFn - Node width calculation function
     * @returns {d3.HierarchyNode} Configured D3 root node
     */
    static createD3HierarchyRootNode(treeData, calculateNodeWidthFn) {
        const root = d3.hierarchy(treeData);
        const idCounts = new Map();

        root.descendants().forEach((node) => {
            const contextId = node.data?.contextId || '';
            const name = node.data?.fullName || node.data?.name || '';
            const baseId = node.depth === 0
                ? (contextId ? `ctx_${contextId}` : 'root_cluster')
                : (node.data?.meta?.type === 'context'
                    ? `ctx_${contextId || name}`
                    : `node_${contextId}_${name}_${node.depth}`);
            const count = (idCounts.get(baseId) || 0) + 1;
            idCounts.set(baseId, count);
            node.id = count > 1 ? `${baseId}_${count}` : baseId;

            node._children = node.children;

            if (node.data) {
                node.data.name = node.data.name || GraphTreeBuilder._displayName(node.data.fullName || node.data.contextId || '');
                node.data.meta = node.data.meta || {};
                if (node.depth === 0) {
                    node.data.meta.type = 'context';
                }
            }

            if (typeof calculateNodeWidthFn === 'function') {
                node.width = calculateNodeWidthFn(node);
            }

            // Always keep only the first child level open at depth 0:
            // Depth 0: Root cluster / Context
            // Depth > 0: Collapsed by default
            if (node.depth > 0) {
                node.children = null;
            }
        });

        root.x0 = 0;
        root.y0 = 0;

        return root;
    }

    /**
     * Creates a child hierarchy node dynamically for lazy loading.
     *
     * @param {d3.HierarchyNode} parentNode - Parent hierarchy node
     * @param {string} beanName - Name of the child bean
     * @param {string} contextId - Context ID
     * @param {boolean} [isCycle=false] - Whether cycle was detected
     * @param {Function} calculateNodeWidthFn - Width calculator callback
     * @returns {d3.HierarchyNode} New hierarchy child node
     */
    static createDynamicHierarchyChild(parentNode, beanName, contextId, isCycle = false, calculateNodeWidthFn) {
        const beanRecord = beanDataStore.findBeanByName(beanName, contextId);
        const displayName = GraphTreeBuilder._displayName(beanName);
        const deps = beanRecord?.dependencies ?? [];

        const childData = {
            name: displayName,
            fullName: beanName,
            contextId,
            hasChildren: deps.length > 0 && !isCycle,
            dependencyNames: deps,
            meta: {
                type: beanRecord?.type ?? 'N/A',
                scope: beanRecord?.scope ?? 'singleton',
                contextId,
                deps: deps.length,
                ...(isCycle && { isCycle: true })
            },
            ...(isCycle && { isCycle: true })
        };

        const childNode = d3.hierarchy(childData);
        childNode.depth = parentNode.depth + 1;
        childNode.parent = parentNode;
        childNode.id = `dyn_${parentNode.id}_${contextId || ''}_${beanName}`;
        if (typeof calculateNodeWidthFn === 'function') {
            childNode.width = calculateNodeWidthFn(childNode);
        }
        childNode.children = null;
        childNode._children = null; // Shallow! Populated only when expanded

        return childNode;
    }

    /**
     * Lazy-loads children for a node if they have not yet been instantiated.
     *
     * @param {d3.HierarchyNode} node - Target node
     * @param {Function} calculateNodeWidthFn - Width calculator callback
     */
    static lazyLoadChildren(node, calculateNodeWidthFn) {
        if (!node || (node._children && node._children.length > 0)) return;

        const fullName = node.data?.fullName;
        const contextId = node.data?.contextId;
        const beanRecord = beanDataStore.findBeanByName(fullName, contextId);
        const deps = node.data?.dependencyNames || beanRecord?.dependencies || [];

        if (!deps.length) {
            node._children = [];
            return;
        }

        node._children = deps.map(depName => {
            let isCycle = false;
            let ancestor = node;
            while (ancestor) {
                if (ancestor.data?.fullName === depName || ancestor.data?.name === depName) {
                    isCycle = true;
                    break;
                }
                ancestor = ancestor.parent;
            }
            return this.createDynamicHierarchyChild(node, depName, contextId, isCycle, calculateNodeWidthFn);
        });
    }

    /**
     * Merges freshly fetched bean details into an existing hierarchy node.
     *
     * @param {d3.HierarchyNode} node - Target hierarchy node
     * @param {Object} details - Bean definition details
     * @param {Function} calculateNodeWidthFn - Width calculator callback
     */
    static mergeBeanDetailsIntoTree(node, details, calculateNodeWidthFn) {
        if (!node || !details) return;

        // 1. Update node metadata in place
        node.data.meta = {
            ...node.data.meta,
            ...(details.type && { type: details.type }),
            ...(details.scope && { scope: details.scope })
        };

        const dependencies = details.dependencies;
        if (!dependencies?.length) return;

        node._children ??= [];

        // 2. Pre-index existing children names for O(1) existence checks
        const existingChildNames = new Set();
        const existingChildren = node._children;

        for (let i = 0; i < existingChildren.length; i++) {
            const childData = existingChildren[i].data;
            if (childData?.fullName) existingChildNames.add(childData.fullName);
            if (childData?.name) existingChildNames.add(childData.name);
        }

        let hasAddedNewChild = false;
        const contextId = details.contextId ?? node.data?.contextId;

        // 3. Append missing dependency nodes
        for (let i = 0; i < dependencies.length; i++) {
            const dependencyName = dependencies[i];
            if (existingChildNames.has(dependencyName)) continue;

            const dependencyNode = this.createDynamicHierarchyChild(node, dependencyName, contextId, false, calculateNodeWidthFn);
            node._children.push(dependencyNode);
            existingChildNames.add(dependencyName);
            hasAddedNewChild = true;
        }

        // 4. Synchronize active visible children if node is currently expanded
        if (hasAddedNewChild && node.children) {
            node.children = node._children;
        }
    }

    /**
     * Determines whether a node has or can have children.
     *
     * @param {d3.HierarchyNode} node - Node to check
     * @returns {boolean} True if node has children
     */
    static nodeHasChildren(node) {
        if (!node) return false;
        if ((node.children && node.children.length > 0) || (node._children && node._children.length > 0)) {
            return true;
        }
        if (node.data?.hasChildren !== undefined) return node.data.hasChildren;
        const deps = node.data?.dependencyNames || beanDataStore.findBeanByName(node.data?.fullName, node.data?.contextId)?.dependencies;
        const has = Boolean(deps && deps.length > 0);
        if (node.data) node.data.hasChildren = has;
        return has;
    }

    /**
     * Captures identifiers of currently expanded nodes across the tree.
     *
     * @param {d3.HierarchyNode} root - Root hierarchy node
     * @returns {Set<string>} Set of composite keys (`contextId:beanName`)
     */
    static captureExpandedNodeIdentifiers(root) {
        if (!root) return new Set();
        const expandedKeys = new Set();
        root.descendants().forEach(node => {
            if (node.children && node.children.length > 0) {
                const name = node.data?.fullName || node.data?.name;
                const contextId = node.data?.contextId || '';
                if (name) expandedKeys.add(`${contextId}:${name}`);
            }
        });
        return expandedKeys;
    }

    /**
     * Restores previously expanded nodes across the tree.
     *
     * @param {d3.HierarchyNode} root - Root hierarchy node
     * @param {Set<string>} expandedKeys - Set of composite keys
     * @param {Function} calculateNodeWidthFn - Width calculator callback
     */
    static restoreExpandedNodeIdentifiers(root, expandedKeys, calculateNodeWidthFn) {
        if (!root || !expandedKeys || expandedKeys.size === 0) return;
        root.descendants().forEach(node => {
            const name = node.data?.fullName || node.data?.name;
            const contextId = node.data?.contextId || '';
            if (name && (expandedKeys.has(`${contextId}:${name}`) || expandedKeys.has(`:${name}`))) {
                this.lazyLoadChildren(node, calculateNodeWidthFn);
                node.children = node._children;
            }
        });
    }

    /**
     * Finds a node in the tree matching targetIdentifier, with optional context pruning.
     *
     * @param {d3.HierarchyNode} rootNode - Root node of the hierarchy
     * @param {string} targetIdentifier - Bean name or qualified identifier
     * @param {string} [targetContextId=null] - Optional context ID filter
     * @returns {d3.HierarchyNode|null} Matching node or null
     */
    static findNodeInTree(rootNode, targetIdentifier, targetContextId = null) {
        if (!rootNode || !targetIdentifier) return null;

        const normalizedTargetName = this.extractTerminalBeanIdentifier(targetIdentifier);
        const traversalStack = [rootNode];

        while (traversalStack.length > 0) {
            const currentNode = traversalStack.pop();
            const currentNodeIdentifier = currentNode.data?.fullName ?? currentNode.data?.name ?? '';
            const currentContextId = currentNode.data?.contextId;

            // Context pruning: if targetContextId is specified and currentNode is a context branch (depth 1),
            // skip descending into other contexts
            if (targetContextId && currentNode.depth === 1 && currentContextId && currentContextId !== 'all' && currentContextId !== targetContextId) {
                continue;
            }

            const isContextMatch = !targetContextId || !currentContextId || currentContextId === 'all' || currentContextId === targetContextId;

            if (isContextMatch && this.isMatchingNode(currentNodeIdentifier, targetIdentifier, normalizedTargetName)) {
                return currentNode;
            }

            const childNodes = currentNode.children ?? currentNode._children;
            if (childNodes) {
                for (let i = childNodes.length - 1; i >= 0; i--) {
                    traversalStack.push(childNodes[i]);
                }
            }
        }

        return null;
    }

    /**
     * Strips namespace or package prefixes from an identifier.
     *
     * @param {string} identifier - Full identifier
     * @returns {string} Terminal name
     */
    static extractTerminalBeanIdentifier(identifier) {
        return identifier.includes(':') ? identifier.split(':').pop() : identifier;
    }

    /**
     * Compares node identifier against target identifier.
     *
     * @param {string} nodeIdentifier - Node's name
     * @param {string} rawTargetIdentifier - Query identifier
     * @param {string} normalizedTargetName - Query normalized terminal name
     * @returns {boolean} True if matching
     */
    static isMatchingNode(nodeIdentifier, rawTargetIdentifier, normalizedTargetName) {
        if (!nodeIdentifier) return false;
        if (nodeIdentifier === rawTargetIdentifier) return true;

        const normalizedNodeName = this.extractTerminalBeanIdentifier(nodeIdentifier);
        return normalizedNodeName === normalizedTargetName;
    }

    /**
     * Performs a BFS to find a path from targetBeanName upward to an already existing node,
     * expands the ancestor path, and triggers lazy loading along the path.
     *
     * @param {d3.HierarchyNode} root - Root node
     * @param {string} targetBeanName - Name of bean to reveal
     * @param {string} [contextId=''] - Context ID
     * @param {Function} calculateNodeWidthFn - Width calculator callback
     * @param {Function} [onUpdate] - Tree update callback
     * @returns {d3.HierarchyNode|null} Found node or null
     */
    static expandPathToBean(root, targetBeanName, contextId = '', calculateNodeWidthFn, onUpdate) {
        if (!root || !targetBeanName) return null;

        const queue = [[targetBeanName]];
        const visited = new Set([targetBeanName]);
        let foundPath = null;

        let iterations = 0;
        while (queue.length > 0 && iterations++ < 500) {
            const path = queue.shift();
            const currentBeanName = path[0];

            const existingNode = this.findNodeInTree(root, currentBeanName, contextId);
            if (existingNode) {
                foundPath = path;
                break;
            }

            const record = beanDataStore.findBeanByName(currentBeanName, contextId);
            const dependents = record?.dependents || [];

            for (let i = 0; i < dependents.length; i++) {
                const parentName = dependents[i];
                if (!visited.has(parentName)) {
                    visited.add(parentName);
                    queue.push([parentName, ...path]);
                }
            }
        }

        if (!foundPath) return null;

        let currentNode = this.findNodeInTree(root, foundPath[0], contextId);

        // Expand all ancestors up to root (e.g. Context nodes in multi-context mode)
        let ancestor = currentNode?.parent;
        while (ancestor) {
            if (ancestor._children && !ancestor.children) {
                ancestor.children = ancestor._children;
            }
            ancestor = ancestor.parent;
        }

        for (let i = 0; i < foundPath.length - 1; i++) {
            if (!currentNode) break;
            this.lazyLoadChildren(currentNode, calculateNodeWidthFn);
            currentNode.children = currentNode._children;
            const nextBeanName = foundPath[i + 1];
            currentNode = (currentNode.children || []).find(c =>
                (c.data?.fullName === nextBeanName || c.data?.name === nextBeanName) &&
                (!contextId || !c.data?.contextId || c.data.contextId === contextId)
            );
        }

        if (currentNode) {
            this.lazyLoadChildren(currentNode, calculateNodeWidthFn);
        }

        onUpdate?.(root);
        return currentNode || this.findNodeInTree(root, targetBeanName, contextId);
    }
}
