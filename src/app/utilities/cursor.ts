import { Observable, Subscriber } from 'rxjs';
import * as _ from 'lodash';
import { Axis,
    Chart,
    GradientColorObject,
    Options,
    PatternObject,
    Point,
    PointerEventObject,
    Series,
    SeriesScatterOptions,
    SVGPathArray,
    SVGAttributes,
    addEvent,
    removeEvent } from './highcharts-globals';

export enum CursorCrosshairStyle {
    Horizontal = 'horizontal',
    Vertical = 'vertical',
    Both = 'both'
}

export enum FindNearestPointMode {
    X = 'x',
    Y = 'y',
    XY = 'xy'
}

export interface CursorPosition {
    x: number;
    y: number;
    seriesIndex: number;
    cursor: ICursor;
}

export interface CursorPixelPosition {
    chartXPixel: number;
    chartYPixel: number;
}

export interface ICursor {
    xPosition: number;
    yPosition: number;
    visible: boolean;
    seriesIndex: number;
    crosshairStyle: CursorCrosshairStyle;
    position$: Observable<CursorPosition>;
    destroy(): void;
    snapToNearestPointOnSeries(
        xPixelPosition?: number,
        yPixelPosition?: number,
        snapToVisiblePoint?: boolean
    ): void;
    getPixelPosition(xPosition?: number, yPosition?: number): CursorPixelPosition;
}

/**
 * View for a Highcharts cursor.
 */
export class Cursor implements ICursor {
    private static readonly visualStrokeWidth = 2;
    private static readonly interactionStrokeWidth = 4;
    // Draw above data and grid lines, and below tooltips
    private static readonly visualZIndex = 5;
    private static readonly interactionZIndex = 6;
    private static readonly targetSize = { width: 10, height: 10 };
    private static readonly defaultTargetSymbol = 'circle';
    private static readonly clickEventSearchRadius = 5;
    private static currentId = 0;

    public get id(): string {
        return this._id;
    }

    public get xPosition(): number {
        return this._xPosition;
    }

    public set xPosition(value) {
        this._xPosition = value;
        this.updatePointState();
        this.requestRedraw();
    }

    public get yPosition(): number {
        return this._yPosition;
    }

    public set yPosition(value) {
        this._yPosition = value;
        this.updatePointState();
        this.requestRedraw();
    }

    public get seriesIndex(): number {
        return this._seriesIndex;
    }

    public set seriesIndex(value) {
        this._seriesIndex = value;
        this.updateSeriesState();
        this.updatePointState();
        this.requestRedraw();
    }

    public get crosshairStyle(): CursorCrosshairStyle {
        return this._crosshairStyle;
    }

    public set crosshairStyle(value) {
        this._crosshairStyle = value;
        this.requestRedraw();
    }

    public get showTarget(): boolean {
        return this._showTarget;
    }

    public set showTarget(value) {
        this._showTarget = value;
        this.requestRedraw();
    }

    public get visible(): boolean {
        return this._visible;
    }

    public set visible(value) {
        this._visible = value;
        this.requestRedraw();
    }

    public get redrawFinished(): Promise<void> {
        return this._redrawFinished;
    }

    public position$: Observable<CursorPosition>;

    private _chart: Chart;
    private _xPosition: number;
    private _yPosition: number;
    private _seriesIndex: number;
    private _crosshairStyle: CursorCrosshairStyle;
    private _showTarget: boolean;
    private _id: string;
    private _visuals: Highcharts.SVGElement[] = [];
    private _visualCleanupCallbacks: (() => void)[] = [];
    private _color: string | GradientColorObject | PatternObject;
    private _opacity: number;
    private _targetSymbol: string;
    private _series: Series;
    private _xAxis: Axis;
    private _yAxis: Axis;
    private _xPixelPosition: number;
    private _yPixelPosition: number;
    private _inXRange: boolean;
    private _inYRange: boolean;
    private _redrawRequested = false;
    private _redrawFinished: Promise<void>;
    private _positionSubscriber: Subscriber<CursorPosition>;
    private _visible = true;
    private _destroyed = false;

