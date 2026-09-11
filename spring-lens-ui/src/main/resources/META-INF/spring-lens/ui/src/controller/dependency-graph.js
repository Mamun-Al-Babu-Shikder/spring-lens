import httpClient from '../helper/http-client.js';
import beanDataStore from '../helper/bean-data-store.js';
import GraphTreeBuilder from '../helper/graph-tree-builder.js';
import {
    tree,
    NW, NH, RX, GAP_X, GAP_Y, ZOOM_SCALE_EXTENT,
    PROGRESS_BADGE_STYLES, ALL_PROGRESS_BADGE_CLASSES, ALL_PROGRESS_DOT_CLASSES,
    TemplateEngine, QueryParam, Sidebar, ToastNotification, BeanSearchEngine, debounce,
    resolveBeanMetadata, CanvasTreeRenderer
} from '../helper/index.js';

export default class DependencyGraph {

    constructor(endpoints = {}) {
        this.dependencyGraphApi = endpoints.GRAPH_DEPENDENCIES;
        this.beanDefinitions = endpoints.BEAN_DEFINITION;
        this.findBeanDefinitionsApi = endpoints.FIND_BEAN_DEFINITION;

        this.root = null;
        this.canvas = null;
        this.canvasRenderer = null;
        this.zoom = null;
        this.currentTransform = d3.zoomIdentity;
        this._textMeasureCtx = null;

        this.totalElements = 0;
        this.beanDependencies = null;
        this.accumulatedBeans = [];
        this.beanDetailsCache = new Map();
        this.isLoadingRemaining = false;

        this.selectedContextId = '';
        this.isHighlightPathActive = false;
        this.focusedNodeFullName = null;
        this.focusedNodeContextId = null;
        this.focusedNodeId = null;

        this.mode = localStorage.getItem('sl-layout') ?? 'tb';
    }

    initEvents() {
        this._bindSearchHandlers();
        this._bindClickActionRouter();
        this._bindCustomEventHandlers();
    }

    async enter(params) {
        this.initEvents();
        this._initSidebar();
        if (!this._initializeCanvas()) return;

        this._bindControls();

        const isDataLoaded = await this._loadInitialData();
        if (!isDataLoaded) return;

        this._renderInitialGraph();
        this._handlePendingBeanFocus(params);
    }

    _initializeCanvas() {
        const canvasElem = document.getElementById('tree-canvas');
        if (!canvasElem) return false;

        this.canvas = canvasElem;
        this._injectTooltip();

        this.canvasRenderer = new CanvasTreeRenderer(canvasElem, {
            onNodeClick: (event, node) => this._handleNodeClick(event, node),
            onToggleClick: (event, node) => this._handleToggleClick(event, node),
            onNodeHover: (event, node) => {
                this.showTip(event, node);
                this.highlightPathForNode(node);
            },
            onNodeLeave: () => {
                $('#tip').removeClass('show');
                this.resetPathHighlight();
            },
            onBackgroundClick: () => {
                this.closeSidebar();
                this.clearFocusedNode();
            }
        });

        this._setupZoom();
        this._setupResizeObserver();
        return true;
    }

    _bindControls() {
        $('#btn-reload-graph')
            .off('click')
            .on('click', () => this.reloadGraphData());
    }

