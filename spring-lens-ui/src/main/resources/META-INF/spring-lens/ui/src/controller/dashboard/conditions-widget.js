import { TemplateEngine } from '../../helper/index.js';

/**
 * Widget responsible for auto-configuration condition evaluation metrics,
 * match ratio progress bars, and recent evaluation sample cards.
 */
export default class ConditionsWidget {

    /**
     * Renders condition evaluations KPI, ratio bars, and notable auto-configs.
     * @param {Object} conditionsResponse
     */
    render(conditionsResponse) {
        if (!conditionsResponse) return;

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

        $('#kpi-conditions-count').text(total.toLocaleString());
        $('#kpi-cond-matched').text(matched.toLocaleString());
        $('#kpi-cond-matched-pct').text(matchedPct);
        $('#kpi-cond-skipped').text(notMatched.toLocaleString());

        // Update Progress Bar
        $('#db-cond-matched-label').text(`${matched} (${matchedPct}%)`);
        $('#db-cond-unmatched-label').text(`${notMatched} (${notMatchedPct}%)`);
        $('#db-cond-matched-bar').css('width', `${matchedPct}%`);
        $('#db-cond-unmatched-bar').css('width', `${notMatchedPct}%`);

        $('#db-conditions-eval-count').text(`${total} Total Checked`);

        // Render Recent Samples
        const $list = $('#db-conditions-sample-list').empty();

        if (items.length === 0) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-empty-state');
            if (emptyClone) {
                $(emptyClone).find('[data-field="message"]').text('No condition reports available.');
                $list.append(emptyClone);
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        const sample = items.slice(0, 4);

        sample.forEach(cond => {
            const clone = TemplateEngine.clone('tpl-dashboard-condition-row');
            if (!clone) return;

            const $row = $(clone.firstElementChild);
            const isMatch = cond.outcome === 'MATCHED';
            const shortSource = cond.source?.split('.').pop() || cond.source || '--';

            $row.find('[data-field="dot"]')
                .addClass(isMatch ? 'bg-emerald-500' : 'bg-slate-400');
            $row.find('[data-field="source"]')
                .text(shortSource)
                .attr('title', cond.source || '');

            const $badge = $row.find('[data-field="outcome-badge"]');
            $badge.text(cond.outcome || 'UNKNOWN');

            if (isMatch) {
                $badge.addClass('bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800');
            } else {
                $badge.addClass('bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700');
            }

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
