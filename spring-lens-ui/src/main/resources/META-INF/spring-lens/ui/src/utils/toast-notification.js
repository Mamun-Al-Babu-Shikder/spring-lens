export default class ToastNotification {
    static _lastToastTime = 0;
    static _lastToastMessage = '';
    static _activeToasts = new Set();

    /**
     * Type configurations with curated gradients, icons, borders, and ambient glows.
     */
    static TYPES = {
        sweet: {
            name: 'auto_awesome',
            accentGradient: 'from-purple-500 via-purple-600 to-indigo-600',
            bgIcon: 'bg-purple-50 dark:bg-purple-950/50',
            textIcon: 'text-purple-600 dark:text-purple-300',
            borderIcon: 'border-purple-200/80 dark:border-purple-800/60',
            progressGradient: 'linear-gradient(90deg, #a855f7 0%, #6366f1 100%)',
            glowColor: 'rgba(168, 85, 247, 0.15)'
        },
        success: {
            name: 'check_circle',
            accentGradient: 'from-emerald-500 to-teal-500',
            bgIcon: 'bg-emerald-50 dark:bg-emerald-950/50',
            textIcon: 'text-emerald-600 dark:text-emerald-400',
            borderIcon: 'border-emerald-200/80 dark:border-emerald-800/60',
            progressGradient: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
            glowColor: 'rgba(16, 185, 129, 0.15)'
        },
        info: {
            name: 'info',
            accentGradient: 'from-blue-500 to-cyan-500',
            bgIcon: 'bg-blue-50 dark:bg-blue-950/50',
            textIcon: 'text-blue-600 dark:text-blue-400',
            borderIcon: 'border-blue-200/80 dark:border-blue-800/60',
            progressGradient: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
            glowColor: 'rgba(59, 130, 246, 0.15)'
        },
        warning: {
            name: 'warning',
            accentGradient: 'from-amber-500 to-orange-500',
            bgIcon: 'bg-amber-50 dark:bg-amber-950/50',
            textIcon: 'text-amber-600 dark:text-amber-400',
            borderIcon: 'border-amber-200/80 dark:border-amber-800/60',
            progressGradient: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
            glowColor: 'rgba(245, 158, 11, 0.15)'
        },
        error: {
            name: 'error',
            accentGradient: 'from-rose-500 to-red-500',
            bgIcon: 'bg-rose-50 dark:bg-rose-950/50',
            textIcon: 'text-rose-600 dark:text-rose-400',
            borderIcon: 'border-rose-200/80 dark:border-rose-800/60',
            progressGradient: 'linear-gradient(90deg, #f43f5e 0%, #ef4444 100%)',
            glowColor: 'rgba(244, 63, 94, 0.15)'
        }
    };

    static show({ title = '', message = '', type = 'sweet', duration = 4000, action = null } = {}) {
        const now = Date.now();
        if (this._lastToastMessage === message && now - this._lastToastTime < 800) {
            return;
        }
        this._lastToastTime = now;
        this._lastToastMessage = message;

        let $container = $('#sl-toast-container');
        if (!$container.length) {
            $container = $(`
                <div id="sl-toast-container" 
                     class="fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0"
                     aria-live="polite" 
                     aria-atomic="true">
                </div>
            `);
            $('body').append($container);
        }

        const config = this.TYPES[type] || this.TYPES.sweet;
        const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const hasAction = action && typeof action.label === 'string';

        const $toast = $(`
            <div id="${toastId}" 
                 class="pointer-events-auto relative group overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-slate-800/90 rounded-2xl shadow-xl shadow-slate-950/10 dark:shadow-black/40 transform translate-x-8 opacity-0 scale-95 transition-all duration-300 ease-out flex flex-col"
                 style="box-shadow: 0 10px 25px -5px ${config.glowColor}, 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
                
                <!-- Main Body -->
                <div class="p-4 flex items-start gap-3.5">
                    <!-- Accent Icon Avatar -->
                    <div class="w-10 h-10 rounded-xl ${config.bgIcon} ${config.textIcon} ${config.borderIcon} border flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                        <span class="material-symbols-outlined text-[20px]">${config.name}</span>
                    </div>

                    <!-- Content Details -->
                    <div class="flex-1 min-w-0 pr-1">
                        ${title ? `
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="text-xs font-bold text-gray-900 dark:text-white tracking-tight">${title}</h4>
                            </div>
                        ` : ''}
                        <div class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed break-words">${message}</div>

                        ${hasAction ? `
                            <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                                <button type="button" class="btn-toast-action px-3 py-1 bg-gradient-to-r ${config.accentGradient} text-white rounded-lg text-[11px] font-bold shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer">
                                    ${action.label}
                                </button>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Close Button -->
                    <button type="button" 
                            class="btn-toast-close w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors -mr-1 -mt-1 flex-shrink-0 cursor-pointer"
                            title="Dismiss notification">
                        <span class="material-symbols-outlined text-[17px]">close</span>
                    </button>
                </div>

                <!-- Interactive Progress Countdown Bar -->
                ${duration > 0 ? `
                    <div class="h-[3px] w-full bg-gray-100 dark:bg-slate-800/80 overflow-hidden relative flex-shrink-0">
                        <div class="toast-progress-bar h-full rounded-r-full"
                             style="width: 100%; background: ${config.progressGradient}; transform-origin: left center;"></div>
                    </div>
                ` : ''}
            </div>
        `);

        // Action CTA click handler
        if (hasAction && typeof action.onClick === 'function') {
            $toast.find('.btn-toast-action').on('click', (e) => {
                e.stopPropagation();
                action.onClick();
                this._dismissToast($toast);
            });
        }

        // Close click handler
        $toast.find('.btn-toast-close').on('click', () => {
            this._dismissToast($toast);
        });

        // Countdown Timer & Hover to Pause logic with CSS hardware-accelerated transitions
        let remainingTime = duration;
        let dismissTimer = null;
        let isPaused = false;
        const $progressBar = $toast.find('.toast-progress-bar');

        const runCountdown = (ms) => {
            if (ms <= 0) {
                this._dismissToast($toast);
                return;
            }
            if ($progressBar.length) {
                $progressBar.css({
                    transition: `width ${ms}ms linear`,
                    width: '0%'
                });
            }
            dismissTimer = setTimeout(() => {
                this._dismissToast($toast);
            }, ms);
        };

        const pauseCountdown = () => {
            if (duration <= 0 || isPaused) return;
            isPaused = true;
            if (dismissTimer) {
                clearTimeout(dismissTimer);
                dismissTimer = null;
            }
            if ($progressBar.length) {
                const currentWidthPx = $progressBar.width();
                const totalWidthPx = $progressBar.parent().width() || 1;
                const fraction = Math.max(0, Math.min(1, currentWidthPx / totalWidthPx));
                remainingTime = Math.round(duration * fraction);
                $progressBar.css({
                    transition: 'none',
                    width: `${fraction * 100}%`
                });
            }
        };

        const resumeCountdown = () => {
            if (duration <= 0 || !isPaused) return;
            isPaused = false;
            if (remainingTime > 80) {
                if ($progressBar.length && $progressBar[0]) {
                    // Force browser reflow to apply transition: none before restarting transition
                    void $progressBar[0].offsetWidth;
                }
                runCountdown(remainingTime);
            } else {
                this._dismissToast($toast);
            }
        };

        // Pause on mouse enter, resume on mouse leave
        $toast.on('mouseenter', pauseCountdown);
        $toast.on('mouseleave', resumeCountdown);

        $container.append($toast);
        this._activeToasts.add($toast);

        // Animate entrance and start progress bar
        requestAnimationFrame(() => {
            $toast.removeClass('translate-x-8 opacity-0 scale-95')
                  .addClass('translate-x-0 opacity-100 scale-100');

            if (duration > 0) {
                // Short initial delay before progress bar starts shrinking for visual clarity
                setTimeout(() => {
                    if (!isPaused && $toast.parent().length) {
                        runCountdown(duration);
                    }
                }, 50);
            }
        });
    }

    /**
     * Dismisses a toast with a smooth slide-and-fade animation.
     */
    static _dismissToast($toast) {
        if (!$toast || !$toast.length || $toast.data('dismissing')) return;
        $toast.data('dismissing', true);

        $toast.removeClass('translate-x-0 opacity-100 scale-100')
              .addClass('translate-x-10 opacity-0 scale-90');

        setTimeout(() => {
            this._activeToasts.delete($toast);
            $toast.remove();
        }, 300);
    }

    /**
     * Convenience helpers for different notification types.
     */
    static success(message, title = 'Success', options = {}) {
        this.show({ message, title, type: 'success', ...options });
    }

    static error(message, title = 'Error', options = {}) {
        this.show({ message, title, type: 'error', duration: options.duration || 5000, ...options });
    }

    static info(message, title = 'Information', options = {}) {
        this.show({ message, title, type: 'info', ...options });
    }

    static warning(message, title = 'Warning', options = {}) {
        this.show({ message, title, type: 'warning', duration: options.duration || 4500, ...options });
    }

    static sweet(message, title = 'Notice', options = {}) {
        this.show({ message, title, type: 'sweet', ...options });
    }

    /**
     * Clears all active toasts from the screen.
     */
    static clear() {
        this._activeToasts.forEach($toast => this._dismissToast($toast));
        this._activeToasts.clear();
    }
}
