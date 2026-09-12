import TemplateEngine from '../../helper/template-engine.js';

/**
 * Widget responsible for rendering the visual connection status badge
 * in the application sidebar.
 */
export default class StatusIndicatorWidget {

    /**
     * @param {Object} [options]
     * @param {string} [options.container] - CSS selector for the status badge container.
     */
    constructor(options = {}) {
        this.container = options.container || '#sidebar-status-container';
        this.currentStatus = null;
    }

    /**
     * Renders connected or disconnected status template badge.
     * @param {boolean} isLive
     */
    render(isLive) {
        if (this.currentStatus === isLive) return;
        this.currentStatus = isLive;

        const templateId = isLive ? 'tpl-status-connected' : 'tpl-status-disconnected';
        const clone = TemplateEngine.clone(templateId);
        if (clone) {
            $(this.container).empty().append(clone);
        }
    }

    /**
     * Clears status container and resets state.
     */
    destroy() {
        $(this.container).empty();
        this.currentStatus = null;
    }
}
