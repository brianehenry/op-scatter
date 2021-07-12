import { AfterContentInit, AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { ScatterCursorOptions } from '../../models/scatter-cursor-options';
import * as Highcharts from '../../utilities/highcharts-globals';

@Component({
  selector: 'app-scatter',
  templateUrl: './scatter.component.html',
  styleUrls: ['./scatter.component.scss']
})
export class ScatterComponent implements AfterViewInit {

  @ViewChild('chartContainer', { static: true }) chartContainer: ElementRef;
  public chart: Highcharts.Chart;
  @Input() chartOptions: Highcharts.Options;
  @Input() set cursorOptions(cursorOptions: ScatterCursorOptions) {
    this._cursorOptions = cursorOptions;
  }
  get cursorOptions(): ScatterCursorOptions {
    return this._cursorOptions;
  }
  @Output() cursorOptionsChange = new EventEmitter<ScatterCursorOptions>();

  private _cursorOptions: ScatterCursorOptions;

  constructor() { }

  ngAfterViewInit(): void {
    this.chart = Highcharts.chart(this.chartContainer.nativeElement, this.chartOptions);
  }

  cursorOptionsChangeHandler(cursorOptions: ScatterCursorOptions) {
    this.cursorOptionsChange.emit(cursorOptions);
  }
}
