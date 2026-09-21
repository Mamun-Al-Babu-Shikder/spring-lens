/**
 * Unified Formatting Utility Class for Strings, Dates, Numbers, and Durations.
 */
export class Formatter {

    /**
     * Capitalizes the first letter of a string, lowercasing the rest.
     * @param {string} str
     * @returns {string}
     */
    static capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Formats count / total into a percentage string (e.g. '42%', '< 1%', '> 99%').
     * @param {number} count
     * @param {number} total
     * @returns {string}
     */
    static formatPercentage(count, total) {
        if (!total) return '0%';
        const pctVal = (count / total) * 100;
        if (pctVal > 0 && pctVal < 1) return '< 1%';
        if (pctVal > 99 && pctVal < 100) return '> 99%';
        return `${Math.round(pctVal)}%`;
    }

    /**
     * Formats duration with clean, exact units (µs, ms, s).
     * 1 µs = 1,000 ns
     * 1 ms = 1,000,000 ns
     * 1 s  = 1,000,000,000 ns
     * @param {number|string} nanos
     * @returns {string}
     */
    static formatDuration(nanos) {
        if (nanos === undefined || nanos === null || isNaN(nanos)) return '0µs';
        const n = Number(nanos);
        if (n >= 1_000_000_000) return (n / 1e9).toFixed(2) + 's';
        const ms = n / 1e6;
        if (ms >= 100) return Math.round(ms) + 'ms';
        if (ms >= 10) return ms.toFixed(1) + 'ms';
        if (ms >= 1) return ms.toFixed(2) + 'ms';
        if (n >= 100_000) return (n / 1e3).toFixed(0) + 'µs';
        if (n >= 10_000) return (n / 1e3).toFixed(1) + 'µs';
        if (n >= 1_000) return (n / 1e3).toFixed(2) + 'µs';
        return n + 'ns';
    }

    /**
     * Formats a date, timestamp, or ISO string into a clean human-readable representation:
     * e.g. "Sep 10, 2026, 13:27:49.123"
     * @param {Date|number|string} val
     * @returns {string}
     */
    static formatDateTime(val) {
        if (!val) return '-';
        let date;
        if (val instanceof Date) {
            date = val;
        } else if (typeof val === 'number') {
            date = new Date(val < 1e11 ? val * 1000 : val);
        } else if (typeof val === 'string') {
            date = new Date(val);
        } else {
            return String(val);
        }

        if (Number.isNaN(date.getTime())) {
            return String(val);
        }

        try {
            const datePart = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            });
            const timePart = date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            const ms = String(date.getMilliseconds()).padStart(3, '0');
            return `${datePart}, ${timePart}.${ms}`;
        } catch {
            return date.toLocaleString();
        }
    }

    /**
     * Formats tick label on timeline / Gantt axis.
     * @param {number} ms
     * @returns {string}
     */
    static formatTickLabel(ms) {
        if (ms === 0) return '0';
        if (ms < 0.1) return `${(ms * 1000).toFixed(0)}µs`;
        if (ms < 1) return `${ms.toFixed(2)}ms`;
        if (ms < 10) return `${ms.toFixed(1)}ms`;
        if (ms < 1000) return `${Math.round(ms)}ms`;
        const sec = ms / 1000;
        return `${Number.isInteger(sec) ? sec : sec.toFixed(1)}s`;
    }
}

export default Formatter;
