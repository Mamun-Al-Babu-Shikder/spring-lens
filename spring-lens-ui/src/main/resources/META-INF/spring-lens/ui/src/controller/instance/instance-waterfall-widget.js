import {
    GraphTreeBuilder,
    BeanMetadataRules,
    Formatter
} from '../../helper/index.js';
import Guard from '../../helper/guard.js';

export class InstanceWaterfallWidget {
    calculateTicks(maxTimeMs) {
        const effectiveMax = Math.max(Number(maxTimeMs) || 10, 1);
        const ticks = BeanMetadataRules.calculateTimeTicks(effectiveMax) || [];

        return ticks
            .map(tick => {
                const pct = Math.min(100, Math.max(0, (tick.ms / effectiveMax) * 100));
                return {
                    ms: tick.ms,
                    pct,
                    label: tick.label || '',
                    isMajor: Boolean(tick.isMajor)
                };
            })
            .filter(tick => tick.pct <= 100);
    }

    formatGanttRows(instances = [], optionsOrSelectedBeanName = null, selectedContextId = null, maxDurationNanos = 0, maxTimeMs = 10, bottleneckThresholdNanos = 500000) {
        if (Guard.isBlank(instances) || !Array.isArray(instances)) return [];

        const options = this._normalizeOptions(
            optionsOrSelectedBeanName,
            selectedContextId,
            maxDurationNanos,
            maxTimeMs,
            bottleneckThresholdNanos
        );

        return instances
            .map(beanInstance => this.formatGanttRow(beanInstance, options))
            .filter(Boolean);
    }

    formatGanttRow(beanInstance, options = {}) {
        if (Guard.isBlank(beanInstance)) return null;

        const {
            selectedBeanName = null,
            selectedContextId = null,
            maxDurationNanos = 0,
            maxTimeMs = 10,
            bottleneckThresholdNanos = 500000
        } = options;

        const {
            beanName = '',
            contextId = 'root',
            initDurationNanos = 0,
            layer
        } = beanInstance;

        const canonicalContextId = contextId || 'root';
        const resolvedLayer = layer || BeanMetadataRules.resolveBeanLayer(beanInstance) || {};
        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
        const isSelected = selectedBeanName === beanName && (!selectedContextId || selectedContextId === canonicalContextId);
        const barColor = durationStyle.color || resolvedLayer.color || '#8b5cf6';
        const widthPct = this._calculateBarWidth(initDurationNanos, maxTimeMs);
        const id = `${canonicalContextId}::${beanName}`;

        return {
            id,
            beanName,
            displayName: GraphTreeBuilder._displayName(beanName),
            contextId: canonicalContextId,
            layer: resolvedLayer,
            layerColor: resolvedLayer.color || '#8b5cf6',
            layerIcon: resolvedLayer.icon || 'deployed_code',
            durationFormatted: Formatter.formatDuration(initDurationNanos),
            durationStyle,
            barColor,
            widthPct,
            showBarLabel: widthPct > 6,
            isSelected,
            isBottleneck: Boolean(durationStyle.isBottleneck),
            raw: beanInstance
        };
    }

    calculateScrubber(pageX, innerEl, scrollContainerEl, maxTimeMs = 10, manifestWidth = 340) {
        if (Guard.isBlank(innerEl) || Guard.isBlank(scrollContainerEl)) return null;

        const innerRect = innerEl.getBoundingClientRect();
        const mouseX = pageX - innerRect.left;
        const totalWidth = innerRect.width;

        if (mouseX >= manifestWidth && mouseX <= totalWidth) {
            const trackX = mouseX - manifestWidth;
            const trackWidth = totalWidth - manifestWidth;
            const timeRatio = trackWidth > 0 ? Math.max(0, Math.min(1, trackX / trackWidth)) : 0;
            const currentMs = timeRatio * (Number(maxTimeMs) || 10);
            const scrollTop = scrollContainerEl.scrollTop || 0;

            return {
                left: mouseX,
                badgeTop: scrollTop + 4,
                formattedTime: Formatter.formatDuration(currentMs * 1e6),
                visible: true
            };
        }

        return this._defaultScrubberState();
    }

    _calculateBarWidth(initDurationNanos, maxTimeMs) {
        const effectiveMax = Math.max(Number(maxTimeMs) || 1, 1);
        const initDurationMs = (Number(initDurationNanos) || 0) / 1e6;
        const pct = (initDurationMs / effectiveMax) * 100;
        return Math.min(100, Math.max(0.6, pct));
    }

    _normalizeOptions(optionsOrSelectedBeanName, selectedContextId, maxDurationNanos, maxTimeMs, bottleneckThresholdNanos) {
        if (optionsOrSelectedBeanName && typeof optionsOrSelectedBeanName === 'object') {
            return optionsOrSelectedBeanName;
        }

        return {
            selectedBeanName: optionsOrSelectedBeanName,
            selectedContextId,
            maxDurationNanos,
            maxTimeMs,
            bottleneckThresholdNanos
        };
    }

    _defaultScrubberState() {
        return {
            left: 0,
            badgeTop: 0,
            formattedTime: '+0.00ms',
            visible: false
        };
    }
}

export const instanceWaterfallWidget = new InstanceWaterfallWidget();
export default instanceWaterfallWidget;
