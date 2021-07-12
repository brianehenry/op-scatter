import { Directive, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { ICursor } from '../utilities/cursor';
import { Chart } from '../utilities/highcharts-globals';
import { ScatterCursorOptions } from '../models/scatter-cursor-options';
import { CursorFactoryService } from '../services/cursor-factory.service';
import * as _ from 'lodash';

@Directive({
    selector: '[cursors]'
})

/** This class is responsible for the creation and removal of the cursor views for the Highcharts
 *  chart, based on the current WidgetCursorSettings state. Additionally, this class will update
 *  the state of the WidgetCursorSettings if any state of interest on the cursor view changes
 *  (such as its position via a drag for instance).
 */
export class ScatterCursorsDirective implements OnDestroy, OnChanges {
    @Input() set chart(chart: Chart) {
        this._chart = chart;
        this.updateCursors(this._cursorOptions);
    }
    get chart(): Chart {
        return this._chart;
    }
    @Input() set cursorOptions(cursorOptions: ScatterCursorOptions) {
        this._cursorOptions = _.cloneDeep(cursorOptions);
        this.updateCursors(cursorOptions);
    }
    get cursorOptions(): ScatterCursorOptions {
        return this._cursorOptions;
    }
    @Output() cursorOptionsChange = new EventEmitter<ScatterCursorOptions>();
    cursorsSubscription: Subscription = new Subscription();
    cursorPositionSubscription = new Subscription();
    cursors: ICursor[] = [];
    private _cursorOptions: ScatterCursorOptions;
    private _chart: Chart;
    constructor(
        private cursorFactoryService: CursorFactoryService
    ) {}

    ngOnChanges(): void {
        if (this.chart !== undefined) {
            // this.cursorsSubscription.add(this.scatterState.cursorSettings$
            //     .pipe(
            //         withLatestFrom(this.scatterState.scatterData$)
            //     )
            //     .subscribe(([cursorSettings, scatterData]) => {
            //         this.cursorSettingsToUpdate = _.cloneDeep(cursorSettings);
            //         this.destroyStaleCursors(cursorSettings);
            //         this.updateAllValidCursors(cursorSettings, scatterData);
            //         this.createNewCursors(cursorSettings, scatterData);
            //     }));

            // this.cursorsSubscription.add(this.scatterState.scatterData$
            //     .pipe(
            //         withLatestFrom(this.scatterState.cursorSettings$)
            //     )
            //     .subscribe(([scatterData, cursorSettings]) => {
            //         const newCursorSettings = _.cloneDeep(cursorSettings);
            //         let updateCursorSettings = this.removeInvalidCursors(newCursorSettings, scatterData);
            //         updateCursorSettings = updateCursorSettings || newCursorSettings.cursors.length !== this.cursors.length;
            //         if (updateCursorSettings) {
            //             this.scatterState.setScatterCursorSettings(newCursorSettings);
            //         }
            //     }));
        }
    }

    updateCursors(cursorOptions: ScatterCursorOptions) {
        if (this.chart !== undefined) {
            this.destroyStaleCursors(cursorOptions);
            this.updateAllValidCursors(cursorOptions);
            this.createNewCursors(cursorOptions);
        }
    }

    removeInvalidCursors(cursorSettings: ScatterCursorOptions): boolean {
        let currentIndex = 0;
        let updateCursorSettings = false;
        const count = cursorSettings.cursors.length;
        for (let i = 0; i < count; i++) {
            const cursorModel = cursorSettings.cursors[currentIndex];
            const seriesIndex = this.getSeriesIndex(cursorModel.seriesName);
            if (seriesIndex < 0) {
                cursorSettings.cursors.splice(currentIndex, 1);
                updateCursorSettings = true;
            } else {
                currentIndex += 1;
            }
        }

        return updateCursorSettings;
    }

    updateAllValidCursors(newCursorSettings: ScatterCursorOptions) {
        const updateCount = Math.min(this.cursors.length, newCursorSettings.cursors.length);
        for (let i = 0; i < updateCount; i++) {
            this.updateCursor(this.cursors[i], i, newCursorSettings);
        }
    }

    updateCursor(cursor: ICursor, index: number, cursorSettings: ScatterCursorOptions): boolean {
        const cursorModel = cursorSettings.cursors[index];
        const cursorPixelPosition = cursor.getPixelPosition();
        cursor.seriesIndex = this.getSeriesIndex(cursorModel.seriesName);
        cursor.crosshairStyle = cursorSettings.crosshairStyle;
        cursor.visible = cursorModel.visible;
        cursor.snapToNearestPointOnSeries(cursorPixelPosition.chartXPixel, cursorPixelPosition.chartYPixel, false);
        return true;
    }

    createNewCursors(newCursorSettings: ScatterCursorOptions) {
        for (let i = this.cursors.length; i < newCursorSettings.cursors.length && this.cursors.length < newCursorSettings.cursors.length; i++) {
            const cursor = newCursorSettings.cursors[i];
            const seriesIndex = this.getSeriesIndex(cursor.seriesName);
            if (seriesIndex >= 0) {
                const cursorView = this.cursorFactoryService.createCursor(this.chart,
                    cursor.x,
                    cursor.y,
                    seriesIndex,
                    newCursorSettings.crosshairStyle);

                cursorView.visible = cursor.visible;
                this.cursors.push(cursorView);
                this.subscribeToCursorPositionChanges(cursorView);
                const cursorPixelPosition = cursorView.getPixelPosition(cursor.x, cursor.y);
                cursorView.snapToNearestPointOnSeries(cursorPixelPosition.chartXPixel, cursorPixelPosition.chartYPixel, true);
            }
        }
    }

    subscribeToCursorPositionChanges(cursor: ICursor) {
        this.cursorPositionSubscription.add(cursor.position$
            .subscribe((cursorPosition) => {
                const cursorIndex = this.cursors.indexOf(cursorPosition.cursor);
                const cursorView = this.cursors[cursorIndex];
                const cursorModel = this._cursorOptions.cursors[cursorIndex];
                if (cursorView.xPosition === cursorModel.x && cursorView.yPosition === cursorModel.y) {
                    return;
                }

                this.copyCursorPositionsToCursorSettings(this._cursorOptions);
                this._cursorOptions.cursors[cursorIndex].x = cursorPosition.x;
                this._cursorOptions.cursors[cursorIndex].y = cursorPosition.y;
                const seriesName = this.getSeriesName(cursorPosition.seriesIndex);
                this._cursorOptions.cursors[cursorIndex].seriesName = seriesName;
                this.cursorOptionsChange.emit(this._cursorOptions);
            }));
    }

    copyCursorPositionsToCursorSettings(cursorSettings: ScatterCursorOptions) {
        this.cursors.forEach((cursor, i) => {
            if (i < cursorSettings.cursors.length) {
                cursorSettings.cursors[i].x = cursor.xPosition;
                cursorSettings.cursors[i].y = cursor.yPosition;
            }
        });
    }

    destroyStaleCursors(newCursorSettings: ScatterCursorOptions) {
        const startIndex = newCursorSettings.cursors.length;
        const endIndex = this.cursors.length;
        for (let i = startIndex; i < endIndex; i++) {
            this.cursors[i].destroy();
        }

        if (startIndex < endIndex) {
            this.cursors.splice(startIndex, endIndex - startIndex);
        }
    }

    getSeriesIndex(seriesName: string) {
        return this.chart.series.findIndex(series => series.getName() === seriesName);
    }

    getSeriesName(seriesIndex: number) {
        return this.chart.series[seriesIndex].getName();
    }

    ngOnDestroy(): void {
        this.cursorsSubscription.unsubscribe();
        this.cursorPositionSubscription.unsubscribe();
        this.cursors.forEach(cursor => cursor.destroy());
    }
}