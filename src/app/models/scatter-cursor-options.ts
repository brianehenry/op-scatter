import { CursorModel } from './cursor-model';

export enum CursorCrosshairStyle {
    Both = 'both',
    Vertical = 'vertical',
    Horizontal = 'horizontal'
}

/** This class holds on to both the widget-wide cursor settings and the settings for the individual cursors */
export class ScatterCursorOptions {
    crosshairStyle: CursorCrosshairStyle = CursorCrosshairStyle.Both;
    showValue = true;
    showLabel = false;

    cursors: CursorModel[] = [];

    constructor(widgetCursorSettings: ScatterCursorOptions = undefined) {
        if (widgetCursorSettings !== undefined) {
            this.crosshairStyle = widgetCursorSettings.crosshairStyle;
            this.showValue = widgetCursorSettings.showValue;
            this.showLabel = widgetCursorSettings.showLabel;
            this.cursors = widgetCursorSettings.cursors.map((cursor: CursorModel) => new CursorModel(cursor));
        }
    }
}
