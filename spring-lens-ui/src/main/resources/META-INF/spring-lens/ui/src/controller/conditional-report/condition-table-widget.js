import { extractClassAndPackage, getOutcomeSummary } from './condition-utils.js';

/**
 * Data presentation formatter for condition evaluation table rows and headers.
 */
export default class ConditionTableWidget {
    getSortIcon(currentSortBy, currentSortDir, column) {
        if (currentSortBy !== column) return 'unfold_more';
        return currentSortDir === 'ASC' ? 'arrow_upward' : 'arrow_downward';
    }

    formatRow(item) {
        if (!item) return null;
        const { source, contextId, outcome, matches = [] } = item;
        const isMatched = outcome === 'MATCHED';
        const { className, packageName, memberName } = extractClassAndPackage(source);
        const displayClassName = memberName ? `${className}#${memberName}` : className;

        const totalMatches = matches.length;
        const matchedCount = matches.filter(m => m.matched).length;
        const percentage = totalMatches > 0 ? Math.round((matchedCount / totalMatches) * 100) : (isMatched ? 100 : 0);
        const outcomeSummary = getOutcomeSummary(item);

        return {
            key: `${contextId || ''}:${source}`,
            isGroupHeader: false,
            isDetailRow: false,
            raw: item,
            source,
            contextId: contextId || '',
            outcome,
            isMatched,
            className: displayClassName,
            packageName: packageName || 'default package',
            ratio: `${matchedCount} / ${totalMatches}`,
            percentage,
            outcomeSummary
        };
    }

    formatTableRows(conditions = [], options = {}) {
        const {
            groupBy = 'none',
            selectedCondition = null,
            detailViewStyle = 'side-sheet',
            selectedConditionDetails = null
        } = options;

        if (!conditions || conditions.length === 0) return [];

        const isInline = detailViewStyle === 'inline';

        const appendRowWithDetail = (rows, item) => {
            const row = this.formatRow(item);
            if (!row) return;
            rows.push(row);
            const isSelected = selectedCondition &&
                selectedCondition.source === row.source &&
                (selectedCondition.contextId || '') === (row.contextId || '');
            if (isInline && isSelected && selectedConditionDetails) {
                rows.push({
                    key: `detail_${row.key}`,
                    isGroupHeader: false,
                    isDetailRow: true,
                    detail: selectedConditionDetails
                });
            }
        };

        if (groupBy === 'package') {
            const packageGroups = new Map();
            for (const item of conditions) {
                const { packageName } = extractClassAndPackage(item.source);
                const groupKey = packageName || 'default';
                if (!packageGroups.has(groupKey)) {
                    packageGroups.set(groupKey, []);
                }
                packageGroups.get(groupKey).push(item);
            }

            const sortedPackages = Array.from(packageGroups.keys()).sort();
            const rows = [];
            for (const pkg of sortedPackages) {
                const items = packageGroups.get(pkg);
                rows.push({
                    key: `pkg_${pkg}`,
                    isGroupHeader: true,
                    isDetailRow: false,
                    groupIcon: 'folder',
                    groupTitle: pkg,
                    groupCount: `${items.length} items`
                });
                for (const item of items) {
                    appendRowWithDetail(rows, item);
                }
            }
            return rows;
        }

        if (groupBy === 'status') {
            const matchedItems = conditions.filter(i => i.outcome === 'MATCHED');
            const unmatchedItems = conditions.filter(i => i.outcome === 'NOT_MATCHED');
            const rows = [];

            if (matchedItems.length > 0) {
                rows.push({
                    key: 'status_matched',
                    isGroupHeader: true,
                    isDetailRow: false,
                    groupIcon: 'check_circle',
                    groupTitle: 'Matched Auto-configurations',
                    groupCount: `${matchedItems.length} items`
                });
                for (const item of matchedItems) {
                    appendRowWithDetail(rows, item);
                }
            }

            if (unmatchedItems.length > 0) {
                rows.push({
                    key: 'status_unmatched',
                    isGroupHeader: true,
                    isDetailRow: false,
                    groupIcon: 'cancel',
                    groupTitle: 'Did Not Match (Skipped)',
                    groupCount: `${unmatchedItems.length} items`
                });
                for (const item of unmatchedItems) {
                    appendRowWithDetail(rows, item);
                }
            }
            return rows;
        }

        const rows = [];
        for (const item of conditions) {
            appendRowWithDetail(rows, item);
        }
        return rows;
    }
}