    constructor(
        chart: Chart,
        xPosition: number,
        yPosition: number,
        seriesIndex: number,
        showTarget = true,
        crosshairStyle = CursorCrosshairStyle.Both
    ) {
        this._id = Cursor.currentId.toString();
        this._chart = chart;
        this._xPosition = xPosition;
        this._yPosition = yPosition;
        this._seriesIndex = seriesIndex;
        this._crosshairStyle = crosshairStyle;
        this._showTarget = showTarget;
        Cursor.currentId += 1;

        this.position$ = new Observable<CursorPosition>(subscriber => {
            this._positionSubscriber = subscriber;
        });

        addEvent(chart, 'redraw', this.onChartRedraw);

        this.updateSeriesState();
        this.updatePointState();
        this.draw();
    }

    destroy(): void {
        this._destroyed = true;
        this.destroyVisuals();
        if (this._positionSubscriber !== undefined) {
            this._positionSubscriber.complete();
        }
        removeEvent(this._chart, 'redraw', this.onChartRedraw);
    }

    snapToNearestPointOnSeries(
        chartXPixel?: number,
        chartYPixel?: number,
        snapToVisiblePoint = false
    ) {
        const xPixel = chartXPixel !== undefined ? chartXPixel : this._xPixelPosition;
        const yPixel = chartYPixel !== undefined ? chartYPixel : this._yPixelPosition;
        this.snapToNearestPoint(xPixel, yPixel, false, FindNearestPointMode.XY, snapToVisiblePoint);
    }

    snapToNearestPoint(
        chartXPixel?: number,
        chartYPixel?: number,
        searchAllSeries = false,
        findNearestPointMode = FindNearestPointMode.XY,
        snapToVisiblePoint = false
    ): void {
        const xPixel = chartXPixel !== undefined ? chartXPixel : this._xPixelPosition;
        const yPixel = chartYPixel !== undefined ? chartYPixel : this._yPixelPosition;
        const currentXPosition = this._xPosition;
        const currentYPosition = this._yPosition;

        const series = searchAllSeries ? this._chart.series : [this._chart.series[this.seriesIndex]];
        const nearestPoint = this.findNearestPoint(series, xPixel, yPixel, findNearestPointMode, snapToVisiblePoint).point;

        this._xPosition = nearestPoint.x;
        this._yPosition = nearestPoint.y;
        if (searchAllSeries) {
            this._seriesIndex = nearestPoint.series.index;
            this.updateSeriesState();
        }

        this.updatePointState();
        if (currentXPosition !== this._xPosition || currentYPosition !== this._yPosition) {
            this.updateCursorPosition();
        }
        this.requestRedraw();
    }

    getPixelPosition(xPosition?: number, yPosition?: number): CursorPixelPosition {
        const xPixel = xPosition !== undefined ? this._xAxis.toPixels(xPosition, false) : this._xPixelPosition;
        const yPixel = yPosition !== undefined ? this._yAxis.toPixels(yPosition, false) : this._yPixelPosition;
        return { chartXPixel: xPixel, chartYPixel: yPixel };
    }

    private onChartRedraw = () => {
        this.updateSeriesState();
        this.updatePointState();
        this.draw();
    };

    private draw() {
        if (this._destroyed) {
            return;
        }
        this.destroyVisuals();

        if (this.visible) {
            this.drawVerticalCrosshair();
            this.drawHorizontalCrosshair();
            this.drawTarget();
        }
    }

    private updateSeriesState() {
        this._series = this._chart.series[this.seriesIndex];
        if (this._series === undefined) {
            this._series = this._chart.series[this._chart.series.length - 1];
            if (this._series === undefined) {
                return;
            }
        }
        this._xAxis = this._series.xAxis;
        this._yAxis = this._series.yAxis;

        // This property will only be set if the series color is set explicitly
        this._color = this._series.userOptions.color;
        if (this._color === undefined) {
            // series.color is not a documented Highcharts API property, and could break in the future
            this._color = (this._series as any).color;
        }

        const markerUserOptions = (this._series.userOptions as SeriesScatterOptions).marker;
        // series.symbol is not a documented Highcharts API property, and could break in the future
        this._targetSymbol = markerUserOptions !== undefined ? markerUserOptions.symbol : (this._series as any).symbol;
        if (this._targetSymbol === undefined) {
            this._targetSymbol = Cursor.defaultTargetSymbol;
        }
    }

