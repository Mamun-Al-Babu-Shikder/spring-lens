import BaseController from '../base-controller.js';
import { RELEASES, CATEGORIES, UPCOMING } from './whats-new-data.js';
import container from '../../core/container.js';

export class WhatsNewController extends BaseController {

    constructor(endpoints, applicationState, containerInstance) {
        super('whatsNew');
        this.applicationState = applicationState || container.make('applicationState');

        this.state = {
            appName: this.applicationState?.getAppName?.() || 'SpringLens',
            releases: RELEASES,
            categories: CATEGORIES,
            upcoming: UPCOMING,
            activeFilter: 'all',
            searchQuery: '',
            activeRelease: RELEASES[0]?.version || 'v1.0.0',
            activeModalImage: null,
            activeModalTitle: ''
        };

        for (const key of Object.keys(this.state)) {
            Object.defineProperty(this, key, {
                get: () => (this.alpine ? this.alpine[key] : this.state[key]),
                set: (value) => this.setState({ [key]: value }),
                configurable: true,
                enumerable: true,
            });
        }

        if (typeof window !== 'undefined' && window.Alpine?.data) {
            window.Alpine.data('whatsNew', () => this.createAlpineState());
        }
    }

    setState(patch) {
        if (!patch) return;
        Object.assign(this.state, patch);
        if (this.alpine) {
            Object.assign(this.alpine, patch);
        }
    }

    createAlpineState() {
        const self = this;
        return {
            ...this.state,
            setFilter(category) {
                this.activeFilter = category;
                self.setFilter(category);
            },
            setSearchQuery(query) {
                this.searchQuery = query || '';
                self.setSearchQuery(query);
            },
            resetSearch() {
                this.searchQuery = '';
                this.activeFilter = 'all';
                self.resetSearch();
            },
            goTo(route) {
                self.goTo(route);
            },
            openImageModal(src, title) {
                this.activeModalImage = src;
                this.activeModalTitle = title || '';
                self.openImageModal(src, title);
            },
            closeImageModal() {
                this.activeModalImage = null;
                this.activeModalTitle = '';
                self.closeImageModal();
            },
            isFeatureVisible(feature) {
                const active = this.activeFilter || 'all';
                const matchesCategory = active === 'all' || feature.category === active;
                if (!matchesCategory) return false;

                const query = (this.searchQuery || '').trim().toLowerCase();
                if (!query) return true;

                const inTitle = feature.title?.toLowerCase().includes(query);
                const inDescription = feature.description?.toLowerCase().includes(query);
                const inCategory = feature.category?.toLowerCase().includes(query);
                const inTags = feature.tags?.some(tag => tag.toLowerCase().includes(query));
                const inPoints = feature.points?.some(point => point.toLowerCase().includes(query));

                return Boolean(inTitle || inDescription || inCategory || inTags || inPoints);
            },
            isHeroVisible(hero) {
                if (this.activeFilter !== 'all') return false;

                const query = (this.searchQuery || '').trim().toLowerCase();
                if (!query) return true;

                const inTitle = hero.title?.toLowerCase().includes(query);
                const inDescription = hero.description?.toLowerCase().includes(query);
                const inTags = hero.tags?.some(tag => tag.toLowerCase().includes(query));
                const inHighlights = hero.highlights?.some(hl => hl.toLowerCase().includes(query));

                return Boolean(inTitle || inDescription || inTags || inHighlights);
            },
            hasVisibleContent(release) {
                const hasVisibleHero = this.isHeroVisible(release.hero);
                const hasVisibleFeatures = release.features.some(feature => this.isFeatureVisible(feature));
                return hasVisibleHero || hasVisibleFeatures;
            }
        };
    }

    async enter() {
        const appName = this.applicationState?.getAppName?.() || 'SpringLens';
        this.setState({ appName });
    }

    setFilter(category) {
        this.setState({ activeFilter: category });
    }

    setSearchQuery(query) {
        this.setState({ searchQuery: query || '' });
    }

    resetSearch() {
        this.setState({ searchQuery: '', activeFilter: 'all' });
    }

    goTo(route) {
        if (!route) return;
        window.location.hash = '#/' + route;
    }

    openImageModal(src, title) {
        this.setState({ activeModalImage: src, activeModalTitle: title || '' });
    }

    closeImageModal() {
        this.setState({ activeModalImage: null, activeModalTitle: '' });
    }

    isFeatureVisible(feature) {
        const active = this.alpine?.activeFilter ?? this.state.activeFilter;
        const query = (this.alpine?.searchQuery ?? this.state.searchQuery ?? '').trim().toLowerCase();

        const matchesCategory = active === 'all' || feature.category === active;
        if (!matchesCategory) return false;

        if (!query) return true;

        const inTitle = feature.title?.toLowerCase().includes(query);
        const inDescription = feature.description?.toLowerCase().includes(query);
        const inCategory = feature.category?.toLowerCase().includes(query);
        const inTags = feature.tags?.some(tag => tag.toLowerCase().includes(query));
        const inPoints = feature.points?.some(point => point.toLowerCase().includes(query));

        return Boolean(inTitle || inDescription || inCategory || inTags || inPoints);
    }

    isHeroVisible(hero) {
        const active = this.alpine?.activeFilter ?? this.state.activeFilter;
        if (active !== 'all') return false;

        const query = (this.alpine?.searchQuery ?? this.state.searchQuery ?? '').trim().toLowerCase();
        if (!query) return true;

        const inTitle = hero.title?.toLowerCase().includes(query);
        const inDescription = hero.description?.toLowerCase().includes(query);
        const inTags = hero.tags?.some(tag => tag.toLowerCase().includes(query));
        const inHighlights = hero.highlights?.some(hl => hl.toLowerCase().includes(query));

        return Boolean(inTitle || inDescription || inTags || inHighlights);
    }

    hasVisibleContent(release) {
        const hasVisibleHero = this.isHeroVisible(release.hero);
        const hasVisibleFeatures = release.features.some(feature => this.isFeatureVisible(feature));
        return hasVisibleHero || hasVisibleFeatures;
    }
}
