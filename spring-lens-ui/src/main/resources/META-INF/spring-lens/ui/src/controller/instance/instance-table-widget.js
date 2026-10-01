import {
    GraphTreeBuilder,
    Formatter,
    BeanMetadataRules
} from '../../helper/index.js';
import Guard from '../../helper/guard.js';

export class InstanceTableWidget {
    formatTableRows(instances = [], optionsOrSelectedBeanName = null, selectedContextId = null, maxDurationNanos = 0, bottleneckThresholdNanos = 500000) {
        if (Guard.isBlank(instances) || !Array.isArray(instances)) return [];

        const options = this._normalizeOptions(
            optionsOrSelectedBeanName,
            selectedContextId,
            maxDurationNanos,
            bottleneckThresholdNanos
        );

        return instances
            .map(inst => this.formatTableRow(inst, options))
            .filter(Boolean);
    }

    formatTableRow(beanInstance, options = {}) {
        if (Guard.isBlank(beanInstance)) return null;

        const {
            selectedBeanName = null,
            selectedContextId = null,
            maxDurationNanos = 0,
            bottleneckThresholdNanos = 500000
        } = options;

        const {
            beanName = '',
            contextId = 'root',
            initDurationNanos = 0,
            scope = 'singleton',
            type = '',
            layer,
            createdAt = ''
        } = beanInstance;

        const canonicalContextId = contextId || 'root';
        const resolvedLayer = layer || BeanMetadataRules.resolveBeanLayer(beanInstance) || {};
        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
        const { typeStr, simpleType, packageName } = this._resolveTypeInfo(type);
        const isSelected = selectedBeanName === beanName && (!selectedContextId || selectedContextId === canonicalContextId);

        return {
            id: `${canonicalContextId}::${beanName}`,
            beanName,
            displayName: GraphTreeBuilder._displayName(beanName),
            contextId: canonicalContextId,
            type: typeStr,
            simpleType,
            packageName,
            scope: (scope || 'singleton').toUpperCase(),
            scopeBadgeClass: BeanMetadataRules.resolveScopeBadgeClass(scope),
            createdAt,
            createdAtFormatted: Formatter.formatDateTime(createdAt),
            createdAtTooltip: createdAt ? `Created at: ${createdAt}` : '',
            durationFormatted: Formatter.formatDuration(initDurationNanos),
            durationNanos: `${(initDurationNanos || 0).toLocaleString()} ns`,
            durationStyle,
            layer: resolvedLayer,
            layerColor: resolvedLayer.color || durationStyle.color || '#8b5cf6',
            layerIcon: resolvedLayer.icon || 'deployed_code',
            isSelected,
            isBottleneck: Boolean(durationStyle.isBottleneck),
            raw: beanInstance
        };
    }

    getSortIcon(column, sortBy, sortDir) {
        if (sortBy !== column) return 'unfold_more';
        return sortDir === 'DESC' ? 'expand_more' : 'expand_less';
    }

    _normalizeOptions(optionsOrSelectedBeanName, selectedContextId, maxDurationNanos, bottleneckThresholdNanos) {
        if (optionsOrSelectedBeanName && typeof optionsOrSelectedBeanName === 'object') {
            return optionsOrSelectedBeanName;
        }

        return {
            selectedBeanName: optionsOrSelectedBeanName,
            selectedContextId,
            maxDurationNanos,
            bottleneckThresholdNanos
        };
    }

    _resolveTypeInfo(type) {
        if (Guard.isBlank(type) || type === '-') {
            return { typeStr: '-', simpleType: '-', packageName: '' };
        }

        const lastDotIndex = type.lastIndexOf('.');
        return {
            typeStr: type,
            simpleType: GraphTreeBuilder._displayName(type),
            packageName: lastDotIndex !== -1 ? type.substring(0, lastDotIndex) : 'default package'
        };
    }
}

export const instanceTableWidget = new InstanceTableWidget();
export default instanceTableWidget;
