import { BeanMetadataRules } from '../../helper/index.js';

/**
 * Widget responsible for dependency graph KPI stats, dependency edge calculations,
 * and top hub beans (highest fan-in dependent count) ranking.
 */
class DependencyHubsWidget {

    /**
     * Computes Dependency Graph KPI, edge totals, and top hub beans.
     * @param {Object} dependenciesResponse
     * @returns {Object}
     */
    computeMetrics(dependenciesResponse) {
        if (!dependenciesResponse) {
            return {
                totalBeans: '--',
                totalEdges: '--',
                dependedBeans: '--',
                footerStats: 'Graph topology telemetry',
                hubs: []
            };
        }

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

        // Sort Top Hub Beans by fan-in count
        const sortedHubs = Array.from(dependentCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const hubs = sortedHubs.map(([beanName, count], idx) => {
            const meta = BeanMetadataRules.resolveBeanMetadata({ beanName });
            return {
                rank: idx + 1,
                name: beanName,
                type: 'Referenced by other beans',
                icon: meta.icon,
                iconColor: meta.color,
                dependentsCount: count
            };
        });

        return {
            totalBeans: totalBeans.toLocaleString(),
            totalEdges: totalEdges.toLocaleString(),
            dependedBeans: dependentCounts.size.toLocaleString(),
            footerStats: `${totalBeans} Beans • ${totalEdges} Connections`,
            hubs
        };
    }

    /**
     * Backward-compatible render method that delegates to computeMetrics.
     * @param {Object} dependenciesResponse
     * @returns {Object}
     */
    render(dependenciesResponse) {
        return this.computeMetrics(dependenciesResponse);
    }

    /**
     * Cleans up widget resources.
     */
    destroy() { }
}

export const hubsWidget = new DependencyHubsWidget();
export default hubsWidget;
