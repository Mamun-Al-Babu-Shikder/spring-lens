class ConditionsWidget {

    /**
     * Computes condition evaluations KPI, ratio bars, and notable auto-configs.
     * @param {Object} conditionsResponse
     * @returns {Object}
     */
    computeMetrics(conditionsResponse) {
        if (!conditionsResponse) {
            return {
                total: '--',
                matched: 0,
                matchedPct: 0,
                notMatched: 0,
                notMatchedPct: 0,
                matchedLabel: '0 (0%)',
                unmatchedLabel: '0 (0%)',
                evaluatedCount: '--',
                samples: []
            };
        }

        const items = conditionsResponse?.content ?? [];
        const total = conditionsResponse?.totalElements ?? items.length;

        let matched = 0;
        let notMatched = 0;

        items.forEach(c => {
            if (c.outcome === 'MATCHED') matched++;
            else notMatched++;
        });

        const evaluatedTotal = matched + notMatched || total || 1;
        const matchedPct = Math.round((matched / evaluatedTotal) * 100);
        const notMatchedPct = 100 - matchedPct;

        const sample = items.slice(0, 4).map((cond, index) => {
            const isMatch = cond.outcome === 'MATCHED';
            const shortSource = cond.source?.split('.').pop() || cond.source || '--';

            return {
                id: `${cond.source || 'cond'}_${index}`,
                source: shortSource,
                fullSource: cond.source || '',
                outcome: cond.outcome || 'UNKNOWN',
                isMatch,
                dotClass: isMatch ? 'bg-emerald-500' : 'bg-slate-400',
                outcomeClass: isMatch
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            };
        });

        return {
            total: total.toLocaleString(),
            matched: matched.toLocaleString(),
            matchedPct,
            notMatched: notMatched.toLocaleString(),
            notMatchedPct,
            matchedLabel: `${matched} (${matchedPct}%)`,
            unmatchedLabel: `${notMatched} (${notMatchedPct}%)`,
            evaluatedCount: `${total} Total Checked`,
            samples: sample
        };
    }

    /**
     * Backward-compatible render method that delegates to computeMetrics.
     * @param {Object} conditionsResponse
     * @returns {Object}
     */
    render(conditionsResponse) {
        return this.computeMetrics(conditionsResponse);
    }

    /**
     * Cleans up widget resources.
     */
    destroy() { }
}
const conditionsWidget = new ConditionsWidget();
export default conditionsWidget;
