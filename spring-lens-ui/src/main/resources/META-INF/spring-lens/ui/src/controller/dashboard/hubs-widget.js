import {
    BeanMetadataRules,
    QueryParam,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget responsible for dependency graph KPI stats, dependency edge calculations,
 * and top hub beans (highest fan-in dependent count) ranking.
 */
export default class DependencyHubsWidget {

    /**
     * Renders Dependency Graph KPI and top hub beans.
     * @param {Object} dependenciesResponse
     */
    render(dependenciesResponse) {
        if (!dependenciesResponse) return;

        const items = dependenciesResponse?.content ?? [];
        const totalBeans = dependenciesResponse?.totalElements ?? items.length;

        // Build dependent fan-in counts
        const dependentCounts = new Map();
        let totalEdges = 0;

        items.forEach(item => {
            const deps = item.dependencies || [];
            totalEdges += deps.length;
            deps.forEach(dep => {
                const count = dependentCounts.get(dep) || 0;
                dependentCounts.set(dep, count + 1);
            });
        });

        $('#kpi-dependencies-count').text(totalBeans.toLocaleString());
        $('#kpi-dep-edges').text(totalEdges.toLocaleString());
        $('#kpi-dep-beans').text(dependentCounts.size.toLocaleString());

        $('#db-graph-footer-stats').text(`${totalBeans} Beans • ${totalEdges} Connections`);

        // Sort Top Hub Beans by fan-in count
        const sortedHubs = Array.from(dependentCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const $list = $('#db-dependency-hubs-list').empty();

        if (sortedHubs.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
            if (emptyClone) {
                $(emptyClone).find('[data-field="message"]').text('No dependency connections detected.');
                $list.append(emptyClone);
            }
            return;
        }

        const fragment = document.createDocumentFragment();

        sortedHubs.forEach(([beanName, count], idx) => {
            const clone = TemplateEngine.clone('tpl-dashboard-hub-row');
            if (!clone) return;

            const $row = $(clone.firstElementChild);
            const meta = BeanMetadataRules.resolveBeanMetadata({ beanName });

            $row.find('[data-field="rank"]').text(idx + 1);
            $row.find('[data-field="icon"]')
                .css('color', meta.color)
                .text(meta.icon);
            $row.find('[data-field="name"]').text(beanName);
            $row.find('[data-field="type"]').text('Referenced by other beans');
            $row.find('[data-field="dependents-count"]').text(`${count} dependents`);

            $row.on('click', () => {
                const query = QueryParam.build({ search: beanName }).toString();
                window.location.hash = `#/definitions?${query}`;
            });

            fragment.appendChild(clone);
        });

        $list.append(fragment);
    }

    /**
     * Cleans up widget resources.
     */
    destroy() {
        // No persistent listeners or intervals
    }
}
