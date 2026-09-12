import { TemplateEngine, PageHeader } from '../../helper/index.js';

/**
 * Widget responsible for the application hero banner, runtime metadata,
 * profile badges, and real-time live uptime tracking.
 */
export default class HeroWidget {

    /**
     * @param {Object} [options]
     * @param {Object} [options.applicationState]
     */
    constructor(options = {}) {
        this.applicationState = options.applicationState || null;
        this.uptimeInterval = null;
        this.appStartDate = null;
        this.currentUptimeState = null;
    }

    /**
     * Renders application telemetry into the hero banner.
     * @param {Object} app - Application info response payload.
     */
    render(app) {
        if (!app) {
            this.renderFallback();
            return;
        }

        const vm = this._extractAppViewModel(app);
        const $hero = $('#hero-application-banner');

        const fieldMap = {
            appName: vm.name ? vm.name.toUpperCase() : '',
            bootVersion: `v${vm.bootVersion}`,
            frameworkVersion: `v${vm.frameworkVersion}`,
            javaVersion: `Java ${vm.javaVersion}`,
            javaVendor: vm.javaVendor,
            startupDuration: vm.formattedDuration,
            startedAt: vm.formattedStartedAt
        };

        this._bindDataFields($hero, fieldMap);
        this._renderProfileBadges(vm.activeProfiles, vm.defaultProfiles);

        if (this.applicationState) {
            this.applicationState.setAppInfo(app);
        } else {
            PageHeader.setAppName(vm.name);
        }

        this.appStartDate = vm.startDate;
        if (vm.startDate && this.currentUptimeState !== false) {
            this._startUptimeTracker(vm.startDate);
        }
    }

    /**
     * Renders fallback application telemetry when service is unreachable.
     */
    renderFallback() {
        this.renderUptimeStatus(false);
        const $hero = $('#hero-application-banner');
        const fallbackMap = {
            appName: 'Spring Boot Application',
            bootVersion: 'Active',
            frameworkVersion: 'Detected',
            javaVersion: 'Runtime',
            javaVendor: 'Standard',
            startupDuration: 'Ready',
            startedAt: 'Live',
            profilesLabel: 'Active Profiles'
        };

        this._bindDataFields($hero, fallbackMap);

        const $container = $('#hero-profiles-list').empty();
        const emptyClone = TemplateEngine.clone('tpl-dashboard-profile-empty');
        if (emptyClone) {
            $container.append(emptyClone);
        }
    }

    /**
     * Toggles between the live ticking uptime card and the Service Down chip.
     * @param {boolean} isLive
     */
    renderUptimeStatus(isLive) {
        const $container = $('#hero-uptime-container');
        if (!$container.length) return;

        if (this.currentUptimeState === isLive) return;
        this.currentUptimeState = isLive;

        const templateId = isLive ? 'tpl-dashboard-uptime-active' : 'tpl-dashboard-uptime-down';
        const clone = TemplateEngine.clone(templateId);
        if (clone) {
            $container.empty().append(clone);
        }

        if (isLive) {
            if (this.appStartDate) {
                this._startUptimeTracker(this.appStartDate);
            }
        } else {
            this._stopUptimeTracker();
        }
    }

    /**
     * Cleans up running timers and resets component state.
     */
    destroy() {
        this._stopUptimeTracker();
        this.currentUptimeState = null;
        this.appStartDate = null;
    }

    /**
     * @private
     */
    _bindDataFields($container, fieldMap = {}) {
        Object.entries(fieldMap).forEach(([field, value]) => {
            const $target = $container.find(`[data-field="${field}"]`);
            if ($target.length && value != null) {
                $target.text(value);
                if (field === 'javaVendor' || field === 'startedAt') {
                    $target.attr('title', String(value));
                }
            }
        });
    }

