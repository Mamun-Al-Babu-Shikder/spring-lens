import { BeanMetadataRules } from '../../helper/index.js';

class BottlenecksWidget {

    /**
     * Computes instances KPI counts and top bottleneck beans presentation models.
     * @param {Object} instancesResponse
     * @returns {Object}
     */
    computeMetrics(instancesResponse) {
        if (!instancesResponse) {
            return {
                count: '--',
                totalCost: '--',
                maxLatency: '--',
                slowestBeans: []
            };
        }

        const items = instancesResponse?.content ?? [];
        const total = instancesResponse?.totalElements ?? items.length;

        let totalNanos = 0;
        let maxNanos = 0;
        items.forEach(inst => {
            const nanos = inst.initDurationNanos || 0;
            totalNanos += nanos;
            if (nanos > maxNanos) maxNanos = nanos;
        });

        const formattedTotalCost = this.formatNanos(totalNanos);
        const formattedMaxLatency = this.formatNanos(maxNanos);

        const sorted = [...items].sort((a, b) => (b.initDurationNanos || 0) - (a.initDurationNanos || 0));
        const top5 = sorted.slice(0, 5);
        const topMaxNanos = top5.length > 0 ? (top5[0].initDurationNanos || 1) : 1;

        const slowestBeans = top5.map((item, index) => {
            const durationNanos = item.initDurationNanos || 0;
            const durationMs = durationNanos / 1_000_000;
            const formattedDuration = this.formatNanos(durationNanos);
            const meta = BeanMetadataRules.resolveBeanMetadata(item);
            const latencyPercent = Math.max(8, Math.min(100, Math.round((durationNanos / topMaxNanos) * 100)));
            const theme = BeanMetadataRules.resolveLatencyTheme(durationMs);

            return {
                rank: index + 1,
                name: item.beanName || '--',
                type: item.type || '--',
                contextId: item.contextId || '',
                icon: meta.icon,
                iconColor: meta.color,
                durationNanos,
                formattedDuration,
                latencyPercent,
                barClass: theme.bar || '',
                badgeClass: theme.badge || ''
            };
        });

        return {
            count: total.toLocaleString(),
            totalCost: formattedTotalCost,
            maxLatency: formattedMaxLatency,
            slowestBeans
        };
    }

    /**
     * Backward-compatible render method that delegates to computeMetrics.
     * @param {Object} instancesResponse
     * @returns {Object}
     */
    render(instancesResponse) {
        return this.computeMetrics(instancesResponse);
    }

    /**
     * Formats nanoseconds into µs, ms, or s.
     * @param {number} nanos
     * @returns {string}
     */
    formatNanos(nanos) {
        if (!nanos || isNaN(nanos)) return '0 ms';

        if (nanos < 1_000_000) {
            return `${(nanos / 1_000).toFixed(1)} µs`;
        }
        if (nanos < 1_000_000_000) {
            return `${(nanos / 1_000_000).toFixed(2)} ms`;
        }
        return `${(nanos / 1_000_000_000).toFixed(2)} s`;
    }

    /**
     * Cleans up widget resources.
     */
    destroy() { }
}

const bottlenecksWidget = new BottlenecksWidget();
export default bottlenecksWidget;
