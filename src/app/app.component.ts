import { Component, OnInit } from '@angular/core';
import { CursorCrosshairStyle, ScatterCursorOptions } from './models/scatter-cursor-options';
import * as Highcharts from './utilities/highcharts-globals';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'op-scatter';

  public options: Highcharts.Options;
  public cursorOptions: ScatterCursorOptions;

  ngOnInit(): void {
    const data = [];
    for (let i = 0; i < 1000; i++) {
      data.push(Math.sin(i / 100));
    }

    this.options = {
      chart: {
        type: 'scatter'
      },
      series: [
        {
          type: 'scatter',
          data: data,
          name: 'series 1'
        }
      ]
    };

    this.cursorOptions = new ScatterCursorOptions({
      crosshairStyle: CursorCrosshairStyle.Both,
      showLabel: true,
      showValue: true,
      cursors: [{
        seriesName: 'series 1',
        x: 50,
        y: 0,
        label: 'Cursor 1',
        visible: true
      }]
    })
  }
}