    private updatePointState() {
        if (this._series === undefined) {
            return;
        }

        const point = this._series.data.find(p => p.x === this.xPosition && p.y === this.yPosition);
        if (point === undefined) {
            this._opacity = 0.5;
        } else {
            this._opacity = 1.0;
        }

        this._xPixelPosition = this._xAxis.toPixels(this._xPosition, false);
        this._yPixelPosition = this._yAxis.toPixels(this._yPosition, false);

        const xAxisExtremes = this._xAxis.getExtremes();
        this._inXRange = this.xPosition >= xAxisExtremes.min && this.xPosition <= xAxisExtremes.max;
        const yAxisExtremes = this._yAxis.getExtremes();
        this._inYRange = this.yPosition >= yAxisExtremes.min && this.yPosition <= yAxisExtremes.max;
    }

    private updateCursorPosition() {
        if (this._positionSubscriber !== undefined) {
            this._positionSubscriber.next({
                x: this._xPosition,
                y: this._yPosition,
                seriesIndex: this._seriesIndex,
                cursor: this
            });
        }
    }

    private destroyVisuals() {
        for (const visualCleanupCallback of this._visualCleanupCallbacks) {
            visualCleanupCallback();
        }
        this._visualCleanupCallbacks = [];
        for (const visual of this._visuals) {
            visual.destroy();
        }
        this._visuals = [];
    }

    private drawVerticalCrosshair() {
        if (this.crosshairStyle !== CursorCrosshairStyle.Vertical && this.crosshairStyle !== CursorCrosshairStyle.Both) {
            return;
        }
        if (!this._inXRange) {
            return;
        }

        const yAxisExtremes = this._yAxis.getExtremes();
        const yPixelStartPosition = this._yAxis.toPixels(yAxisExtremes.min, false);
        const yPixelEndPosition = this._yAxis.toPixels(yAxisExtremes.max, false);

        const path: SVGPathArray = [
            ['M', this._xPixelPosition, yPixelStartPosition],
            ['V', yPixelEndPosition]
        ];

        this.drawVerticalCrosshairVisual(path);
        this.drawVerticalCrosshairInteractor(path);
    }

    private drawVerticalCrosshairVisual(path: SVGPathArray) {
        const verticalCrosshairElement = this.drawPath(path, this.getCommonVisualSVGConfig('verticalCrosshair'));
        this._visuals.push(verticalCrosshairElement);
    }

    private drawVerticalCrosshairInteractor(path: SVGPathArray) {
        const verticalCrosshairInteractorElement = this.drawPath(path, {
            cursor: 'col-resize',
            ...this.getCommonInteractorSVGConfig('verticalCrosshairInteractor')
        });

        const removeMouseDownEventCallback = addEvent(verticalCrosshairInteractorElement.element, 'mousedown', (event: MouseEvent) => {
            this.beginDrag(FindNearestPointMode.X, 'col-resize', false, event);
        }) as () => void;

        const removeClickEventCallback = addEvent(verticalCrosshairInteractorElement.element, 'click', (e: MouseEvent) => {
            this.clickEventHandler(e);
        }) as () => void;

        this._visuals.push(verticalCrosshairInteractorElement);
        this._visualCleanupCallbacks.push(removeMouseDownEventCallback);
        this._visualCleanupCallbacks.push(removeClickEventCallback);
    }

    private drawHorizontalCrosshair() {
        if (this.crosshairStyle !== CursorCrosshairStyle.Horizontal && this.crosshairStyle !== CursorCrosshairStyle.Both) {
            return;
        }
        if (!this._inYRange) {
            return;
        }

        const xAxisExtremes = this._xAxis.getExtremes();
        const xPixelStartPosition = this._xAxis.toPixels(xAxisExtremes.min, false);
        const xPixelEndPosition = this._xAxis.toPixels(xAxisExtremes.max, false);

        const path: SVGPathArray = [
            ['M', xPixelStartPosition, this._yPixelPosition],
            ['H', xPixelEndPosition]
        ];

        this.drawHorizontalCrosshairVisual(path);
        this.drawHorizontalCrosshairInteractor(path);
    }

    private drawHorizontalCrosshairVisual(path: SVGPathArray) {
        const horizontalCrosshairElement = this.drawPath(path, this.getCommonVisualSVGConfig('horizontalCrosshair'));
        this._visuals.push(horizontalCrosshairElement);
    }

