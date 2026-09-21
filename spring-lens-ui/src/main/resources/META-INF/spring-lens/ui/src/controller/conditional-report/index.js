import ConditionKpiWidget from './condition-kpi-widget.js';
import ConditionTabsWidget from './condition-tabs-widget.js';
import ConditionTableWidget from './condition-table-widget.js';
import ConditionDetailWidget from './condition-detail-widget.js';

export { default as BaseController } from '../base-controller.js';
export { ConditionalReportController, ConditionalReportController as ConditionalReport, ConditionalReportController as default } from './conditional-report-controller.js';
export { default as ConditionReportService } from './condition-report-service.js';

export { ConditionKpiWidget, ConditionTabsWidget, ConditionTableWidget, ConditionDetailWidget };

export const conditionKpiWidget = new ConditionKpiWidget();
export const conditionTabsWidget = new ConditionTabsWidget();
export const conditionTableWidget = new ConditionTableWidget();
export const conditionDetailWidget = new ConditionDetailWidget();

export * from './condition-utils.js';
export {
    Pagination,
    QueryParam,
    AsyncUtils,
    container
} from '../../helper/index.js';
