/**
 * Widget responsible for rendering the top 4 KPI metric cards
 * (Total Configurations, Matched, Did Not Match, Total Conditions Evaluated).
 */
export default class ConditionKpiWidget {

    /**
     * Updates top 4 KPI metric cards in the DOM.
     * @param {Object} metrics
     * @param {number} metrics.total
     * @param {number} metrics.matched
     * @param {number} metrics.unmatched
     * @param {number} metrics.totalConditions
     */
    render(metrics = {}) {
        const { total = 0, matched = 0, unmatched = 0, totalConditions = 0 } = metrics;

        $('#condition-kpi-total').text(total.toLocaleString());

        const matchedPct = total > 0 ? ((matched / total) * 100).toFixed(1) : '0';
        $('#condition-kpi-matched-count').text(matched.toLocaleString());
        $('#condition-kpi-matched-pct').text(`(${matchedPct}%)`);

        const unmatchedPct = total > 0 ? ((unmatched / total) * 100).toFixed(1) : '0';
        $('#condition-kpi-unmatched-count').text(unmatched.toLocaleString());
        $('#condition-kpi-unmatched-pct').text(`(${unmatchedPct}%)`);

        $('#condition-kpi-conditions-total').text(totalConditions > 0 ? totalConditions.toLocaleString() : '-');
    }

    /**
     * Resets KPI cards to initial placeholders.
     */
    reset() {
        $('#condition-kpi-total').text('-');
        $('#condition-kpi-matched-count').text('-');
        $('#condition-kpi-matched-pct').text('-');
        $('#condition-kpi-unmatched-count').text('-');
        $('#condition-kpi-unmatched-pct').text('-');
        $('#condition-kpi-conditions-total').text('-');
    }
}
