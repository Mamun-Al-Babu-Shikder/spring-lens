/**
 * DOM and Browser Utility Class for CSS custom properties and file downloads.
 */
export class DomUtils {

    /**
     * Reads a computed CSS variable value from the document root.
     * @param {string} variableName - e.g. '--color-primary'
     * @returns {string}
     */
    static css(variableName) {
        return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    }

    /**
     * Triggers client-side download of JSON data as a formatted file.
     * @param {string} filename - Target file name (e.g. 'report.json')
     * @param {any} data - Object or data array to serialize
     */
    static downloadJson(filename, data) {
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
}
export default DomUtils;
