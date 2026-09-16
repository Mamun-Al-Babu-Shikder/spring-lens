import {
    BeanMetadataRules
} from '../../helper/index.js';

/**
 * Widget responsible for bean definitions table presentation models,
 * badge style resolution, sort header indicators, and pagination calculations.
 */
export default class DefinitionTableWidget {

    /**
     * Generates a consistent unique ID for a bean.
     * @param {string|Object} contextIdOrBean
     * @param {string} [beanName]
     * @returns {string}
     */
    static generateBeanUniqueId(contextIdOrBean, beanName) {
        if (contextIdOrBean && typeof contextIdOrBean === 'object') {
            const ctx = contextIdOrBean.contextId ?? contextIdOrBean.raw?.contextId ?? '';
            const name = contextIdOrBean.beanName ?? contextIdOrBean.raw?.beanName ?? '';
            return `${ctx}:${name}`;
        }
        const ctx = contextIdOrBean || '';
        const name = beanName || '';
        return `${ctx}:${name}`;
    }

    generateBeanUniqueId(contextIdOrBean, beanName) {
        return DefinitionTableWidget.generateBeanUniqueId(contextIdOrBean, beanName);
    }

    /**
     * Transforms raw backend bean records into rich presentation models for Alpine table rendering.
     * @param {Array<Object>} rawBeans
     * @returns {Array<Object>}
     */
    formatBeanRows(rawBeans = []) {
        if (!Array.isArray(rawBeans)) return [];

        return rawBeans.map(bean => {
            const {
                beanName = '--',
                role = 'APPLICATION',
                scope = 'SINGLETON',
                type = '-',
                primary = false,
                lazyInit = false,
                contextId = '',
                dependencies = [],
                dependents = []
            } = bean;

            const uniqueId = this.generateBeanUniqueId(bean);
            const meta = BeanMetadataRules.resolveBeanMetadata(bean);

            // Short type & package
            const typeStr = type || '-';
            const lastDotIndex = typeStr.lastIndexOf('.');
            const shortType = lastDotIndex !== -1 ? typeStr.substring(lastDotIndex + 1) : typeStr;
            const packageName = lastDotIndex !== -1 ? typeStr.substring(0, lastDotIndex) : 'default package';

            const cleanRole = (role ? String(role).replace(/^ROLE_/, '') : 'APPLICATION').toUpperCase();
            const cleanScope = (scope ? String(scope) : 'SINGLETON').toUpperCase();

            // Dependencies counts
            const depsList = Array.isArray(dependencies) ? dependencies : [];
            const dependentsList = Array.isArray(dependents) ? dependents : [];
            const depsCount = `${depsList.length} ${depsList.length === 1 ? 'dep' : 'deps'}`;
            const usedByCount = `${dependentsList.length} used by`;

            return {
                uniqueId,
                beanName,
                contextId,
                type: typeStr,
                shortType,
                packageName,
                role: cleanRole,
                scope: cleanScope,
                primary: Boolean(primary),
                lazyInit: Boolean(lazyInit),
                depsCount,
                depsTooltip: `${depsList.length} dependencies (Depends on)`,
                usedByCount,
                usedByTooltip: `${dependentsList.length} dependents (Used by)`,
                meta,
                raw: bean
            };
        });
    }


    /**
     * Resolves sort icon name for table header columns.
     * @param {string} column
     * @param {string} sortColumn
     * @param {string} sortDirection
     * @returns {string}
     */
    getSortIcon(column, sortColumn, sortDirection) {
        if (sortColumn !== column) return 'unfold_more';
        return sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward';
    }

    destroy() {}
}