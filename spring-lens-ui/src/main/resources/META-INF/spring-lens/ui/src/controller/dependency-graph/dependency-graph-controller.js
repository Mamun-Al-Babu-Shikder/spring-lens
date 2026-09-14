import BaseController from '../base-controller.js';
import {
    DependencyGraphService,
    GraphHierarchyBuilder,
    GraphPathTracer,
    GraphCanvasWidget,
    GraphSearchWidget,
    GraphSidebarWidget,
    PROGRESS_BADGE_STYLES,
    ALL_PROGRESS_BADGE_CLASSES,
    ALL_PROGRESS_DOT_CLASSES,
    TemplateEngine,
    QueryParam,
    ToastNotification,
    AsyncUtils
} from './index.js';

/**
 * Controller Facade for the Spring Bean Dependency Graph.
 * Coordinates data ingestion, tree hierarchy formation, interactive canvas rendering,
 * search exploration, path tracing, and the bean details slide-over panel.
 */
export class DependencyGraphController extends BaseController {

    /**
     * @param {Object} [endpoints] - API endpoints mapping
     */
    constructor(endpoints = {}) {
        super('dependencyGraph');
        this.service = new DependencyGraphService(endpoints);

        this.pathTracer = new GraphPathTracer({
            onStateChange: () => this._renderCanvas()
        });

        this.canvasWidget = new GraphCanvasWidget({
            onNodeClick: (event, node) => this._handleNodeClick(event, node),
            onToggleClick: (event, node) => this._handleToggleClick(event, node),
            onNodeHover: (event, node) => {
                this.pathTracer.highlightPathForNode(node);
            },
            onNodeLeave: () => {
                this.pathTracer.resetPathHighlight(this.selectedNodeRef);
            },
            onBackgroundClick: () => {
                this.closeSidebar();
                this.clearFocusedNode();
            }
        });

        this.sidebarWidget = new GraphSidebarWidget({
            onTransition: () => this.canvasWidget.animateSidebarTransition(this.root, this._getExtraCanvasConfig())
        });

        this.searchWidget = new GraphSearchWidget(this.service, {
            onSelectBean: (fullName, contextId, isSuggestion) => {
                if (isSuggestion) {
                    this.focusOnBean(fullName, contextId, false);
                } else {
                    this.showBeanDetails(fullName, contextId);
                }
            },
            getRootNode: () => this.root,
            getSelectedContextId: () => this.selectedContextId
        });

        this.addDisposable(this.canvasWidget);
        this.addDisposable(this.searchWidget);

        this.root = null;
        this.selectedContextId = '';
        this.selectedNodeRef = null;
    }

    // --- Backward Compatibility Getters & Setters ---

    get canvas() {
        return this.canvasWidget.canvas;
    }

    set canvas(value) {
        this.canvasWidget.canvas = value;
    }

    get canvasRenderer() {
        return this.canvasWidget.canvasRenderer;
    }

    get zoom() {
        return this.canvasWidget.zoom;
    }

    get currentTransform() {
        return this.canvasWidget.currentTransform;
    }

    set currentTransform(value) {
        this.canvasWidget.currentTransform = value;
    }

    get isHighlightPathActive() {
        return this.pathTracer.isHighlightPathActive;
    }

    set isHighlightPathActive(val) {
        this.pathTracer.isHighlightPathActive = val;
    }

    get activePathNodeRefs() {
        return this.pathTracer.activePathNodeRefs;
    }

    get activePathNodeIds() {
        return this.pathTracer.activePathNodeIds;
    }

    get activePathNodeNames() {
        return this.pathTracer.activePathNodeNames;
    }

    get focusedNodeFullName() {
        return this.canvasWidget.focusedNodeFullName;
    }

    get focusedNodeContextId() {
        return this.canvasWidget.focusedNodeContextId;
    }

    get focusedNodeId() {
        return this.canvasWidget.focusedNodeId;
    }

    get mode() {
        return this.canvasWidget.mode;
    }

    set mode(val) {
        this.canvasWidget.mode = val;
    }

    get totalElements() {
        return this.service.totalElements;
    }

    get accumulatedBeans() {
        return this.service.accumulatedBeans;
    }

    get beanDependencies() {
        return this.service.beanDependencies;
    }

    get beanDetailsCache() {
        return this.service.beanDetailsCache;
    }

