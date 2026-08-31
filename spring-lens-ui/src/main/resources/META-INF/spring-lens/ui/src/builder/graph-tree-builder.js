export default class GraphTreeBuilder {

    static _displayName(beanName = '') {
        if (!beanName) return '';
        const simpleName = beanName.split('.').pop() || '';
        return simpleName.replace(/\$\$.*$/, '').split('$').pop() || '';
    }

    /**
     * Builds hierarchical tree structures grouped by application context.
     */
    static buildByContext(beanDependencies = []) {
        const groupedData = this._transformBeanDependencyData(beanDependencies);
        const contextKeys = Object.keys(groupedData);

        if (contextKeys.length === 0) {
            return this._buildSingleContextTree('default', []);
        }

        if (contextKeys.length === 1) {
            const contextId = contextKeys[0];
            return this._buildSingleContextTree(contextId, groupedData[contextId]);
        }

        return {
            name: 'Application Contexts',
            fullName: 'Application Contexts',
            contextId: 'all',
            meta: { type: 'context', contextId: 'all' },
            children: contextKeys.map(contextId =>
                this._buildSingleContextTree(contextId, groupedData[contextId])
            )
        };
    }

    /**
     * Builds a single hierarchy tree for a given context.
     */
    static _buildSingleContextTree(contextId, beans = []) {
        const contextNode = {
            name: contextId,
            fullName: contextId,
            contextId,
            meta: { type: 'context', contextId },
            children: []
        };

        if (!beans.length) return contextNode;

        const beanMap = new Map();
        const hasParent = new Set();

        // 1. Single pass: Populate map and track dependencies
        for (const b of beans) {
            beanMap.set(b.name, b);
        }
        for (const b of beans) {
            for (const dep of b.dependencies) {
                if (beanMap.has(dep)) {
                    hasParent.add(dep);
                }
            }
        }

        // 2. Identify top-level root beans (circular fallback to first bean)
        const rootBeans = beans.filter(b => !hasParent.has(b.name));
        const rootNames = rootBeans.length ? rootBeans.map(b => b.name) : [beans[0].name];

        // 3. Build tree recursively with single-set backtracking (prevents memory cloning)
        const visited = new Set();

        const buildNode = (name) => {
            const beanRecord = beanMap.get(name) || {};
            const isCycle = visited.has(name);
            const meta = {
                type: beanRecord.type || 'N/A',
                scope: beanRecord.scope || 'singleton',
                contextId,
                ...(isCycle && { isCycle: true })
            };

            const node = {
                name: this._displayName(name),
                fullName: name,
                contextId,
                meta,
                ...(isCycle && { isCycle: true })
            };

            if (isCycle) return node;

            visited.add(name);
            const validChildren = (beanRecord.dependencies || []).filter(dep => beanMap.has(dep));

            if (validChildren.length > 0) {
                node.children = validChildren.map(buildNode);
            }

            visited.delete(name); // Backtrack for sibling branches
            return node;
        };

        contextNode.children = rootNames.map(buildNode);
        return contextNode;
    }

    /**
     * Normalizes and groups input beans by contextId.
     */
    static _transformBeanDependencyData(data) {
        if (!data) return {};

        // Format: { contextId: "...", beans: [...] }
        if (!Array.isArray(data) && Array.isArray(data.beans)) {
            const contextId = data.contextId || 'default';
            return {
                [contextId]: data.beans.map(b => this._normalizeBean(b))
            };
        }

        // Format: [{ contextId, ... }, ...]
        if (Array.isArray(data) && data.length > 0) {
            return data.reduce((acc, bean) => {
                const contextId = bean.contextId || 'default';
                (acc[contextId] = acc[contextId] || []).push(this._normalizeBean(bean));
                return acc;
            }, {});
        }

        return {};
    }

    static _normalizeBean(bean = {}) {
         const { name, beanName, type, className, beanType, scope, dependencies } = bean;

        return {
            name: name || beanName || '',
            type: type || className || beanType || 'N/A',
            scope: scope || 'singleton',
            dependencies: dependencies || []
        };
    }

    static buildModalGraphHierarchy(targetBean, findBeanFn = () => null) {
        if (!targetBean) return null;

        const targetName = targetBean.beanName || targetBean.name || '';

        const createChild = (name, kind) => {
            const depBean = findBeanFn(name, targetBean.contextId);
            return {
                name: this._displayName(name),
                fullName: name,
                meta: {
                    type: depBean?.type || 'N/A',
                    scope: depBean?.scope || 'N/A',
                    role: depBean?.role || 'N/A',
                    kind
                }
            };
        };

        const deps = (targetBean.dependencies || []).map(name => createChild(name, 'dependency'));
        const dependents = (targetBean.dependents || []).map(name => createChild(name, 'dependent'));
        const children = [...deps, ...dependents];

        return {
            name: targetName,
            fullName: targetName,
            meta: {
                type: targetBean.type || 'N/A',
                scope: targetBean.scope || 'N/A',
                role: targetBean.role || 'N/A',
                kind: 'target'
            },
            ...(children.length > 0 && { children })
        };
    }
}