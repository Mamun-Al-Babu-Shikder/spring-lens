import {
    GraphTreeBuilder,
    beanDataStore,
    httpClient,
    NH, RX, ICON, ZOOM_SCALE_EXTENT,
    GRAPH_NODE_THEMES_BADGE, QueryParam, ENDPOINTS
} from '../../helper/index.js';

export default class DefinitionGraphModalWidget {

    constructor(options = {}) {
        this.findBeanEndpoint = options.findBeanEndpoint || ENDPOINTS?.FIND_BEAN_DEFINITION;
        this.onSelectBean = options.onSelectBean;

        this.modalGraphMode = 'lr';
        this.canvas = null;
        this.ctx = null;
        this.d3Zoom = null;
        this.currentTransform = (typeof d3 !== 'undefined') ? d3.zoomIdentity : { x: 0, y: 0, k: 1 };
        this.dpr = window.devicePixelRatio || 1;
        this.width = 800;
        this.height = 500;

        this.modalGraphData = null;
        this.modalGraphNodes = [];
        this.links = [];
        this.headers = [];
        this.hoveredNode = null;
        this.iconPath2D = (typeof Path2D !== 'undefined' && ICON) ? new Path2D(ICON) : null;

        this.tooltipElement = null;
        this.tipName = null;
        this.tipType = null;
        this.tipScope = null;
        this.tipMeta = null;

        this.resizeObserver = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.isDragging = false;
    }

    initCanvas() {
        const canvasElem = document.getElementById('modal-tree-canvas');
        if (!canvasElem) return false;
        if (this.canvas === canvasElem && this.ctx) return true;

        this.canvas = canvasElem;
        this.ctx = canvasElem.getContext('2d');

        if (typeof d3 !== 'undefined') {
            this.d3Zoom = d3.zoom()
                .scaleExtent(ZOOM_SCALE_EXTENT || [0.05, 4])
                .on('zoom', ({ transform }) => {
                    this.currentTransform = transform;
                    if (this.hoveredNode) {
                        this.hoveredNode = null;
                        this.hideTooltip();
                    }
                    this.renderCurrent();
                });
            d3.select(this.canvas).call(this.d3Zoom);
            d3.select(this.canvas).on('dblclick.zoom', null);
        }

        this.canvas.addEventListener('mousedown', (event) => {
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            this.isDragging = false;
        });

        this.canvas.addEventListener('mousemove', (event) => {
            if (event.buttons !== 0) {
                const distance = Math.hypot(event.clientX - this.dragStartX, event.clientY - this.dragStartY);
                if (distance > 5) {
                    this.isDragging = true;
                    if (this.hoveredNode) {
                        this.hoveredNode = null;
                        this.hideTooltip();
                        this.renderCurrent();
                    }
                    return;
                }
            }
            if (this.isDragging) return;
            this._handleMouseMove(event);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredNode = null;
            this.hideTooltip();
            this.renderCurrent();
        });

        this.canvas.addEventListener('click', (event) => {
            if (this.isDragging) {
                this.isDragging = false;
                return;
            }
            this._handleClick(event);
        });

        const container = document.getElementById('modal-graph-container');
        if (container && typeof ResizeObserver !== 'undefined') {
            this.resizeObserver?.disconnect();
            this.resizeObserver = new ResizeObserver(() => {
                this.resize();
            });
            this.resizeObserver.observe(container);
        }

        return true;
    }

    async open(targetBean) {
        if (!targetBean) return;

        await this._prefetchRelatedBeans(targetBean);
        this.render(targetBean);
    }

    close() {
        this.hoveredNode = null;
        this.hideTooltip();
    }

    render(targetBean) {
        if (!targetBean) return;
        this.initCanvas();

        const rawData = GraphTreeBuilder.buildModalGraphHierarchy(
            targetBean,
            (depName, ctxId) => beanDataStore.findBeanByName(depName, ctxId)
        );
        this.modalGraphData = rawData;
        this._computeLayout(rawData);
        this.resize();
        this.renderCurrent();
        requestAnimationFrame(() => this.fitView());
    }

    renderCurrent() {
        if (!this.ctx || !this.canvas) return;

        const isDark = document.documentElement.classList.contains('dark');

        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.scale(this.dpr, this.dpr);
        this.ctx.translate(this.currentTransform.x, this.currentTransform.y);
        this.ctx.scale(this.currentTransform.k, this.currentTransform.k);

        this._drawScene(this.ctx, isDark, this.hoveredNode);
        this.ctx.restore();
    }

