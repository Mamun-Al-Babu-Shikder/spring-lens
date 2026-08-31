/**
 * Utility class for managing and cloning HTML <template> elements.
 */
export default class TemplateEngine {
    /**
     * Clones a native HTML <template> element content by template ID.
     * @param {string} templateId - DOM ID of the target <template> element.
     * @returns {DocumentFragment|null} Cloned document fragment or null if element is missing.
     */
    static clone(templateId) {
        const template = document.getElementById(templateId);
        return template ? template.content.cloneNode(true) : null;
    }

    /**
     * Clones either check or uncheck icon template based on boolean flag.
     * @param {boolean} isTrue
     * @returns {DocumentFragment|null}
     */
    static renderBooleanIcon(isTrue) {
        return TemplateEngine.clone(isTrue ? 'tpl-icon-check' : 'tpl-icon-uncheck');
    }
}
