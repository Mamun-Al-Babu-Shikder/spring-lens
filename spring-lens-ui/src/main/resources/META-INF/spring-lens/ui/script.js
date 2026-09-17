import { Route } from './src/core/router/route.js';
import {
    DashboardController,
    DefinitionController,
    ConditionalReportController,
    InstanceController,
    DependencyGraphController,
    WhatsNewController
} from "./src/controller/index.js";

$(document).ready(() => {

    // 1. Dashboard Overview
    Route.get('/dashboard', [DashboardController, 'index'])
        .view('dashboard/dashboard')
        .name('dashboard');

    // 2. Bean Ecosystem Routes
    Route.get('/definitions', [DefinitionController, 'index'])
        .view('bean/definitions')
        .header(null)
        .name('definitions');

    Route.get('/conditions', [ConditionalReportController, 'index'])
        .view('bean/condition-reports')
        .header(null)
        .name('conditions');

    Route.get('/instances', [InstanceController, 'index'])
        .view('bean/instances')
        .header(null)
        .name('instances');

    Route.get('/graph', [DependencyGraphController, 'index'])
        .view('bean/graph')
        .header(null)
        .name('graph');

    Route.get('/whats-new', [WhatsNewController, 'index'])
        .view('whats-new/whats-new')
        .header(null)
        .name('whats-new');

    // 3. Backward Compatibility Redirects
    Route.redirect('/instance', 'instances');
    Route.redirect('/timeline', 'instances');
    Route.redirect('/changelog', 'whats-new');
    Route.redirect('/releases', 'whats-new');

    // 4. Boot Core Container & Router Engine
    Route.boot({
        container: '#main-content',
        defaultRoute: 'dashboard'
    });
});
