import {
    Sidebar,
    BeanMetadataRules,
    GraphTreeBuilder,
    Formatter
} from '../../helper/index.js';

export class BeanSidebarWidget {

    constructor(options = {}) {
        this.options = options;
    }

    formatDetails(beanInformation) {
        if (!beanInformation) return null;

        const {
            beanName = '',
            type = 'N/A',
            scope,
            role,
            primary,
            lazyInit,
            autowireCandidate,
            contextId = '-',
            factoryBeanName = '-',
            factoryMethodName = '-',
            initMethodName = '-',
            destroyMethodName = '-'
        } = beanInformation;

        const cleanRole = role ? String(role).replace(/^ROLE_/, '') : '';
        const displayRole = cleanRole ? Formatter.capitalize(cleanRole) : 'Application';
        const displayScope = scope ? Formatter.capitalize(scope) : 'Singleton';
        const meta = BeanMetadataRules.resolveBeanMetadata(beanInformation);

        return {
            beanName,
            type: type || 'N/A',
            scope: displayScope,
            role: displayRole,
            contextId: contextId || '-',
            primary: Boolean(primary),
            primaryLabel: primary ? 'TRUE' : 'FALSE',
            lazyInit: Boolean(lazyInit),
            lazyInitLabel: lazyInit ? 'TRUE' : 'FALSE',
            autowired: Boolean(autowireCandidate !== false),
            autowiredLabel: (autowireCandidate !== false) ? 'TRUE' : 'FALSE',
            factoryBean: factoryBeanName || '-',
            factoryMethod: factoryMethodName || '-',
            initMethod: initMethodName || '-',
            destroyMethod: destroyMethodName || '-',
            meta
        };
    }

    formatDependencyItems(names = [], contextId = '') {
        if (!Array.isArray(names)) return [];

        return names.map(depName => {
            const displayName = GraphTreeBuilder._displayName ? GraphTreeBuilder._displayName(depName) : depName;
            const categoryColor = Sidebar.resolveDependencyCategoryColor(depName, contextId) || 'blue';

            return {
                fullName: depName,
                name: displayName,
                categoryColor,
                contextId
            };
        });
    }

    destroy() { }
}

export default BeanSidebarWidget;
