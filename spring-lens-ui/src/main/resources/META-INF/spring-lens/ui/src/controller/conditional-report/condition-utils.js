export function extractClassAndPackage(sourceStr) {
    if (!sourceStr || typeof sourceStr !== 'string') {
        return { className: 'Unknown', packageName: '', memberName: '' };
    }

    let mainSource = sourceStr;
    let memberName = '';

    if (sourceStr.includes('#')) {
        const parts = sourceStr.split('#');
        mainSource = parts[0];
        memberName = parts[1] || '';
    }

    const lastDotIndex = mainSource.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return { className: mainSource, packageName: '', memberName };
    }

    const packageName = mainSource.substring(0, lastDotIndex);
    const className = mainSource.substring(lastDotIndex + 1);

    return { className, packageName, memberName };
}

/**
 * Formats condition names like 'OnPropertyCondition' into '@ConditionalOnProperty'.
 * @param {string} condition
 * @returns {string}
 */
export function formatConditionName(condition) {
    if (!condition) return '@Condition';
    if (condition.startsWith('@')) return condition;

    if (condition.startsWith('On') && condition.endsWith('Condition')) {
        const core = condition.substring(2, condition.length - 'Condition'.length);
        return `@ConditionalOn${core}`;
    }

    if (condition.endsWith('Condition')) {
        const core = condition.substring(0, condition.length - 'Condition'.length);
        return `@Conditional${core}`;
    }

    return `@${condition}`;
}

/**
 * Extracts a concise human-readable outcome summary or failure reason snippet.
 * @param {Object} item
 * @returns {string}
 */
export function getOutcomeSummary(item) {
    if (item?.outcome === 'MATCHED') {
        return 'All conditions matched';
    }

    const matches = Array.isArray(item?.matches) ? item.matches : [];
    const failedMatch = matches.find(m => !m.matched);

    if (failedMatch?.message) {
        return failedMatch.message;
    }

    return 'Condition did not match';
}
