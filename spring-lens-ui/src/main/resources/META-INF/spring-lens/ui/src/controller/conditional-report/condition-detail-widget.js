import {
    CSS_CLASSES,
    CONDITION_STATUS_THEMES,
    TemplateEngine
} from '../../helper/index.js';
import { extractClassAndPackage, formatConditionName } from './condition-utils.js';

/**
 * Widget responsible for the condition detail inspector, supporting both
 * Side-Sheet Modal (Overlay Flyout) and Inline Accordion view styles.
 */
export default class ConditionDetailWidget {

    /**
     * Renders detailed breakdown using the configured view style.
     * @param {Object} condition
     * @param {'side-sheet'|'inline'} [viewStyle='side-sheet']
     */
    render(condition, viewStyle = 'side-sheet') {
        if (!condition) return;

        if (viewStyle === 'inline') {
            this._renderInlineAccordion(condition);
        } else {
            this._renderSideSheet(condition);
        }
    }

    /**
     * Option 2: Renders detailed breakdown inside the Sliding Side-Sheet Modal.
     * @private
     */
    _renderSideSheet(condition) {
        const $overlay = $('#condition-detail-overlay');
        const $backdrop = $('#condition-detail-backdrop');
        const $panel = $('#condition-detail-panel');
        const $conditionDetailsClassName = $('#condition-detail-class-name');

        if (!$panel.length) return;

        const { source, contextId, outcome, matches = [] } = condition;
        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = extractClassAndPackage(source);
        const displayClassName = memberName ? `${className}#${memberName}` : className;

        // Populate Header
        $conditionDetailsClassName.text(displayClassName);
        $('#condition-detail-package-name').text(packageName || 'default package');
        $('#condition-detail-context-badge').text(contextId || 'SpringContext');
        $('#condition-detail-context-id').text(contextId || '-');
        $('#condition-detail-source-full').text(source);

        // Status Badge
        const statusTheme = isMatched ? CONDITION_STATUS_THEMES.matched : CONDITION_STATUS_THEMES.notMatched;
        $('#condition-detail-status-badge')
            .removeClass()
            .addClass(`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1 shadow-xs ${statusTheme.badge}`);
        $('#condition-detail-status-icon').text(statusTheme.icon);
        $('#condition-detail-status-text').text(statusTheme.label);

        // Summary Icon & Reason Text
        const failedMatch = matches.find(m => !m.matched);
        const $reasonIcon = $('#condition-detail-reason-icon');
        const $reasonText = $('#condition-detail-reason-text');

        if (isMatched) {
            $reasonIcon.text('check_circle').removeClass('text-red-500').addClass('text-emerald-500');
            $reasonText.text('All condition evaluations satisfied. Configuration applied.');
            $('#condition-detail-diagnostic-msg').text(
                matches.map(m => `• ${formatConditionName(m.condition)}: ${m.message}`).join('\n') || 'Configuration evaluated successfully.'
            );
        } else {
            $reasonIcon.text('cancel').removeClass('text-emerald-500').addClass('text-red-500');
            const failedMatches = matches.filter(m => !m.matched);
            const failureReason = failedMatch?.message || 'One or more required conditions did not match.';
            $reasonText.text(failureReason);
            const diagnosticDetails = failedMatches.length > 1
                ? failedMatches.map(m => `• ${formatConditionName(m.condition)}: ${m.message}`).join('\n')
                : failureReason;
            $('#condition-detail-diagnostic-msg').text(diagnosticDetails);
        }

        // Render Condition Outcomes List
        const $matchesList = $('#condition-detail-matches-list');
        $matchesList.empty();
        $('#condition-detail-matches-count').text(`${matches.length} conditions`);

        if (matches.length === 0) {
            $matchesList.html('<p class="text-xs text-gray-400 italic py-4">No individual condition checks recorded.</p>');
        } else {
            const matchesFrag = document.createDocumentFragment();

            for (const match of matches) {
                const matchClone = TemplateEngine.clone('tpl-condition-match-item');
                if (matchClone?.firstElementChild) {
                    const $item = $(matchClone.firstElementChild);
                    const isItemMatched = match.matched;

                    const $icon = $item.find('[data-field="matchIcon"]');
                    const $name = $item.find('[data-field="conditionName"]');
                    const $msg = $item.find('[data-field="matchMessage"]');
                    const $badge = $item.find('[data-field="matchStatusBadge"]');

                    $name.text(formatConditionName(match.condition));
                    $msg.text(match.message || 'No additional message');

                    if (isItemMatched) {
                        $icon.text('check_circle').addClass('text-emerald-500');
                        $badge.text('Matched')
                            .addClass('bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40');
                    } else {
                        $icon.text('cancel').addClass('text-red-500');
                        $badge.text('Did Not Match')
                            .addClass('bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40');
                        $item.addClass('bg-red-50/30 dark:bg-red-950/20 border-red-100 dark:border-red-900/30');
                    }

                    matchesFrag.appendChild(matchClone);
                }
            }

            $matchesList.append(matchesFrag);
        }

        // Open Side-Sheet with smooth flyout animation
        $overlay.removeClass('hidden pointer-events-none');
        $backdrop.removeClass('opacity-100 pointer-events-none').addClass('opacity-100 pointer-events-auto');
        if ($panel.length) {
            void $panel[0].offsetWidth;
        }
        requestAnimationFrame(() => {
            $panel.removeClass('translate-x-full').addClass('translate-x-0');
        });
    }

