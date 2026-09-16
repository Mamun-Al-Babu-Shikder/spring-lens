import {
    GraphTreeBuilder,
    beanDataStore,
    httpClient,
    NH, RX, ICON, ZOOM_SCALE_EXTENT,
    GRAPH_NODE_THEMES_BADGE, QueryParam, ENDPOINTS
} from '../../helper/index.js';

/**
 * Widget responsible for the interactive D3 dependency/dependent tree modal,
 * supporting Top-to-Bottom and Left-to-Right layout modes, node inspection,
 * zooming, and tooltip cards.
 */
export default class DefinitionGraphModalWidget {

    /**
     * @param {Object} [options]
     * @param {string} [options.findBeanEndpoint]
     * @param {Function} [options.onSelectBean] - Callback when a node is clicked in graph.
     */
    constructor(options = {}) {
        this.findBeanEndpoint = options.findBeanEndpoint || ENDPOINTS?.FIND_BEAN_DEFINITION;
        this.onSelectBean = options.onSelectBean;
        this.onTooltipChange = options.onTooltipChange;

        this.modalGraphMode = 'lr';
        this.modalZoom = null;
        this.modalSvg = null;
        this.modalGraphData = null;
        this.modalGraphNodes = [];
    }

    async open(targetBean) {
        if (!targetBean) return;

        await this._prefetchRelatedBeans(targetBean);
        this.render(targetBean);
    }

    close() {
        this.onTooltipChange?.({ visible: false });
    }

    /**
     * Renders D3 hierarchy visualization for the target bean.
     * @param {Object} targetBean
     */
    render(targetBean) {
        if (!targetBean) return;
        if (typeof d3 === 'undefined') return;

        const svg = d3.select('#modal-tree-svg');
        if (!svg.node()) return;

        svg.selectAll('*').remove();

        const isDark = document.documentElement.classList.contains('dark');
        const defs = svg.append('defs');

        const createArrowMarker = (id, color) => {
            defs.append('marker')
                .attr('id', id)
                .attr('viewBox', '0 0 10 10')
                .attr('refX', 8)
                .attr('refY', 5)
                .attr('markerUnits', 'userSpaceOnUse')
                .attr('markerWidth', 8)
                .attr('markerHeight', 8)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
                .attr('fill', color);
        };

        createArrowMarker('modal-arrow-dependency', isDark ? '#34d399' : '#059669');
        createArrowMarker('modal-arrow-dependent', isDark ? '#c084fc' : '#9333ea');
        createArrowMarker('modal-arrow-default', isDark ? '#64748b' : '#94a3b8');

        defs.append('marker')
            .attr('id', 'modal-dot')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 9)
            .attr('refY', 5)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', 10)
            .attr('markerHeight', 10)
            .attr('orient', 'auto')
            .append('circle')
            .attr('cx', 5)
            .attr('cy', 5)
            .attr('r', 4)
            .attr('fill', isDark ? '#64748b' : '#94a3b8');

        const gMain = svg.append('g').attr('id', 'modal-g-main');
        const gHeader = gMain.append('g').attr('class', 'tier-headers');
        const gLink = gMain.append('g').attr('class', 'links');
        const gNode = gMain.append('g').attr('class', 'nodes');

        const zoom = d3.zoom()
            .scaleExtent(ZOOM_SCALE_EXTENT || [0.05, 4])
            .on('zoom', ({ transform }) => gMain.attr('transform', transform));

        svg.call(zoom);
        this.modalZoom = zoom;
        this.modalSvg = svg;

        const rawData = GraphTreeBuilder.buildModalGraphHierarchy(
            targetBean,
            (depName, ctxId) => beanDataStore.findBeanByName(depName, ctxId)
        );
        this.modalGraphData = rawData;
        this.modalGraphMode = this.modalGraphMode || 'lr';