    get dependencyGraphApi() {
        return this.service.dependencyGraphApi;
    }

    get beanDefinitions() {
        return this.service.beanDefinitions;
    }

    get findBeanDefinitionsApi() {
        return this.service.findBeanDefinitionsApi;
    }

    // --- Lifecycle Methods ---

    initEvents() {
        this.searchWidget.bindEvents();
        this._bindClickActionRouter();
        this._bindCustomEventHandlers();
    }

    async enter(params) {
        this.initEvents();
        this.sidebarWidget.initSidebar();
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
        return this.canvasWidget.init(canvasElem, () => this.root);
    }

    _bindControls() {
        this.on('#btn-reload-graph', 'click', () => this.reloadGraphData());
    }

    async reloadGraphData() {
        const $btn = $('#btn-reload-graph');
        const $icon = $btn.find('.material-symbols-outlined');
        $icon.addClass('animate-spin');

        try {
            await this.service.fetchBeanGraphDependencies((progress) => this._updateProgressBadge(progress));
            this._buildHierarchyFromDependencies();
            this._updateTotalBeanCount();
            this.update(null, null, 0);
            this.fitView(0);
        } catch (error) {
            console.error('Error reloading graph data:', error);
        } finally {
            setTimeout(() => $icon.removeClass('animate-spin'), 600);
        }
    }

