import { extractClassAndPackage, formatConditionName } from './condition-utils.js';

/**
 * Data presentation formatter for condition detail side-sheet and inline accordion inspector.
 */
export default class ConditionDetailWidget {

    formatDetails(condition) {
        if (!condition) return null;

        const { source, contextId, outcome, matches = [] } = condition;
        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = extractClassAndPackage(source);
        const displayClassName = memberName ? `${className}#${memberName}` : className;

        const failedMatch = matches.find(m => !m.matched);
        const failedMatches = matches.filter(m => !m.matched);

        let reasonText = '';
        let diagnosticMsg = '';

        if (isMatched) {
            reasonText = 'All condition evaluations satisfied. Configuration applied.';
            diagnosticMsg = matches.map(m => `• ${formatConditionName(m.condition)}: ${m.message}`).join('\n') ||
                'Configuration evaluated successfully.';
        } else {
            const failureReason = failedMatch?.message || 'One or more required conditions did not match.';
            reasonText = failureReason;
            diagnosticMsg = failedMatches.length > 1
                ? failedMatches.map(m => `• ${formatConditionName(m.condition)}: ${m.message}`).join('\n')
                : failureReason;
        }

        const formattedMatches = matches.map(m => ({
            conditionName: formatConditionName(m.condition),
            message: m.message || 'No additional message',
            matched: Boolean(m.matched)
        }));

        return {
            source,
            contextId: contextId || 'SpringContext',
            contextIdRaw: contextId || '-',
            className: displayClassName,
            packageName: packageName || 'default package',
            isMatched,
            reasonText,
            diagnosticMsg,
            matchesCount: `${matches.length} conditions`,
            matches: formattedMatches
        };
    }
}
