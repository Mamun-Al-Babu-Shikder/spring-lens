/**
 * Theme Manager.
 * Manages light / dark mode toggling and dispatches `theme changed` events.
 */
export class ThemeManager {
    /**
     * Initializes theme toggle event binding.
     * @param {string} [toggleSelector='#theme-toggle']
     */
    static init(toggleSelector = '#theme-toggle') {
        $(toggleSelector).off('click.themeToggle').on('click.themeToggle', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            document.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: isDark ? 'dark' : 'light' } }));
        });
    }

    /**
     * Returns true if dark mode is currently active.
     * @returns {boolean}
     */
    static isDark() {
        return document.documentElement.classList.contains('dark');
    }

    /**
     * Programmatically sets the theme.
     * @param {boolean} enableDark
     */
    static setDark(enableDark) {
        document.documentElement.classList.toggle('dark', enableDark);
        localStorage.setItem('theme', enableDark ? 'dark' : 'light');
        document.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: enableDark ? 'dark' : 'light' } }));
    }
}

export default ThemeManager;