    private drawHorizontalCrosshairInteractor(path: SVGPathArray) {
        const horizontalCrosshairInteractorElement = this.drawPath(path, {
            cursor: 'row-resize',
            ...this.getCommonInteractorSVGConfig('horizontalCrosshairInteractor')
        });

        const removeMouseDownEventCallback = addEvent(horizontalCrosshairInteractorElement.element, 'mousedown', (event: MouseEvent) => {
            this.beginDrag(FindNearestPointMode.Y, 'row-resize', false, event);
        }) as () => void;

        const removeClickEventCallback = addEvent(horizontalCrosshairInteractorElement.element, 'click', (e: MouseEvent) => {
            this.clickEventHandler(e);
        }) as () => void;

        this._visuals.push(horizontalCrosshairInteractorElement);
        this._visualCleanupCallbacks.push(removeMouseDownEventCallback);
        this._visualCleanupCallbacks.push(removeClickEventCallback);
    }

    private drawTarget() {
        if (!this._inXRange || !this._inYRange) {
            return;
        }

        if (this._showTarget) {
            this.drawTargetVisual();
        }

        this.drawTargetInteractor();
    }

    private drawTargetVisual() {
        const targetElement = this.drawSymbol(this._targetSymbol,
            this._xPixelPosition,
            this._yPixelPosition,
            Cursor.targetSize.width,
            Cursor.targetSize.height,
            this.getCommonVisualSVGConfig('target'));
        this._visuals.push(targetElement);
    }

    private drawTargetInteractor() {
        const targetInteractorElement = this.drawSymbol('circle',
            this._xPixelPosition,
            this._yPixelPosition,
            Cursor.targetSize.width,
            Cursor.targetSize.height,
            {
                cursor: 'move',
                ...this.getCommonInteractorSVGConfig('targetInteractor')
            });

        const removeMouseDownEventCallback = addEvent(targetInteractorElement.element, 'mousedown', (event: MouseEvent) => {
            this.beginDrag(FindNearestPointMode.XY, 'move', true, event);
        }) as () => void;
        const removeClickEventCallback = addEvent(targetInteractorElement.element, 'click', (e: MouseEvent) => {
            this.clickEventHandler(e);
        }) as () => void;

        this._visuals.push(targetInteractorElement);
        this._visualCleanupCallbacks.push(removeMouseDownEventCallback);
        this._visualCleanupCallbacks.push(removeClickEventCallback);
    }

    private beginDrag(findNearestPointMode: FindNearestPointMode, cursorStyle: string, searchAllSeries: boolean, mouseDownEvent: MouseEvent) {
        const mouseDownPointerEventObject = this.mouseEventToPointerEventObject(mouseDownEvent);

        const previousChartZoomAndPanOptions: Options = {
            chart: {
                panning: _.cloneDeep(this._chart.options.chart.panning),
                zoomType: this._chart.options.chart.zoomType
            }
        };

        const temporaryChartOptionsForCursorDrag: Options = {
            chart: {
                panning: {
                    enabled: false
                },
                zoomType: undefined
            }
        };
        this._chart.update(temporaryChartOptionsForCursorDrag, false);
        this._chart.container.style.cursor = cursorStyle;

        const mouseMoveHandler = (e: MouseEvent) => {
            const highchartsMouseEvent = e as PointerEventObject;
            if (highchartsMouseEvent.chartX === undefined || highchartsMouseEvent.chartY === undefined) {
                return;
            }
            if (highchartsMouseEvent.chartX === mouseDownPointerEventObject.chartX && highchartsMouseEvent.chartY === mouseDownPointerEventObject.chartY) {
                // Mouse hasn't actually moved yet. Don't trigger redraw, so that we can still potentially get a click event for point selection.
                return;
            }

            this.snapToNearestPoint(highchartsMouseEvent.chartX, highchartsMouseEvent.chartY, searchAllSeries, findNearestPointMode);
        };

        const mouseUpHandler = () => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);

            this._chart.update(previousChartZoomAndPanOptions, false);
            this._chart.container.style.removeProperty('cursor');