        this._drawModalTree(rawData, gNode, gLink, svg, zoom, gHeader);
    }

    /**
     * Changes graph layout mode ('tb' or 'lr').
     * @param {'tb'|'lr'} mode
     */
    setMode(mode) {
        if (this.modalGraphMode === mode) return;
        this.modalGraphMode = mode;

        if (this.modalGraphData && this.modalSvg) {
            this._drawModalTree(
                this.modalGraphData,
                this.modalSvg.select('g.nodes'),
                this.modalSvg.select('g.links'),
                this.modalSvg,
                this.modalZoom,
                this.modalSvg.select('g.tier-headers')
            );
        }
    }

    /**
     * Fits modal view to bounding box of rendered nodes.
     */
    fitView() {
        if (!this.modalSvg || !this.modalZoom || !this.modalGraphNodes) return;
        const svgNode = this.modalSvg.node();
        if (!svgNode || !svgNode.isConnected) return;

        const container = document.getElementById('modal-graph-container');
        const width = container?.clientWidth || 800;
        const height = container?.clientHeight || 500;

        const nodes = this.modalGraphNodes;
        if (!nodes || nodes.length === 0) return;

        const minX = d3.min(nodes, d => d.x - (d.width || 180) / 2) ?? -200;
        const maxX = d3.max(nodes, d => d.x + (d.width || 180) / 2) ?? 200;
        const minY = d3.min(nodes, d => d.y - NH / 2 - 32) ?? -100;
        const maxY = d3.max(nodes, d => d.y + NH / 2 + 10) ?? 100;

        const graphWidth = (maxX - minX) || 1;
        const graphHeight = (maxY - minY) || 1;

        let scale = Math.min(0.9, Math.min((width - 60) / graphWidth, (height - 60) / graphHeight));
        if (isNaN(scale) || !isFinite(scale) || scale <= 0) scale = 1;

        const translateX = width / 2 - ((minX + maxX) / 2) * scale;
        const translateY = height / 2 - ((minY + maxY) / 2) * scale;

        if (isNaN(translateX) || isNaN(translateY) || !isFinite(translateX) || !isFinite(translateY)) return;

        const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
        this.modalSvg.transition().duration(400).call(this.modalZoom.transform, transform);
    }

    /**
     * Scales modal zoom by given factor.
     * @param {number} scaleFactor
     */
    zoom(scaleFactor) {
        if (this.modalSvg && this.modalZoom) {
            this.modalSvg.transition().duration(300).call(this.modalZoom.scaleBy, scaleFactor);
        }
    }

    /**
     * Teardown and resource cleanup.
     */
    destroy() {
        this.close();
        this.modalGraphData = null;
        this.modalGraphNodes = [];
        this.modalSvg = null;
        this.modalZoom = null;
    }

    /**
     * @private
     */
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

    /**
     * @private
     */
    _drawModalTree(graphData, gNode, gLink, svg, zoom, gHeader = null) {
        if (!gNode || !gLink || !graphData || !graphData.target) return;
        gNode.selectAll('*').remove();
        gLink.selectAll('*').remove();

        const actualHeader = gHeader || svg.select('g.tier-headers');
        if (actualHeader && actualHeader.node()) {
            actualHeader.selectAll('*').remove();
        }

        const { target, dependencies = [], dependents = [] } = graphData;
        const isTB = this.modalGraphMode === 'tb';
        const isDark = document.documentElement.classList.contains('dark');

        const calcWidth = (node) => {
            const nameLen = node?.name?.length || 0;
            return Math.max(180, nameLen * 7.8 + 64);
        };

        target.width = calcWidth(target);
        target.id = 'target-node';

        dependencies.forEach((node, i) => {
            node.id = `dep-${i}`;
            node.width = calcWidth(node);
        });

        dependents.forEach((node, i) => {
            node.id = `dependent-${i}`;
            node.width = calcWidth(node);
        });

        const depNodes = dependencies;
        const dependentNodes = dependents;
        let headers = [];

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
                headers.push({ text: `DEPENDENCIES (${dependencies.length})`, x: 0, y: depRowY - NH / 2 - 22, color: isDark ? '#34d399' : '#059669' });
            }

            headers.push({ text: 'TARGET BEAN', x: 0, y: target.y - NH / 2 - 22, color: isDark ? '#60a5fa' : '#2563eb' });

            if (dependentNodes.length > 0) {
                const dependentTotalW = dependentNodes.reduce((sum, d) => sum + d.width, 0) + (dependentNodes.length - 1) * nodeGap;
                let curDependentX = -dependentTotalW / 2;
                dependentNodes.forEach((node) => {
                    node.x = curDependentX + node.width / 2;
                    node.y = dependentRowY;
                    curDependentX += node.width + nodeGap;
                });
                headers.push({ text: `DEPENDENTS (${dependents.length})`, x: 0, y: dependentRowY - NH / 2 - 22, color: isDark ? '#c084fc' : '#9333ea' });
            }
        } else {
            target.x = 0;
            target.y = 0;

            const hGap = 110;
            const rowHeight = NH + 22;

            if (depNodes.length > 0) {
                const maxDepWidth = d3.max(depNodes, d => d.width) || 180;
                const depColCenterX = -(target.width / 2) - hGap - (maxDepWidth / 2);
                const depTotalH = (depNodes.length - 1) * rowHeight;
                depNodes.forEach((node, i) => {
                    node.x = depColCenterX;
                    node.y = -depTotalH / 2 + i * rowHeight;
                });
                const minDepY = d3.min(depNodes, d => d.y) ?? 0;
                headers.push({ text: `DEPENDENCIES (${dependencies.length})`, x: depColCenterX, y: minDepY - NH / 2 - 22, color: isDark ? '#34d399' : '#059669' });
            }

            headers.push({ text: 'TARGET BEAN', x: 0, y: target.y - NH / 2 - 22, color: isDark ? '#60a5fa' : '#2563eb' });

            if (dependentNodes.length > 0) {
                const maxDependentWidth = d3.max(dependentNodes, d => d.width) || 180;
                const dependentColCenterX = (target.width / 2) + hGap + (maxDependentWidth / 2);
                const dependentTotalH = (dependents.length - 1) * rowHeight;
                dependentNodes.forEach((node, i) => {
                    node.x = dependentColCenterX;
                    node.y = -dependentTotalH / 2 + i * rowHeight;
                });
                const minDependentY = d3.min(dependentNodes, d => d.y) ?? 0;
                headers.push({ text: `DEPENDENTS (${dependents.length})`, x: dependentColCenterX, y: minDependentY - NH / 2 - 22, color: isDark ? '#c084fc' : '#9333ea' });
            }
        }

        if (actualHeader && actualHeader.node()) {
            actualHeader.selectAll('text.tier-header')
                .data(headers)
                .join('text')
                .attr('class', 'tier-header')
                .attr('x', d => d.x)
                .attr('y', d => d.y)
                .attr('text-anchor', 'middle')
                .attr('font-size', 11)
                .attr('font-weight', 700)
                .attr('letter-spacing', '0.06em')
                .attr('font-family', 'Inter, -apple-system, sans-serif')
                .attr('fill', d => d.color)
                .text(d => d.text);
        }

        // Links
        const links = [];
        if (dependencies.length > 0) {
            dependencies.forEach(dep => {
                links.push({
                    id: `${dep.id}->${target.id}`,
                    source: dep,
                    target: target,
                    kind: 'dependency'
                });
            });
        }
        if (dependents.length > 0) {
            dependents.forEach(dependent => {
                links.push({
                    id: `${target.id}->${dependent.id}`,
                    source: target,
                    target: dependent,
                    kind: 'dependent'
                });
            });
        }

        const linkFn = (d) => {
            if (isTB) {
                const sx = d.source.x;
                const sy = d.source.y + NH / 2;
                const tx = d.target.x;
                const ty = d.target.y - NH / 2;
                const my = (sy + ty) / 2;
                return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
            } else {
                const sx = d.source.x + d.source.width / 2;
                const sy = d.source.y;
                const tx = d.target.x - d.target.width / 2;
                const ty = d.target.y;
                const mx = (sx + tx) / 2;
                return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
            }
        };

        gLink.selectAll('path.link')
            .data(links, d => d.id)
            .join('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('stroke', d => {
                if (d.kind === 'dependency') return isDark ? '#059669' : '#10b981';
                if (d.kind === 'dependent') return isDark ? '#9333ea' : '#a855f7';
                return isDark ? '#475569' : '#94a3b8';
            })
            .attr('stroke-width', 1.8)
            .attr('stroke-opacity', 0.85)
            .attr('marker-end', d => `url(#modal-arrow-${d.kind})`)
            .attr('d', linkFn);

        const allNodes = [target, ...dependencies, ...dependents];
        this.modalGraphNodes = allNodes;

        const getModalNodeStyle = (node) => {
            const kind = node?.meta?.kind || 'default';
            const mode = isDark ? 'dark' : 'light';
            const modeMap = GRAPH_NODE_THEMES_BADGE?.[mode] || GRAPH_NODE_THEMES_BADGE.light;
            return modeMap[kind] || modeMap.default || {
                fill: isDark ? '#0f172a' : '#ffffff',
                stroke: '#3b82f6',
                icon: '#2563eb',
                text: isDark ? '#f1f5f9' : '#1e293b',
                iconBg: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'
            };
        };

        const nodes = gNode.selectAll('g.node')
            .data(allNodes, d => d.id)
            .join('g')
            .attr('class', 'node cursor-pointer')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        nodes.append('rect')
            .attr('class', 'node-rect')
            .attr('x', d => -d.width / 2)
            .attr('y', -NH / 2)
            .attr('width', d => d.width)
            .attr('height', NH)
            .attr('rx', RX)
            .attr('fill', d => getModalNodeStyle(d).fill)
            .attr('stroke', d => getModalNodeStyle(d).stroke)
            .attr('stroke-width', d => d.meta?.kind === 'target' ? 2.5 : 1.8);

        nodes.append('rect')
            .attr('class', 'node-icon-bg')
            .attr('x', d => -d.width / 2 + 8)
            .attr('y', -14)
            .attr('width', 28)
            .attr('height', 28)
            .attr('rx', 8)
            .attr('fill', d => getModalNodeStyle(d).iconBg ?? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'));

        nodes.append('g')
            .attr('class', 'node-icon')
            .attr('transform', d => `translate(${-d.width / 2 + 12}, -10)`)
            .append('path')
            .attr('d', ICON)
            .attr('stroke', d => getModalNodeStyle(d).icon)
            .attr('stroke-width', 1.8)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('fill', 'none');

        nodes.append('text')
            .attr('class', 'node-text')
            .attr('x', d => -d.width / 2 + 44)
            .attr('y', 1)
            .attr('dy', '0.35em')
            .attr('font-size', 13)
            .attr('font-weight', 600)
            .attr('font-family', 'Inter, -apple-system, sans-serif')
            .attr('fill', d => getModalNodeStyle(d).text)
            .text(d => d.name);

        const container = document.getElementById('modal-graph-container');
        const tipEl = document.getElementById('modal-graph-tooltip');

        const getCoords = (event) => {
            if (container) {
                const rect = container.getBoundingClientRect();
                return {
                    x: Math.round(event.clientX - rect.left + 14),
                    y: Math.round(event.clientY - rect.top + 16)
                };
            }
            return { x: 0, y: 0 };
        };

        nodes
            .on('click', async (event, node) => {
                event.stopPropagation();
                if (node.fullName) {
                    await this.onSelectBean?.(node.fullName);
                }
            })
            .on('mouseenter', (event, node) => {
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

                const { x, y } = getCoords(event);
                if (tipEl) {
                    tipEl.style.left = `${x}px`;
                    tipEl.style.top = `${y}px`;
                }

                this.onTooltipChange?.({
                    visible: true,
                    x,
                    y,
                    name: fullName || name,
                    type: typeLabel,
                    scope: scopeLabel,
                    meta: kindLabel
                });
            })
            .on('mousemove', (event) => {
                const { x, y } = getCoords(event);
                if (tipEl) {
                    tipEl.style.left = `${x}px`;
                    tipEl.style.top = `${y}px`;
                }
            })
            .on('mouseleave', () => {
                this.onTooltipChange?.({ visible: false });
            });

        setTimeout(() => this.fitView(), 50);
    }
}
