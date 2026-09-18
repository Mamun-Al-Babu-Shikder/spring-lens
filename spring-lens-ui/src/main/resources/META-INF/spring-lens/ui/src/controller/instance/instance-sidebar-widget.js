import {
    GraphTreeBuilder,
    Formatter,
    BeanMetadataRules
} from '../../helper/index.js';

export class InstanceSidebarWidget {
    formatDetails(instance, maxDurationNanos = 0, bottleneckThresholdNanos = 500000) {
        if (!instance) return null;

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
        const definitionHref = `#/definitions?beanName=${encodeURIComponent(beanName)}${contextId ? `&contextId=${encodeURIComponent(contextId)}` : ''}`;

        const isBottleneck = (initDurationNanos || 0) > bottleneckThresholdNanos;
        const pctOfMax = maxDurationNanos > 0 ? Math.min(100, Math.max(1, Math.round(((initDurationNanos || 0) / maxDurationNanos) * 100))) : 0;
        const simpleType = type && type !== 'N/A' ? (type.includes('.') ? type.split('.').pop() : type) : 'N/A';
        const packageName = type && type !== 'N/A' && type.includes('.') ? type.substring(0, type.lastIndexOf('.')) : '';

        return {
            name: GraphTreeBuilder._displayName(beanName),
            fullName: beanName,
            type: type || 'N/A',
            simpleType,
            packageName,
            scope: Formatter.capitalize(scope || 'singleton'),
            duration: Formatter.formatDuration(initDurationNanos),
            initDurationNanos: initDurationNanos || 0,
            pctOfMax,
            isBottleneck,
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
        if (!proxyInfo || proxyInfo.isDirect || proxyInfo.proxyType === 'DIRECT') {
            const directStyles = BeanMetadataRules.resolveProxyBadgeStyles('DIRECT');
            return {
                isDirect: true,
                proxyType: 'Direct',
                badgeStyles: directStyles,
                targetClass: 'N/A',
                adviceFrozen: false,
                adviceFrozenClass: BeanMetadataRules.resolveAdviceFrozenClass(false),
                advices: [],
                proxiedInterfaces: []
            };
        }

        const {
            targetClass = 'N/A',
            advices = [],
            proxiedInterfaces = [],
            adviceFrozen = false,
            proxyType = 'CGLIB'
        } = proxyInfo;

        const proxyStyles = BeanMetadataRules.resolveProxyBadgeStyles(proxyType);

        return {
            isDirect: false,
            proxyType,
            badgeStyles: proxyStyles,
            targetClass: targetClass || 'N/A',
            adviceFrozen: Boolean(adviceFrozen),
            adviceFrozenClass: BeanMetadataRules.resolveAdviceFrozenClass(adviceFrozen),
            advices: advices.map(adv => ({
                fullName: adv,
                shortName: adv.includes('.') ? adv.split('.').pop() : adv,
                badge: 'Advice'
            })),
            proxiedInterfaces: proxiedInterfaces.map(iface => ({
                fullName: iface,
                shortName: iface.includes('.') ? iface.split('.').pop() : iface,
                badge: 'Interface'
            }))
        };
    }
}

export const instanceSidebarWidget = new InstanceSidebarWidget();
export default instanceSidebarWidget;
