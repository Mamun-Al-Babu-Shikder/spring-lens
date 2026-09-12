import {
    GraphTreeBuilder,
    ALL_ADVICE_FROZEN_CLASSES,
    ALL_DEFINITION_STATUS_CLASSES,
    ALL_PROXY_PILL_CLASSES,
    ALL_PROXY_TAB_CLASSES,
    ALL_TAB_BUTTON_CLASSES,
    Formatter,
    BeanMetadataRules,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget managing the slide-over details sidebar (#time-details-sidebar).
 * Handles bean telemetry inspector, definition status, and AOP/CGLIB proxy metadata panels.
 */
export class InstanceSidebarWidget {

    /**
     * @param {Object} [options={}] - Options and callbacks
     */
    constructor(options = {}) {
        this.options = options;
        this.activeTab = 'telemetry';
    }

    /**
     * Opens the slide-over details drawer with smooth width transition.
     */
    openSidebar() {
        const $sidebar = $('#time-details-sidebar');
        if (!$sidebar.length) return;

        $sidebar
            .removeClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0')
            .addClass('w-[380px] max-w-[380px] opacity-100 mr-0 border');
    }

    /**
     * Closes the slide-over details drawer and resets internal pane states.
     */
    closeSidebar() {
        const $sidebar = $('#time-details-sidebar');
        $('#time-sidebar-footer').addClass('hidden').hide();
        $('#time-sidebar-proxy-type').addClass('hidden').hide();
        $('#time-sidebar-proxy-loading').addClass('hidden').hide();
        $('#time-sidebar-proxy-content').addClass('hidden').hide();
        $('#time-sidebar-proxy-empty').addClass('hidden').hide();
        $('#time-sidebar-tab-proxy-badge').addClass('hidden').hide();
        this.switchTab('telemetry');

        if (!$sidebar.length) return;

        $sidebar
            .removeClass('w-[380px] max-w-[380px] opacity-100 mr-0 border')
            .addClass('w-0 max-w-0 opacity-0 pointer-events-none -mr-6 border-0');
    }

    /**
     * Switches the active sidebar tab between 'telemetry' and 'proxy'.
     *
     * @param {string} tabName - 'telemetry' or 'proxy'
     */
    switchTab(tabName) {
        if (!tabName) return;
        this.activeTab = tabName;

        const isProxy = tabName === 'proxy';
        const $telemetryBtn = $('#time-sidebar-tab-telemetry');
        const $proxyBtn = $('#time-sidebar-tab-proxy');
        const $telemetryPane = $('#time-sidebar-pane-telemetry');
        const $proxyPane = $('#time-sidebar-pane-proxy');

        $proxyBtn
            .removeClass(ALL_TAB_BUTTON_CLASSES)
            .addClass(BeanMetadataRules.resolveTabButtonClass(isProxy));
        $telemetryBtn
            .removeClass(ALL_TAB_BUTTON_CLASSES)
            .addClass(BeanMetadataRules.resolveTabButtonClass(!isProxy));

        if (isProxy) {
            $telemetryPane.addClass('hidden').hide();
            $proxyPane.removeClass('hidden').show();
        } else {
            $proxyPane.addClass('hidden').hide();
            $telemetryPane.removeClass('hidden').show();
        }
    }

    /**
     * Renders bean telemetry details into the sidebar inspector pane.
     *
     * @param {Object} instance - Bean instance record
     * @param {number} maxDurationNanos - Max duration in nanos
     * @param {number} bottleneckThresholdNanos - Bottleneck threshold in nanos
     */
    renderSidebarDetails(instance, maxDurationNanos, bottleneckThresholdNanos) {
        if (!instance) return;

        const { beanName, type, scope, initDurationNanos, contextId, createdAt, hasDefinition } = instance;
        const metadata = BeanMetadataRules.resolveBeanMetadata(instance);

        const data = {
            name: GraphTreeBuilder._displayName(beanName),
            type: type || 'N/A',
            scope: Formatter.capitalize(scope || 'singleton'),
            duration: Formatter.formatDuration(initDurationNanos),
            context: contextId || 'root',
            created: Formatter.formatDateTime(createdAt),
            nanos: (initDurationNanos || 0).toLocaleString() + ' ns',
            definitionStatus: hasDefinition ? 'DEFINED' : 'DYNAMIC'
        };

        this.openSidebar();

        $('#time-sidebar-icon').text(metadata.icon || 'schema');
        $('#time-sidebar-icon-container').css({
            backgroundColor: `${metadata.color}15`,
            color: metadata.color,
            borderColor: `${metadata.color}30`
        });

        const titles = {
            name: beanName,
            type: type || 'N/A',
            scope: capitalize(scope || 'singleton'),
            duration: (initDurationNanos || 0).toLocaleString() + ' ns',
            context: contextId || 'root',
            created: createdAt || 'N/A',
            nanos: (initDurationNanos || 0).toLocaleString() + ' ns',
            definitionStatus: hasDefinition ? 'Defined in Application Context' : 'Dynamically Registered'
        };

        const $sidebar = $('#time-details-sidebar');
        $sidebar.find('[data-field]').each((_, el) => {
            const field = el.dataset.field;
            if (data[field] != null) {
                $(el).text(data[field]);
            }
            if (titles[field] != null) {
                $(el).attr('title', titles[field]);
            }
        });

        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos);
        $('#time-sidebar-duration').css('color', durationStyle.color);

        $('#time-sidebar-definition-status')
            .removeClass(ALL_DEFINITION_STATUS_CLASSES)
            .addClass(BeanMetadataRules.resolveDefinitionStatusBadgeClass(hasDefinition));

        const $footer = $('#time-sidebar-footer');
        const $viewBtn = $('#time-btn-view-details');

        if (hasDefinition) {
            const href = `#/definitions?beanName=${encodeURIComponent(beanName)}${contextId ? `&contextId=${encodeURIComponent(contextId)}` : ''}`;
            $viewBtn.attr('href', href);
            $footer.removeClass('hidden').show();
        } else {
            $viewBtn.attr('href', '#/definitions');
            $footer.addClass('hidden').hide();
        }
    }

    /**
     * Shows or hides the proxy inspection loading state.
     *
     * @param {boolean} isLoading - Loading flag
     */
    setProxyLoading(isLoading) {
        const $loading = $('#time-sidebar-proxy-loading');
        if (isLoading) {
            $('#time-sidebar-proxy-type').addClass('hidden').hide();
            $('#time-sidebar-proxy-content').addClass('hidden').hide();
            $('#time-sidebar-proxy-empty').addClass('hidden').hide();
            $loading.removeClass('hidden').show();
        } else {
            $loading.addClass('hidden').hide();
        }
    }

    /**
     * Renders AOP Proxy metadata details into the proxy inspector tab.
     *
     * @param {Object} proxyInfo - Proxy metadata from API
     */
    renderProxyInfo(proxyInfo) {
        if (!proxyInfo) return;

        const { targetClass, advices = [], proxiedInterfaces = [], adviceFrozen, proxyType } = proxyInfo;

        const proxyStyles = BeanMetadataRules.resolveProxyBadgeStyles(proxyType);
        const proxyTypeText = proxyType || 'CGLIB';

        const $typeBadge = $('#time-sidebar-proxy-type');
        const $tabBadge = $('#time-sidebar-tab-proxy-badge');

        $typeBadge.text(proxyTypeText)
            .removeClass(ALL_PROXY_PILL_CLASSES)
            .addClass(proxyStyles.pill)
            .removeClass('hidden')
            .show();

        $tabBadge.text(proxyTypeText)
            .removeClass(ALL_PROXY_TAB_CLASSES)
            .addClass(proxyStyles.tab)
            .removeClass('hidden')
            .show();

        // Target Class
        const targetClassDisplay = targetClass || 'N/A';
        $('#time-sidebar-proxy-target-class')
            .text(targetClassDisplay)
            .attr('title', targetClassDisplay);

        // Advice Frozen
        $('#time-sidebar-proxy-frozen')
            .text(adviceFrozen ? 'TRUE' : 'FALSE')
            .removeClass(ALL_ADVICE_FROZEN_CLASSES)
            .addClass(BeanMetadataRules.resolveAdviceFrozenClass(adviceFrozen));

        // Advices list
        $('#time-sidebar-proxy-advices-count').text(advices.length);
        const $advicesList = $('#time-sidebar-proxy-advices-list');
        $advicesList.empty();
        if (advices.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-proxy-empty-item');
            if (emptyClone) {
                const $emptyItem = $(emptyClone.firstElementChild);
                $emptyItem.find('[data-field="message"]').text('No custom advices attached');
                $advicesList.append($emptyItem);
            }
        } else {
            advices.forEach(adv => {
                const shortName = adv.includes('.') ? adv.split('.').pop() : adv;
                const clone = TemplateEngine.clone('tpl-proxy-item');
                if (!clone) return;
                const $item = $(clone.firstElementChild);
                $item.find('[data-field="name"]').text(shortName).attr('title', adv);
                $item.find('[data-field="badge"]').text('Advice');
                $advicesList.append($item);
            });
        }

        // Interfaces list
        $('#time-sidebar-proxy-interfaces-count').text(proxiedInterfaces.length);
        const $interfacesList = $('#time-sidebar-proxy-interfaces-list');
        $interfacesList.empty();
        if (proxiedInterfaces.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-proxy-empty-item');
            if (emptyClone) {
                const $emptyItem = $(emptyClone.firstElementChild);
                $emptyItem.find('[data-field="message"]').text('No interfaces proxied (CGLIB class proxy)');
                $interfacesList.append($emptyItem);
            }
        } else {
            proxiedInterfaces.forEach(iface => {
                const shortName = iface.includes('.') ? iface.split('.').pop() : iface;
                const clone = TemplateEngine.clone('tpl-proxy-item');
                if (!clone) return;
                const $item = $(clone.firstElementChild);
                $item.find('[data-field="name"]').text(shortName).attr('title', iface);
                $item.find('[data-field="badge"]').text('Interface');
                $interfacesList.append($item);
            });
        }

        $('#time-sidebar-proxy-empty').addClass('hidden').hide();
        $('#time-sidebar-proxy-content').removeClass('hidden').show();
    }

    /**
     * Renders the Direct / Non-proxied POJO empty state card.
     */
    renderProxyEmptyState() {
        $('#time-sidebar-proxy-type').addClass('hidden').hide();
        const directStyles = BeanMetadataRules.resolveProxyBadgeStyles('DIRECT');
        $('#time-sidebar-tab-proxy-badge')
            .text('Direct')
            .removeClass(ALL_PROXY_TAB_CLASSES)
            .addClass(directStyles.tab)
            .removeClass('hidden')
            .show();
        $('#time-sidebar-proxy-content').addClass('hidden').hide();
        $('#time-sidebar-proxy-empty').removeClass('hidden').show();
    }
}
