import { Formatter } from '../../helper/index.js';

export class InstanceKpiWidget {
    formatSummary(summaryData) {
        if (!summaryData) {
            return {
                totalCreatedInstances: '-',
                instancesWithDefinition: '-',
                instancesWithoutDefinitionText: '0 dynamic',
                totalDuration: '-',
                totalDurationNanos: '-',
                maxDuration: '-',
                maxDurationNanos: '-',
                avgDuration: '-',
                avgDurationNanos: '-'
            };
        }

        const {
            totalCreatedInstances = 0,
            instancesWithDefinition = 0,
            instancesWithoutDefinition = 0,
            maxInitializationDurationNanos = 0,
            totalInitializationDurationNanos = 0,
            averageInitializationDurationNanos = 0
        } = summaryData;

        return {
            totalCreatedInstances: totalCreatedInstances.toLocaleString(),
            instancesWithDefinition: instancesWithDefinition.toLocaleString(),
            instancesWithoutDefinitionText: `${instancesWithoutDefinition} dynamic`,
            totalDuration: Formatter.formatDuration(totalInitializationDurationNanos),
            totalDurationNanos: `${totalInitializationDurationNanos.toLocaleString()} ns`,
            maxDuration: Formatter.formatDuration(maxInitializationDurationNanos),
            maxDurationNanos: `${maxInitializationDurationNanos.toLocaleString()} ns`,
            avgDuration: Formatter.formatDuration(averageInitializationDurationNanos),
            avgDurationNanos: `${averageInitializationDurationNanos.toLocaleString()} ns`
        };
    }
}

export const instanceKpiWidget = new InstanceKpiWidget();
export default instanceKpiWidget;
