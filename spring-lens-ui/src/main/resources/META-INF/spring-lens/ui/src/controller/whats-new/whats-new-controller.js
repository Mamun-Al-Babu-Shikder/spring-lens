import BaseController from '../base-controller.js';
import { RELEASES, CATEGORIES } from './whats-new-data.js';
import container from '../../core/container.js';

export class WhatsNewController extends BaseController {

    constructor() {
        super('whatsNew');
        this.applicationState = container.make('applicationState');

        this.state = {
            appName: this.applicationState?.getAppName?.() || 'SpringLens',
            releases: RELEASES,
            categories: CATEGORIES,
            activeFilter: 'all',
            activeRelease: RELEASES[0]?.version || 'v1.0.0'
        };
    }

    async enter() {
        const appName = this.applicationState?.getAppName?.() || 'SpringLens';
        this.setState({ appName });
    }

    setFilter(category) {
        this.setState({ activeFilter: category });
    }

    goTo(route) {
        if (!route) return;
        window.location.hash = '#/' + route;
    }

    isFeatureVisible(feature) {
        if (this.state.activeFilter === 'all') return true;
        return feature.category === this.state.activeFilter;
    }
}