    /**
     * @private
     */
    _renderProfileBadges(activeProfiles = [], defaultProfiles = []) {
        const $hero = $('#hero-application-banner');
        const $container = $('#hero-profiles-list').empty();
        const isActive = activeProfiles.length > 0;
        const profiles = isActive ? activeProfiles : defaultProfiles;

        $hero.find('[data-field="profilesLabel"]').text(isActive ? 'Active Profiles' : 'Default Profiles');

        if (!profiles.length || (!isActive && profiles.length === 1 && profiles[0] === 'default')) {
            const emptyClone = TemplateEngine.clone('tpl-dashboard-profile-empty');
            if (emptyClone) {
                $container.append(emptyClone);
                return;
            }
        }

        const fragment = document.createDocumentFragment();
        profiles.forEach(profileName => {
            const clone = TemplateEngine.clone(isActive ? 'tpl-dashboard-profile-badge' : 'tpl-dashboard-profile-empty');
            if (!clone) return;

            const badge = clone.firstElementChild;
            const nameEl = badge.querySelector('[data-field="name"]') || badge;
            nameEl.textContent = profileName;

            if (!isActive) {
                badge.setAttribute('title', 'Default profile');
            }

            fragment.appendChild(clone);
        });

        $container.append(fragment);
    }

    /**
     * @private
     */
    _extractAppViewModel(app = {}) {
        const {
            name = 'Spring Application',
            spring = {},
            java = {},
            startup = {},
            activeProfiles = [],
            defaultProfiles = [],
        } = app;

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

        return {
            name,
            bootVersion: spring.bootVersion ?? '3.x',
            frameworkVersion: spring.frameworkVersion ?? '6.x',
            javaVersion: java.version ?? '21',
            javaVendor: java.vendor ?? 'OpenJDK',
            rawDuration: startup.startupDuration,
            formattedDuration: this._formatStartupDuration(startup.startupDuration),
            rawStartedAt: startup.startedAt ?? '',
            formattedStartedAt,
            startDate,
            activeProfiles: Array.isArray(activeProfiles) ? activeProfiles : [],
            defaultProfiles: Array.isArray(defaultProfiles) && defaultProfiles.length > 0
                ? defaultProfiles
                : ['default'],
        };
    }

    /**
     * @private
     */
    _startUptimeTracker(startDate) {
        this._stopUptimeTracker();
        this.appStartDate = startDate;

        const update = () => {
            const $heroAppUptime = $('#hero-app-uptime');
            if (!$heroAppUptime.length) return;

            const diffMs = Date.now() - startDate.getTime();
            if (diffMs < 0) {
                $heroAppUptime.text('Just started');
                return;
            }

            const totalSec = Math.floor(diffMs / 1000);
            const hrs = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            const secs = totalSec % 60;

            let formatted = '';
            if (hrs > 0) {
                formatted = `${hrs}h ${mins}m ${secs}s`;
            } else if (mins > 0) {
                formatted = `${mins}m ${secs}s`;
            } else {
                formatted = `${secs}s`;
            }

            $heroAppUptime.text(formatted);
        };

        update();
        this.uptimeInterval = setInterval(update, 1000);
    }

    /**
     * @private
     */
    _stopUptimeTracker() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
            this.uptimeInterval = null;
        }
    }

    /**
     * @private
     */
    _formatStartupDuration(val) {
        if (!val) return '--';

        if (typeof val === 'number') {
            return `${val.toFixed(2)}s`;
        }

        if (typeof val === 'string') {
            if (val.startsWith('PT')) {
                const secondsMatch = val.match(/([\d.]+)S/);
                const minutesMatch = val.match(/(\d+)M/);

                let res = '';
                if (minutesMatch) res += `${minutesMatch[1]}m `;
                if (secondsMatch) res += `${parseFloat(secondsMatch[1]).toFixed(2)}s`;
                return res.trim() || val;
            }
            return val;
        }

        if (typeof val === 'object' && val.seconds !== undefined) {
            const sec = (val.seconds || 0) + ((val.nano || 0) / 1e9);
            return `${sec.toFixed(2)}s`;
        }

        return String(val);
    }
}
