import {
    GraphTreeBuilder,
    BeanMetadataRules,
    Formatter
} from '../../helper/index.js';

export class InstanceWaterfallWidget {
    calculateTicks(maxTimeMs) {
        const effectiveMax = maxTimeMs || 10;
        const ticks = BeanMetadataRules.calculateTimeTicks(effectiveMax);

        return ticks.map(tick => {
            const pct = (tick.ms / effectiveMax) * 100;
            return {
                ms: tick.ms,
                pct: Math.min(100, Math.max(0, pct)),
                label: tick.label || '',
                isMajor: Boolean(tick.isMajor)
            };
        }).filter(tick => tick.pct <= 100);
    }

    formatGanttRows(instances = [], selectedBeanName = null, selectedContextId = null, maxDurationNanos = 0, maxTimeMs = 10, bottleneckThresholdNanos = 500000) {
        if (!Array.isArray(instances)) return [];
        const effectiveMax = maxTimeMs || 1;

        return instances.map(inst => {
            const {
                beanName = '',
                contextId = '',
                initDurationNanos = 0,
                initDurationMs = (initDurationNanos / 1e6),
                layer
            } = inst;

            const resolvedLayer = layer || BeanMetadataRules.resolveBeanLayer(inst) || {};
            const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
            const isSelected = selectedBeanName === beanName && selectedContextId === contextId;
            const barColor = durationStyle.color || resolvedLayer.color || '#8b5cf6';
            const widthPct = Math.min(Math.max((initDurationMs / effectiveMax) * 100, 0.6), 100);

            return {
                beanName,
                displayName: GraphTreeBuilder._displayName(beanName),
                contextId: contextId || 'root',
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
                raw: inst
            };
        });
    }

    calculateScrubber(pageX, innerEl, scrollContainerEl, maxTimeMs = 10, manifestWidth = 340) {
        if (!innerEl || !scrollContainerEl) return null;

        const innerRect = innerEl.getBoundingClientRect();
        const mouseX = pageX - innerRect.left;
        const totalWidth = innerRect.width;

        if (mouseX >= manifestWidth && mouseX <= totalWidth) {
            const trackX = mouseX - manifestWidth;
            const trackWidth = totalWidth - manifestWidth;
            const timeRatio = trackWidth > 0 ? Math.max(0, Math.min(1, trackX / trackWidth)) : 0;
            const currentMs = timeRatio * maxTimeMs;
            const scrollTop = scrollContainerEl.scrollTop || 0;

            return {
                left: mouseX,
                badgeTop: scrollTop + 4,
                formattedTime: Formatter.formatDuration(currentMs * 1e6),
                visible: true
            };
        }

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
