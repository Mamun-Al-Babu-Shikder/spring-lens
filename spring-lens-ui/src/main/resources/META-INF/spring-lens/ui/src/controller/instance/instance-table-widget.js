import {
    GraphTreeBuilder,
    Formatter,
    BeanMetadataRules
} from '../../helper/index.js';

export class InstanceTableWidget {
    formatTableRows(instances = [], selectedBeanName = null, selectedContextId = null, maxDurationNanos = 0, bottleneckThresholdNanos = 500000) {
        if (!Array.isArray(instances)) return [];

        return instances.map(inst => {
            const {
                beanName = '',
                contextId = '',
                initDurationNanos = 0,
                scope = 'singleton',
                type = '',
                layer,
                createdAt
            } = inst;

            const resolvedLayer = layer || BeanMetadataRules.resolveBeanLayer(inst) || {};
            const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
            const isSelected = selectedBeanName === beanName && selectedContextId === contextId;
            const simpleType = type && type.includes('.') ? type.substring(type.lastIndexOf('.') + 1) : (type || '-');
            const packageName = type && type.includes('.') ? type.substring(0, type.lastIndexOf('.')) : 'default package';
            const barColor = resolvedLayer.color || durationStyle.color || '#8b5cf6';

            return {
                beanName,
                displayName: GraphTreeBuilder._displayName(beanName),
                contextId: contextId || 'root',
                type: type || '-',
                simpleType,
                packageName,
                scope: (scope || 'singleton').toUpperCase(),
                scopeBadgeClass: BeanMetadataRules.resolveScopeBadgeClass(scope),
                createdAt: createdAt || '',
                createdAtFormatted: Formatter.formatDateTime(createdAt),
                createdAtTooltip: createdAt ? `Created at: ${createdAt}` : '',
                durationFormatted: Formatter.formatDuration(initDurationNanos),
                durationNanos: `${(initDurationNanos || 0).toLocaleString()} ns`,
                durationStyle,
                layer: resolvedLayer,
                layerColor: barColor,
                layerIcon: resolvedLayer.icon || 'deployed_code',
                isSelected,
                isBottleneck: Boolean(durationStyle.isBottleneck),
                raw: inst
            };
        });
    }

    getSortIcon(column, sortBy, sortDir) {
        if (sortBy !== column) return 'unfold_more';
        return sortDir === 'DESC' ? 'expand_more' : 'expand_less';
    }
}

export const instanceTableWidget = new InstanceTableWidget();
export default instanceTableWidget;
