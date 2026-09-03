import httpClient from '../../client/http-client.js';
import TemplateEngine from '../../utils/template-engine.js';

export class ApplicationState {
    constructor(healthApi, container = '#sidebar-status-container', intervalMs = 10000) {
        this.healthApi = healthApi;
        this.container = container;
        this.intervalMs = intervalMs;
        this.isLive = null;
        this.timer = null;
        this.listeners = [];
    }

    onStateChange(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    start(intervalMs) {
        if (intervalMs) this.intervalMs = intervalMs;
        this.checkHealth();
        this._startPolling();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._stopPolling();
            } else {
                this.checkHealth();
                this._startPolling();
            }
        });
    }

    _startPolling() {
        this._stopPolling();
        this.timer = setInterval(() => this.checkHealth(), this.intervalMs);
    }

    _stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async checkHealth() {
        try {
            const data = await httpClient.get(this.healthApi);
            const status = (data?.status || '').toLowerCase();
            const isLive = status === 'up';
            this.render(isLive);
            return isLive;
        } catch (error) {
            this.render(false);
            return false;
        }
    }

    render(isLive) {
        if (this.isLive === isLive) return;
        this.isLive = isLive;

        const templateId = isLive ? 'tpl-status-connected' : 'tpl-status-disconnected';
        const clone = TemplateEngine.clone(templateId);
        if (clone) {
            $(this.container).empty().append(clone);
        }

        this.listeners.forEach(fn => {
            try { fn(isLive); } catch (e) { console.error(e); }
        });
    }
}

export default ApplicationState;