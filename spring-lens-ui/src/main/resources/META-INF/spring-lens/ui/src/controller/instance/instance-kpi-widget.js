import { Formatter } from '../../helper/index.js';

/**
 * Widget managing the Executive Telemetry Summary Strip (#instance-kpi-strip).
 * Displays total created instances, definition ratio, and initialization duration percentiles.
 */
export class InstanceKpiWidget {

    /**
     * Renders KPI metrics into the executive strip.
     *
     * @param {Object} summaryData - Summary data payload from backend
     */
    render(summaryData) {
        if (!summaryData) return;

        const {
            totalCreatedInstances = 0,
            instancesWithDefinition = 0,
            instancesWithoutDefinition = 0,
            maxInitializationDurationNanos = 0,
            totalInitializationDurationNanos = 0,
            averageInitializationDurationNanos = 0
        } = summaryData;

        $('#time-kpi-total-instances').text(totalCreatedInstances.toLocaleString());
        $('#time-kpi-with-def').text(instancesWithDefinition.toLocaleString());
        $('#time-kpi-without-def').text(`${instancesWithoutDefinition} dynamic`);

        $('#time-kpi-total-duration').text(Formatter.formatDuration(totalInitializationDurationNanos));
        $('#time-kpi-total-duration-nanos').text(`${totalInitializationDurationNanos.toLocaleString()} ns`);

        $('#time-kpi-max-duration').text(Formatter.formatDuration(maxInitializationDurationNanos));
        $('#time-kpi-max-duration-nanos').text(`${maxInitializationDurationNanos.toLocaleString()} ns`);

        $('#time-kpi-avg-duration').text(Formatter.formatDuration(averageInitializationDurationNanos));
        $('#time-kpi-avg-duration-nanos').text(`${averageInitializationDurationNanos.toLocaleString()} ns`);
    }

    /**
     * Resets all KPI fields to placeholder dashes.
     */
    reset() {
        $('#time-kpi-total-instances').text('-');
        $('#time-kpi-with-def').text('-');
        $('#time-kpi-without-def').text('0 dynamic');
        $('#time-kpi-total-duration').text('-');
        $('#time-kpi-total-duration-nanos').text('-');
        $('#time-kpi-max-duration').text('-');
        $('#time-kpi-max-duration-nanos').text('-');
        $('#time-kpi-avg-duration').text('-');
        $('#time-kpi-avg-duration-nanos').text('-');
    }
}
