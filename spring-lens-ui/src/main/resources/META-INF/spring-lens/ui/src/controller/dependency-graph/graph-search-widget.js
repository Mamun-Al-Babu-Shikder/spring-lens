import {
    beanDataStore,
    GraphTreeBuilder,
    BeanSearchEngine,
    BeanMetadataRules
} from '../../helper/index.js';

export class GraphSearchWidget {

    constructor(service, options = {}) {
        this.service = service;
        this.options = options;
    }

    async search(rawQueryValue, maxResults = 12) {
        const query = (rawQueryValue || '').trim();
        if (!query) return [];

        try {
            const items = await this.service.searchBeansApi(query, maxResults);
            return this._formatSearchResults(items, query);
        } catch (error) {
            console.warn('Error fetching search suggestions from API:', error);
            const matchingBeans = this._searchMatchingNodes(query, maxResults);
            return this._formatSearchResults(matchingBeans, query);
        }
    }

    _formatSearchResults(matchingBeans, query = '') {
        if (!matchingBeans || matchingBeans.length === 0) {
            return [];
        }

        const seen = new Set();
        const results = [];

        for (const matchingBean of matchingBeans) {
            const { contextId = '', beanName, type, scope } = matchingBean;
            const resolvedFullName = matchingBean.fullName || beanName || null;

            if (!resolvedFullName) continue;

            const dedupeKey = `${contextId}::${resolvedFullName}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            const meta = BeanMetadataRules.resolveBeanMetadata({ beanName: resolvedFullName, type });
            const shortType = type ? type.split('.').pop() : '';
            const highlightedName = BeanSearchEngine.highlight(beanName || resolvedFullName, query);

            results.push({
                beanName: beanName || resolvedFullName,
                fullName: resolvedFullName,
                highlightedName,
                contextId: contextId || '',
                type: type || '',
                shortType,
                scope: scope || '',
                meta
            });
        }

        return results;
    }

    _searchMatchingNodes(searchQuery, maxResultsCount) {
        const candidateBeans = [];
        const visitedKeys = new Set();

        if (beanDataStore?.beansMap?.size > 0) {
            for (const bean of beanDataStore.beansMap.values()) {
                if (!bean || !bean.beanName) continue;
                const fullName = bean.beanName;
                const contextId = bean.contextId || '';
                const uniqueKey = `${contextId}:${fullName}`;
                if (visitedKeys.has(uniqueKey)) continue;
                visitedKeys.add(uniqueKey);

                const displayName = GraphTreeBuilder._displayName(fullName);
                candidateBeans.push({
                    beanName: displayName,
                    fullName,
                    contextId,
                    type: bean.type || '',
                    scope: bean.scope || ''
                });
            }
        }

        const root = this.options.getRootNode?.();
        if (candidateBeans.length === 0 && root) {
            const traversalStack = [root];
            while (traversalStack.length > 0) {
                const currentNode = traversalStack.pop();
                const nodeData = currentNode.data ?? {};
                const { fullName, meta = {}, contextId = '' } = nodeData;
                const uniqueKey = `${contextId}:${fullName}`;

                if (fullName && !visitedKeys.has(uniqueKey)) {
                    visitedKeys.add(uniqueKey);
                    const displayName = GraphTreeBuilder._displayName(fullName);
                    candidateBeans.push({
                        beanName: displayName,
                        fullName,
                        contextId,
                        type: meta.type || '',
                        scope: meta.scope || ''
                    });
                }

                const childNodes = currentNode.children ?? currentNode._children;
                if (childNodes) {
                    for (let i = childNodes.length - 1; i >= 0; i--) {
                        traversalStack.push(childNodes[i]);
                    }
                }
            }
        }

        const results = BeanSearchEngine.search(candidateBeans, searchQuery, {
            limit: maxResultsCount,
            scoreResults: true
        });

        return results.map(b => ({
            beanName: b.beanName,
            fullName: b.fullName,
            contextId: b.contextId || '',
            type: b.type,
            scope: b.scope
        }));
    }

    destroy() { }
}