/**
 * Originally sourced from https://github.com/rudovjan/highcharts-tooltip-delay (MIT License)
 */

// eslint-disable-next-line no-restricted-imports
import { Point, Tooltip, wrap } from 'highcharts';

declare module 'highcharts' {
    interface TooltipOptions {
        /**
         * Delay time in milliseconds before displaying a tooltip.
         */
        delayForDisplay?: number;
    }
}

const timerIdMap = new Map<string, number>();

const generatePointsUniqueKey = function (points: Point[]) {
    const generatePointKey = function (point: Point): string {
        return `${point.category} ${point.series.name}: ${point.x} ${point.y}`;
    };

    const result = points.map(generatePointKey).join(', ');

    return result;
};

const refreshWrapper = function (
    proceed: (pointOrPoints: Point|Point[], ...args: any[]) => void,
    pointOrPoints: Point|Point[],
    ...args: any[]
) {
    const tooltip = this as Tooltip;

    let seriesName: string;
    if (Array.isArray(pointOrPoints)) {
        // Can be array in case that, it's shared tooltip
        seriesName = generatePointsUniqueKey(pointOrPoints);
    } else {
        seriesName = pointOrPoints.series.name;
    }

    const chart = tooltip.chart;

    const delayForDisplay: number = typeof chart.options.tooltip.delayForDisplay === 'number'
        ? chart.options.tooltip.delayForDisplay : 1000;

    if (timerIdMap.has(seriesName)) {
        clearTimeout(timerIdMap.get(seriesName));
        timerIdMap.delete(seriesName);
    }

    const timerId = window.setTimeout(() => {
        if (pointOrPoints === chart.hoverPoint || (Array.isArray(pointOrPoints) && pointOrPoints.includes(chart.hoverPoint))) {
            proceed.apply(tooltip, [pointOrPoints, ...args]);
        }
    }, delayForDisplay);

    timerIdMap.set(seriesName, timerId);
};

export default function tooltipdelay() {
    wrap(Tooltip.prototype, 'refresh', refreshWrapper);
}