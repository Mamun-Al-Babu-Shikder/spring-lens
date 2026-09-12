import { NH, NW, RX, ICON, BeanMetadataRules } from '../../helper/index.js';

/**
 * High-performance HTML5 Canvas renderer for D3 collapsible dependency trees.
 * Full visual and interactive parity with SVG:
 * - Viewport (frustum) culling: only visible on-screen nodes & curves are drawn.
 * - Zero measureText thrashing: fast character metrics estimation with node-level caching.
 * - Staggered organic bloom (expansion) and collapse animations with cubic-out easing.
 * - Dynamic Bézier links with terminal marker dots following node coordinates.
 * - Click vs drag discrimination to prevent accidental node openings while panning.
 * - Focused node halo glow with top-layer rendering.
 * - High-contrast path highlighting (ancestors + descendants vivid, non-path dimmed).
 * - Interactive hover states on cards and toggle badges (+ / -).
 */
export default class CanvasTreeRenderer {

    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement?.getContext('2d');
        this.options = options;

        this.width = 800;
        this.height = 600;
        this.dpr = window.devicePixelRatio || 1;

        this.onNodeClick = options.onNodeClick || (() => {});
        this.onToggleClick = options.onToggleClick || (() => {});
        this.onNodeHover = options.onNodeHover || (() => {});
        this.onNodeLeave = options.onNodeLeave || (() => {});
        this.onBackgroundClick = options.onBackgroundClick || (() => {});

        this.hoveredNode = null;
        this.hoveredToggle = false;
        this.currentTransform = d3.zoomIdentity;
        this.currentRoot = null;
        this.currentConfig = {};

        // Drag gesture tracking to eliminate pan vs click conflicts
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._isDragging = false;

        // Node animation state tracking: id -> { id, node, x, y, opacity, startX, startY, startOpacity, targetX, targetY, targetOpacity, delay, isExiting }
        this.nodeStates = new Map();
        this.animFrameId = null;
        this.transformAnimFrameId = null;

        this._iconPath2D = null;
        if (typeof Path2D !== 'undefined') {
            try {
                this._iconPath2D = new Path2D(ICON);
            } catch (e) {
                this._iconPath2D = null;
            }
        }