    /**
     * Option 3: Renders detailed breakdown into an expandable inline table row (Accordion).
     * @private
     */
    _renderInlineAccordion(condition) {
        $('.condition-expanded-row').remove();

        const { source, contextId, outcome, matches = [] } = condition;
        const $targetRow = $(`.condition-row[data-context-id="${contextId}"][data-source="${source}"]`);
        if (!$targetRow.length) return;

        const clone = TemplateEngine.clone('tpl-condition-expanded-row');
        if (!clone || !clone.firstElementChild) return;

        const $expandedRow = $(clone.firstElementChild);
        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = extractClassAndPackage(source);
        const displayClassName = memberName ? `${className}#${memberName}` : className;

        // Header info
        $expandedRow.find('[data-field="className"]').text(displayClassName);
        $expandedRow.find('[data-field="contextBadge"]').text(contextId || 'SpringContext');
        $expandedRow.find('[data-field="sourceFull"]').text(source);

        // Status Badge
        const statusTheme = isMatched ? CONDITION_STATUS_THEMES.matched : CONDITION_STATUS_THEMES.notMatched;
        $expandedRow.find('[data-field="statusBadge"]')
            .addClass(`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1 shadow-xs ${statusTheme.badge}`);
        $expandedRow.find('[data-field="statusIcon"]').text(statusTheme.icon);
        $expandedRow.find('[data-field="statusText"]').text(statusTheme.label);

        // Summary Icon & Reason Text
        const failedMatch = matches.find(m => !m.matched);
        const $reasonIcon = $expandedRow.find('[data-field="reasonIcon"]');
        const $reasonText = $expandedRow.find('[data-field="reasonText"]');
        const $diagMsg = $expandedRow.find('[data-field="diagnosticMsg"]');

        if (isMatched) {
            $reasonIcon.text('check_circle').addClass('text-emerald-500');
            $reasonText.text('All condition evaluations satisfied. Configuration applied.');
            $diagMsg.text(
                matches.map(m => `• ${formatConditionName(m.condition)}: ${m.message}`).join('\n') || 'Configuration evaluated successfully.'
            );
        } else {
            $reasonIcon.text('cancel').addClass('text-red-500');
            const failedMatches = matches.filter(m => !m.matched);
            const failureReason = failedMatch?.message || 'One or more required conditions did not match.';
            $reasonText.text(failureReason);
            const diagnosticDetails = failedMatches.length > 1
                ? failedMatches.map(m => `• ${formatConditionName(m.condition)}: ${m.message}`).join('\n')
                : failureReason;
            $diagMsg.text(diagnosticDetails);
        }

        // Render Condition Outcomes List
        const $matchesList = $expandedRow.find('[data-field="matchesList"]');
        $matchesList.empty();
        $expandedRow.find('[data-field="matchesCount"]').text(`${matches.length} conditions`);

        if (matches.length === 0) {
            $matchesList.html('<p class="text-xs text-gray-400 italic py-3">No individual condition checks recorded.</p>');
        } else {
            const matchesFrag = document.createDocumentFragment();

            for (const match of matches) {
                const matchClone = TemplateEngine.clone('tpl-condition-match-item');
                if (matchClone?.firstElementChild) {
                    const $item = $(matchClone.firstElementChild);
                    const isItemMatched = match.matched;

                    const $icon = $item.find('[data-field="matchIcon"]');
                    const $name = $item.find('[data-field="conditionName"]');
                    const $msg = $item.find('[data-field="matchMessage"]');
                    const $badge = $item.find('[data-field="matchStatusBadge"]');

                    $name.text(formatConditionName(match.condition));
                    $msg.text(match.message || 'No additional message');

                    if (isItemMatched) {
                        $icon.text('check_circle').addClass('text-emerald-500');
                        $badge.text('Matched')
                            .addClass('bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40');
                    } else {
                        $icon.text('cancel').addClass('text-red-500');
                        $badge.text('Did Not Match')
                            .addClass('bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40');
                        $item.addClass('bg-red-50/30 dark:bg-red-950/20 border-red-100 dark:border-red-900/30');
                    }

                    matchesFrag.appendChild(matchClone);
                }
            }

            $matchesList.append(matchesFrag);
        }

        $targetRow.after($expandedRow);
        const $wrapper = $expandedRow.find('.condition-accordion-wrapper');
        if ($wrapper.length) {
            void $wrapper[0].offsetHeight;
        }
        requestAnimationFrame(() => {
            $wrapper.addClass('open');
        });
    }

    /**
     * Closes the detail panel across both side-sheet and inline modes.
     * @param {Function} [callback]
     */
    close(callback) {
        $('.condition-row')
            .removeClass(CSS_CLASSES.rowActive)
            .find('[data-field="expandIcon"]')
            .removeClass('rotate-90 text-primary dark:text-purple-300');

        // 1. Close Side-Sheet flyout if open
        const $overlay = $('#condition-detail-overlay');
        const $backdrop = $('#condition-detail-backdrop');
        const $panel = $('#condition-detail-panel');

        if ($panel.hasClass('translate-x-0')) {
            $panel.removeClass('translate-x-0').addClass('translate-x-full');
            $backdrop.removeClass('opacity-100 pointer-events-auto').addClass('opacity-0 pointer-events-none');
            setTimeout(() => {
                $overlay.addClass('hidden pointer-events-none');
                if (typeof callback === 'function') callback();
            }, 300);
            return;
        }

        // 2. Close Inline Accordion row if open
        const $existing = $('.condition-expanded-row');
        if ($existing.length) {
            const $wrapper = $existing.find('.condition-accordion-wrapper');
            $wrapper.removeClass('open');
            setTimeout(() => {
                $existing.remove();
                if (typeof callback === 'function') callback();
            }, 550);
            return;
        }

        if (typeof callback === 'function') {
            callback();
        }
    }
}
