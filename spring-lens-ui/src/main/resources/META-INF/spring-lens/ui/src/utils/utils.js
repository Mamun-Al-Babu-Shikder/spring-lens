import { NH, NW, NODE_STYLES_TINT, NODE_STYLES_BADGE, DEFAULT_NODE_STYLE, BEAN_TYPE_RULES } from "./constants.js";

// Style mappings for Tinted theme in dark mode
const DARK_NODE_STYLES_TINT = {
    root: { fill: 'rgba(30, 58, 138, 0.32)', stroke: '#3b82f6', icon: '#60a5fa', text: '#93c5fd' },
    context: { fill: 'rgba(67, 56, 202, 0.32)', stroke: '#6366f1', icon: '#818cf8', text: '#a5b4fc' },
    intermediate: { fill: 'rgba(6, 78, 59, 0.32)', stroke: '#22c55e', icon: '#4ade80', text: '#86efac' },
    leaf: { fill: 'rgba(120, 53, 15, 0.32)', stroke: '#f59e0b', icon: '#fbbf24', text: '#fde68a' },
    adapter: { fill: 'rgba(88, 28, 135, 0.32)', stroke: '#a855f7', icon: '#c084fc', text: '#e9d5ff' }
};

// Style mappings for Card/Badge theme in dark mode
const DARK_NODE_STYLES_BADGE = {
    root: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#3b82f6', icon: '#60a5fa', iconBg: 'rgba(59, 130, 246, 0.22)', text: '#f1f5f9' },
    context: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#6366f1', icon: '#818cf8', iconBg: 'rgba(99, 102, 241, 0.22)', text: '#f1f5f9' },
    intermediate: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#10b981', icon: '#34d399', iconBg: 'rgba(16, 185, 129, 0.22)', text: '#f1f5f9' },
    leaf: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#f59e0b', icon: '#fbbf24', iconBg: 'rgba(245, 158, 11, 0.22)', text: '#f1f5f9' },
    adapter: { fill: 'rgba(15, 23, 42, 0.92)', stroke: '#a855f7', icon: '#c084fc', iconBg: 'rgba(168, 85, 247, 0.22)', text: '#f1f5f9' }
};

export const css = (variableName) =>
    getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();

export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatPercentage(count, total) {
    if (!total) return '0%';

    const pctVal = (count / total) * 100;

    if (pctVal > 0 && pctVal < 1) return '< 1%';
    if (pctVal > 99 && pctVal < 100) return '> 99%';

    return `${Math.round(pctVal)}%`;
}

/**
 * Resolves metadata (icon and color) for a bean based on rule keyword matches or fallback styles.
 * @param {Object|null} bean - Target bean object.
 * @returns {{ icon: string, color: string }} Icon name and hex/CSS color.
 */
export function resolveBeanMetadata(bean) {
    if (!bean) return { icon: 'extension', color: '#6b46c1' };

    const { beanName = '', type = '' } = bean;
    const lowerName = beanName.toLowerCase();
    const lowerType = type.toLowerCase();

    // Fast keyword lookup in BEAN_TYPE_RULES
    const rulesLength = BEAN_TYPE_RULES.length;
    for (let i = 0; i < rulesLength; i++) {
        const rule = BEAN_TYPE_RULES[i];
        const keywords = rule.keywords;
        const keywordsLength = keywords.length;

        for (let j = 0; j < keywordsLength; j++) {
            const keyword = keywords[j];
            if (lowerName.includes(keyword) || lowerType.includes(keyword)) {
                return { icon: rule.icon, color: rule.color };
            }
        }
    }

    // Fallback node style resolution
    const style = nodeStyle({ fullName: beanName, meta: { type } });
    return {
        icon: 'extension',
        color: style.stroke ?? '#6b46c1'
    };
}


/**
 * Categorizes a graph node or bean definition into a semantic layout type ('adapter', 'root', 'intermediate', or 'leaf').
 * @param {Object|d3.HierarchyNode|null} node - Hierarchy node or bean object.
 * @returns {string} Category label string.
 */
export function getBeanCategory(node) {
    if (!node) return 'leaf';

    const nodeData = node.data ?? node;
    const fullName = nodeData.fullName ?? '';
    const type = nodeData.meta?.type ?? '';

    if (nodeData.meta?.type === 'context') return 'context';
    if (nodeData.meta?.type === 'root') return 'root';

    // 1. Root origin check (depth 0 is the root node)
    if (node.depth === 0) {
        return 'root';
    }

    const lowerName = fullName.toLowerCase();
    const lowerType = type.toLowerCase();

    // 2. Adapter check
    if (lowerName.includes('adapter') || lowerType.includes('adapter')) {
        return 'adapter';
    }

    // 3. Child node presence check for tree nodes
    const hasChildren = (node.children?.length ?? 0) > 0 || (node._children?.length ?? 0) > 0;
    if (hasChildren) {
        return 'intermediate';
    }

    // 4. Fallback check for raw data objects using the global map
    const record = window.allBeansMap?.get(fullName);
    if (record) {
        const deps = record.dependencies;
        const dependents = record.dependents;

        if (dependents && dependents.length > 0 && deps && deps.length > 0) return 'intermediate';
        if (!deps || deps.length === 0) return 'leaf';
        if (!dependents || dependents.length === 0) return 'root';
    }

    return 'leaf';
}

export function nodeStyle(node, theme = null) {
    const isDark = document.documentElement.classList.contains('dark');
    const category = getBeanCategory(node);
    const activeTheme = theme || localStorage.getItem('sl-node-theme') || 'tint';

    if (activeTheme === 'badge') {
        if (isDark) {
            return DARK_NODE_STYLES_BADGE[category] ?? DARK_NODE_STYLES_BADGE.adapter;
        }
        return NODE_STYLES_BADGE[category] ?? NODE_STYLES_BADGE.adapter;
    }

    if (isDark) {
        return DARK_NODE_STYLES_TINT[category] ?? DARK_NODE_STYLES_TINT.adapter;
    }
    return NODE_STYLES_TINT[category] ?? NODE_STYLES_TINT.adapter;
}

export function tbLink({ source, target }) {
    const sx = source.x;
    const sy = source.y + NH / 2;
    const tx = target.x;
    const ty = target.y - NH / 2;
    const my = (sy + ty) / 2;

    return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
}

export function lrLink({ source, target }) {
    const sWidth = source.width ?? NW;
    const tWidth = target.width ?? NW;
    const sx = source.y + sWidth / 2;
    const sy = source.x;
    const tx = target.y - tWidth / 2;
    const ty = target.x;
    const mx = (sx + tx) / 2;

    return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

export const tree = d3.tree();

/**
 * Triggers a browser file download of an object as formatted JSON.
 * @param {string} filename - Target filename (e.g. 'spring-lens-report.json').
 * @param {Object} data - Data object to serialize.
 */
export function downloadJson(filename, data) {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}