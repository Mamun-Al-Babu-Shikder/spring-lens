import {
    GraphTreeBuilder,
    BeanMetadataRules,
    Formatter,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget managing the Waterfall / Gantt chart visualization view (#instance-gantt-card).
 * Handles the dynamic time ruler axis, vertical grid lines, scrubber tracking needle,
 * zoom scaling, load-more pagination, and Gantt bar latency rendering.
 */
export class InstanceWaterfallWidget {

    /**
     * @param {Object} [options={}] - Options and callbacks
     */
    constructor(options = {}) {
        this.options = options;
        this.zoomLevel = 1;
        this._lastScrubberMouseEvent = null;
    }

    /**
     * Renders the dynamic time ruler tick markers and vertical grid lines.
     *
     * @param {number} maxTimeMs - Maximum time span in milliseconds
     */
    renderTimeRulerAndGrid(maxTimeMs) {
        const $ruler = $('#instance-ruler-ticks');
        const $grid = $('#instance-grid-lines');
        if (!$ruler.length || !$grid.length) return;

        $ruler.empty();
        $grid.empty();

        const effectiveMax = maxTimeMs || 10;
        const ticks = BeanMetadataRules.calculateTimeTicks(effectiveMax);
        const rulerFragment = document.createDocumentFragment();
        const gridFragment = document.createDocumentFragment();

        ticks.forEach((tick) => {
            const pct = (tick.ms / effectiveMax) * 100;
            if (pct > 100) return;

            // 1. Tick container on ruler
            const tickClone = TemplateEngine.clone('tpl-instance-ruler-tick');
            if (tickClone?.firstElementChild) {
                const $tick = $(tickClone.firstElementChild);
                $tick.css('left', `${pct}%`);

                const $mark = $tick.find('[data-field="tickMark"]');
                const $label = $tick.find('[data-field="tickLabel"]');

                if (tick.isMajor) {
                    $mark.addClass('ruler-tick-major');
                    $label.addClass('font-bold text-gray-700 dark:text-gray-200').text(tick.label);
                } else {
                    $label.addClass('text-gray-400 dark:text-gray-500');
                }

                rulerFragment.appendChild(tickClone);
            }

            // 2. Vertical dashed/dotted grid line
            const gridClone = TemplateEngine.clone('tpl-instance-grid-line');
            if (gridClone?.firstElementChild) {
                const $gridLine = $(gridClone.firstElementChild);
                $gridLine.css('left', `calc(${pct}% + 340px)`);

                if (tick.isMajor) {
                    $gridLine.addClass('border-dashed border-gray-300/80 dark:border-slate-700/80');
                } else {
                    $gridLine.addClass('border-dotted border-gray-200/60 dark:border-slate-800/60');
                }

                gridFragment.appendChild(gridClone);
            }
        });

        $ruler.append(rulerFragment);
        $grid.append(gridFragment);
    }

    /**
     * Renders rows in the Gantt waterfall chart.
     *
     * @param {Array<Object>} instances - List of bean instance records
     * @param {string|null} selectedBeanName - Selected bean name
     * @param {string|null} selectedContextId - Selected context ID
     * @param {number} maxDurationNanos - Maximum duration in nanos
     * @param {number} maxTimeMs - Maximum time in milliseconds
     * @param {number} bottleneckThresholdNanos - Threshold for bottleneck flag
     */
    renderGanttRows(instances, selectedBeanName, selectedContextId, maxDurationNanos, maxTimeMs, bottleneckThresholdNanos) {
        const $container = $('#instance-waterfall-rows');
        if (!$container.length) return;

        $container.children().not('#instance-grid-lines, #instance-scrubber-needle').remove();

        if (!instances || instances.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-instance-empty');
            if (emptyClone) $container.append(emptyClone);
            return;
        }

        const fragment = document.createDocumentFragment();

        instances.forEach((inst) => {
            const node = this._createWaterfallRowNode(
                inst,
                selectedBeanName,
                selectedContextId,
                maxDurationNanos,
                maxTimeMs,
                bottleneckThresholdNanos
            );
            if (node) fragment.appendChild(node);
        });

        $container.append(fragment);
    }

    /**
     * Creates an individual Gantt waterfall row DOM node.
     */
    _createWaterfallRowNode(inst, selectedBeanName, selectedContextId, maxDurationNanos, maxTimeMs, bottleneckThresholdNanos) {
        const clone = TemplateEngine.clone('tpl-waterfall-row');
        if (!clone?.firstElementChild) return null;

        const $row = $(clone.firstElementChild);
        const { beanName, contextId, initDurationMs = 0, initDurationNanos = 0, layer = {} } = inst;

        const isSelected = (selectedBeanName === beanName) && (selectedContextId === contextId);
        if (isSelected) {
            $row.addClass('gantt-row-selected');
        }

        $row.attr({
            'data-context-id': contextId || '',
            'data-bean-name': beanName || ''
        });

        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos);
        const barColor = durationStyle.color;

        $row.css({
            '--row-accent-color': barColor
        });

        // Category Icon Container
        const $iconContainer = $row.find('[data-field="iconContainer"]');
        const $icon = $row.find('[data-field="icon"]');
        $icon.text(layer.icon || 'deployed_code').css('color', layer.color);
        $iconContainer.css({
            backgroundColor: `${layer.color}15`,
            borderColor: `${layer.color}35`
        });

        // Name
        const displayName = GraphTreeBuilder._displayName(beanName);
        $row.find('[data-field="name"]').text(displayName).attr('title', beanName);

        // Duration Text & Badge Styling
        const formattedDuration = Formatter.formatDuration(initDurationNanos);
        const $duration = $row.find('[data-field="duration"]');
        $duration.text(formattedDuration)
            .addClass(durationStyle.badgeClass)
            .css({
                color: durationStyle.color,
                backgroundColor: `${durationStyle.color}15`,
                borderColor: `${durationStyle.color}35`
            });

        // Waterfall Bar Layout
        const maxTime = maxTimeMs || 1;
        const widthPct = Math.min(Math.max((initDurationMs / maxTime) * 100, 0.6), 100);

        const $bar = $row.find('[data-field="bar"]');
        $bar.css({
            left: '0%',
            width: `${widthPct}%`,
            background: durationStyle.gradient,
            border: `1px solid ${barColor}`,
            '--bar-glow': durationStyle.glow,
            '--layer-color': barColor
        });

        // Bottleneck Flame Indicator
        if (durationStyle.isBottleneck) {
            $bar.addClass('gantt-bar-bottleneck');
            const $flame = $row.find('[data-field="bottleneckBadge"]');
            $flame.removeClass('hidden').css('left', `calc(${widthPct}% + 6px)`);
        }

        // Bar Label
        const $barLabel = $row.find('[data-field="barLabel"]');
        if (widthPct > 6) {
            $barLabel.text(formattedDuration);
        } else {
            $barLabel.empty();
        }

        return clone;
    }

    /**
     * Renders the load-more button and count indicator in the Gantt footer.
     *
     * @param {Object} paginationState - State with totalElements
     * @param {number} currentCount - Currently loaded instance count
     * @param {number} maxTimeMs - Max time in ms
     */
    renderLoadMore(paginationState, currentCount, maxTimeMs) {
        const totalElements = paginationState?.totalElements || 0;
        const remaining = Math.max(0, totalElements - currentCount);

        const $btn = $('#time-btn-load-more');
        const $text = $('#time-load-more-text');

        if (remaining > 0) {
            $text.text(`+ ${remaining.toLocaleString()} more beans`);
            $btn.removeClass('hidden opacity-60 cursor-default pointer-events-none').show();
        } else {
            $text.text(`All ${totalElements.toLocaleString()} beans loaded`);
            $btn.addClass('opacity-60 cursor-default pointer-events-none');
        }

        $('#time-loaded-summary-text').text(
            `Showing ${currentCount.toLocaleString()} of ${totalElements.toLocaleString()} instances (max latency ${Formatter.formatDuration((maxTimeMs || 0) * 1e6)})`
        );
    }

    /**
     * Sets the zoom scale level for the waterfall view.
     *
     * @param {number} level - Desired zoom level (1.0 to 4.0)
     * @param {number} maxTimeMs - Max time for re-rendering ticks
     * @param {boolean} [updateSlider=true] - Whether to sync the range slider input
     */
    setZoom(level, maxTimeMs, updateSlider = true) {
        this.zoomLevel = Math.max(1, Math.min(4, level));
        if (updateSlider) {
            $('#time-zoom-slider').val(this.zoomLevel);
        }

        const pct = Math.round(this.zoomLevel * 100);
        $('#time-zoom-level-badge').text(`${pct}%`);

        const widthPercent = this.zoomLevel * 100;
        $('#instance-inner-container').css('min-width', `${widthPercent}%`);
        this.renderTimeRulerAndGrid(maxTimeMs);
    }

    /**
     * Binds mousemove scrubber needle guide.
     *
     * @param {Function} getMaxTimeMsFn - Function returning active maxTimeMs
     */
    bindScrubberEvents(getMaxTimeMsFn) {
        const $scrollContainer = $('#instance-scroll-container');
        const $waterfallRows = $('#instance-waterfall-rows');
        const $needle = $('#instance-scrubber-needle');
        const $badge = $('#instance-scrubber-badge');

        const updateScrubberPosition = (e) => {
            if (!e) return;
            const $inner = $('#instance-inner-container');
            const offset = $inner.offset();
            const rowsOffset = $waterfallRows.offset();
            if (!offset || !rowsOffset) return;

            if (e.pageY < rowsOffset.top) {
                $needle.css('opacity', 0);
                return;
            }

            const manifestWidth = 340;
            const mouseX = e.pageX - offset.left;

            if (mouseX >= manifestWidth && mouseX <= $inner.outerWidth()) {
                const trackX = mouseX - manifestWidth;
                const trackWidth = $inner.outerWidth() - manifestWidth;
                const timeRatio = Math.max(0, Math.min(1, trackX / trackWidth));
                const maxTimeMs = getMaxTimeMsFn?.() || 10;
                const currentMs = timeRatio * maxTimeMs;
                const scrollTop = $scrollContainer.scrollTop() || 0;

                $needle.css({
                    left: `${mouseX}px`,
                    opacity: 1
                });
                $badge.css('top', `${scrollTop + 4}px`).text(Formatter.formatDuration(currentMs * 1e6));
            } else {
                $needle.css('opacity', 0);
            }
        };

        $scrollContainer
            .off('mousemove.instanceScrubber')
            .on('mousemove.instanceScrubber', (e) => {
                this._lastScrubberMouseEvent = e;
                updateScrubberPosition(e);
            });

        $scrollContainer
            .off('scroll.instanceScrubber')
            .on('scroll.instanceScrubber', () => {
                if (this._lastScrubberMouseEvent && $needle.css('opacity') !== '0') {
                    updateScrubberPosition(this._lastScrubberMouseEvent);
                }
            });

        $scrollContainer
            .off('mouseleave.instanceScrubber')
            .on('mouseleave.instanceScrubber', () => {
                this._lastScrubberMouseEvent = null;
                $needle.css('opacity', 0);
            });
    }

    /**
     * Updates threshold labels in the footer benchmark legend.
     *
     * @param {number} bottleneckThresholdNanos - Threshold in nanos
     */
    updateBottleneckUI(bottleneckThresholdNanos) {
        const threshold = bottleneckThresholdNanos;
        const formatted = Formatter.formatDuration(threshold);

        $('#time-legend-bottleneck').text(`>${formatted} (Bottleneck)`);
        $('#time-legend-high').text(`High ${Formatter.formatDuration(threshold * 0.4)}-${formatted}`);
        $('#time-legend-medium').text(`Medium ${Formatter.formatDuration(threshold * 0.1)}-${Formatter.formatDuration(threshold * 0.4)}`);
        $('#time-legend-fast').text(`Fast <${Formatter.formatDuration(threshold * 0.1)}`);

        $('[data-action="quick-filter"][data-filter="bottlenecks"]').attr('title', `Beans taking > ${formatted} to initialize`);
    }

    /**
     * Displays the loading skeleton inside the waterfall container.
     */
    renderLoadingState() {
        const $container = $('#instance-waterfall-rows');
        $container.children().not('#instance-grid-lines, #instance-scrubber-needle').remove();
        const clone = TemplateEngine.clone('tpl-instance-loading');
        if (clone) $container.append(clone);
    }

    /**
     * Displays an error alert inside the waterfall container.
     *
     * @param {string} errorMessage - Error details
     */
    renderErrorState(errorMessage) {
        const $container = $('#instance-waterfall-rows');
        $container.children().not('#instance-grid-lines, #instance-scrubber-needle').remove();
        const clone = TemplateEngine.clone('tpl-instance-error');
        if (clone) {
            $(clone).find('[data-field="errorMessage"]').text(`Failed to fetch bean instance: ${errorMessage}`);
            $container.append(clone);
        }
    }
}
