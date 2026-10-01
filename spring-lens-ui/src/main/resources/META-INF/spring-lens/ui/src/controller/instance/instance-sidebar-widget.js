import {
    GraphTreeBuilder,
    Formatter,
    BeanMetadataRules,
    QueryParam
} from '../../helper/index.js';
import Guard from "../../helper/guard.js";

export class InstanceSidebarWidget {
    formatDetails(instance, maxDurationNanos = 0, bottleneckThresholdNanos = 500000) {
        if (Guard.isBlank(instance)) return null;
 
        const {
            beanName = '',
            type = 'N/A',
            scope = 'singleton',
            initDurationNanos = 0,
            contextId = 'root',
            createdAt = '',
            hasDefinition = false
        } = instance;

        const metadata = BeanMetadataRules.resolveBeanMetadata(instance) || { icon: 'schema', color: '#8b5cf6' };
        const durationStyle = BeanMetadataRules.resolveDurationColor(initDurationNanos, maxDurationNanos, bottleneckThresholdNanos) || {};
        const definitionHref = this._buildDefinitionHref(beanName, contextId);
        const pctOfMax = this._calculatePctOfMax(initDurationNanos, maxDurationNanos);

        return {
            name: GraphTreeBuilder._displayName(beanName),
            fullName: beanName,
            type: type || 'N/A',
            scope: Formatter.capitalize(scope || 'singleton'),
            duration: Formatter.formatDuration(initDurationNanos),
            initDurationNanos: initDurationNanos || 0,
            pctOfMax,
            isBottleneck: Boolean(durationStyle.isBottleneck),
            context: contextId || 'root',
            created: Formatter.formatDateTime(createdAt),
            rawCreated: createdAt || 'N/A',
            nanos: `${(initDurationNanos || 0).toLocaleString()} ns`,
            hasDefinition: Boolean(hasDefinition),
            definitionStatus: hasDefinition ? 'DEFINED' : 'DYNAMIC',
            definitionStatusTitle: hasDefinition ? 'Defined in Application Context' : 'Dynamically Registered',
            definitionStatusBadgeClass: BeanMetadataRules.resolveDefinitionStatusBadgeClass(hasDefinition),
            metadata,
            durationStyle,
            definitionHref
        };
    }

    formatProxyInfo(proxyInfo) {
        if (Guard.isBlank(proxyInfo)) return null;

        const {
            targetClass = 'N/A',
            adviceFrozen = false,
            proxyType = 'CGLIB',
            advices = [],
            proxiedInterfaces = []
        } = proxyInfo;

        return {
            proxyType,
            badgeStyles: BeanMetadataRules.resolveProxyBadgeStyles(proxyType),
            targetClass: targetClass || 'N/A',
            adviceFrozen: Boolean(adviceFrozen),
            adviceFrozenClass: BeanMetadataRules.resolveAdviceFrozenClass(adviceFrozen),
            advices: this._formatProxyMembers(advices, 'Advice'),
            proxiedInterfaces: this._formatProxyMembers(proxiedInterfaces, 'Interface')
        };
    }

    _formatProxyMembers(advicesOrProxiedInterfaces, badge) {
        if (!Array.isArray(advicesOrProxiedInterfaces)) return [];
        return advicesOrProxiedInterfaces.map((item, index) => {
            return {
                id: `${badge ? badge.toLowerCase() : 'item'}-${index}`,
                simpleName: GraphTreeBuilder._displayName(item),
                fullName: item,
                badge
            };
        });
    }

    _buildDefinitionHref(beanName, contextId) {
        return QueryParam.append('#/definitions', { beanName, contextId });
    }

    _calculatePctOfMax(initDurationNanos, maxDurationNanos) {
        if (!maxDurationNanos || maxDurationNanos <= 0) return 0;
        return Math.min(100, Math.max(1, Math.round(((initDurationNanos || 0) / maxDurationNanos) * 100)));
    }
}

export const instanceSidebarWidget = new InstanceSidebarWidget();
