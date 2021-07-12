import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { DxDataGridModule } from 'devextreme-angular/ui/data-grid';

import { AppComponent } from './app.component';
import { CursorTableComponent } from './components/cursor-table/cursor-table.component';
import { ScatterComponent } from './components/scatter/scatter.component';
import { ScatterCursorsDirective } from './directives/scatter-cursors.directive';
import { CursorFactoryService } from './services/cursor-factory.service';

@NgModule({
  declarations: [
    AppComponent,
    ScatterComponent,
    ScatterCursorsDirective,
    CursorTableComponent
  ],
  imports: [
    BrowserModule,
    DxDataGridModule
  ],
  providers: [
    CursorFactoryService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
