import { Injectable } from '@angular/core';
import { Cursor, ICursor } from '../utilities/cursor';
import { Chart } from '../utilities/highcharts-globals';
import { CursorCrosshairStyle } from '../models/scatter-cursor-options';

/**
 * This class is responsible for the creation of a 'Cursor' view.
 */
@Injectable()
export class CursorFactoryService {
    public createCursor(chart: Chart, x: number, y: number, seriesIndex: number, crosshairStyle: CursorCrosshairStyle): ICursor {
        return new Cursor(chart, x, y, seriesIndex, true, crosshairStyle);
    }
}