    setMode(mode) {
        if (this.modalGraphMode === mode) return;
        this.modalGraphMode = mode;

        if (this.modalGraphData) {
            this._computeLayout(this.modalGraphData);
            this.renderCurrent();
            this.fitView();
        }
    }

    fitView() {
        if (!this.canvas || !this.d3Zoom || !this.modalGraphNodes || this.modalGraphNodes.length === 0) return;

        const width = this.width || 800;
        const height = this.height || 500;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const node of this.modalGraphNodes) {
            const left = node.x - (node.width || 180) / 2;
            const right = node.x + (node.width || 180) / 2;
            const top = node.y - NH / 2 - 32;
            const bottom = node.y + NH / 2 + 10;

            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;
        }

        if (!Number.isFinite(minX)) return;

        const graphWidth = Math.max(1, maxX - minX);
        const graphHeight = Math.max(1, maxY - minY);

        let scale = Math.min(0.9, Math.min((width - 60) / graphWidth, (height - 60) / graphHeight));
        if (isNaN(scale) || !isFinite(scale) || scale <= 0) scale = 1;

        const translateX = width / 2 - ((minX + maxX) / 2) * scale;
        const translateY = height / 2 - ((minY + maxY) / 2) * scale;

        if (isNaN(translateX) || isNaN(translateY) || !isFinite(translateX) || !isFinite(translateY)) return;

