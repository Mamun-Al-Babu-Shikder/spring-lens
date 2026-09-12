import {
    BeanMetadataRules,
    QueryParam,
    TemplateEngine
} from '../../helper/index.js';

/**
 * Widget responsible for bean instances KPI, total initialization startup cost,
 * and top slowest bean startup bottlenecks list.
 */
export default class BottlenecksWidget {

    /**
     * Renders instances KPI counts and top bottleneck beans.
     * @param {Object} instancesResponse
     */
    render(instancesResponse) {
        if (!instancesResponse) return;

        const items = instancesResponse?.content ?? [];
        const total = instancesResponse?.totalElements ?? items.length;
        $('#kpi-instances-count').text(total.toLocaleString());

        // Compute startup latency metrics
        let totalNanos = 0;
        let maxNanos = 0;
        items.forEach(inst => {
            const nanos = inst.initDurationNanos || 0;
            totalNanos += nanos;
            if (nanos > maxNanos) maxNanos = nanos;
        });

        const formattedTotalCost = this.formatNanos(totalNanos);
        const formattedMaxLatency = this.formatNanos(maxNanos);

        $('#kpi-inst-total-cost').text(formattedTotalCost);
        $('#db-slowest-cost-val').text(formattedTotalCost);
        $('#db-slowest-max-val').text(formattedMaxLatency);

        // Sort items by initDurationNanos descending and pick top 5
        const sorted = [...items].sort((a, b) => (b.initDurationNanos || 0) - (a.initDurationNanos || 0));
        const top5 = sorted.slice(0, 5);
        const topMaxNanos = top5.length > 0 ? (top5[0].initDurationNanos || 1) : 1;

        const $list = $('#db-slowest-beans-list').empty();

        if (top5.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
            if (emptyClone) {
                $(emptyClone).find('[data-field="message"]').text('No instance initialization records found.');
                $list.append(emptyClone);
            }
            return;
        }

        const fragment = document.createDocumentFragment();

        top5.forEach((item, index) => {
            const clone = TemplateEngine.clone('tpl-dashboard-slowest-row');
            if (!clone) return;

            const $row = $(clone.firstElementChild);
            const durationNanos = item.initDurationNanos || 0;
            const durationMs = durationNanos / 1_000_000;
            const formattedDuration = this.formatNanos(durationNanos);
            const meta = BeanMetadataRules.resolveBeanMetadata(item);
            const pct = Math.max(8, Math.min(100, Math.round((durationNanos / topMaxNanos) * 100)));

            $row.attr('data-bean-name', item.beanName || '');
            $row.find('[data-field="rank"]').text(index + 1);
            $row.find('[data-field="icon"]')
                .css('color', meta.color)
                .text(meta.icon);
            $row.find('[data-field="name"]').text(item.beanName || '--');
            $row.find('[data-field="type"]').text(item.type || '--');

            const $bar = $row.find('[data-field="latency-bar"]').css('width', `${pct}%`);
            const $badge = $row.find('[data-field="latency-badge"]').text(formattedDuration);

            // Apply latency theme classes
            const theme = BeanMetadataRules.resolveLatencyTheme(durationMs);
            $bar.addClass(theme.bar);
            $badge.addClass(theme.badge);

            // Click to navigate to instances view
            $row.on('click', () => {
                if (item.beanName) {
                    const query = QueryParam.build({ search: item.beanName, contextId: item.contextId || '' }).toString();
                    window.location.hash = `#/instances?${query}`;
                } else {
                    window.location.hash = '#/instances';
                }
            });

            fragment.appendChild(clone);
        });

        $list.append(fragment);
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
    destroy() {
        // No persistent listeners or intervals
    }
}