    async _loadInitialData() {
        try {
            await this.service.fetchBeanGraphDependencies((progress) => this._updateProgressBadge(progress));
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
        this.update(null, null, 0);
        this.fitView(0);
    }

    _handlePendingBeanFocus(params) {
        const targetBean = QueryParam.get(params, 'focus', 'search', 'bean');
        const contextId = QueryParam.get(params, 'contextId', 'context') || '';
        if (!targetBean) return;

        setTimeout(() => this.focusOnBean(targetBean, contextId, false), 300);
    }

    // --- Hierarchy & Data Delegation ---

    async fetchBeanDetails(contextId, beanName) {
        return this.service.fetchBeanDetails(contextId, beanName);
    }

    _mergeBeanDetailsIntoTree(node, details) {
        GraphHierarchyBuilder.mergeBeanDetailsIntoTree(node, details, (n) => this._calculateNodeWidth(n));
    }

    _nodeHasChildren(node) {
        return GraphHierarchyBuilder.nodeHasChildren(node);
    }

    _lazyLoadChildren(node) {
        GraphHierarchyBuilder.lazyLoadChildren(node, (n) => this._calculateNodeWidth(n));
    }

    _createDynamicHierarchyChild(parentNode, beanName, contextId, isCycle = false) {
        return GraphHierarchyBuilder.createDynamicHierarchyChild(parentNode, beanName, contextId, isCycle, (n) => this._calculateNodeWidth(n));
    }

    _buildHierarchyFromDependencies(beanDefinitions = null) {
        const listOfBeans = beanDefinitions || this.service.accumulatedBeans;
        if (!listOfBeans || listOfBeans.length === 0) {
            this.root = null;
            return;
        }

        this._populateContextFilter(listOfBeans);
        this.root = GraphHierarchyBuilder.buildHierarchy(
            listOfBeans,
            this.selectedContextId,
            (node) => this._calculateNodeWidth(node)
        );
    }

    _populateContextFilter(beanDefinitions = []) {
        const $contextFilterSelectElement = $('#context-filter');
        if ($contextFilterSelectElement.length === 0) return;

        const uniqueContextIdentifiers = GraphHierarchyBuilder.extractUniqueContextIdentifiers(beanDefinitions);
        const $filterContainerElement = $contextFilterSelectElement.closest('#context-filter-container').length
            ? $contextFilterSelectElement.closest('#context-filter-container')
            : $contextFilterSelectElement.parent();

        if (uniqueContextIdentifiers.length <= 1) {
            $filterContainerElement.addClass('hidden').removeClass('flex');
            return;
        }

        $filterContainerElement.removeClass('hidden').addClass('flex');
        const renderedOptionsHtml = GraphHierarchyBuilder.buildContextFilterOptionsHtml(
            uniqueContextIdentifiers,
            this.selectedContextId
        );
        $contextFilterSelectElement.html(renderedOptionsHtml);
    }

    _updateTotalBeanCount() {
        const beanList = this.service.accumulatedBeans;
        const totalElements = this.service.totalElements || beanList.length;
        $('#beans-count').text(totalElements);

        let totalDeps = 0;
        for (let i = 0; i < beanList.length; i++) {
            totalDeps += beanList[i]?.dependencies?.length ?? 0;
        }
        $('#deps-count').text(totalDeps);
    }

    // --- Canvas & Rendering Delegation ---

    _getExtraCanvasConfig() {
        return {
            isHighlightPathActive: this.isHighlightPathActive,
            selectedNodeRef: this.selectedNodeRef,
            isNodeHighlighted: (node) => this.pathTracer.isNodeInActivePath(node),
            isLinkHighlighted: (link) => this.pathTracer.isLinkInActivePath(link)
        };
    }

    _renderCanvas(source = null, duration = 0) {
        this.canvasWidget.renderCanvas(this.root, source, duration, this._getExtraCanvasConfig());
    }

    update(event, source = null, customDuration = null) {
        this.canvasWidget.update(
            this.root,
            event,
            source,
            customDuration,
            this._getExtraCanvasConfig(),
            (node) => this._nodeHasChildren(node)
        );
    }

    _calculateNodeWidth(node) {
        return this.canvasWidget.calculateNodeWidth(node, (n) => this._nodeHasChildren(n));
    }

    highlightPathForNode(node) {
        this.pathTracer.highlightPathForNode(node);
    }

    resetPathHighlight() {
        this.pathTracer.resetPathHighlight(this.selectedNodeRef);
    }

    showTip(event, node) {
        this.canvasWidget.showTip(event, node);
    }

    zoomBy(factor, duration = 300) {
        this.canvasWidget.zoomBy(factor, duration);
    }

    fitView(duration = 500, padding = 50, minScale = 0.25, maxScale = 0.88) {
        this.canvasWidget.fitView(this.root, duration, padding, minScale, maxScale, this._getExtraCanvasConfig());
    }

    updateZoomPercent(k) {
        this.canvasWidget.updateZoomPercent(k);
    }

    markNodeAsFocused(targetNode) {
        this.canvasWidget.markNodeAsFocused(targetNode, this.root, this._getExtraCanvasConfig());
    }

    clearFocusedNode() {
        this.canvasWidget.clearFocusedNode(this.root, this._getExtraCanvasConfig());
    }

    setMode(layoutMode, triggerUpdate = true) {
        this.canvasWidget.setMode(
            layoutMode,
            triggerUpdate ? this.root : null,
            (source) => this.update(null, source)
        );
    }

    findNodeInTree(rootNode, targetIdentifier, targetContextId = null) {
        return GraphHierarchyBuilder.findNodeInTree(rootNode, targetIdentifier, targetContextId);
    }

    _expandPathToBean(targetBeanName, contextId = '') {
        return GraphHierarchyBuilder.expandPathToBean(
            this.root,
            targetBeanName,
            contextId,
            (n) => this._calculateNodeWidth(n),
            (r) => this.update(null, r)
        );
    }

    // --- Interactive Navigation & Node Details ---

    async focusOnBean(fullName, contextId = '', openSidebar = false) {
        if (!fullName) return;

        // Auto-switch context filter if requested bean belongs to a different context
        if (contextId && this.selectedContextId && this.selectedContextId !== contextId) {
            this.selectedContextId = contextId;
            $('#context-filter').val(contextId);
            const beans = this.service.accumulatedBeans.length > 0 ? this.service.accumulatedBeans : null;
            this._buildHierarchyFromDependencies(beans);
            this.update(null, null, 0);
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

                if (this.canvasWidget.canvasRenderer) {
                    const state = this.canvasWidget.canvasRenderer.nodeStates.get(targetNode.id);
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

                const $graph = $('#beanGraph');
                const width = $graph.width() || 800;
                const height = $graph.height() || 600;

                const zoomScale = 1.15;
                const translateX = width / 2 - targetX * zoomScale;
                const translateY = height / 2 - targetY * zoomScale;

                const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(zoomScale);
                this.currentTransform = newTransform;
                d3.select(this.canvas).property('__zoom', newTransform);

                if (this.canvasWidget.canvasRenderer) {
                    this.canvasWidget.canvasRenderer.animateTransform(newTransform, 500, (k) => this.updateZoomPercent(k));
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
            beanDetails = fetched || { beanName, contextId };
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

        this.sidebarWidget.populateDetails(beanDetails);
        this.sidebarWidget.renderDependencyAccordions(dependencies, dependents, contextId);

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

    openSidebar() {
        this.sidebarWidget.openSidebar();
    }

    closeSidebar(immediate = false) {
        this.sidebarWidget.closeSidebar();
    }

    switchTab(tabName) {
        this.sidebarWidget.switchTab(tabName);
    }

    // --- Node Click / Toggle / Selection Handlers ---

    async _handleNodeClick(event, node) {
        this.markNodeAsFocused(node);

        const { contextId, fullName, meta } = node.data;

        if (meta?.type === 'context') {
            this.closeSidebar();
            await this._handleToggleClick(event, node);
            return;
        }

        const details = await this.fetchBeanDetails(contextId, fullName);
        if (details) this._mergeBeanDetailsIntoTree(node, details);
        await this.selectNodeAndShowDetails(node, details);

        this.canvasWidget.hideTip();
    }

    async _handleToggleClick(event, node) {
        const { contextId, fullName, meta } = node.data;
        if (meta?.type !== 'context') {
            const details = await this.fetchBeanDetails(contextId, fullName);
            if (details) this._mergeBeanDetailsIntoTree(node, details);
        }

        if (!node._children || node._children.length === 0) {
            this._lazyLoadChildren(node);
        }

        node.children = node.children ? null : node._children;
        this.update(event, node);
        this.canvasWidget.hideTip();
    }

    // --- Toolbar, Accordion & Action Routing ---

    _bindClickActionRouter() {
        this.on(document, 'click', (event) => {
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
            'btn-highlight-path': () => this.pathTracer.toggleHighlightState($actionButton, this.selectedNodeRef),
            'btn-close-sidebar': () => this.closeSidebar(),
            'btn-tb': () => this.setMode('tb'),
            'btn-lr': () => this.setMode('lr')
        };
    }

    _bindCustomEventHandlers() {
        const themeHandler = () => {
            if (this.root) {
                this._renderCanvas();
            }
        };
        document.addEventListener('themechanged', themeHandler);
        this.addDisposable(() => document.removeEventListener('themechanged', themeHandler));

        const debouncedResize = AsyncUtils.debounce(() => {
            if (this.canvasWidget.canvasRenderer && this.root) {
                this._renderCanvas();
            }
        }, 150);
        window.addEventListener('resize', debouncedResize);
        this.addDisposable(() => {
            window.removeEventListener('resize', debouncedResize);
            debouncedResize.cancel?.();
        });

        this.on(document, 'change', '#context-filter', (event) => {
            this.selectedContextId = $(event.target).val();
            const beans = this.service.accumulatedBeans.length > 0 ? this.service.accumulatedBeans : null;
            this._buildHierarchyFromDependencies(beans);
            this.update(null, null, 0);
            this._updateTotalBeanCount();
            this.fitView(500);
        });

        this.on(document, 'click', '.tab-btn', (event) => {
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

    // --- Loading Progress Indicator ---

    _updateProgressBadge({ loaded = 0, total = 0, isComplete = false, hasError = false, errorMsg = '' } = {}) {
        const $badgeElement = $('#chunk-progress-badge');
        const $dotElement = $('#chunk-progress-dot');
        const $textElement = $('#chunk-progress-text');

        if ($badgeElement.length === 0) return;

        const progressState = hasError ? 'error' : (isComplete ? 'complete' : 'loading');
        const style = PROGRESS_BADGE_STYLES[progressState] || PROGRESS_BADGE_STYLES.loading;

        const textHtmlMap = {
            error: `Failed <span class="text-[11px] opacity-85">(${errorMsg || 'Retry'})</span>`,
            complete: `Loaded (${loaded})`,
            loading: `Loading: ${loaded} / ${total}`
        };

        $badgeElement.removeClass(ALL_PROGRESS_BADGE_CLASSES).addClass(style.badge);
        $dotElement.removeClass(ALL_PROGRESS_DOT_CLASSES).addClass(style.dot);
        $textElement.html(textHtmlMap[progressState]);
    }

    // --- Teardown & Route Leave ---

    leave() {
        this.closeSidebar();
        this.clearFocusedNode();
        this.selectedNodeRef = null;

        $('#search-input').val('');
        $('#search-suggestions').hide().empty();

        super.leave();
    }
}

export default DependencyGraphController;
