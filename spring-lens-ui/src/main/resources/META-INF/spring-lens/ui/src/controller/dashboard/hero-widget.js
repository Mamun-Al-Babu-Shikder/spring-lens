class HeroWidget {

    extractViewModel(app = {}) {
        const {
            name = 'Spring Boot Application',
            spring = {},
            java = {},
            startup = {},
            activeProfiles = [],
            defaultProfiles = []
        } = (app || {});

        let startDate = null;
        let formattedStartedAt = '--';

        if (startup.startedAt) {
            const parsedDate = new Date(startup.startedAt);
            if (!Number.isNaN(parsedDate.getTime())) {
                startDate = parsedDate;
                formattedStartedAt = parsedDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
        }

        const activeList = Array.isArray(activeProfiles) ? activeProfiles : [];
        const defaultList = Array.isArray(defaultProfiles) && defaultProfiles.length > 0 ? defaultProfiles : ['default'];
        const hasActive = activeList.length > 0;

        return {
            name: name,
            rawName: name || 'Spring Boot Application',
            bootVersion: `v${spring.bootVersion ?? '3.x'}`,
            frameworkVersion: `v${spring.frameworkVersion ?? '6.x'}`,
            javaVersion: `Java ${java.version ?? '21'}`,
            javaVendor: java.vendor ?? 'OpenJDK',
            startupDuration: this.formatStartupDuration(startup.startupDuration),
            formattedStartedAt,
            startDate,
            profiles: hasActive ? activeList : defaultList,
            profilesLabel: hasActive ? 'Active Profiles' : 'Default Profiles',
            isActiveProfiles: hasActive
        };
    }

    /**
     * Returns standard fallback view model when the backend service is offline.
     * @returns {Object}
     */
    getFallbackViewModel() {
        return {
            name: 'Spring Boot Application',
            rawName: 'Spring Boot Application',
            bootVersion: 'Active',
            frameworkVersion: 'Detected',
            javaVersion: 'Runtime',
            javaVendor: 'Standard',
            startupDuration: 'Ready',
            formattedStartedAt: 'Live',
            startDate: null,
            profiles: ['default'],
            profilesLabel: 'Active Profiles',
            isActiveProfiles: false
        };
    }

    /**
     * Formats duration (number, ISO-8601 string, or Duration object) into human-readable text.
     * @param {number|string|Object} duration
     * @returns {string}
     */
    formatStartupDuration(duration) {
        if (!duration && duration !== 0) return '--';

        if (typeof duration === 'number') {
            return duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`;
        }

        if (typeof duration === 'string') {

            const ISO_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/;
            const match = ISO_DURATION_REGEX.exec(duration);

            if (match) {
                const hours = Number.parseFloat(match[1] || 0);
                const minutes = Number.parseFloat(match[2] || 0);
                const seconds = Number.parseFloat(match[3] || 0);
                const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                if (totalSeconds < 1) {
                    return `${Math.round(totalSeconds * 1000)}ms`;
                }
                return `${totalSeconds.toFixed(2)}s`;
            }
            return duration;
        }

        if (typeof duration === 'object' && duration.seconds !== undefined) {
            const totalSeconds = (Number(duration.seconds) || 0) + ((Number(duration.nano) || 0) / 1e9);
            if (totalSeconds < 1) {
                return `${Math.round(totalSeconds * 1000)}ms`;
            }
            return `${totalSeconds.toFixed(2)}s`;
        }

        return String(duration);
    }

    /**
     * Formats elapsed milliseconds into human-readable uptime text.
     * @param {number} diffMs
     * @returns {string}
     */
    formatUptime(diffMs) {
        if (!Number.isFinite(diffMs) || diffMs < 0) return 'Just started';

        const totalSec = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSec / 86400);
        const hrs = Math.floor((totalSec % 86400) / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        if (days > 0) return `${days}d ${hrs}h ${mins}m`;
        if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    }

    /**
     * Calculates and formats current uptime given the application startup date.
     * @param {Date|string|number} startDate
     * @returns {string}
     */
    calculateUptime(startDate) {
        if (!startDate) return '--';

        const time = startDate instanceof Date
            ? startDate.getTime()
            : new Date(startDate).getTime();

        if (Number.isNaN(time)) return '--';
        return this.formatUptime(Date.now() - time);
    }

    /**
     * Lifecycle destroy hook for compatibility with controller disposables.
     */
    destroy() { }
}

const heroWidget = new HeroWidget();
export default heroWidget;