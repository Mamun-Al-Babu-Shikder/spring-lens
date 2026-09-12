import CanvasTreeRenderer from './canvas-tree-renderer.js';
import {
    BeanMetadataRules,
    NW, NH, GAP_X, GAP_Y, ZOOM_SCALE_EXTENT,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget managing HTML5 canvas tree rendering, zoom/pan navigation,
 * layout computation, and interactive tooltip overlay.
 */
export class GraphCanvasWidget {

    /**
     * @param {Object} [options] - Configuration and event callbacks
     * @param {Function} [options.onNodeClick] - Node click handler (event, node)
     * @param {Function} [options.onToggleClick] - Toggle button click handler (event, node)
     * @param {Function} [options.onNodeHover] - Node hover handler (event, node)
     * @param {Function} [options.onNodeLeave] - Node mouse leave handler
     * @param {Function} [options.onBackgroundClick] - Canvas background click handler
     */
    constructor(options = {}) {
        this.options = options;

        this.canvas = null;
        this.canvasRenderer = null;
        this.zoom = null;
        this.currentTransform = d3.zoomIdentity;
        this._textMeasureCtx = null;

        this.mode = localStorage.getItem('sl-layout') ?? 'tb';

        this.focusedNodeFullName = null;
        this.focusedNodeContextId = null;
        this.focusedNodeId = null;

        this.resizeObserver = null;
        this._sidebarAnimFrameId = null;
    }

    /**
     * Initializes the canvas element, renderer instance, zoom behavior, and resize observer.
     *
     * @param {HTMLCanvasElement} canvasElem - The target canvas element
     * @param {Function} getRootNodeFn - Callback returning the current root node
     * @returns {boolean} True if successfully initialized
     */
    init(canvasElem, getRootNodeFn) {
        if (!canvasElem) return false;
        this.canvas = canvasElem;
        this.getRootNode = getRootNodeFn;

        this.injectTooltip();

        this.canvasRenderer = new CanvasTreeRenderer(canvasElem, {
            onNodeClick: (event, node) => this.options.onNodeClick?.(event, node),
            onToggleClick: (event, node) => this.options.onToggleClick?.(event, node),
            onNodeHover: (event, node) => {
                this.showTip(event, node);
                this.options.onNodeHover?.(event, node);
            },
            onNodeLeave: () => {
                this.hideTip();
                this.options.onNodeLeave?.();
            },
            onBackgroundClick: () => {
                this.options.onBackgroundClick?.();
            }
        });

        this._setupZoom();

        const $graph = $('#beanGraph');
        const initialWidth = $graph.width() || 800;
        const initialHeight = $graph.height() || 600;
        this.canvasRenderer.resize(initialWidth, initialHeight);

        this.setupResizeObserver();
        this._updateModeButtons();

        return true;
    }

    /**
     * Measures text width in pixels using a 2D canvas context.
     *
     * @param {string} text - Text string
     * @returns {number} Text width in pixels
     */
    measureTextWidth(text) {
        if (!text) return 0;
        if (!this._textMeasureCtx) {
            const canvas = document.createElement('canvas');
            this._textMeasureCtx = canvas.getContext('2d');
        }
        this._textMeasureCtx.font = '600 13px Inter, -apple-system, sans-serif';
        return this._textMeasureCtx.measureText(text).width;
    }

    /**
     * Computes the bounding width for a node based on label width and child count.
     *
     * @param {d3.HierarchyNode} node - Target node
     * @param {Function} nodeHasChildrenFn - Callback returning whether node has children
     * @returns {number} Calculated node width in pixels
     */
    calculateNodeWidth(node, nodeHasChildrenFn) {
        const name = node?.data?.name || '';
        const hasChildren = typeof nodeHasChildrenFn === 'function'
            ? nodeHasChildrenFn(node)
            : Boolean((node.children && node.children.length > 0) || (node._children && node._children.length > 0));
        const textWidth = this.measureTextWidth(name);
        const extraPadding = hasChildren ? 88 : 64;
        return Math.max(180, Math.ceil(textWidth) + extraPadding);
    }

    /**
     * Calculates the D3 tree layout positions.
     *
     * @param {Array<d3.HierarchyNode>} nodes - Reversed descendants array
     * @param {boolean} isTB - Whether top-to-bottom layout is active
     * @param {d3.HierarchyNode} root - Root hierarchy node
     */
    calculateLayout(nodes, isTB, root) {
        const maxWidth = d3.max(nodes, node => node.width) || NW;
        BeanMetadataRules.tree.nodeSize(isTB ? [maxWidth + GAP_X, NH + GAP_Y] : [NH + 28, maxWidth + GAP_Y]);
        BeanMetadataRules.tree(root);
    }

    /**
     * Renders the canvas tree using CanvasTreeRenderer.
     *
     * @param {d3.HierarchyNode} root - Root hierarchy node
     * @param {d3.HierarchyNode} [source=null] - Source node for transition origin
     * @param {number} [duration=0] - Transition duration in ms
     * @param {Object} [extraConfig={}] - Additional rendering configuration (highlights, paths)
     */
    renderCanvas(root, source = null, duration = 0, extraConfig = {}) {
        if (!this.canvasRenderer || !root) return;

        const $graph = $('#beanGraph');
        const width = $graph.width() || 800;
        const height = $graph.height() || 600;
        this.canvasRenderer.resize(width, height);

        const config = {
            mode: this.mode,
            focusedNodeFullName: this.focusedNodeFullName,
            focusedNodeContextId: this.focusedNodeContextId,
            focusedNodeId: this.focusedNodeId,
            ...extraConfig
        };

        if (source && duration > 0) {
            this.canvasRenderer.animateTransition(root, this.currentTransform, config, source, duration);
        } else {
            this.canvasRenderer.render(root, this.currentTransform, config);
        }
    }

    /**
     * Recalculates layout and re-renders tree onto canvas.
     *
     * @param {d3.HierarchyNode} root - Root hierarchy node
     * @param {Event} [event] - Optional DOM event (checks altKey for slow-motion)
     * @param {d3.HierarchyNode} [source=null] - Animation source
     * @param {number} [customDuration=null] - Duration override
     * @param {Object} [extraConfig={}] - Extra config
     * @param {Function} [nodeHasChildrenFn] - Node children checker
     */
    update(root, event = null, source = null, customDuration = null, extraConfig = {}, nodeHasChildrenFn = null) {
        if (!root) return;

        const isTB = this.mode === 'tb';
        const duration = customDuration !== null
            ? customDuration
            : (event?.altKey ? 4000 : (source ? 950 : 0));

        const descendants = root.descendants();
        const nodes = descendants.slice().reverse();

        let visibleCount = 0;

        descendants.forEach((node) => {
            node.width = this.calculateNodeWidth(node, nodeHasChildrenFn);

            if (node.depth === 0 || node.parent?.children) {
                visibleCount++;
            }
        });

        this.calculateLayout(nodes, isTB, root);
        this.renderCanvas(root, source, duration, extraConfig);

        root.eachBefore(node => {
            node.x0 = node.x;
            node.y0 = node.y;
        });

        $('#nodeCount strong').text(visibleCount);
    }

    /**
     * Marks a node as currently focused and triggers re-render.
     *
     * @param {d3.HierarchyNode|string} targetNode - Target node or bean name
     * @param {d3.HierarchyNode} [root] - Root node for re-render
     * @param {Object} [extraConfig={}] - Extra render config
     */
    markNodeAsFocused(targetNode, root = null, extraConfig = {}) {
        this.focusedNodeFullName = targetNode?.data?.fullName || targetNode?.data?.name || (typeof targetNode === 'string' ? targetNode : null);
        this.focusedNodeContextId = targetNode?.data?.contextId || null;
        this.focusedNodeId = targetNode?.id ?? null;
        const currentRoot = root || this.getRootNode?.();
        if (currentRoot) {
            this.renderCanvas(currentRoot, null, 0, extraConfig);
        }
    }

    /**
     * Clears node focus and triggers re-render.
     *
     * @param {d3.HierarchyNode} [root] - Root node for re-render
     * @param {Object} [extraConfig={}] - Extra render config
     */
    clearFocusedNode(root = null, extraConfig = {}) {
        this.focusedNodeFullName = null;
        this.focusedNodeContextId = null;
        this.focusedNodeId = null;
        const currentRoot = root || this.getRootNode?.();
        if (currentRoot) {
            this.renderCanvas(currentRoot, null, 0, extraConfig);
        }
    }

    /**
     * Sets layout direction mode ('tb' or 'lr') and triggers tree layout update.
     *
     * @param {string} layoutMode - 'tb' or 'lr'
     * @param {d3.HierarchyNode} [root] - Root hierarchy node
     * @param {Function} [onUpdateLayout] - Layout update callback
     */
    setMode(layoutMode, root = null, onUpdateLayout = null) {
        this.mode = layoutMode;
        localStorage.setItem('sl-layout', layoutMode);
        this._updateModeButtons();

        if (!root || typeof onUpdateLayout !== 'function') return;

        root.eachBefore(node => {
            node.x0 = node.x;
            node.y0 = node.y;
        });

        const { x = 0, y = 0, x0 = 0, y0 = 0 } = root;
        onUpdateLayout({ x, y, x0, y0 });
        this.fitView(root, 500);
    }

    /**
     * Updates styling on mode toggle buttons.
     */
    _updateModeButtons() {
        const isTopBottom = this.mode === 'tb';
        const activeClasses = 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white shadow-xs font-bold';
        const inactiveClasses = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white font-medium';

        $('#btn-tb')
            .toggleClass(activeClasses, isTopBottom)
            .toggleClass(inactiveClasses, !isTopBottom);

        $('#btn-lr')
            .toggleClass(activeClasses, !isTopBottom)
            .toggleClass(inactiveClasses, isTopBottom);
    }

    /**
     * Zooms the viewport by a given scaling factor.
     *
     * @param {number} factor - Scale factor (e.g. 1.25 or 0.8)
     * @param {number} [duration=300] - Animation duration in ms
     */
    zoomBy(factor, duration = 300) {
        if (!this.zoom || !this.canvas) return;

        d3.select(this.canvas).transition()
            .duration(duration)
            .call(this.zoom.scaleBy, factor);
    }

    /**
     * Calculates optimal bounding box and scales viewport to fit all visible nodes.
     *
     * @param {d3.HierarchyNode} root - Root hierarchy node
     * @param {number} [duration=500] - Animation duration in ms
     * @param {number} [padding=50] - Viewport padding in px
     * @param {number} [minScale=0.25] - Minimum allowable scale
     * @param {number} [maxScale=0.88] - Maximum allowable scale
     * @param {Object} [extraConfig={}] - Extra config for render
     */
    fitView(root, duration = 500, padding = 50, minScale = 0.25, maxScale = 0.88, extraConfig = {}) {
        if (!this.canvas || !root) return;

        const $beanGraph = $('#beanGraph');
        const width = $beanGraph.width() || 800;
        const height = $beanGraph.height() || 600;

        const nodes = root.descendants();
        if (nodes.length === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let maxNodeW = NW;

        const isTB = this.mode === 'tb';

        for (let i = 0; i < nodes.length; i++) {
            const { x, y, width: nodeWidth = NW } = nodes[i];
            const nx = isTB ? x : y;
            const ny = isTB ? y : x;

            if (nx < minX) minX = nx;
            if (nx > maxX) maxX = nx;
            if (ny < minY) minY = ny;
            if (ny > maxY) maxY = ny;
            if (nodeWidth > maxNodeW) maxNodeW = nodeWidth;
        }

        const graphW = (maxX - minX) + maxNodeW + padding * 2;
        const graphH = (maxY - minY) + NH + padding * 2;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const rawScale = Math.min(width / graphW, height / graphH) * 0.88;
        const scale = Math.max(minScale, Math.min(maxScale, rawScale));

        const tx = width / 2 - centerX * scale;
        const ty = height / 2 - centerY * scale;

        const newTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        this.currentTransform = newTransform;
        d3.select(this.canvas).property('__zoom', newTransform);

        if (duration > 0 && this.canvasRenderer) {
            this.canvasRenderer.animateTransform(newTransform, duration, (k) => this.updateZoomPercent(k));
        } else {
            this.renderCanvas(root, null, 0, extraConfig);
            this.updateZoomPercent(scale);
        }
    }

    /**
     * Updates the zoom percentage indicator in the toolbar.
     *
     * @param {number} k - Current scale factor
     */
    updateZoomPercent(k) {
        $('#zoom-percent').text(`${Math.round(k * 100)}%`);
    }

    /**
     * Injects the tooltip template into document body if not already present.
     */
    injectTooltip() {
        if ($('#tip').length === 0) {
            const clone = TemplateEngine.clone('tpl-tooltip');
            if (clone) $('body').append(clone);
        }
    }

    /**
     * Displays the hover tooltip for a given node.
     *
     * @param {MouseEvent} param0 - Mouse event with pageX, pageY
     * @param {d3.HierarchyNode} node - Target node
     */
    showTip({ pageX, pageY }, node) {
        const { data, depth, _children = [] } = node;
        const { name, meta = {} } = data;
        const { type, scope, role, deps, dependents } = meta;

        const childrenCount = _children?.length;
        const shortType = type ? type.slice(type.lastIndexOf('.') + 1) : '';

        const typeLabel = shortType ? `Type: ${shortType}` : '';
        const scopeLabel = scope ? `Scope: ${scope}${role ? ` · ${role}` : ''}` : '';

        let metaText = `Leaf · depth ${depth}`;
        if (deps !== undefined) {
            metaText = `Deps: ${deps} · Dependents: ${dependents ?? 0}`;
        } else if (childrenCount > 0) {
            metaText = `${childrenCount} child bean(s) · depth ${depth}`;
        }

        $('#tip-name').text(name);
        $('#tip-type').text(typeLabel);
        $('#tip-scope').text(scopeLabel);
        $('#tip-meta').text(metaText);

        $('#tip')
            .addClass('show')
            .css({ left: pageX + 12, top: pageY + 20 });
    }

    /**
     * Hides the hover tooltip.
     */
    hideTip() {
        $('#tip').removeClass('show');
    }

    /**
     * Sets up D3 zoom and pan listeners on the canvas.
     */
    _setupZoom() {
        this.zoom = d3.zoom()
            .scaleExtent(ZOOM_SCALE_EXTENT)
            .on('zoom', ({ transform }) => {
                this.currentTransform = transform;
                const root = this.getRootNode?.();
                if (root) {
                    this.renderCanvas(root);
                }
                this.updateZoomPercent(transform.k);
            });

        if (this.canvas) {
            d3.select(this.canvas).call(this.zoom);
        }
    }

    /**
     * Synchronizes canvas dimensions with its container, adjusting transform to preserve center.
     *
     * @param {d3.HierarchyNode} [root] - Root node
     * @param {Object} [extraConfig={}] - Extra config
     */
    syncCanvasSize(root = null, extraConfig = {}) {
        if (!this.canvasRenderer) return;
        const currentRoot = root || this.getRootNode?.();
        if (!currentRoot) return;

        const $graph = $('#beanGraph');
        const width = $graph.width() || 800;
        const height = $graph.height() || 600;

        if (width <= 0 || height <= 0) return;

        const oldWidth = this.canvasRenderer.width;
        const oldHeight = this.canvasRenderer.height;

        if (Math.abs(oldWidth - width) > 2 || Math.abs(oldHeight - height) > 2) {
            if (oldWidth > 0 && oldHeight > 0) {
                const dx = (width - oldWidth) / 2;
                const dy = (height - oldHeight) / 2;
                this.currentTransform = d3.zoomIdentity
                    .translate(this.currentTransform.x + dx, this.currentTransform.y + dy)
                    .scale(this.currentTransform.k);
                d3.select(this.canvas).property('__zoom', this.currentTransform);
            }

            this.canvasRenderer.resize(width, height);
            this.renderCanvas(currentRoot, null, 0, extraConfig);
        }
    }

    /**
     * Runs an animation frame loop to smoothly adjust canvas size during sidebar open/close.
     *
     * @param {d3.HierarchyNode} [root] - Root node
     * @param {Object} [extraConfig={}] - Extra config
     */
    animateSidebarTransition(root = null, extraConfig = {}) {
        if (this._sidebarAnimFrameId) {
            cancelAnimationFrame(this._sidebarAnimFrameId);
        }

        const startTime = performance.now();
        const duration = 350;

        const step = (now) => {
            this.syncCanvasSize(root, extraConfig);
            if (now - startTime < duration) {
                this._sidebarAnimFrameId = requestAnimationFrame(step);
            } else {
                this._sidebarAnimFrameId = null;
                this.syncCanvasSize(root, extraConfig);
            }
        };

        this._sidebarAnimFrameId = requestAnimationFrame(step);
    }

    /**
     * Observes resize events on `#beanGraph` container.
     */
    setupResizeObserver() {
        const graphContainer = document.getElementById('beanGraph');
        if (!graphContainer || typeof ResizeObserver === 'undefined') return;

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.resizeObserver = new ResizeObserver(() => {
            this.syncCanvasSize();
        });

        this.resizeObserver.observe(graphContainer);
    }

    /**
     * Cleans up canvas renderer, observers, and animation frames.
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this._sidebarAnimFrameId) {
            cancelAnimationFrame(this._sidebarAnimFrameId);
            this._sidebarAnimFrameId = null;
        }
        if (this.canvasRenderer) {
            this.canvasRenderer.destroy();
            this.canvasRenderer = null;
        }
        this.hideTip();
    }
}
