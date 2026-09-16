import { Route } from './src/core/router/route.js';
import {
    DashboardController,
    DefinitionController,
    ConditionalReportController,
    InstanceController,
    DependencyGraphController
} from './src/controller/index.js';

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

    // 3. Backward Compatibility Redirects
    Route.redirect('/instance', 'instances');
    Route.redirect('/timeline', 'instances');

    // 4. Boot Core Container & Router Engine
    Route.boot({
        container: '#main-content',
        defaultRoute: 'dashboard'
    });
});