            this.updateCursorPosition();
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    }

    private drawPath(path: SVGPathArray, attributes: SVGAttributes): Highcharts.SVGElement {
        return this._chart.renderer.path(path)
            .attr(attributes).add();
    }

    private drawSymbol(symbol: string, xPosition: number, yPosition: number, width: number, height: number, attributes: SVGAttributes): Highcharts.SVGElement {
        return this._chart.renderer.symbol(symbol,
            xPosition - width / 2,
            yPosition - height / 2,
            width,
            height)
            .attr(attributes)
            .add();
    }

    private getCommonVisualSVGConfig(cursorPart: string): SVGAttributes {
        return {
            stroke: this._color,
            fill: this._color,
            'stroke-width': Cursor.visualStrokeWidth,
            zIndex: Cursor.visualZIndex,
            opacity: this._opacity,
            cursorId: this.id, // Identifier for tests
            cursorPart // Identifier for tests
        };
    }

    private getCommonInteractorSVGConfig(cursorPart: string): SVGAttributes {
        return {
            // Need a stroke and fill or else mouse events and CSS cursors don't work
            stroke: 'black',
            fill: 'black',
            'stroke-width': Cursor.interactionStrokeWidth,
            zIndex: Cursor.interactionZIndex,
            opacity: 0,
            cursorId: this.id, // Identifier for tests
            cursorPart // Identifier for tests
        };
    }

    private requestRedraw() {
        if (!this._redrawRequested) {
            this._redrawRequested = true;
            this._redrawFinished = new Promise(resolve => {
                window.requestAnimationFrame(() => {
                    this._redrawRequested = false;
                    this.draw();
                    resolve();
                });
            });
        }
    }

    private findNearestPoint(series: Series[], chartX: number, chartY: number, findNearestPointMode: FindNearestPointMode, inVisibleRange = false): { point: Point, distance: number } {
        const calculateDistance = (point: Point): number => {
            let xDistance: number;
            let yDistance: number;
            if (findNearestPointMode === FindNearestPointMode.X || findNearestPointMode === FindNearestPointMode.XY) {
                xDistance = point.series.xAxis.toPixels(point.x, false) - chartX;
                if (findNearestPointMode === FindNearestPointMode.X) {
                    return Math.abs(xDistance);
                }
            }
            if (findNearestPointMode === FindNearestPointMode.Y || findNearestPointMode === FindNearestPointMode.XY) {
                yDistance = point.series.yAxis.toPixels(point.y, false) - chartY;
                if (findNearestPointMode === FindNearestPointMode.Y) {
                    return Math.abs(yDistance);
                }
            }
            return Math.sqrt(xDistance * xDistance + yDistance * yDistance);
        };

        let nearestPoint: Point;
        let nearestDistance: number;
        let nearestVisiblePoint: Point;
        let nearestVisiblePointDistance: number;
        for (const s of series) {
            const xExtremes = s.xAxis.getExtremes();
            const yExtremes = s.yAxis.getExtremes();
            for (const point of s.points) {
                const distance = calculateDistance(point);
                if (inVisibleRange
                        && point.x >= xExtremes.min && point.x <= xExtremes.max
                        && point.y >= yExtremes.min && point.y <= yExtremes.max
                        && (nearestVisiblePoint === undefined || distance < nearestVisiblePointDistance)) {
                    nearestVisiblePoint = point;
                    nearestVisiblePointDistance = distance;
                }
                if (nearestPoint === undefined || distance < nearestDistance) {
                    nearestPoint = point;
                    nearestDistance = distance;
                }
            }
        }

        if (inVisibleRange && nearestVisiblePoint !== undefined) {
            return { point: nearestVisiblePoint, distance: nearestVisiblePointDistance };
        }
        return { point: nearestPoint, distance: nearestDistance };
    }

    private findNearestPointFromMouseEvent(series: Series[], mouseEvent: MouseEvent, findNearestPointMode: FindNearestPointMode): { point: Point, distance: number } {
        const pointerEventObject = this.mouseEventToPointerEventObject(mouseEvent);
        const xPixelPosition = pointerEventObject.chartX;
        const yPixelPosition = pointerEventObject.chartY;
        return this.findNearestPoint(series, xPixelPosition, yPixelPosition, findNearestPointMode);
    }

    private mouseEventToPointerEventObject(event: MouseEvent): PointerEventObject {
        let pointerEventObject = event as PointerEventObject;
        if (pointerEventObject.chartX === undefined || pointerEventObject.chartY === undefined) {
            pointerEventObject = this._chart.pointer.normalize(event);
        }
        return pointerEventObject;
    }

    private clickEventHandler = (event: MouseEvent) => {
        if (!this._chart.isInPointSelectionMode) {
            return;
        }
        const nearestPoint = this.findNearestPointFromMouseEvent(this._chart.series, event, FindNearestPointMode.XY);
        if (nearestPoint.distance < Cursor.clickEventSearchRadius) {
            if (event.shiftKey === true || event.ctrlKey === true) {
                const pointSelected = nearestPoint.point.selected;
                nearestPoint.point.select(!pointSelected, true);
            } else {
                nearestPoint.point.select(true, false);
            }
        }
        event.stopPropagation();
    };
}