        this._bindEvents();
    }

    /**
     * Resizes the canvas backbuffer only if dimensions or devicePixelRatio have changed.
     * Prevents clearing the GPU backbuffer during pan/zoom.
     */
    resize(width, height) {
        if (!this.canvas || !this.ctx) return;
        const dpr = window.devicePixelRatio || 1;

        if (this.width === width && this.height === height && this.dpr === dpr) {
            return;
        }

        this.width = width;
        this.height = height;
        this.dpr = dpr;

        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);

        if (!this.animFrameId && this.currentRoot) {
            this._drawCanvasFrame();
        }
    }

    /**
     * Smoothly animates expanding, collapsing, and moving nodes using requestAnimationFrame
     * with organic cascading delays and buttery-smooth cubic in-out deceleration easing.
     */
    animateTransition(root, transform, config = {}, source = null, duration = 950) {
        if (!this.canvas || !this.ctx || !root) return;

        this.currentRoot = root;
        this.currentTransform = transform || this.currentTransform;
        this.currentConfig = config;

        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        const isTB = config.mode === 'tb';
        const currentDescendants = root.descendants();
        const currentIdSet = new Set();

        // If no prior state existed or instant duration requested, render directly
        if (this.nodeStates.size === 0 || duration <= 0) {
            this.render(root, this.currentTransform, config);
            return;
        }

        const srcNode = source || root;
        const srcCx = isTB ? (srcNode.x0 ?? srcNode.x ?? 0) : (srcNode.y0 ?? srcNode.y ?? 0);
        const srcCy = isTB ? (srcNode.y0 ?? srcNode.y ?? 0) : (srcNode.x0 ?? srcNode.x ?? 0);
        const srcTargetCx = isTB ? (srcNode.x ?? 0) : (srcNode.y ?? 0);
        const srcTargetCy = isTB ? (srcNode.y ?? 0) : (srcNode.x ?? 0);

        // 1. Process current visible / entering nodes
        for (let i = 0; i < currentDescendants.length; i++) {
            const node = currentDescendants[i];
            currentIdSet.add(node.id);

            const targetCx = isTB ? node.x : node.y;
            const targetCy = isTB ? node.y : node.x;

            let state = this.nodeStates.get(node.id);
            if (state) {
                // Existing node moving to new position
                state.node = node;
                state.startX = state.x;
                state.startY = state.y;
                state.startOpacity = state.opacity;
                state.targetX = targetCx;
                state.targetY = targetCy;
                state.targetOpacity = 1;
                state.delay = 0;
                state.isExiting = false;
            } else {
                // Entering node: blossoms outward from parent's origin with cascading slide-reveal
                const parentNode = node.parent;
                const parentState = parentNode ? this.nodeStates.get(parentNode.id) : null;

                const originX = parentState ? parentState.x : (parentNode ? (isTB ? (parentNode.x0 ?? parentNode.x ?? srcCx) : (parentNode.y0 ?? parentNode.y ?? srcCy)) : srcCx);
                const originY = parentState ? parentState.y : (parentNode ? (isTB ? (parentNode.y0 ?? parentNode.y ?? srcCy) : (parentNode.x0 ?? parentNode.x ?? srcCx)) : srcCy);

                const startX = originX + (isTB ? 0 : 20);
                const startY = originY + (isTB ? 20 : 0);

                // Gentle cascading stagger based on sibling order within the expanding branch
                let siblingIndex = 0;
                if (parentNode?.children) {
                    const idx = parentNode.children.indexOf(node);
                    siblingIndex = idx >= 0 ? idx : (i % 8);
                } else {
                    siblingIndex = (i % 8);
                }
                const isTargetNodeFocused = this._isNodeFocused(node, config);

                const staggerDelay = (node.depth === 0 || isTargetNodeFocused)
                    ? 0
                    : Math.min(siblingIndex * 40, 280);

                const initialX = isTargetNodeFocused ? targetCx : startX;
                const initialY = isTargetNodeFocused ? targetCy : startY;
                const initialOpacity = isTargetNodeFocused ? 1 : 0;

                this.nodeStates.set(node.id, {
                    id: node.id,
                    node: node,
                    x: initialX,
                    y: initialY,
                    opacity: initialOpacity,
                    startX: initialX,
                    startY: initialY,
                    startOpacity: initialOpacity,
                    targetX: targetCx,
                    targetY: targetCy,
                    targetOpacity: 1,
                    delay: staggerDelay,
                    isExiting: false
                });
            }
        }

        // 2. Process exiting nodes: smoothly collapse back into parent position
        for (const [id, state] of this.nodeStates.entries()) {
            if (!currentIdSet.has(id)) {
                const parent = state.node?.parent;
                const parentState = parent ? this.nodeStates.get(parent.id) : null;
                const destX = parentState ? parentState.targetX : (parent ? (isTB ? parent.x : parent.y) : srcTargetCx);
                const destY = parentState ? parentState.targetY : (parent ? (isTB ? parent.y : parent.x) : srcTargetCy);

                state.startX = state.x;
                state.startY = state.y;
                state.startOpacity = state.opacity;
                state.targetX = destX;
                state.targetY = destY;
                state.targetOpacity = 0;
                state.delay = 0; // Exiting nodes collapse without delay
                state.isExiting = true;
            }
        }

        // 3. requestAnimationFrame tick with cubic in-out deceleration easing
        const startTime = performance.now();
        const animDuration = Math.max(400, duration);

        const easeInOutCubic = (p) => {
            return p < 0.5
                ? 4 * p * p * p
                : 1 - Math.pow(-2 * p + 2, 3) / 2;
        };

        const tick = (now) => {
            const elapsed = now - startTime;
            let allCompleted = true;

            for (const state of this.nodeStates.values()) {
                const nodeElapsed = Math.max(0, elapsed - state.delay);
                const progress = Math.min(1, nodeElapsed / animDuration);
                const t = easeInOutCubic(progress);

                state.x = state.startX + (state.targetX - state.startX) * t;
                state.y = state.startY + (state.targetY - state.startY) * t;

                const opacityProgress = Math.min(1, progress * 1.25);
                const ot = easeInOutCubic(opacityProgress);
                state.opacity = state.startOpacity + (state.targetOpacity - state.startOpacity) * ot;

                if (progress < 1) {
                    allCompleted = false;
                }
            }

            this._drawCanvasFrame();

            if (!allCompleted) {
                this.animFrameId = requestAnimationFrame(tick);
            } else {
                this.animFrameId = null;
                // Clean up exiting nodes from state
                for (const [id, state] of this.nodeStates.entries()) {
                    if (state.isExiting) {
                        this.nodeStates.delete(id);
                    } else {
                        state.x = state.targetX;
                        state.y = state.targetY;
                        state.opacity = 1;
                    }
                }
                this._drawCanvasFrame();
            }
        };

        this.animFrameId = requestAnimationFrame(tick);
    }

    /**
     * Smoothly animates zoom & pan transitions on Canvas (for Fit View, Zoom In/Out, and Focus).
     */
    animateTransform(targetTransform, duration = 600, onUpdate = null) {
        if (!this.canvas || !this.ctx) return;

        if (this.transformAnimFrameId) {
            cancelAnimationFrame(this.transformAnimFrameId);
            this.transformAnimFrameId = null;
        }

        if (duration <= 0) {
            this.currentTransform = targetTransform;
            if (onUpdate) onUpdate(targetTransform.k);
            this._drawCanvasFrame();
            return;
        }

        const startX = this.currentTransform.x;
        const startY = this.currentTransform.y;
        const startK = this.currentTransform.k;
        const targetX = targetTransform.x;
        const targetY = targetTransform.y;
        const targetK = targetTransform.k;

        const startTime = performance.now();

        const easeInOutCubic = (p) => {
            return p < 0.5
                ? 4 * p * p * p
                : 1 - Math.pow(-2 * p + 2, 3) / 2;
        };

        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, Math.max(0, elapsed / duration));
            const t = easeInOutCubic(progress);

            const curX = startX + (targetX - startX) * t;
            const curY = startY + (targetY - startY) * t;
            const curK = startK + (targetK - startK) * t;

            this.currentTransform = d3.zoomIdentity.translate(curX, curY).scale(curK);
            if (onUpdate) onUpdate(curK);

            this._drawCanvasFrame();

            if (progress < 1) {
                this.transformAnimFrameId = requestAnimationFrame(tick);
            } else {
                this.transformAnimFrameId = null;
                this.currentTransform = targetTransform;
                if (onUpdate) onUpdate(targetK);
                this._drawCanvasFrame();
            }
        };

        this.transformAnimFrameId = requestAnimationFrame(tick);
    }

    /**
     * Immediate static render (used for mouse move, hover, zoom drag, and instant updates).
     */
    render(root, transform, config = {}) {
        if (!this.canvas || !this.ctx || !root) return;

        this.currentRoot = root;
        this.currentTransform = transform || this.currentTransform;
        this.currentConfig = config;

        // If any animation is currently running, cancel it so instant render takes effect
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.transformAnimFrameId) {
            cancelAnimationFrame(this.transformAnimFrameId);
            this.transformAnimFrameId = null;
        }

        const isTB = config.mode === 'tb';
        const descendants = root.descendants();
        const activeIds = new Set();

        for (let i = 0; i < descendants.length; i++) {
            const node = descendants[i];
            activeIds.add(node.id);
            const cx = isTB ? node.x : node.y;
            const cy = isTB ? node.y : node.x;

            let state = this.nodeStates.get(node.id);
            if (state) {
                state.node = node;
                state.x = cx;
                state.y = cy;
                state.opacity = 1;
                state.targetX = cx;
                state.targetY = cy;
                state.targetOpacity = 1;
                state.isExiting = false;
            } else {
                this.nodeStates.set(node.id, {
                    id: node.id,
                    node: node,
                    x: cx,
                    y: cy,
                    opacity: 1,
                    startX: cx,
                    startY: cy,
                    startOpacity: 1,
                    targetX: cx,
                    targetY: cy,
                    targetOpacity: 1,
                    delay: 0,
                    isExiting: false
                });
            }
        }

        for (const id of this.nodeStates.keys()) {
            if (!activeIds.has(id)) {
                this.nodeStates.delete(id);
            }
        }

        this._drawCanvasFrame();
    }

    _drawCanvasFrame() {
        if (!this.canvas || !this.ctx) return;

        const ctx = this.ctx;
        const dpr = this.dpr;
        const config = this.currentConfig;
        const isTB = config.mode === 'tb';
        const isDark = document.documentElement.classList.contains('dark');
        const isHighlightActive = Boolean(config.isHighlightPathActive && (config.selectedNodeRef || this.hoveredNode));

        // Clear canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply Retina scaling and zoom transform
        ctx.scale(dpr, dpr);
        ctx.translate(this.currentTransform.x, this.currentTransform.y);
        ctx.scale(this.currentTransform.k, this.currentTransform.k);

        // Calculate visible bounding box in world coordinates for Frustum Culling
        const k = this.currentTransform.k;
        const margin = 140;
        const viewport = {
            viewLeft: -this.currentTransform.x / k - margin,
            viewRight: (this.width - this.currentTransform.x) / k + margin,
            viewTop: -this.currentTransform.y / k - margin,
            viewBottom: (this.height - this.currentTransform.y) / k + margin
        };

        // 1. Draw connecting Bézier curves (with viewport culling and terminal dot markers)
        this._drawAnimatedLinks(ctx, isTB, isDark, isHighlightActive, config, viewport);

        // 2. Draw nodes (with viewport culling, hover reactive toggle buttons, and top-layer focus ring)
        this._drawAnimatedNodes(ctx, isTB, isDark, isHighlightActive, config, viewport);
    }

    _drawAnimatedLinks(ctx, isTB, isDark, isHighlightActive, config, viewport) {
        if (!this.currentRoot) return;

        const defaultColor = isDark ? '#334155' : '#cbd5e1';
        const highlightColor = isDark ? '#818cf8' : '#6366f1';

        // 1. Draw links between visible hierarchy nodes
        const links = this.currentRoot.links();
        const linkCount = links.length;

        for (let i = 0; i < linkCount; i++) {
            const link = links[i];
            const sourceState = this.nodeStates.get(link.source.id);
            const targetState = this.nodeStates.get(link.target.id);
            if (!sourceState || !targetState) continue;

            const alpha = Math.min(sourceState.opacity, targetState.opacity);
            if (alpha <= 0.001) continue;

            // Viewport culling: skip curve if outside visible screen
            if (viewport) {
                const minX = Math.min(sourceState.x, targetState.x) - NW;
                const maxX = Math.max(sourceState.x, targetState.x) + NW;
                const minY = Math.min(sourceState.y, targetState.y) - NH;
                const maxY = Math.max(sourceState.y, targetState.y) + NH;
                if (maxX < viewport.viewLeft || minX > viewport.viewRight ||
                    maxY < viewport.viewTop || minY > viewport.viewBottom) {
                    continue;
                }
            }

            const isHighlighted = isHighlightActive && config.isLinkHighlighted?.(link);
            const isDimmed = isHighlightActive && !isHighlighted;
            const strokeColor = isHighlighted ? highlightColor : defaultColor;
            const baseLineWidth = isHighlighted ? 2.6 : (isDimmed ? 1.0 : 1.5);
            const baseAlpha = isHighlighted ? 1.0 : (isDimmed ? 0.08 : 0.85);

            this._drawSingleCurve(ctx, sourceState, targetState, link.source, link.target, isTB, strokeColor, baseLineWidth, alpha * baseAlpha, isHighlighted);
        }

        // 2. Draw links for exiting nodes (smoothly collapsing back into their parent)
        for (const targetState of this.nodeStates.values()) {
            if (!targetState.isExiting) continue;
            const parent = targetState.node?.parent;
            if (!parent) continue;

            const sourceState = this.nodeStates.get(parent.id);
            if (!sourceState) continue;

            const alpha = targetState.opacity;
            if (alpha <= 0.001) continue;

            if (viewport) {
                const minX = Math.min(sourceState.x, targetState.x) - NW;
                const maxX = Math.max(sourceState.x, targetState.x) + NW;
                const minY = Math.min(sourceState.y, targetState.y) - NH;
                const maxY = Math.max(sourceState.y, targetState.y) + NH;
                if (maxX < viewport.viewLeft || minX > viewport.viewRight ||
                    maxY < viewport.viewTop || minY > viewport.viewBottom) {
                    continue;
                }
            }

            this._drawSingleCurve(ctx, sourceState, targetState, parent, targetState.node, isTB, defaultColor, 1.4, alpha * 0.7, false);
        }
    }

    _drawSingleCurve(ctx, sourceState, targetState, sourceNode, targetNode, isTB, strokeColor, lineWidth, alpha, isHighlighted = false) {
        ctx.save();
        ctx.beginPath();

        let sx, sy, tx, ty, mx, my;

        if (isTB) {
            sx = sourceState.x;
            sy = sourceState.y + NH / 2;
            tx = targetState.x;
            ty = targetState.y - NH / 2;
            my = (sy + ty) / 2;
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(sx, my, tx, my, tx, ty);
        } else {
            const sWidth = this._getNodeWidth(sourceNode);
            const tWidth = this._getNodeWidth(targetNode);
            sx = sourceState.x + sWidth / 2;
            sy = sourceState.y;
            tx = targetState.x - tWidth / 2;
            ty = targetState.y;
            mx = (sx + tx) / 2;
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(mx, sy, mx, ty, tx, ty);
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        if (isHighlighted) {
            ctx.shadowColor = strokeColor;
            ctx.shadowBlur = 6;
        }

        ctx.stroke();

        // Terminal circle dot on target end (matches SVG marker dot)
        ctx.beginPath();
        ctx.arc(tx, ty, isHighlighted ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();

        ctx.restore();
    }

    _isNodeFocused(node, config) {
        if (!node || !config) return false;

        if (config.focusedNodeId !== undefined && config.focusedNodeId !== null) {
            return node.id === config.focusedNodeId;
        }

        const focusedFullName = config.focusedNodeFullName;
        if (!focusedFullName) return false;

        const nameMatches = node.data?.fullName === focusedFullName || node.data?.name === focusedFullName;
        if (!nameMatches) return false;

        if (config.focusedNodeContextId && node.data?.contextId) {
            return node.data.contextId === config.focusedNodeContextId;
        }

        return true;
    }

    _drawAnimatedNodes(ctx, isTB, isDark, isHighlightActive, config, viewport) {
        const focusedCardsToDrawOnTop = [];

        for (const state of this.nodeStates.values()) {
            const node = state.node;
            const isFocused = this._isNodeFocused(node, config);

            // Focused node is never skipped due to low opacity
            if (!isFocused && state.opacity <= 0.001) continue;

            const width = this._getNodeWidth(node);
            const height = NH;

            const cx = state.x;
            const cy = state.y;

            // Viewport Culling: Skip off-screen nodes (focused node is NEVER culled!)
            if (!isFocused && viewport) {
                const minCx = Math.min(cx, state.targetX ?? cx);
                const maxCx = Math.max(cx, state.targetX ?? cx);
                const minCy = Math.min(cy, state.targetY ?? cy);
                const maxCy = Math.max(cy, state.targetY ?? cy);

                if (maxCx + width / 2 < viewport.viewLeft ||
                    minCx - width / 2 > viewport.viewRight ||
                    maxCy + height / 2 < viewport.viewTop ||
                    minCy - height / 2 > viewport.viewBottom) {
                    continue;
                }
            }

            // Defer focused card(s) to second pass so they render on top
            if (isFocused) {
                focusedCardsToDrawOnTop.push({ state, node, width, height, cx, cy });
                continue;
            }

            this._drawSingleNodeCard(ctx, state, node, width, height, cx, cy, isDark, isHighlightActive, config, false);
        }

        // Second pass: draw focused node(s) on top of sibling cards
        for (let j = 0; j < focusedCardsToDrawOnTop.length; j++) {
            const { state, node, width, height, cx, cy } = focusedCardsToDrawOnTop[j];
            this._drawSingleNodeCard(ctx, state, node, width, height, cx, cy, isDark, isHighlightActive, config, true);
        }
    }

    _drawSingleNodeCard(ctx, state, node, width, height, cx, cy, isDark, isHighlightActive, config, isFocused) {
        const style = BeanMetadataRules.nodeStyle(node);
        const x = cx - width / 2;
        const y = cy - height / 2;

        const isNodeHighlighted = !isHighlightActive || config.isNodeHighlighted?.(node);
        const isDimmed = isHighlightActive && !isNodeHighlighted;
        const isCardHovered = (this.hoveredNode === node);

        ctx.save();
        const effectiveOpacity = isFocused ? 1 : state.opacity;
        ctx.globalAlpha = Math.max(0, Math.min(1, effectiveOpacity * (isDimmed ? 0.12 : 1)));

        // 1. Card background
        ctx.beginPath();
        this._roundRect(ctx, x, y, width, height, RX);
        ctx.fillStyle = style.fill || (isDark ? '#0f172a' : '#ffffff');
        ctx.fill();

        // 2. Stroke and glow
        ctx.lineWidth = isFocused ? 3.5 : (isCardHovered ? 2.4 : 1.8);
        ctx.strokeStyle = isFocused ? (style.stroke || '#8b5cf6') : (style.stroke || '#94a3b8');

        if (isFocused) {
            ctx.shadowColor = style.stroke || '#8b5cf6';
            ctx.shadowBlur = 18;
        } else if (isCardHovered) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
            ctx.shadowBlur = 10;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 3. Icon Badge container
        ctx.beginPath();
        this._roundRect(ctx, x + 8, cy - 14, 28, 28, 8);
        ctx.fillStyle = style.iconBg || 'rgba(0,0,0,0.06)';
        ctx.fill();

        if (this._iconPath2D) {
            ctx.save();
            ctx.translate(x + 14, cy - 10);
            ctx.scale(0.85, 0.85);
            ctx.strokeStyle = style.icon || style.stroke || '#6366f1';
            ctx.lineWidth = 1.8;
            ctx.stroke(this._iconPath2D);
            ctx.restore();
        }

        // 4. Text Label
        const textX = x + 44;
        ctx.fillStyle = style.text || (isDark ? '#f1f5f9' : '#1e293b');
        ctx.font = '600 13px Inter, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const text = node.data?.name || '';
        ctx.fillText(text, textX, cy + 1);

        // 5. Expand / Collapse toggle badge with hover reactivity
        const hasChildren = this._hasNodeChildren(node);
        if (hasChildren) {
            const isExpanded = Boolean(node.children && node.children.length > 0);
            const toggleX = x + width - 18;
            const toggleY = cy;
            const isToggleHovered = (isCardHovered && this.hoveredToggle);

            ctx.beginPath();
            ctx.arc(toggleX, toggleY, 9.5, 0, Math.PI * 2);

            if (isToggleHovered) {
                // Interactive hover state: circle filled with stroke color, icon turns white
                ctx.fillStyle = style.stroke || '#94a3b8';
                ctx.fill();
                ctx.strokeStyle = style.stroke || '#94a3b8';
                ctx.lineWidth = 1.6;
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.6;
                ctx.moveTo(toggleX - 4, toggleY);
                ctx.lineTo(toggleX + 4, toggleY);
                if (!isExpanded) {
                    ctx.moveTo(toggleX, toggleY - 4);
                    ctx.lineTo(toggleX, toggleY + 4);
                }
                ctx.stroke();
            } else {
                // Default state
                ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
                ctx.fill();
                ctx.strokeStyle = style.stroke || '#94a3b8';
                ctx.lineWidth = 1.6;
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = style.stroke || '#94a3b8';
                ctx.lineWidth = 1.6;
                ctx.moveTo(toggleX - 4, toggleY);
                ctx.lineTo(toggleX + 4, toggleY);
                if (!isExpanded) {
                    ctx.moveTo(toggleX, toggleY - 4);
                    ctx.lineTo(toggleX, toggleY + 4);
                }
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    _roundRect(ctx, x, y, width, height, radius) {
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, width, height, radius);
        } else {
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x + radius, y);
            ctx.quadraticCurveTo(x, y + radius, x, y);
            ctx.closePath();
        }
    }

    _getNodeWidth(node) {
        if (node?.width) return node.width;
        const name = node?.data?.name || '';
        const avgCharWidth = 8.2;
        const hasChildren = this._hasNodeChildren(node);
        return Math.max(180, Math.ceil(name.length * avgCharWidth) + (hasChildren ? 88 : 64));
    }

    _hasNodeChildren(node) {
        if (!node) return false;
        if ((node.children && node.children.length > 0) || (node._children && node._children.length > 0)) return true;
        if (node.data?.hasChildren) return true;
        const deps = node.data?.dependencyNames;
        return Boolean(deps && deps.length > 0);
    }

    _getNodeAtScreenPosition(screenX, screenY) {
        if (!this.currentRoot || !this.currentTransform) return null;

        const isTB = this.currentConfig?.mode === 'tb';
        const k = this.currentTransform.k;
        const worldX = (screenX - this.currentTransform.x) / k;
        const worldY = (screenY - this.currentTransform.y) / k;

        const nodes = this.currentRoot.descendants();
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const width = this._getNodeWidth(node);
            const height = NH;

            const state = this.nodeStates?.get(node.id);
            if (state && state.opacity <= 0.1) continue;

            const cx = state ? state.x : (isTB ? node.x : node.y);
            const cy = state ? state.y : (isTB ? node.y : node.x);

            // Fast boundary check before any math
            if (worldX < cx - width / 2 || worldX > cx + width / 2 || worldY < cy - height / 2 || worldY > cy + height / 2) {
                continue;
            }

            // Check if toggle circle on the right side was targeted
            const toggleX = (cx + width / 2) - 18;
            const toggleY = cy;
            const distToToggle = Math.hypot(worldX - toggleX, worldY - toggleY);
            const isToggle = distToToggle <= 12;

            return { node, isToggle };
        }

        return null;
    }

    _bindEvents() {
        if (!this.canvas) return;

        // Track mousedown to differentiate between pan dragging and clicking
        this.canvas.addEventListener('mousedown', (event) => {
            this._dragStartX = event.clientX;
            this._dragStartY = event.clientY;
            this._isDragging = false;
        });

        this.canvas.addEventListener('click', (event) => {
            if (this._isDragging) {
                this._isDragging = false;
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;

            const hit = this._getNodeAtScreenPosition(screenX, screenY);
            if (hit) {
                if (hit.isToggle) {
                    this.onToggleClick(event, hit.node);
                } else {
                    this.onNodeClick(event, hit.node);
                }
            } else {
                this.onBackgroundClick(event);
            }
        });

        this.canvas.addEventListener('mousemove', (event) => {
            // Check if drag threshold is exceeded
            if (event.buttons !== 0) {
                const dist = Math.hypot(event.clientX - this._dragStartX, event.clientY - this._dragStartY);
                if (dist > 5) {
                    this._isDragging = true;
                }
            }

            const rect = this.canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;

            const hit = this._getNodeAtScreenPosition(screenX, screenY);
            const node = hit?.node || null;
            const isToggle = Boolean(hit?.isToggle);

            let needsRedraw = false;

            if (node !== this.hoveredNode || isToggle !== this.hoveredToggle) {
                this.hoveredNode = node;
                this.hoveredToggle = isToggle;
                this.canvas.style.cursor = node ? 'pointer' : 'default';

                if (node) {
                    this.onNodeHover(event, node);
                } else {
                    this.onNodeLeave();
                }

                needsRedraw = true;
            } else if (node) {
                this.onNodeHover(event, node);
            }

            if (needsRedraw && this.currentRoot && !this.animFrameId) {
                this._drawCanvasFrame();
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.hoveredNode) {
                this.hoveredNode = null;
                this.hoveredToggle = false;
                this.canvas.style.cursor = 'default';
                this.onNodeLeave();
                if (this.currentRoot && !this.animFrameId) {
                    this._drawCanvasFrame();
                }
            }
        });
    }

    destroy() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.transformAnimFrameId) {
            cancelAnimationFrame(this.transformAnimFrameId);
            this.transformAnimFrameId = null;
        }
        this.nodeStates.clear();
        this.currentRoot = null;
        this.hoveredNode = null;
    }
}
