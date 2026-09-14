import {
    BeanSearchEngine,
    BeanMetadataRules,
    QueryParam
} from '../../helper/index.js';

class QuickSearchWidget {

    constructor(options = {}) {
        this.service = options.service;

        // Reactive state properties
        this.query = '';
        this.loading = false;
        this.items = [];
        this.empty = false;
    }

    get visible() {
        return this.loading || this.empty || this.items.length > 0;
    }

    async search() {
        const query = this.query ? this.query.trim() : '';
        if (!query || query.length < 2) {
            this.reset();
            return;
        }

        this.loading = true;
        this.empty = false;

        try {
            const response = await this.service.searchDefinitions(query, { pageSize: 9 });
            const list = response?.content ?? [];
            this.items = list.map(bean => this.formatBean(bean, query));
            this.empty = this.items.length === 0;
        } catch (err) {
            console.warn('Dashboard quick search failed:', err);
            this.items = [];
            this.empty = true;
        } finally {
            this.loading = false;
        }
    }

    // Formats a backend bean record into presentation data
    formatBean(bean, query) {
        const { beanName, type, contextId } = bean;
        const meta = BeanMetadataRules.resolveBeanMetadata({ beanName, type });
        return {
            name: beanName,
            highlightedName: BeanSearchEngine.highlight(beanName, query),
            icon: meta.icon,
            iconColor: meta.color,
            contextId
        };
    }

    // Navigates to target page with query parameters
    goTo(route, name, contextId) {
        const paramKey = route === 'graph' ? 'focus' : 'search';
        const params = { [paramKey]: name };
        if (contextId) params.contextId = contextId;
        const q = QueryParam.build(params).toString();
        window.location.hash = `#/${route}?${q}`;
    }


    destroy() {
        this.reset();
    }

    // Resets search input and clears results
    reset() {
        this.query = '';
        this.items = [];
        this.empty = false;
        this.loading = false;
    }
}

const quickSearchWidget = new QuickSearchWidget();
export default quickSearchWidget;