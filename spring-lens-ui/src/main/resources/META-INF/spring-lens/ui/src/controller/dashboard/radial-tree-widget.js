import { GraphTreeBuilder, BeanMetadataRules, TemplateEngine } from '../../helper/index.js';

/**
 * Widget responsible for the Interactive D3 Force-Directed Tree visualization,
 * node physics simulation, zoom mechanics, drag interaction, path tracing,
 * and glassmorphism hover tooltips.
 */
export default class RadialTreeWidget {

    constructor() {
        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;
        this.forceSimulation = null;
        this.dependenciesData = null;
    }

    /**
     * Renders or refreshes the Interactive D3 Force-Directed Tree.
     * @param {Object} [dependenciesResponse]
     */
    render(dependenciesResponse = this.dependenciesData) {
        if (!dependenciesResponse) return;
        this.dependenciesData = dependenciesResponse;

        const $dbRadialLoading = $('#db-radial-loading');
        const items = dependenciesResponse?.content ?? [];
        const $svg = $('#db-radial-tree-svg');
        const svgNode = $svg[0];
        if (!svgNode) return;

        if (items.length === 0) {
            $dbRadialLoading.addClass('hidden');
            $('#db-radial-stats').text('No dependencies found');
            return;
        }

        try {
            if (this.forceSimulation) {
                this.forceSimulation.stop();
                this.forceSimulation = null;
            }

            const treeData = GraphTreeBuilder.buildByContext(items);
            if (!treeData) {
                $dbRadialLoading.addClass('hidden');
                return;
            }

            const width = svgNode.clientWidth || 400;
            const height = svgNode.clientHeight || 340;

            const isDark = document.documentElement.classList.contains('dark');
            const defaultLinkStroke = isDark ? '#334155' : '#cbd5e1';
            const rootLinkStroke = '#10b981';

            const hierarchy = d3.hierarchy(treeData);
            const nodes = hierarchy.descendants();
            const links = hierarchy.links();
            const totalNodes = nodes.length;
            const treeDepth = hierarchy.height;
            $('#db-radial-stats').text(`${totalNodes} Beans • ${treeDepth} Levels • Hover or drag nodes`);

            const svg = d3.select(svgNode);
            svg.selectAll('*').remove();

            const getNodeColor = (d) => {
                if (d.depth === 0) return '#10b981';
                const text = `${d.data?.name || ''} ${d.data?.meta?.type || d.data?.type || ''}`.toLowerCase();
                if (/service/.test(text)) return '#34d399';
                if (/repo|data|entity|repository/.test(text)) return '#fbbf24';
                if (/controller|web|rest|endpoint/.test(text)) return '#f472b6';
                if (/config|security|filter|properties/.test(text)) return '#c084fc';
                return '#60a5fa';
            };

            // Main Zoomable SVG Group
            const g = svg.append('g');

            // Zoom Handling (with default zoomed-in view)
            const zoom = d3.zoom()
                .scaleExtent([0.25, 5.0])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });

            const initialScale = 1.30;
            const initialTransform = d3.zoomIdentity
                .translate((width / 2) * (1 - initialScale), (height / 2) * (1 - initialScale))
                .scale(initialScale);

            this.radialZoom = zoom;
            this.radialSvg = svg;
            this.radialInitialTransform = initialTransform;

            svg.call(zoom).call(zoom.transform, initialTransform);

            // 1. Render Links Group
            const linksGroup = g.append('g').attr('class', 'tree-links');
            const linkSelection = linksGroup.selectAll('line')
                .data(links)
                .join('line')
                .attr('class', 'tree-link')
                .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
                .attr('stroke-opacity', 0.45)
                .attr('stroke-width', 0.75)
                .attr('stroke-linecap', 'round');

            // 2. Render Nodes Group
            const nodesGroup = g.append('g').attr('class', 'tree-nodes');
            const nodeGroups = nodesGroup.selectAll('g')
                .data(nodes)
                .join('g')
                .attr('class', 'tree-node select-none');

