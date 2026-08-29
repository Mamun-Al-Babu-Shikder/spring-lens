/**
 * Toast notification utility for user-friendly popup messages
 */
export default class ToastNotification {
    static _lastToastTime = 0;
    static _lastToastMessage = '';

    /**
     * Shows a sweet, modern toast notification.
     * @param {Object} options
     * @param {string} [options.title=''] - Header title
     * @param {string} options.message - Message body (supports HTML)
     * @param {string} [options.type='sweet'] - 'sweet' | 'info' | 'warning' | 'error' | 'success'
     * @param {number} [options.duration=4000] - Duration in milliseconds before auto-dismiss
     */
    static show({ title = '', message = '', type = 'sweet', duration = 4000 } = {}) {
        const now = Date.now();
        if (this._lastToastMessage === message && now - this._lastToastTime < 1000) {
            return;
        }
        this._lastToastTime = now;
        this._lastToastMessage = message;

        let $container = $('#sl-toast-container');
        if (!$container.length) {
            $container = $('<div id="sl-toast-container" class="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none"></div>');
            $('body').append($container);
        }

        const icons = {
            sweet: {
                name: 'auto_awesome',
                bg: 'bg-purple-50 dark:bg-purple-950/60',
                text: 'text-purple-600 dark:text-purple-400',
                border: 'border-purple-200 dark:border-purple-800/60'
            },
            info: {
                name: 'info',
                bg: 'bg-blue-50 dark:bg-blue-950/60',
                text: 'text-blue-600 dark:text-blue-400',
                border: 'border-blue-200 dark:border-blue-800/60'
            },
            warning: {
                name: 'warning',
                bg: 'bg-amber-50 dark:bg-amber-950/60',
                text: 'text-amber-600 dark:text-amber-400',
                border: 'border-amber-200 dark:border-amber-800/60'
            },
            error: {
                name: 'error',
                bg: 'bg-rose-50 dark:bg-rose-950/60',
                text: 'text-rose-600 dark:text-rose-400',
                border: 'border-rose-200 dark:border-rose-800/60'
            },
            success: {
                name: 'check_circle',
                bg: 'bg-emerald-50 dark:bg-emerald-950/60',
                text: 'text-emerald-600 dark:text-emerald-400',
                border: 'border-emerald-200 dark:border-emerald-800/60'
            }
        };

        const config = icons[type] || icons.sweet;
        const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const $toast = $(`
            <div id="${toastId}" class="pointer-events-auto flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 rounded-xl shadow-xl shadow-black/10 transform translate-y-[-10px] opacity-0 transition-all duration-300 ease-out backdrop-blur-md">
                <div class="w-8 h-8 rounded-lg ${config.bg} ${config.text} ${config.border} border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span class="material-symbols-outlined text-[18px]">${config.name}</span>
                </div>
                <div class="flex-1 min-w-0 pr-1">
                    ${title ? `<h4 class="text-xs font-semibold text-gray-800 dark:text-gray-200 tracking-tight mb-0.5">${title}</h4>` : ''}
                    <div class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed break-words">${message}</div>
                </div>
                <button type="button" class="btn-toast-close text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-0.5 -mr-1 rounded-md flex-shrink-0 cursor-pointer">
                    <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>
        `);

        $toast.find('.btn-toast-close').on('click', () => {
            $toast.removeClass('translate-y-0 opacity-100').addClass('translate-y-[-10px] opacity-0');
            setTimeout(() => $toast.remove(), 300);
        });

        $container.append($toast);

        // Animate entrance
        requestAnimationFrame(() => {
            $toast.removeClass('translate-y-[-10px] opacity-0').addClass('translate-y-0 opacity-100');
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                if ($toast.parent().length) {
                    $toast.removeClass('translate-y-0 opacity-100').addClass('translate-y-[-10px] opacity-0');
                    setTimeout(() => $toast.remove(), 300);
                }
            }, duration);
        }
    }
}
