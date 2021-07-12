/* eslint-disable no-restricted-imports */
import * as _Highcharts from 'highcharts';
import stock from 'highcharts/modules/stock';
import more from 'highcharts/highcharts-more';
import nodata from 'highcharts/modules/no-data-to-display';
/* eslint-enable no-restricted-imports */

import tooltipdelay from './tooltip-delay';

stock(_Highcharts);
more(_Highcharts);
nodata(_Highcharts);
tooltipdelay();


declare module 'highcharts' {
    interface Chart {
        isInPointSelectionMode?: boolean;
    }
}

// eslint-disable-next-line no-restricted-imports
export * from 'highcharts';
