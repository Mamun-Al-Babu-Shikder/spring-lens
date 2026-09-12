/**
 * Manages dependency/dependent path tracing and active highlight sets for canvas rendering.
 */
export class GraphPathTracer {

    /**
     * @param {Object} [options] - Configuration options
     * @param {Function} [options.onStateChange] - Callback invoked when highlight state changes
     */
    constructor(options = {}) {
        this.onStateChange = options.onStateChange;

        this.isHighlightPathActive = false;
        this.activePathNodeRefs = null;
        this.activePathNodeIds = null;
        this.activePathNodeNames = null;
    }

    /**
     * Highlights the dependency and dependent path for a given node.
     * Traces upwards to root (ancestors) and downwards through visible descendants.
     *
     * @param {d3.HierarchyNode} node - Target node to trace from
     */
    highlightPathForNode(node) {
        if (!this.isHighlightPathActive || !node) return;

        const pathNodeRefs = new Set();
        const pathNodeIds = new Set();
        const pathNodeNames = new Set();

        // 1. Trace upwards: All ancestor nodes to root
        let currentAncestor = node;
        while (currentAncestor) {
            pathNodeRefs.add(currentAncestor);
            if (currentAncestor.id !== undefined) pathNodeIds.add(currentAncestor.id);
            if (currentAncestor.data?.fullName) pathNodeNames.add(currentAncestor.data.fullName);
            if (currentAncestor.data?.name) pathNodeNames.add(currentAncestor.data.name);
            currentAncestor = currentAncestor.parent;
        }

        // 2. Trace downwards: All descendant nodes (visible children recursively)
        const traversalQueue = [node];
        while (traversalQueue.length > 0) {
            const currentDescendant = traversalQueue.shift();
            pathNodeRefs.add(currentDescendant);
            if (currentDescendant.id !== undefined) pathNodeIds.add(currentDescendant.id);
            if (currentDescendant.data?.fullName) pathNodeNames.add(currentDescendant.data.fullName);
            if (currentDescendant.data?.name) pathNodeNames.add(currentDescendant.data.name);

            const activeChildren = currentDescendant.children || [];
            for (let i = 0; i < activeChildren.length; i++) {
                traversalQueue.push(activeChildren[i]);
            }
        }

        this.activePathNodeRefs = pathNodeRefs;
        this.activePathNodeIds = pathNodeIds;
        this.activePathNodeNames = pathNodeNames;

        this.onStateChange?.();
    }

    /**
     * Resets or restores path highlights depending on active state and selected node.
     *
     * @param {d3.HierarchyNode} [selectedNodeRef] - Currently selected node, if any
     */
    resetPathHighlight(selectedNodeRef = null) {
        if (this.isHighlightPathActive && selectedNodeRef) {
            this.highlightPathForNode(selectedNodeRef);
            return;
        }

        this.activePathNodeRefs = null;
        this.activePathNodeIds = null;
        this.activePathNodeNames = null;

        this.onStateChange?.();
    }

    /**
     * Checks if a given node is included in the active traced path.
     *
     * @param {d3.HierarchyNode} node - Target node
     * @returns {boolean} True if highlighted or if path highlighting is off
     */
    isNodeInActivePath(node) {
        if (!this.isHighlightPathActive || !this.activePathNodeRefs) return true;
        return this.activePathNodeRefs.has(node) ||
            (node.id !== undefined && this.activePathNodeIds?.has(node.id)) ||
            (node.data?.fullName && this.activePathNodeNames?.has(node.data.fullName)) ||
            (node.data?.name && this.activePathNodeNames?.has(node.data.name));
    }

    /**
     * Checks if a given link connects two nodes in the active traced path.
     *
     * @param {Object} link - Hierarchy link { source, target }
     * @returns {boolean} True if both endpoints are highlighted or highlighting is off
     */
    isLinkInActivePath(link) {
        if (!this.isHighlightPathActive || !this.activePathNodeRefs) return true;
        return this.isNodeInActivePath(link.source) && this.isNodeInActivePath(link.target);
    }

    /**
     * Toggles path highlight mode on/off and updates the toolbar toggle button state.
     *
     * @param {jQuery} $highlightButton - jQuery button element
     * @param {d3.HierarchyNode} [selectedNodeRef] - Currently selected node
     */
    toggleHighlightState($highlightButton, selectedNodeRef = null) {
        const HIGHLIGHT_BUTTON_CLASSES = {
            active: 'bg-primary text-white border-primary hover:bg-primary/90',
            inactive: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        };

        this.isHighlightPathActive = !this.isHighlightPathActive;

        if ($highlightButton && $highlightButton.length) {
            $highlightButton
                .toggleClass(HIGHLIGHT_BUTTON_CLASSES.active, this.isHighlightPathActive)
                .toggleClass(HIGHLIGHT_BUTTON_CLASSES.inactive, !this.isHighlightPathActive);
        }

        if (!this.isHighlightPathActive) {
            this.resetPathHighlight(null);
        } else if (selectedNodeRef) {
            this.highlightPathForNode(selectedNodeRef);
        }
    }
}