        const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
        d3.select(this.canvas).transition().duration(400).call(this.d3Zoom.transform, transform);
    }

    zoom(scaleFactor) {
        if (this.canvas && this.d3Zoom) {
            d3.select(this.canvas).transition().duration(300).call(this.d3Zoom.scaleBy, scaleFactor);
        }
    }

    resize() {
        const container = document.getElementById('modal-graph-container');
        if (!container || !this.canvas) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return;

        this.width = width;
        this.height = height;
        this.dpr = window.devicePixelRatio || 1;

        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.renderCurrent();
    }

    async exportPNG({ pixelRatio = 2 } = {}) {
        if (!this.modalGraphNodes || this.modalGraphNodes.length === 0) return null;

        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff';

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const node of this.modalGraphNodes) {
            const left = node.x - (node.width || 180) / 2;
            const right = node.x + (node.width || 180) / 2;
            const top = node.y - NH / 2 - 32;
            const bottom = node.y + NH / 2 + 10;

            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;
        }

        if (!Number.isFinite(minX)) return null;

        const padding = 60;
        const contentWidth = Math.max(200, maxX - minX + padding * 2);
        const contentHeight = Math.max(160, maxY - minY + padding * 2);

        const maxDimension = 16384;
        let dpr = Math.max(1, pixelRatio);
        if (contentWidth * dpr > maxDimension || contentHeight * dpr > maxDimension) {
            dpr = Math.min(maxDimension / contentWidth, maxDimension / contentHeight);
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = Math.round(contentWidth * dpr);
        exportCanvas.height = Math.round(contentHeight * dpr);

        const exportCtx = exportCanvas.getContext('2d');
        if (!exportCtx) return null;

        exportCtx.fillStyle = bgColor;
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        exportCtx.scale(dpr, dpr);
        exportCtx.translate(-(minX - padding), -(minY - padding));

        this._drawScene(exportCtx, isDark, null);

        exportCtx.save();
        exportCtx.setTransform(1, 0, 0, 1, 0, 0);
        exportCtx.font = '500 ' + Math.max(10, Math.round(11 * (dpr > 1.5 ? 1.5 : dpr))) + 'px Inter, -apple-system, sans-serif';
        exportCtx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.65)';
        exportCtx.textAlign = 'right';
        exportCtx.textBaseline = 'bottom';
        const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        const targetName = this.modalGraphData?.target?.name || 'Bean';
        exportCtx.fillText(`SpringLens Bean Dependency Graph • ${targetName} • ${dateStr}`, exportCanvas.width - 20, exportCanvas.height - 16);
        exportCtx.restore();

        return new Promise((resolve) => {
            exportCanvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    destroy() {
        this.close();
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.modalGraphData = null;
        this.modalGraphNodes = [];
        this.links = [];
        this.headers = [];
        this.canvas = null;
        this.ctx = null;
        this.d3Zoom = null;
    }

    async _prefetchRelatedBeans(targetBean) {
        if (!this.findBeanEndpoint) return;

        const ctxId = targetBean.contextId || '';
        const relatedNames = [...(targetBean.dependencies || []), ...(targetBean.dependents || [])];
        const missingNames = relatedNames.filter(name => !beanDataStore.findBeanByName(name, ctxId));

        if (missingNames.length > 0) {
            try {
                const fetchPromises = missingNames.map(name => {
                    const query = QueryParam.build({ contextId: ctxId, beanName: name });
                    return httpClient.getWithQuery(this.findBeanEndpoint, query.toString());
                });

                const results = await Promise.allSettled(fetchPromises);
                const fetchedBeans = results.flatMap(r =>
                    (r.status === 'fulfilled' && r.value) ? [r.value] : []
                );

                if (fetchedBeans.length) {
                    beanDataStore.addBeans(fetchedBeans);
                }
            } catch (error) {
                console.warn('Failed to pre-fetch related bean details:', error);
            }
        }
    }

    _computeLayout(graphData) {
        if (!graphData || !graphData.target) return;

        const { target, dependencies = [], dependents = [] } = graphData;
        const isTB = this.modalGraphMode === 'tb';
        const isDark = document.documentElement.classList.contains('dark');

        const measureWidth = (node) => {
            const nameLen = node?.name?.length || 0;
            return Math.max(180, nameLen * 7.8 + 64);
        };

        target.width = measureWidth(target);
        target.id = 'target-node';

        dependencies.forEach((node, i) => {
            node.id = `dep-${i}`;
            node.width = measureWidth(node);
        });

        dependents.forEach((node, i) => {
            node.id = `dependent-${i}`;
            node.width = measureWidth(node);
        });

        this.headers = [];
        const depNodes = dependencies;
        const dependentNodes = dependents;

        if (isTB) {
            target.x = 0;
            target.y = 0;

            const nodeGap = 28;
            const vGap = 80;
            const depRowY = -(NH / 2) - vGap - (NH / 2);
            const dependentRowY = (NH / 2) + vGap + (NH / 2);

            if (depNodes.length > 0) {
                const depTotalW = depNodes.reduce((sum, d) => sum + d.width, 0) + (depNodes.length - 1) * nodeGap;
                let curDepX = -depTotalW / 2;
                depNodes.forEach((node) => {
                    node.x = curDepX + node.width / 2;
                    node.y = depRowY;
                    curDepX += node.width + nodeGap;
                });
                this.headers.push({
                    text: `DEPENDENCIES (${dependencies.length})`,
                    x: 0,
                    y: depRowY - NH / 2 - 22,
                    color: isDark ? '#34d399' : '#059669'
                });
            }

            this.headers.push({
                text: 'TARGET BEAN',
                x: 0,
                y: target.y - NH / 2 - 22,
                color: isDark ? '#60a5fa' : '#2563eb'
            });

            if (dependentNodes.length > 0) {
                const dependentTotalW = dependentNodes.reduce((sum, d) => sum + d.width, 0) + (dependentNodes.length - 1) * nodeGap;
                let curDependentX = -dependentTotalW / 2;
                dependentNodes.forEach((node) => {
                    node.x = curDependentX + node.width / 2;
                    node.y = dependentRowY;
                    curDependentX += node.width + nodeGap;
                });
                this.headers.push({
                    text: `DEPENDENTS (${dependents.length})`,
                    x: 0,
                    y: dependentRowY - NH / 2 - 22,
                    color: isDark ? '#c084fc' : '#9333ea'
                });
            }
        } else {
            target.x = 0;
            target.y = 0;

            const hGap = 110;
            const rowHeight = NH + 22;

            if (depNodes.length > 0) {
                const maxDepWidth = Math.max(...depNodes.map(d => d.width), 180);
                const depColCenterX = -(target.width / 2) - hGap - (maxDepWidth / 2);
                const depTotalH = (depNodes.length - 1) * rowHeight;
                depNodes.forEach((node, i) => {
                    node.x = depColCenterX;
                    node.y = -depTotalH / 2 + i * rowHeight;
                });
                const minDepY = Math.min(...depNodes.map(d => d.y));
                this.headers.push({
                    text: `DEPENDENCIES (${dependencies.length})`,
                    x: depColCenterX,
                    y: minDepY - NH / 2 - 22,
                    color: isDark ? '#34d399' : '#059669'
                });
            }

            this.headers.push({
                text: 'TARGET BEAN',
                x: 0,
                y: target.y - NH / 2 - 22,
                color: isDark ? '#60a5fa' : '#2563eb'
            });

            if (dependentNodes.length > 0) {
                const maxDependentWidth = Math.max(...dependentNodes.map(d => d.width), 180);
                const dependentColCenterX = (target.width / 2) + hGap + (maxDependentWidth / 2);
                const dependentTotalH = (dependents.length - 1) * rowHeight;
                dependentNodes.forEach((node, i) => {
                    node.x = dependentColCenterX;
                    node.y = -dependentTotalH / 2 + i * rowHeight;
                });
                const minDependentY = Math.min(...dependentNodes.map(d => d.y));
                this.headers.push({
                    text: `DEPENDENTS (${dependents.length})`,
                    x: dependentColCenterX,
                    y: minDependentY - NH / 2 - 22,
                    color: isDark ? '#c084fc' : '#9333ea'
                });
            }
        }

        this.links = [];
        dependencies.forEach(dep => {
            this.links.push({
                source: dep,
                target: target,
                kind: 'dependency'
            });
        });
        dependents.forEach(dependent => {
            this.links.push({
                source: target,
                target: dependent,
                kind: 'dependent'
            });
        });

        this.modalGraphNodes = [target, ...dependencies, ...dependents];
    }

    _drawScene(ctx, isDark, hoveredNode = null) {
        const isTB = this.modalGraphMode === 'tb';

        for (const header of this.headers) {
            ctx.save();
            ctx.font = '700 11px Inter, -apple-system, sans-serif';
            ctx.fillStyle = header.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(header.text, header.x, header.y);
            ctx.restore();
        }

        for (const link of this.links) {
            const isDependency = link.kind === 'dependency';
            const strokeColor = isDependency
                ? (isDark ? '#34d399' : '#059669')
                : (isDark ? '#c084fc' : '#9333ea');

            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = strokeColor;
            ctx.lineWidth = 1.8;
            ctx.globalAlpha = 0.85;

            let sx, sy, tx, ty, mx, my;
            if (isTB) {
                sx = link.source.x;
                sy = link.source.y + NH / 2;
                tx = link.target.x;
                ty = link.target.y - NH / 2;
                my = (sy + ty) / 2;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.bezierCurveTo(sx, my, tx, my, tx, ty);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx - 4.5, ty - 8);
                ctx.lineTo(tx + 4.5, ty - 8);
                ctx.closePath();
                ctx.fill();
            } else {
                sx = link.source.x + link.source.width / 2;
                sy = link.source.y;
                tx = link.target.x - link.target.width / 2;
                ty = link.target.y;
                mx = (sx + tx) / 2;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.bezierCurveTo(mx, sy, mx, ty, tx, ty);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx - 8, ty - 4.5);
                ctx.lineTo(tx - 8, ty + 4.5);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        const mode = isDark ? 'dark' : 'light';
        const modeMap = GRAPH_NODE_THEMES_BADGE?.[mode] || GRAPH_NODE_THEMES_BADGE.light;

        for (const node of this.modalGraphNodes) {
            const kind = node?.meta?.kind || (node.id === 'target-node' ? 'target' : 'default');
            const style = modeMap[kind] || modeMap.default;
            const isHovered = (hoveredNode === node);
            const isTarget = (node.id === 'target-node');
            const x = node.x - node.width / 2;
            const y = node.y - NH / 2;

            ctx.save();
            ctx.beginPath();
            this._roundRect(ctx, x, y, node.width, NH, RX);
            ctx.fillStyle = style.fill || (isDark ? '#0f172a' : '#ffffff');
            ctx.fill();

            ctx.lineWidth = isTarget ? 2.5 : (isHovered ? 2.4 : 1.8);
            ctx.strokeStyle = style.stroke || '#3b82f6';
            if (isHovered) {
                ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.18)';
                ctx.shadowBlur = 10;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.beginPath();
            this._roundRect(ctx, x + 8, node.y - 14, 28, 28, 8);
            ctx.fillStyle = style.iconBg || (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)');
            ctx.fill();

            if (this.iconPath2D) {
                ctx.save();
                ctx.translate(x + 14, node.y - 10);
                ctx.scale(0.85, 0.85);
                ctx.strokeStyle = style.icon || style.stroke || '#3b82f6';
                ctx.lineWidth = 1.8;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke(this.iconPath2D);
                ctx.restore();
            }

            ctx.fillStyle = style.text || (isDark ? '#f1f5f9' : '#1e293b');
            ctx.font = '600 13px Inter, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name || '', x + 44, node.y + 1);

            ctx.restore();
        }
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

    _handleMouseMove(event) {
        if (!this.canvas || !this.modalGraphNodes || this.modalGraphNodes.length === 0) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let worldX = mouseX;
        let worldY = mouseY;
        if (this.currentTransform && typeof this.currentTransform.invert === 'function') {
            [worldX, worldY] = this.currentTransform.invert([mouseX, mouseY]);
        }

        const hitNode = this._findNodeAt(worldX, worldY);

        if (hitNode) {
            this.canvas.style.cursor = 'pointer';

            if (this.hoveredNode !== hitNode) {
                this.hoveredNode = hitNode;
                this.renderCurrent();
            }

            this.showTooltip(mouseX, mouseY, hitNode);
        } else {
            this.canvas.style.cursor = '';
            if (this.hoveredNode !== null) {
                this.hoveredNode = null;
                this.hideTooltip();
                this.renderCurrent();
            }
        }
    }

    showTooltip(mouseX, mouseY, node) {
        if (!this.tooltipElement) {
            this.tooltipElement = document.getElementById('modal-graph-tooltip');
            this.tipName = document.getElementById('modal-tip-name');
            this.tipType = document.getElementById('modal-tip-type');
            this.tipScope = document.getElementById('modal-tip-scope');
            this.tipMeta = document.getElementById('modal-tip-meta');
        }
        if (!this.tooltipElement) return;

        const { name, fullName, meta = {} } = node;
        const { type, scope, role, kind } = meta;

        const shortType = (type && type !== 'N/A')
            ? (type.includes('.') ? type.slice(type.lastIndexOf('.') + 1) : type)
            : (type || 'N/A');
        const typeLabel = `Type: ${shortType}`;

        const cleanRole = (role && role !== 'N/A') ? role.replace(/^ROLE_/, '') : '';
        const displayScope = (scope && scope !== 'N/A') ? scope : 'N/A';
        const scopeLabel = `Scope: ${displayScope}${cleanRole ? ` · ${cleanRole}` : ''}`;
        const kindLabel = kind ? `Role in view: ${kind.toUpperCase()}` : '';

        if (this.tipName) this.tipName.textContent = fullName || name || '-';
        if (this.tipType) this.tipType.textContent = typeLabel;
        if (this.tipScope) this.tipScope.textContent = scopeLabel;
        if (this.tipMeta) {
            this.tipMeta.textContent = kindLabel;
            this.tipMeta.style.display = kindLabel ? 'block' : 'none';
        }

        const container = document.getElementById('modal-graph-container');
        const containerWidth = container?.clientWidth || 800;
        const containerHeight = container?.clientHeight || 500;
        const tipWidth = this.tooltipElement.offsetWidth || 260;
        const tipHeight = this.tooltipElement.offsetHeight || 110;

        let tipX = mouseX + 28;
        let tipY = mouseY + 22;

        if (tipX + tipWidth > containerWidth - 12) {
            tipX = Math.max(12, mouseX - tipWidth - 16);
        }

        if (tipY + tipHeight > containerHeight - 12) {
            tipY = Math.max(12, mouseY - tipHeight - 16);
        }

        this.tooltipElement.style.left = `${Math.round(tipX)}px`;
        this.tooltipElement.style.top = `${Math.round(tipY)}px`;
        this.tooltipElement.classList.remove('hidden');
    }

    hideTooltip() {
        if (!this.tooltipElement) {
            this.tooltipElement = document.getElementById('modal-graph-tooltip');
        }
        if (this.tooltipElement) {
            this.tooltipElement.classList.add('hidden');
        }
    }

    _handleClick(event) {
        if (!this.canvas || !this.modalGraphNodes) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let worldX = mouseX;
        let worldY = mouseY;
        if (this.currentTransform && typeof this.currentTransform.invert === 'function') {
            [worldX, worldY] = this.currentTransform.invert([mouseX, mouseY]);
        }

        const hitNode = this._findNodeAt(worldX, worldY);
        if (hitNode?.fullName) {
            this.onSelectBean?.(hitNode.fullName);
        }
    }

    _findNodeAt(worldX, worldY) {
        if (!this.modalGraphNodes) return null;

        for (let i = this.modalGraphNodes.length - 1; i >= 0; i--) {
            const node = this.modalGraphNodes[i];
            const halfWidth = (node.width || 180) / 2;
            const halfHeight = NH / 2;

            if (
                worldX >= node.x - halfWidth &&
                worldX <= node.x + halfWidth &&
                worldY >= node.y - halfHeight &&
                worldY <= node.y + halfHeight
            ) {
                return node;
            }
        }

        return null;
    }
}
