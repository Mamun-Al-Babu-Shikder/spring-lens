import TemplateEngine from './template-engine.js';

export default class PageHeader {
    /**
     * Renders a page header DOM element from config.
     * @param {Object} headerConfig
     * @returns {HTMLElement|null}
     */
    static render(headerConfig) {
        if (!headerConfig) return null;

        const clone = TemplateEngine.clone('tpl-page-header');
        if (!clone) return null;

        const $header = $(clone.firstElementChild);

        // 1. Icon
        if (headerConfig.icon) {
            $header.find('[data-header-field="icon"]').text(headerConfig.icon);
        } else {
            $header.find('[data-header-field="iconContainer"]').remove();
        }

        // 2. Title
        if (headerConfig.title) {
            $header.find('[data-header-field="title"]').text(headerConfig.title);
        }

        // 3. Badge
        const $badge = $header.find('[data-header-field="badge"]');
        if (headerConfig.badge) {
            $badge.text(headerConfig.badge).removeClass('hidden');
        } else {
            $badge.remove();
        }

        // 4. Breadcrumbs
        const $breadcrumbs = $header.find('[data-header-field="breadcrumbs"]').empty();
        if (Array.isArray(headerConfig.breadcrumbs) && headerConfig.breadcrumbs.length > 0) {
            headerConfig.breadcrumbs.forEach((crumb, idx) => {
                if (idx > 0) {
                    $breadcrumbs.append('<span class="material-symbols-outlined text-[12px] opacity-60">chevron_right</span>');
                }
                const isLast = idx === headerConfig.breadcrumbs.length - 1;
                const $crumbSpan = $('<span>').text(crumb);
                if (isLast) {
                    $crumbSpan.addClass('text-gray-700 dark:text-gray-300 font-semibold');
                }
                $breadcrumbs.append($crumbSpan);
            });
        } else {
            $breadcrumbs.remove();
        }

        // 5. Actions
        const $actions = $header.find('[data-header-field="actions"]').empty();
        if (Array.isArray(headerConfig.actions) && headerConfig.actions.length > 0) {
            headerConfig.actions.forEach(action => {
                if (action.type === 'search') {
                    const searchClone = TemplateEngine.clone('tpl-page-header-search');
                    if (searchClone) {
                        const $input = $(searchClone).find('input');
                        if (action.id) $input.attr('id', action.id);
                        if (action.placeholder) $input.attr('placeholder', action.placeholder);
                        if (action.cssClass) $input.addClass(action.cssClass);
                        $actions.append(searchClone);
                    }
                } else {
                    const btnClone = TemplateEngine.clone('tpl-page-header-btn');
                    if (btnClone) {
                        const $btn = $(btnClone.firstElementChild);
                        if (action.id) $btn.attr('id', action.id);
                        if (action.action) $btn.attr('data-action', action.action);
                        if (action.title) $btn.attr('title', action.title);
                        if (action.icon) {
                            $btn.find('[data-btn-field="icon"]').text(action.icon);
                        } else {
                            $btn.find('[data-btn-field="icon"]').remove();
                        }
                        if (action.label) {
                            $btn.find('[data-btn-field="label"]').text(action.label);
                        } else {
                            $btn.find('[data-btn-field="label"]').remove();
                        }
                        if (action.cssClass) {
                            $btn.addClass(action.cssClass);
                        }
                        $actions.append($btn);
                    }
                }
            });
        } else {
            $actions.remove();
        }

        return $header[0];
    }
}