            // Node Rendering
            nodeGroups.each(function (d) {
                const nodeEl = d3.select(this);
                const hasChildren = Boolean(d.children && d.children.length > 0);
                const isRoot = d.depth === 0;
                const nodeColor = getNodeColor(d);
                const radius = isRoot ? 6.2 : (hasChildren ? 5.4 : 4.2);

                nodeEl.append('circle')
                    .attr('class', 'node-dot')
                    .attr('r', radius)
                    .attr('fill', nodeColor)
                    .attr('stroke', isDark ? '#0f172a' : '#ffffff')
                    .attr('stroke-width', 1.0);
            });

            // 3. Force Simulation Setup
            const simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(links)
                    .id(d => d.id)
                    .distance(d => d.depth === 1 ? 58 : (d.target.children ? 40 : 28))
                    .strength(0.85)
                )
                .force('charge', d3.forceManyBody()
                    .strength(d => d.depth === 0 ? -190 : (d.children ? -135 : -58))
                    .distanceMax(270)
                )
                .force('collide', d3.forceCollide()
                    .radius(d => (d.depth === 0 ? 11 : (d.children ? 9 : 7)) + 3)
                    .iterations(2)
                )
                .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
                .force('x', d3.forceX(width / 2).strength(0.04))
                .force('y', d3.forceY(height / 2).strength(0.04));

            this.forceSimulation = simulation;

            // Tick updates
            simulation.on('tick', () => {
                linkSelection
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                nodeGroups.attr('transform', d => `translate(${d.x}, ${d.y})`);
            });

            // 4. Drag & Drop Interaction
            const drag = d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                });

            nodeGroups.call(drag);

            // 5. Interactive Hover & Path Tracing
            const $tooltip = $('#db-radial-tooltip');

            const getAncestors = (node) => {
                const ancestors = [];
                let curr = node;
                while (curr) {
                    ancestors.push(curr);
                    curr = curr.parent;
                }
                return ancestors;
            };

            const getDescendants = (node) => {
                const descendants = [];
                const traverse = (n) => {
                    descendants.push(n);
                    if (n.children) n.children.forEach(traverse);
                };
                traverse(node);
                return descendants;
            };

            nodeGroups.on('mouseenter', (event, d) => {
                const ancestors = new Set(getAncestors(d));
                const descendants = new Set(getDescendants(d));

                const hoverActiveColor = isDark ? '#94a3b8' : '#475569';
                linkSelection
                    .transition().duration(150)
                    .attr('stroke', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) {
                            return hoverActiveColor;
                        }
                        return defaultLinkStroke;
                    })
                    .attr('stroke-width', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) return 0.95;
                        return 0.5;
                    })
                    .attr('stroke-opacity', (link) => {
                        if ((ancestors.has(link.target) && ancestors.has(link.source)) ||
                            (descendants.has(link.target) && descendants.has(link.source))) return 0.9;
                        return 0.15;
                    });

                nodeGroups
                    .transition().duration(150)
                    .attr('opacity', (node) => {
                        if (ancestors.has(node) || descendants.has(node)) return 1;
                        return 0.2;
                    });

                d3.select(event.currentTarget).selectAll('circle.node-dot')
                    .transition().duration(150)
                    .attr('transform', 'scale(1.3)')
                    .attr('stroke', isDark ? '#ffffff' : '#0f172a')
                    .attr('stroke-width', 1.5);

                // Render Glassmorphism Tooltip Card
                const isRootNode = d.depth === 0;
                const meta = BeanMetadataRules.resolveBeanMetadata(d.data);
                const titleName = isRootNode ? (d.data?.name || 'Application Context') : d.data.name;
                const type = isRootNode ? 'Root Context' : (d.data?.meta?.type || d.data?.type || 'Spring Bean');
                const scope = isRootNode ? 'CONTEXT' : (d.data?.meta?.scope || 'singleton');
                const directChildren = d.children ? d.children.length : 0;
                const totalSubtree = descendants.size - 1;
                const parentName = d.parent ? (d.parent.data?.name || d.parent.data?.fullName || 'Root') : 'None';

                const clone = TemplateEngine.clone('tpl-dashboard-radial-tooltip');
                if (clone) {
                    const $t = $(clone.firstElementChild);

                    let badgeClass = 'bg-blue-400/20 text-blue-300';
                    let iconColor = '#60a5fa';
                    if (isRootNode) {
                        badgeClass = 'bg-emerald-500/20 text-emerald-300';
                        iconColor = '#10b981';
                    } else {
                        const color = getNodeColor(d);
                        if (color === '#34d399') { badgeClass = 'bg-emerald-400/20 text-emerald-300'; iconColor = '#34d399'; }
                        else if (color === '#fbbf24') { badgeClass = 'bg-amber-400/20 text-amber-300'; iconColor = '#fbbf24'; }
                        else if (color === '#f472b6') { badgeClass = 'bg-pink-400/20 text-pink-300'; iconColor = '#f472b6'; }
                        else if (color === '#c084fc') { badgeClass = 'bg-purple-400/20 text-purple-300'; iconColor = '#c084fc'; }
                    }

                    $t.find('[data-field="icon"]')
                        .css('color', iconColor)
                        .text(isRootNode ? 'account_tree' : meta.icon);
                    $t.find('[data-field="title"]').text(titleName);
                    $t.find('[data-field="scope-badge"]').addClass(badgeClass).text(scope);
                    $t.find('[data-field="type"]').text(type).attr('title', type);
                    $t.find('[data-field="depth"]').text(`L${d.depth}`);
                    $t.find('[data-field="direct-deps"]').text(directChildren);
                    $t.find('[data-field="subtree"]').text(totalSubtree);
                    $t.find('[data-field="parent"]').text(parentName);
                    $t.find('[data-field="parent-container"]').attr('title', parentName);

                    $tooltip.empty().append($t).removeClass('hidden');
                }
            })
                .on('mousemove', (event) => {
                    const containerRect = svgNode.getBoundingClientRect();
                    const x = event.clientX - containerRect.left + 14;
                    const y = event.clientY - containerRect.top - 20;
                    $tooltip.css({ left: `${Math.min(x, containerRect.width - 240)}px`, top: `${Math.max(10, y)}px` });
                })
                .on('mouseleave', (event, d) => {
                    linkSelection
                        .transition().duration(200)
                        .attr('stroke', d => d.source.depth === 0 ? rootLinkStroke : defaultLinkStroke)
                        .attr('stroke-width', 0.75)
                        .attr('stroke-opacity', 0.45);

                    nodeGroups
                        .transition().duration(200)
                        .attr('opacity', 1);

                    d3.select(event.currentTarget).selectAll('circle.node-dot')
                        .transition().duration(200)
                        .attr('transform', 'scale(1)')
                        .attr('stroke', isDark ? '#0f172a' : '#ffffff')
                        .attr('stroke-width', 1.0);

                    $tooltip.addClass('hidden');
                });

            $dbRadialLoading.addClass('hidden');
        } catch (err) {
            console.error('Error rendering Force-Directed Tree:', err);
            $dbRadialLoading.addClass('hidden');
        }
    }

    /**
     * Smoothly scales the radial D3 SVG zoom.
     * @param {number} scaleFactor
     */
    zoom(scaleFactor) {
        if (this.radialSvg && this.radialZoom) {
            this.radialSvg.transition().duration(250).call(this.radialZoom.scaleBy, scaleFactor);
        }
    }

    /**
     * Resets the radial D3 SVG zoom to its initial transform.
     */
    resetZoom() {
        if (this.radialSvg && this.radialZoom && this.radialInitialTransform) {
            this.radialSvg.transition().duration(300).call(this.radialZoom.transform, this.radialInitialTransform);
            if (this.forceSimulation) {
                this.forceSimulation.alpha(0.3).restart();
            }
        }
    }

    /**
     * Re-renders tree with updated theme styles.
     */
    onThemeChanged() {
        if (this.dependenciesData) {
            this.render(this.dependenciesData);
        }
    }

    /**
     * Cleans up D3 simulation, SVG elements, tooltips, and zoom state.
     */
    destroy() {
        if (this.forceSimulation) {
            this.forceSimulation.stop();
            this.forceSimulation = null;
        }

        this.radialZoom = null;
        this.radialSvg = null;
        this.radialInitialTransform = null;
        this.dependenciesData = null;

        $('#db-radial-tooltip').addClass('hidden').empty();
    }
}
