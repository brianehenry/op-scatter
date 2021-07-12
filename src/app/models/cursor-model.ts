/** This class represents the state of an individual cursor */
export class CursorModel {
    x: number;
    y: number;
    label: string;
    seriesName: string;
    visible = true;

    constructor(cursorModel: CursorModel = undefined) {
        if (cursorModel === undefined) {
            this.label = '';
            this.seriesName = '';
        } else {
            this.x = cursorModel.x;
            this.y = cursorModel.y;
            this.label = cursorModel.label;
            this.seriesName = cursorModel.seriesName;
            this.visible = cursorModel.visible;
        }
    }
}
