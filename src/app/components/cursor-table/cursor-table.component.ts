import { Component, EventEmitter, HostBinding, HostListener, Input, Output, ViewChild } from '@angular/core';
import { DxDataGridComponent } from 'devextreme-angular/ui/data-grid';
import { DxiDataGridColumn } from 'devextreme-angular/ui/nested/base/data-grid-column-dxi';
//import { ColorsService } from '../../../core/services/colors.service';
import { CursorModel } from '../../models/cursor-model';
import * as _ from 'lodash';

interface DxDataGridCell {
    data?: any;
    rowIndex?: number;
}

interface DxDataGridOnCellPreparedArgs {
    data: any;
    rowType: string;
    column: DxiDataGridColumn;
    cellElement: HTMLElement;
}

/** Event args for @see CursorTableComponent.cursorVisibilityChanged */
export interface CursorVisibilityChangedArgs {
    index: number;
    visible: boolean;
}

/** Event args for @see CursorTableComponent.sizeChanged */
export interface CursorTableSizeChangedArgs {
    isExpanded: boolean;
}

@Component({
    selector: 'cursor-table',
    templateUrl: './cursor-table.component.html',
    styleUrls: ['./cursor-table.component.scss']
})
/** Displays a grid of information about scatter graph cursors, and provides a way to show/hide individual cursors. */
export class CursorTableComponent {
    cursorTableExpanded = true;
    cursorsInternal: CursorModel[];
    @HostBinding('class.expanded') get expandedClass() { return this.cursorTableExpanded; }

    @Input() set cursors(value: CursorModel[]) {
        this.cursorsInternal = _.cloneDeep(value);
    }

    @ViewChild(DxDataGridComponent, { static: false }) gridComponent: DxDataGridComponent;

    @Output() sizeChanged: EventEmitter<CursorTableSizeChangedArgs> = new EventEmitter<CursorTableSizeChangedArgs>();
    @Output() cursorVisibilityChanged: EventEmitter<CursorVisibilityChangedArgs> = new EventEmitter<CursorVisibilityChangedArgs>();
    @Output() renderCompleted: EventEmitter<void> = new EventEmitter();

    constructor() {
    }

    onDataGridContentReady() {
        this.renderCompleted.emit();
    }

    showHideCursor(cell: DxDataGridCell) {
        const cursor: CursorModel = cell.data;
        cursor.visible = !cursor.visible;
        this.cursorVisibilityChanged.emit({ index: cell.rowIndex, visible: cursor.visible });
    }

    toggleCursorTable() {
        this.cursorTableExpanded = !this.cursorTableExpanded;
        this.reflow();
        this.sizeChanged.emit({ isExpanded: this.cursorTableExpanded });
    }

    onCellPrepared(event: Event) {
        const args = event as any as DxDataGridOnCellPreparedArgs;
        if (args.rowType === 'data' && args.column.dataField === 'seriesName') {
            //const seriesColor = this.colorsService.getColorForKey(args.data.seriesName);
            args.cellElement.style.setProperty('--op-scatter-cursor-row-series-color', 'blue');
        }
    }

    /**
     * Handle mousewheel scrolling. By default, DxDataGrid configured with a small height scrolls too
     * far (skips rows) and doesn't have a built-in way to customize the scroll amount.
     * This function scrolls by one page per wheel scroll (i.e. if 2 rows are visible, it'll scroll past
     * those 2 rows))
     * @param event Event Args
     */
    @HostListener('mousewheel', ['$event'])
    onMouseWheel(event: WheelEvent) {
        if (this.gridComponent) {
            const scrollable = this.gridComponent.instance.getScrollable();
            const scrollUp = event.deltaY < 0;
            const pageHeight = scrollable.clientHeight();
            const scrollAmount = scrollUp ? -pageHeight : pageHeight;
            const oldScrollOffset = scrollable.scrollTop();
            scrollable.scrollBy(scrollAmount);
            const didScroll = scrollable.scrollTop() !== oldScrollOffset;
            if (didScroll) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }
    }

    public reflow() {
        if (this.gridComponent) {
            // The dx-data-grid scrollbars often don't get updated correctly when the grid
            // changes size due to an ancestor changing size. refresh() fixes the scrollbars.
            this.gridComponent.instance.refresh();
        }
    }
}