    async reloadGraphData() {
        const $btn = $('#btn-reload-graph');
        const $icon = $btn.find('.material-symbols-outlined');
        $icon.addClass('animate-spin');

        try {
            await this._fetchBeanGraphDependencies();
            this._buildHierarchyFromDependencies();
            this._updateTotalBeanCount();
            this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
            this.fitView(0);
        } catch (error) {
            console.error('Error reloading graph data:', error);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 600);
        }
    }

    async _loadInitialData() {
        try {
            await this._fetchBeanGraphDependencies();
            this._buildHierarchyFromDependencies();
            this._updateTotalBeanCount();
            return true;
        } catch (error) {
            console.error('Failed to initialize graph data:', error);
            const clone = TemplateEngine.clone('tpl-bean-graph-error');
            if (clone) {
                $(clone).find('[data-field="errorMessage"]').text(error.message);
                $('#beanGraph').empty().append(clone);
            }
            return false;
        }
    }

    _renderInitialGraph() {
        this.setMode(this.mode, false);
        this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
        this.fitView(0);
    }

    _handlePendingBeanFocus(params) {
        const targetBean = QueryParam.get(params, 'focus', 'search', 'bean');
        const contextId = QueryParam.get(params, 'contextId', 'context') || '';
        if (!targetBean) return;

        setTimeout(() => this.focusOnBean(targetBean, contextId, false), 300);
    }

    async fetchBeanDetails(contextId, beanName) {
        if (!beanName || !contextId) return null;

        const cacheKey = `${contextId}:${beanName}`;
        if (this.beanDetailsCache.has(cacheKey)) {
            return this.beanDetailsCache.get(cacheKey);
        }

        try {
            const queryParams = QueryParam.build({ contextId: contextId, beanName }).toString();
            const beanDetails = await httpClient.getWithQuery(this.findBeanDefinitionsApi, queryParams);
            if (!beanDetails) return null;

            this._updateBeanCaches(beanDetails, cacheKey);
            return beanDetails;
        } catch (error) {
            console.warn(`Error fetching bean details for ${beanName}:`, error);
            this.beanDetailsCache.set(cacheKey, null);
            return null;
        }
    }

    _updateBeanCaches(beanDetails, primaryCacheKey) {
        this.beanDetailsCache.set(primaryCacheKey, beanDetails);
        beanDataStore.addBeans([beanDetails]);
    }

    _mergeBeanDetailsIntoTree(node, details) {
        if (!node || !details) return;

        // 1. Update node metadata in place
        node.data.meta = {
            ...node.data.meta,
            ...(details.type && { type: details.type }),
            ...(details.scope && { scope: details.scope })
        };

        const dependencies = details.dependencies;
        if (!dependencies?.length) return;

        // Ensure _children backing array exists
        node._children ??= [];

        // 2. Pre-index existing children names for O(1) existence checks
        const existingChildNames = new Set();
        const existingChildren = node._children;

        for (let i = 0; i < existingChildren.length; i++) {
            const childData = existingChildren[i].data;

            if (childData?.fullName)
                existingChildNames.add(childData.fullName);

            if (childData?.name)
                existingChildNames.add(childData.name);
        }

        let hasAddedNewChild = false;
        const contextId = details.contextId ?? node.data?.contextId;

        // 3. Append missing dependency nodes
        for (let i = 0; i < dependencies.length; i++) {
            const dependencyName = dependencies[i];
            if (existingChildNames.has(dependencyName)) continue;

            const dependencyNode = this._createDynamicHierarchyChild(node, dependencyName, contextId);
            node._children.push(dependencyNode);
            existingChildNames.add(dependencyName);
            hasAddedNewChild = true;
        }

        // 4. Synchronize active visible children if node is currently expanded
        if (hasAddedNewChild && node.children) {
            node.children = node._children;
        }
    }

    _nodeHasChildren(node) {
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

    _lazyLoadChildren(node) {
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
            return this._createDynamicHierarchyChild(node, depName, contextId, isCycle);
        });
    }

    _createDynamicHierarchyChild(parentNode, beanName, contextId, isCycle = false) {
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
        childNode.width = this._calculateNodeWidth(childNode);
        childNode.children = null;
        childNode._children = null; // Shallow! Populated only when expanded

        return childNode;
    }

    async _fetchBeanGraphDependencies() {
        this._updateProgressBadge({ loaded: 0, total: 0, isComplete: false });

        const searchParams = QueryParam.build({ pageNumber: 0, pageSize: 500 }).toString();
        const serverResponse = await httpClient.getWithQuery(this.dependencyGraphApi, searchParams);
        this.beanDependencies = serverResponse;

        const initialBeanDefinitions = Array.isArray(serverResponse)
            ? serverResponse
            : (serverResponse?.content ?? []);

        this.accumulatedBeans = [...initialBeanDefinitions];
        this.totalElements = serverResponse?.totalElements ?? initialBeanDefinitions.length;

        beanDataStore.addBeans(initialBeanDefinitions);

        const hasRemainingPages = this._hasSubsequentPages(serverResponse);

        this._updateProgressBadge({
            loaded: this.accumulatedBeans.length,
            total: this.totalElements,
            isComplete: !hasRemainingPages
        });

        if (hasRemainingPages) {
            setTimeout(() => this._fetchRemainingGraphPages(serverResponse), 500);
        }
    }

    _hasSubsequentPages(paginationPayload) {
        if (!paginationPayload || Array.isArray(paginationPayload)) return false;

        const { totalPages = 1, pageNumber = 0, last = true } = paginationPayload;
        return !last && pageNumber < totalPages - 1;
    }

    async _fetchRemainingGraphPages(firstPageData) {
        if (this.isLoadingRemaining) return;
        this.isLoadingRemaining = true;

        try {
            const { totalPages = 1, pageNumber = 0, pageSize = 500 } = firstPageData;

            for (let targetPageIndex = pageNumber + 1; targetPageIndex < totalPages; targetPageIndex++) {
                const searchParams = QueryParam.build({
                    pageNumber: targetPageIndex,
                    pageSize
                }).toString();

                const fetchedPagePayload = await httpClient.getWithQuery(this.dependencyGraphApi, searchParams);
                const fetchedBeanDefinitions = fetchedPagePayload?.content ?? [];

                if (fetchedBeanDefinitions.length === 0) break;

                this.accumulatedBeans.push(...fetchedBeanDefinitions);
                beanDataStore.addBeans(fetchedBeanDefinitions);

                this._updateTotalBeanCount();

                const isFinalPageBatch = targetPageIndex === totalPages - 1;
                this._updateProgressBadge({
                    loaded: this.accumulatedBeans.length,
                    total: this.totalElements,
                    isComplete: isFinalPageBatch
                });

                await this._yieldThreadToEventLoop(20);
            }

            // Once streaming completes: preserve active expanded nodes and focused bean
            const expandedNodeNames = this._captureExpandedNodeIdentifiers();
            const previousFocusedNode = this.focusedNodeFullName;
            const previousFocusedContextId = this.focusedNodeContextId;

            this._buildHierarchyFromDependencies(this.accumulatedBeans);
            this._restoreExpandedNodeIdentifiers(expandedNodeNames);

            this.update(null, this.root);
            this._updateTotalBeanCount();

            if (previousFocusedNode) {
                const targetNode = this.findNodeInTree(this.root, previousFocusedNode, previousFocusedContextId);
                if (targetNode) {
                    this.markNodeAsFocused(targetNode);
                }
            }

        } catch (networkStreamingError) {
            console.error('Error loading lazy background bean graph data:', networkStreamingError);
            this._updateProgressBadge({ hasError: true, errorMsg: networkStreamingError.message });
        } finally {
            this.isLoadingRemaining = false;
        }
    }

    _captureExpandedNodeIdentifiers() {
        if (!this.root) return new Set();
        const expandedKeys = new Set();
        this.root.descendants().forEach(node => {
            if (node.children && node.children.length > 0) {
                const name = node.data?.fullName || node.data?.name;
                const contextId = node.data?.contextId || '';
                if (name) expandedKeys.add(`${contextId}:${name}`);
            }
        });
        return expandedKeys;
    }

    _restoreExpandedNodeIdentifiers(expandedKeys) {
        if (!this.root || !expandedKeys || expandedKeys.size === 0) return;
        this.root.descendants().forEach(node => {
            const name = node.data?.fullName || node.data?.name;
            const contextId = node.data?.contextId || '';
            if (name && (expandedKeys.has(`${contextId}:${name}`) || expandedKeys.has(`:${name}`))) {
                this._lazyLoadChildren(node);
                node.children = node._children;
            }
        });
    }

    _yieldThreadToEventLoop(delayDurationInMilliseconds = 500) {
        return new Promise(resolveEventLoopYield => setTimeout(resolveEventLoopYield, delayDurationInMilliseconds));
    }

    _extractUniqueContextIdentifiers(beanDefinitions) {
        const uniqueContextSet = new Set();
        for (let i = 0; i < beanDefinitions.length; i++) {
            const contextIdentifier = beanDefinitions[i]?.contextId;
            if (contextIdentifier) {
                uniqueContextSet.add(contextIdentifier);
            }
        }
        return Array.from(uniqueContextSet);
    }

    _buildContextFilterOptionsHtml(uniqueContextId, selectedContextId) {
        const isDefaultOptionSelected = !selectedContextId ? 'selected' : '';
        const defaultOptionHtml = `<option value="" ${isDefaultOptionSelected} class="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">All Contexts (${uniqueContextId.length})</option>`;

        const contextOptionsHtml = uniqueContextId.map(contextIdentifier => {
            const isSelected = contextIdentifier === selectedContextId ? 'selected' : '';
            return `<option value="${contextIdentifier}" ${isSelected} class="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">${contextIdentifier}</option>`;
        }).join('');

        return `${defaultOptionHtml}${contextOptionsHtml}`;
    }

    _buildHierarchyFromDependencies(beanDefinitions = null) {
        const listOfBeanDefinitions = this._resolveRawBeanDefinitions(beanDefinitions);
        if (!listOfBeanDefinitions || listOfBeanDefinitions.length === 0) {
            this.root = null;
            return;
        }

        this._populateContextFilter(listOfBeanDefinitions);

        const scopedBeanDefinitions = this._filterBeanDefinitionsByActiveContext(listOfBeanDefinitions);
        this._buildAndCrossLinkBeanDependencies(scopedBeanDefinitions);

        const rawTreeHierarchyData = GraphTreeBuilder.buildByContext(scopedBeanDefinitions);

        if (!rawTreeHierarchyData) {
            this.root = null;
            return;
        }

        this.root = this._createD3HierarchyRootNode(rawTreeHierarchyData);
    }

    _resolveRawBeanDefinitions(providedBeanDefinitions) {
        if (providedBeanDefinitions) {
            return providedBeanDefinitions;
        }

        if (Array.isArray(this.beanDependencies)) {
            return this.beanDependencies;
        }

        return this.beanDependencies?.content ?? [];
    }

    _populateContextFilter(beanDefinitions = []) {
        const $contextFilterSelectElement = $('#context-filter');
        if ($contextFilterSelectElement.length === 0) return;

        const uniqueContextIdentifiers = this._extractUniqueContextIdentifiers(beanDefinitions);
        const $filterContainerElement = $contextFilterSelectElement.closest('#context-filter-container').length
            ? $contextFilterSelectElement.closest('#context-filter-container')
            : $contextFilterSelectElement.parent();

        if (uniqueContextIdentifiers.length <= 1) {
            $filterContainerElement.addClass('hidden').removeClass('flex');
            return;
        }

        $filterContainerElement.removeClass('hidden').addClass('flex');

        const renderedOptionsHtml = this._buildContextFilterOptionsHtml(
            uniqueContextIdentifiers,
            this.selectedContextId
        );

        $contextFilterSelectElement.html(renderedOptionsHtml);
    }

    _filterBeanDefinitionsByActiveContext(beanDefinitions) {
        if (!this.selectedContextId) {
            return beanDefinitions;
        }

        return beanDefinitions.filter(bean => bean?.contextId === this.selectedContextId);
    }

    _buildAndCrossLinkBeanDependencies(beanDefinitions) {
        beanDataStore.addBeans(beanDefinitions);
        const beanCount = beanDefinitions.length;

        // Cross-link inverse dependent relationships in O(1) time using Set
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

    _createD3HierarchyRootNode(treeData) {
        const root = d3.hierarchy(treeData);

        let autoIncId = 0;

        root.descendants().forEach((node) => {
            node.id = autoIncId++;
            node._children = node.children;

            if (node.data) {
                node.data.name = node.data.name || GraphTreeBuilder._displayName(node.data.fullName || node.data.contextId || '');
                node.data.meta = node.data.meta || {};
                if (node.depth === 0) {
                    node.data.meta.type = 'context';
                }
            }

            node.width = this._calculateNodeWidth(node);

            // Always keep only the first child level open at depth 0:
            // - If 1 context: Root is that context (depth 0), its root beans (depth 1) are open, and their children are collapsed.
            // - If multiple contexts: Root is "Application Contexts" (depth 0), each context (depth 1) is visible, and all context children (depth 2) are collapsed!
            if (node.depth > 0) {
                node.children = null;
            }
        });

        root.x0 = 0;
        root.y0 = 0;

        return root;
    }

    _updateTotalBeanCount() {
        const beanList = this.accumulatedBeans.length > 0
            ? this.accumulatedBeans
            : (Array.isArray(this.beanDependencies) ? this.beanDependencies : (this.beanDependencies?.content || []));

        const totalElements = this.totalElements || this.beanDependencies?.totalElements || beanList.length;
        $('#beans-count').text(totalElements);

        let totalDeps = 0;
        for (const bean of beanList) {
            totalDeps += bean.dependencies?.length ?? 0;
        }
        $('#deps-count').text(totalDeps);
    }

    _injectTooltip() {
        if ($('#tip').length === 0) {
            const clone = TemplateEngine.clone('tpl-tooltip');
            if (clone) $('body').append(clone);
        }
    }

    _setupZoom() {
        this.zoom = d3.zoom()
            .scaleExtent(ZOOM_SCALE_EXTENT)
            .on('zoom', ({ transform }) => {
                this.currentTransform = transform;
                this._renderCanvas();
                this.updateZoomPercent(transform.k);
            });

        if (this.canvas) {
            d3.select(this.canvas).call(this.zoom);
        }
    }

    _renderCanvas(source = null, duration = 0) {
        if (!this.canvasRenderer || !this.root) return;
        const $graph = $('#beanGraph');
        const width = $graph.width() || 800;
        const height = $graph.height() || 600;
        this.canvasRenderer.resize(width, height);

        const config = {
            mode: this.mode,
            focusedNodeFullName: this.focusedNodeFullName,
            focusedNodeContextId: this.focusedNodeContextId,
            focusedNodeId: this.focusedNodeId,
            isHighlightPathActive: this.isHighlightPathActive,
            selectedNodeRef: this.selectedNodeRef,
            isNodeHighlighted: (node) => this._isNodeInActivePath(node),
            isLinkHighlighted: (link) => this._isLinkInActivePath(link)
        };

        if (source && duration > 0) {
            this.canvasRenderer.animateTransition(this.root, this.currentTransform, config, source, duration);
        } else {
            this.canvasRenderer.render(this.root, this.currentTransform, config);
        }
    }

    _isNodeInActivePath(node) {
        if (!this.isHighlightPathActive || !this.activePathNodeRefs) return true;
        return this.activePathNodeRefs.has(node) ||
            (node.id !== undefined && this.activePathNodeIds?.has(node.id)) ||
            (node.data?.fullName && this.activePathNodeNames?.has(node.data.fullName)) ||
            (node.data?.name && this.activePathNodeNames?.has(node.data.name));
    }

    _isLinkInActivePath(link) {
        if (!this.isHighlightPathActive || !this.activePathNodeRefs) return true;
        return this._isNodeInActivePath(link.source) && this._isNodeInActivePath(link.target);
    }

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

        // Cache element lookups or execute in a single selection
        $('#tip-name').text(name);
        $('#tip-type').text(typeLabel);
        $('#tip-scope').text(scopeLabel);
        $('#tip-meta').text(metaText);

        $('#tip')
            .addClass('show')
            .css({ left: pageX + 12, top: pageY + 20 });
    }

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

        // 2. Trace downwards: All descendant nodes (visible children recursively across all nested levels)
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

        this._renderCanvas();
    }

    resetPathHighlight() {
        if (this.isHighlightPathActive && this.selectedNodeRef) {
            this.highlightPathForNode(this.selectedNodeRef);
            return;
        }

        this.activePathNodeRefs = null;
        this.activePathNodeIds = null;
        this.activePathNodeNames = null;

        this._renderCanvas();
    }

    update(event, source) {
        if (!this.root) return;

        const isTB = this.mode === 'tb';
        const duration = event?.altKey ? 4000 : 950;

        const descendants = this.root.descendants();
        const nodes = descendants.slice().reverse();

        let visibleCount = 0;

        descendants.forEach((node) => {
            node.width = this._calculateNodeWidth(node);

            if (node.depth === 0 || node.parent?.children) {
                visibleCount++;
            }
        });

        this._calculateLayout(nodes, isTB);
        this._renderCanvas(source, duration);

        // Store current positions for future animations
        this.root.eachBefore(node => {
            node.x0 = node.x;
            node.y0 = node.y;
        });

        $('#nodeCount strong').text(visibleCount);
    }

    _measureTextWidth(text) {
        if (!text) return 0;
        if (!this._textMeasureCtx) {
            const canvas = document.createElement('canvas');
            this._textMeasureCtx = canvas.getContext('2d');
        }
        this._textMeasureCtx.font = '600 13px Inter, -apple-system, sans-serif';
        return this._textMeasureCtx.measureText(text).width;
    }

    _calculateNodeWidth(node) {
        const name = node?.data?.name || '';
        const hasChildren = this._nodeHasChildren(node);
        const textWidth = this._measureTextWidth(name);
        const extraPadding = hasChildren ? 88 : 64;
        return Math.max(180, Math.ceil(textWidth) + extraPadding);
    }

    _calculateLayout(nodes, isTB) {
        const maxWidth = d3.max(nodes, node => node.width) || NW;
        tree.nodeSize(isTB ? [maxWidth + GAP_X, NH + GAP_Y] : [NH + 28, maxWidth + GAP_Y]);
        tree(this.root);
    }

    async _handleNodeClick(event, node) {
        this.markNodeAsFocused(node);

        const { contextId, fullName, meta } = node.data;

        if (meta?.type === "context") {
            this.closeSidebar();
            await this._handleToggleClick(event, node);
            return;
        }

        const details = await this.fetchBeanDetails(contextId, fullName);
        if (details) this._mergeBeanDetailsIntoTree(node, details);
        await this.selectNodeAndShowDetails(node, details);

        $('#tip').removeClass('show');
    }

    async _handleToggleClick(event, node) {
        const { contextId, fullName, meta } = node.data;
        if (meta?.type !== "context") {
            const details = await this.fetchBeanDetails(contextId, fullName);
            if (details) this._mergeBeanDetailsIntoTree(node, details);
        }

        if (!node._children || node._children.length === 0) {
            this._lazyLoadChildren(node);
        }

        node.children = node.children ? null : node._children;
        this.update(event, node);
        $('#tip').removeClass('show');
    }

    zoomBy(factor, duration = 300) {
        if (!this.zoom || !this.canvas) return;

        d3.select(this.canvas).transition()
            .duration(duration)
            .call(this.zoom.scaleBy, factor);
    }

    fitView(duration = 500, padding = 35, minScale = 0.4, maxScale = 1.8) {
        if (!this.canvas || !this.root) return;

        const $beanGraph = $('#beanGraph');
        const width = $beanGraph.width() || 800;
        const height = $beanGraph.height() || 600;

        const nodes = this.root.descendants();
        if (nodes.length === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let maxNodeW = NW;

        const isTB = this.mode === 'tb';

        // Single pass to find coordinate bounds and maximum node width
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

        const rawScale = (Math.min(width / graphW, height / graphH)) * 1.25;
        const scale = Math.max(minScale, Math.min(maxScale, rawScale));

        const tx = width / 2 - centerX * scale;
        const ty = height / 2 - centerY * scale;

        const newTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        this.currentTransform = newTransform;
        d3.select(this.canvas).property('__zoom', newTransform);

        if (duration > 0 && this.canvasRenderer) {
            this.canvasRenderer.animateTransform(newTransform, duration, (k) => this.updateZoomPercent(k));
        } else {
            this._renderCanvas();
            this.updateZoomPercent(scale);
        }
    }

    updateZoomPercent(k) {
        $('#zoom-percent').text(`${Math.round(k * 100)}%`);
    }

    async selectNodeAndShowDetails(selectedHierarchyNode, beanDetails) {
        this.selectedNodeRef = selectedHierarchyNode;
        if (this.isHighlightPathActive) this.highlightPathForNode(selectedHierarchyNode);

        const { fullName, meta } = selectedHierarchyNode.data ?? {};
        const { dependencies = [], dependents = [] } = beanDetails ?? {};

        const isIgnoredType = meta?.type === 'context' || meta?.type === 'N/A';
        const hasDetails = dependencies.length > 0 || dependents.length > 0;

        if (isIgnoredType || !hasDetails) {
            this.closeSidebar();
            ToastNotification.show({
                title: 'Bean Details',
                message: `No additional details available for <span class="font-semibold text-gray-850 dark:text-gray-200">${fullName}</span>.`,
                type: 'sweet',
                duration: 4000
            });
            return;
        }

        this.showBeanDetails(beanDetails, selectedHierarchyNode);
    }

    async showBeanDetails(beanDetailsOrName, hierarchyNodeOrContextId) {
        let beanDetails = beanDetailsOrName;
        let hierarchyNode = null;
        let contextId = '';

        if (typeof beanDetailsOrName === 'string') {
            const beanName = beanDetailsOrName;
            contextId = typeof hierarchyNodeOrContextId === 'string' ? hierarchyNodeOrContextId : (this.selectedContextId || '');
            hierarchyNode = this.root ? this.findNodeInTree(this.root, beanName, contextId) : null;
            const fetched = await this.fetchBeanDetails(contextId, beanName);
            beanDetails = fetched || beanDataStore.findBeanByName(beanName, contextId) || { beanName, contextId };
        } else if (beanDetailsOrName && typeof beanDetailsOrName === 'object') {
            beanDetails = beanDetailsOrName;
            hierarchyNode = hierarchyNodeOrContextId && typeof hierarchyNodeOrContextId === 'object' ? hierarchyNodeOrContextId : null;
            contextId = beanDetails.contextId || (typeof hierarchyNodeOrContextId === 'string' ? hierarchyNodeOrContextId : '') || '';
        }

        if (!beanDetails) return;

        const { dependencies = [], dependents = [] } = beanDetails;

        if (hierarchyNode) {
            this._mergeBeanDetailsIntoTree(hierarchyNode, beanDetails);
        }

        this._openSidebarAndPopulateData(beanDetails);
        this._renderDependencyAccordions(dependencies, dependents, contextId);

        // If the node exists in the current graph tree layout, focus & highlight it
        if (this.root) {
            const targetNode = hierarchyNode || this.findNodeInTree(this.root, beanDetails.beanName, contextId);
            if (targetNode) {
                this.markNodeAsFocused(targetNode);
                if (this.isHighlightPathActive) {
                    this.highlightPathForNode(targetNode);
                }
            }
        }
    }

    _openSidebarAndPopulateData(beanDetails = {}) {
        this.openSidebar();
        Sidebar.populateDetails(beanDetails);
        Sidebar.updateSidebarIcon(beanDetails);
        this.switchTab('properties');
    }

    _initSidebar() {
        const $sidebar = $('#details-sidebar');
        if ($sidebar.length && !$sidebar.children().length) {
            $sidebar.empty();
            const clone = TemplateEngine.clone('tpl-bean-details-sidebar');
            if (clone) {
                $sidebar.append(clone);
            }
        }
    }

    openSidebar() {
        this._initSidebar();
        const $sidebar = $('#details-sidebar');
        if (!$sidebar.length) return;
        $sidebar.removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-4 border-0')
            .addClass('w-[360px] max-w-[360px] opacity-100 mr-0 border');
        this._animateSidebarTransition();
    }

    closeSidebar(immediate = false) {
        const $sidebar = $('#details-sidebar');
        if (!$sidebar.length) return;
        $sidebar.removeClass('w-[360px] max-w-[360px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-4 border-0');
        this._animateSidebarTransition();
    }

    _syncCanvasSize() {
        if (!this.canvasRenderer || !this.root) return;
        const $graph = $('#beanGraph');
        const width = $graph.width() || 800;
        const height = $graph.height() || 600;

        if (width <= 0 || height <= 0) return;

        const oldWidth = this.canvasRenderer.width;
        const oldHeight = this.canvasRenderer.height;

        if (Math.abs(oldWidth - width) > 1 || Math.abs(oldHeight - height) > 1) {
            if (oldWidth > 0 && oldHeight > 0) {
                const dx = (width - oldWidth) / 2;
                const dy = (height - oldHeight) / 2;
                this.currentTransform = d3.zoomIdentity
                    .translate(this.currentTransform.x + dx, this.currentTransform.y + dy)
                    .scale(this.currentTransform.k);
                d3.select(this.canvas).property('__zoom', this.currentTransform);
            }

            this.canvasRenderer.resize(width, height);
            this._renderCanvas();
        }
    }

    _animateSidebarTransition() {
        if (this._sidebarAnimFrameId) {
            cancelAnimationFrame(this._sidebarAnimFrameId);
        }

        const startTime = performance.now();
        const duration = 350; // slightly longer than 300ms CSS drawer transition

        const step = (now) => {
            this._syncCanvasSize();
            if (now - startTime < duration) {
                this._sidebarAnimFrameId = requestAnimationFrame(step);
            } else {
                this._sidebarAnimFrameId = null;
                this._syncCanvasSize();
            }
        };

        this._sidebarAnimFrameId = requestAnimationFrame(step);
    }

    _setupResizeObserver() {
        const graphContainer = document.getElementById('beanGraph');
        if (!graphContainer || typeof ResizeObserver === 'undefined') return;

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.resizeObserver = new ResizeObserver(() => {
            this._syncCanvasSize();
        });

        this.resizeObserver.observe(graphContainer);
    }

    switchTab(tabName) {
        Sidebar.switchTab(tabName);
    }

    _renderDependencyAccordions(dependencyNames = [], dependentNames = [], contextId = '') {
        $('#detail-deps-count').text(dependencyNames.length);
        $('#detail-dependents-count').text(dependentNames.length);

        Sidebar.renderDependencyList($('#detail-deps-list'), dependencyNames, {
            emptyText: 'No dependencies',
            emptyTemplateId: 'tpl-graph-dep-empty',
            templateId: 'tpl-graph-dep-item',
            contextId
        });
        Sidebar.renderDependencyList($('#detail-dependents-list'), dependentNames, {
            emptyText: 'No dependents',
            emptyTemplateId: 'tpl-graph-dep-empty',
            templateId: 'tpl-graph-dep-item',
            contextId
        });
    }

    findNodeInTree(rootNode, targetIdentifier, targetContextId = null) {
        if (!rootNode || !targetIdentifier) return null;

        const normalizedTargetName = this._extractTerminalBeanIdentifier(targetIdentifier);
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

            if (isContextMatch && this._isMatchingNode(currentNodeIdentifier, targetIdentifier, normalizedTargetName)) {
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

    _extractTerminalBeanIdentifier(identifier) {
        return identifier.includes(':') ? identifier.split(':').pop() : identifier;
    }

    _isMatchingNode(nodeIdentifier, rawTargetIdentifier, normalizedTargetName) {
        if (!nodeIdentifier) return false;
        if (nodeIdentifier === rawTargetIdentifier) return true;

        const normalizedNodeName = this._extractTerminalBeanIdentifier(nodeIdentifier);
        return normalizedNodeName === normalizedTargetName;
    }

    _expandPathToBean(targetBeanName, contextId = '') {
        if (!this.root || !targetBeanName) return null;

        const queue = [[targetBeanName]];
        const visited = new Set([targetBeanName]);
        let foundPath = null;

        let iterations = 0;
        while (queue.length > 0 && iterations++ < 500) {
            const path = queue.shift();
            const currentBeanName = path[0];

            const existingNode = this.findNodeInTree(this.root, currentBeanName, contextId);
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

        let currentNode = this.findNodeInTree(this.root, foundPath[0], contextId);

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
            this._lazyLoadChildren(currentNode);
            currentNode.children = currentNode._children;
            const nextBeanName = foundPath[i + 1];
            currentNode = (currentNode.children || []).find(c =>
                (c.data?.fullName === nextBeanName || c.data?.name === nextBeanName) &&
                (!contextId || !c.data?.contextId || c.data.contextId === contextId)
            );
        }

        if (currentNode) {
            this._lazyLoadChildren(currentNode);
        }

        this.update(null, this.root);
        return currentNode || this.findNodeInTree(this.root, targetBeanName, contextId);
    }

    async focusOnBean(fullName, contextId = '', openSidebar = false) {
        if (!fullName) return;

        // Auto-switch context filter if requested bean belongs to a different context
        if (contextId && this.selectedContextId && this.selectedContextId !== contextId) {
            this.selectedContextId = contextId;
            $('#context-filter').val(contextId);
            const beans = this.accumulatedBeans.length > 0 ? this.accumulatedBeans : null;
            this._buildHierarchyFromDependencies(beans);
            this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
            this._updateTotalBeanCount();
        }

        if (this.root) {
            let targetNode = this.findNodeInTree(this.root, fullName, contextId);
            if (!targetNode) {
                targetNode = this._expandPathToBean(fullName, contextId);
            }

            if (targetNode) {
                // Expand collapsed parents along the upward ancestor path
                let currentNode = targetNode.parent;
                let needsUpdate = false;

                while (currentNode) {
                    if (currentNode._children && !currentNode.children) {
                        currentNode.children = currentNode._children;
                        needsUpdate = true;
                    }
                    currentNode = currentNode.parent;
                }

                if (needsUpdate) {
                    this.update(null, this.root);
                }

                const isTopBottom = this.mode === 'tb';
                const { x: nodeX, y: nodeY } = targetNode;
                const targetX = isTopBottom ? nodeX : nodeY;
                const targetY = isTopBottom ? nodeY : nodeX;

                // Ensure targetNode animation state is immediately visible and positioned
                if (this.canvasRenderer) {
                    const state = this.canvasRenderer.nodeStates.get(targetNode.id);
                    if (state) {
                        state.x = targetX;
                        state.y = targetY;
                        state.startX = targetX;
                        state.startY = targetY;
                        state.targetX = targetX;
                        state.targetY = targetY;
                        state.opacity = 1;
                        state.targetOpacity = 1;
                        state.delay = 0;
                    }
                }

                this.markNodeAsFocused(targetNode);

                // Measure viewport dimensions once
                const $graph = $('#beanGraph');
                const width = $graph.width() || 800;
                const height = $graph.height() || 600;

                const zoomScale = 1.3;
                const translateX = width / 2 - targetX * zoomScale;
                const translateY = height / 2 - targetY * zoomScale;

                const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale);
                this.currentTransform = newTransform;
                d3.select(this.canvas).property('__zoom', newTransform);

                if (this.canvasRenderer) {
                    this.canvasRenderer.animateTransform(newTransform, 500, (k) => this.updateZoomPercent(k));
                } else {
                    this._renderCanvas();
                    this.updateZoomPercent(zoomScale);
                }

                if (this.isHighlightPathActive) {
                    this.highlightPathForNode(targetNode);
                }
            } else {
                console.info(`Bean "${fullName}" not found in current graph layout.`);
            }
        }

        if (openSidebar) {
            this.showBeanDetails(fullName, contextId);
        }
    }

    markNodeAsFocused(targetNode) {
        this.focusedNodeFullName = targetNode?.data?.fullName || targetNode?.data?.name || (typeof targetNode === 'string' ? targetNode : null);
        this.focusedNodeContextId = targetNode?.data?.contextId || null;
        this.focusedNodeId = targetNode?.id ?? null;
        this._renderCanvas();
    }

    clearFocusedNode() {
        this.focusedNodeFullName = null;
        this.focusedNodeContextId = null;
        this.focusedNodeId = null;
        this._renderCanvas();
    }

    setMode(layoutMode) {
        this.mode = layoutMode;
        localStorage.setItem('sl-layout', layoutMode);

        const isTopBottom = layoutMode === 'tb';
        const activeClasses = 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white shadow-xs font-bold';
        const inactiveClasses = 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white font-medium';

        // Batch toggle button styling
        $('#btn-tb')
            .toggleClass(activeClasses, isTopBottom)
            .toggleClass(inactiveClasses, !isTopBottom);

        $('#btn-lr')
            .toggleClass(activeClasses, !isTopBottom)
            .toggleClass(inactiveClasses, isTopBottom);

        if (!this.root) return;

        // Cache previous positions before recalculating layout
        this.root.eachBefore(node => {
            node.x0 = node.x;
            node.y0 = node.y;
        });

        const { x = 0, y = 0, x0 = 0, y0 = 0 } = this.root;

        this.update(null, { x, y, x0, y0 });
        this.fitView(500);
    }


    _bindSearchHandlers() {
        this._debouncedGraphSearch = debounce((query) => {
            this._handleSearchInput(query);
        }, 180);

        $(document).off('input.graphSearch', '#search-input').on('input.graphSearch', '#search-input', (event) => {
            this._debouncedGraphSearch(event.target.value);
        });

        $(document).off('keydown.graphSearch', '#search-input').on('keydown.graphSearch', '#search-input', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this._debouncedGraphSearch?.flush();
                const $firstSuggestion = $('#search-suggestions .suggestion-item').first();
                if ($firstSuggestion.length) {
                    $firstSuggestion.trigger('click');
                } else {
                    const query = $('#search-input').val()?.trim();
                    if (query) {
                        this.focusOnBean(query, this.selectedContextId, false);
                        $('#search-input').val('');
                        $('#search-suggestions').hide();
                    }
                }
            } else if (event.key === 'Escape') {
                this._debouncedGraphSearch?.cancel();
                $('#search-input').val('');
                $('#search-suggestions').hide().empty();
            }
        });

        $(document).off('keydown.graphSearchShortcut').on('keydown.graphSearchShortcut', (event) => {
            if (event.key === '/' && !$(event.target).is('input, textarea, select')) {
                event.preventDefault();
                $('#search-input').focus();
            }
        });

        this._bindOutsideSearchDismissal();
    }

    async _handleSearchInput(rawQueryValue) {
        const $suggestionsBox = $('#search-suggestions');
        const query = (rawQueryValue || '').trim();

        if (!query) {
            $suggestionsBox.hide().empty();
            return;
        }

        // Show loading indicator
        $suggestionsBox.html('<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs flex items-center gap-2"><span class="material-symbols-outlined text-[16px] animate-spin text-primary">progress_activity</span><span>Searching beans...</span></div>').show();

        try {
            const queryParams = QueryParam.build({
                search: query,
                pageSize: 12
            }).toString();

            const response = await httpClient.getWithQuery(this.beanDefinitions, queryParams);
            const items = response?.content ?? (Array.isArray(response) ? response : []);

            this._renderSearchSuggestions($suggestionsBox, items, query);
        } catch (error) {
            console.warn('Error fetching search suggestions from API:', error);
            // Fallback to in-memory matching if API is offline
            const matchingBeans = this._searchMatchingNodes(query, 12);
            this._renderSearchSuggestions($suggestionsBox, matchingBeans, query);
        }
    }

    _searchMatchingNodes(searchQuery, maxResultsCount) {
        const candidateBeans = [];
        const visitedKeys = new Set();

        // 1. Search all beans loaded in beanDataStore
        if (beanDataStore?.beansMap?.size > 0) {
            for (const bean of beanDataStore.beansMap.values()) {
                if (!bean || !bean.beanName) continue;
                const fullName = bean.beanName;
                const contextId = bean.contextId || '';
                const uniqueKey = `${contextId}:${fullName}`;
                if (visitedKeys.has(uniqueKey)) continue;
                visitedKeys.add(uniqueKey);

                const displayName = GraphTreeBuilder._displayName(fullName);
                candidateBeans.push({
                    beanName: displayName,
                    fullName,
                    contextId,
                    type: bean.type || '',
                    scope: bean.scope || ''
                });
            }
        }

        // 2. Fallback to tree traversal if beanDataStore is empty
        if (candidateBeans.length === 0 && this.root) {
            const traversalStack = [this.root];
            while (traversalStack.length > 0) {
                const currentNode = traversalStack.pop();
                const nodeData = currentNode.data ?? {};
                const { fullName, meta = {}, contextId = '' } = nodeData;
                const uniqueKey = `${contextId}:${fullName}`;

                if (fullName && !visitedKeys.has(uniqueKey)) {
                    visitedKeys.add(uniqueKey);
                    const displayName = GraphTreeBuilder._displayName(fullName);
                    candidateBeans.push({
                        beanName: displayName,
                        fullName,
                        contextId,
                        type: meta.type || '',
                        scope: meta.scope || ''
                    });
                }

                const childNodes = currentNode.children ?? currentNode._children;
                if (childNodes) {
                    for (let i = childNodes.length - 1; i >= 0; i--) {
                        traversalStack.push(childNodes[i]);
                    }
                }
            }
        }

        const results = BeanSearchEngine.search(candidateBeans, searchQuery, {
            limit: maxResultsCount,
            scoreResults: true
        });

        return results.map(b => ({
            beanName: b.beanName,
            fullName: b.fullName,
            contextId: b.contextId || '',
            type: b.type,
            scope: b.scope
        }));
    }

    _renderSearchSuggestions($suggestionsBox, matchingBeans, query = '') {
        if (!matchingBeans || matchingBeans.length === 0) {
            $suggestionsBox
                .html('<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs italic">No matching beans found</div>')
                .show();
            return;
        }

        $suggestionsBox.empty();
        const fragment = document.createDocumentFragment();
        matchingBeans.forEach(matchingBean => {
            const { contextId = '', beanName, type, scope } = matchingBean;
            const resolvedFullName = matchingBean.fullName || beanName;
            const meta = resolveBeanMetadata({ beanName: resolvedFullName, type: type });

            const itemElem = document.createElement('div');
            itemElem.className = 'suggestion-item px-3 py-2 text-xs hover:bg-purple-50/60 dark:hover:bg-purple-950/40 cursor-pointer flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800/60 last:border-b-0 transition-colors';
            itemElem.setAttribute('data-fullname', resolvedFullName);
            itemElem.setAttribute('data-context-id', contextId || '');

            const highlightedName = BeanSearchEngine.highlight(beanName || resolvedFullName, query);
            const shortType = type ? type.split('.').pop() : '';

            itemElem.innerHTML = `
                <div class="flex items-center gap-2 min-w-0">
                    <span class="material-symbols-outlined text-[16px] flex-shrink-0" style="color: ${meta.color}">${meta.icon}</span>
                    <div class="min-w-0">
                        <div class="font-semibold text-gray-800 dark:text-gray-200 truncate">${highlightedName}</div>
                        ${shortType ? `<div class="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">${shortType}</div>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    ${contextId ? `<span class="px-1.5 py-0.5 text-[9px] font-medium rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50 truncate max-w-[120px]" title="${contextId}">${contextId}</span>` : ''}
                    ${scope ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 uppercase">${scope}</span>` : ''}
                </div>
            `;

            fragment.appendChild(itemElem);
        });

        $suggestionsBox.append(fragment).show();
    }

    _bindOutsideSearchDismissal() {
        $(document).on('click', (event) => {
            const isClickInsideSearch = Boolean(
                event.target.closest('#search-input') ||
                event.target.closest('#search-suggestions')
            );

            if (!isClickInsideSearch) {
                $('#search-suggestions').hide();
            }
        });
    }

    _bindClickActionRouter() {
        $(document).on('click', (event) => {
            const $clickedElement = $(event.target);

            if (this._handleBeanNavigationClick($clickedElement, event)) return;
            if (this._handleAccordionToggleClick($clickedElement)) return;
            this._handleToolbarActionClick($clickedElement);
        });
    }

    _handleBeanNavigationClick($clickedElement, event) {
        const $navigationLink = $clickedElement.closest('.suggestion-item, .dep-item-left, .dep-link');
        if ($navigationLink.length === 0) return false;

        event.stopPropagation();

        const isSuggestion = $navigationLink.hasClass('suggestion-item');
        if (isSuggestion) {
            $('#search-input').val('');
            $('#search-suggestions').hide();
        }

        const targetBeanFullName = $navigationLink.data('fullname') || $navigationLink.attr('data-fullname');
        const targetContextId = $navigationLink.data('context-id') || $navigationLink.attr('data-context-id') || this.selectedContextId || '';

        if (targetBeanFullName) {
            if (isSuggestion) {
                this.focusOnBean(targetBeanFullName, targetContextId, false);
            } else {
                this.showBeanDetails(targetBeanFullName, targetContextId);
            }
        }

        return true;
    }

    _handleAccordionToggleClick($clickedElement) {
        const $accordionHeader = $clickedElement.closest('.accordion-header');
        if (!$accordionHeader.length) return false;

        $accordionHeader.toggleClass('open');
        $accordionHeader.find('.material-symbols-outlined').toggleClass('rotate-90');
        $accordionHeader.next('.accordion-body').slideToggle(200);

        return true;
    }

    _handleToolbarActionClick($clickedElement) {
        const $actionButton = $clickedElement.closest('button, [id^="btn-"]');
        if ($actionButton.length === 0) return;

        const actionButtonId = $actionButton.attr('id');
        const buttonActionMap = this._getToolbarActionMap($actionButton);

        const targetActionHandler = buttonActionMap[actionButtonId];
        if (targetActionHandler) {
            targetActionHandler();
        }
    }

    _getToolbarActionMap($actionButton) {
        return {
            'btn-expand': () => this._expandVisibleNodes(2),
            'btn-collapse': () => this._mutateTreeNodes(node => { if (node.depth > 0) node.children = null; }),
            'btn-control-zoom-in': () => this.zoomBy(1.25),
            'btn-control-zoom-out': () => this.zoomBy(0.8),
            'btn-control-fit': () => this.fitView(),
            'btn-pan-mode': () => this.fitView(),
            'btn-highlight-path': () => this._togglePathHighlightState($actionButton),
            'btn-close-sidebar': () => this.closeSidebar(),
            'btn-tb': () => this.setMode('tb'),
            'btn-lr': () => this.setMode('lr')
        };
    }

    _togglePathHighlightState($highlightButton) {
        const HIGHLIGHT_BUTTON_CLASSES = {
            active: 'bg-primary text-white border-primary hover:bg-primary/90',
            inactive: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        };

        this.isHighlightPathActive = !this.isHighlightPathActive;

        $highlightButton
            .toggleClass(HIGHLIGHT_BUTTON_CLASSES.active, this.isHighlightPathActive)
            .toggleClass(HIGHLIGHT_BUTTON_CLASSES.inactive, !this.isHighlightPathActive);

        if (!this.isHighlightPathActive) {
            this.resetPathHighlight();
        } else if (this.selectedNodeRef) {
            this.highlightPathForNode(this.selectedNodeRef);
        }
    }

    _bindCustomEventHandlers() {
        document.addEventListener('themechanged', () => {
            if (this.root) {
                this._renderCanvas();
            }
        });

        window.addEventListener('resize', debounce(() => {
            if (this.canvasRenderer && this.root) {
                this._renderCanvas();
            }
        }, 150));

        $(document).on('change', '#context-filter', (event) => {
            this.selectedContextId = $(event.target).val();
            const beans = this.accumulatedBeans.length > 0 ? this.accumulatedBeans : null;
            this._buildHierarchyFromDependencies(beans);
            this.update(null, { x: 0, y: 0, x0: 0, y0: 0 });
            this._updateTotalBeanCount();
            this.fitView(500);
        });

        $(document).on('click', '.tab-btn', (event) => {
            const tabName = $(event.currentTarget).attr('data-tab');
            if (tabName) {
                this.switchTab(tabName);
            }
        });
    }

    _expandVisibleNodes(maxDepth = 2) {
        if (!this.root) return;
        this.root.eachBefore(node => {
            if (node.depth < maxDepth) {
                if (!node._children || node._children.length === 0) {
                    this._lazyLoadChildren(node);
                }
                node.children = node._children;
            }
        });
        this.update(null, this.root);
        this.fitView(400);
    }

    _mutateTreeNodes(mutatorFn) {
        if (!this.root) return;
        this.root.eachBefore(mutatorFn);
        this.update(null, this.root);
        this.fitView();
    }

    _updateProgressBadge({ loaded = 0, total = 0, isComplete = false, hasError = false, errorMsg = '' } = {}) {
        const $badgeElement = $('#chunk-progress-badge');
        const $dotElement = $('#chunk-progress-dot');
        const $textElement = $('#chunk-progress-text');

        if ($badgeElement.length === 0) return;

        const progressState = this._resolveProgressState(hasError, isComplete);
        const configuration = this._getProgressConfiguration(progressState, { loaded, total, errorMsg });

        $badgeElement.removeClass(ALL_PROGRESS_BADGE_CLASSES).addClass(configuration.badgeClass);
        $dotElement.removeClass(ALL_PROGRESS_DOT_CLASSES).addClass(configuration.dotClass);
        $textElement.html(configuration.textHtml);
    }

    _resolveProgressState(hasError, isComplete) {
        if (hasError) return 'error';
        if (isComplete) return 'complete';
        return 'loading';
    }

    _getProgressConfiguration(state, { loaded, total, errorMsg }) {
        const style = PROGRESS_BADGE_STYLES[state] || PROGRESS_BADGE_STYLES.loading;

        const textHtmlMap = {
            error: `Failed <span class="text-[11px] opacity-85">(${errorMsg || 'Retry'})</span>`,
            complete: `Loaded (${loaded})`,
            loading: `Loading: ${loaded} / ${total}`
        };

        return {
            badgeClass: style.badge,
            dotClass: style.dot,
            textHtml: textHtmlMap[state]
        };
    }

    leave() {
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
        }
        this.closeSidebar();
        this.clearFocusedNode();
        this._debouncedGraphSearch?.cancel();
        $(document).off('keydown.graphSearchShortcut');
        $('#search-input').val('');
        $('#search-results').addClass('hidden').empty();
        $('#tip').removeClass('show');
    }
}