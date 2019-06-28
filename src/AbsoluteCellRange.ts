import {CellRange, CellValue, simpleCellAddress, SimpleCellAddress} from './Cell'
import {CellAddress} from './parser/CellAddress'
import {Matrix} from './Matrix'
import {SheetMapping} from "./SheetMapping";
import {Sheets} from "./GraphBuilder";
import {add} from "./interpreter/scalar";

export const DIFFERENT_SHEETS_ERROR = 'AbsoluteCellRange: Start and end are in different sheets'

export class AbsoluteCellRange {

  public get sheet() {
    return this.start.sheet
  }

  public static fromCellRange(x: CellRange, baseAddress: SimpleCellAddress): AbsoluteCellRange {
    return new AbsoluteCellRange(
        new CellAddress(x.start.sheet, x.start.col, x.start.row, x.start.type).toSimpleCellAddress(baseAddress),
        new CellAddress(x.end.sheet, x.end.col, x.end.row, x.end.type).toSimpleCellAddress(baseAddress),
    )
  }

  public static spanFrom(topLeftCorner: SimpleCellAddress, width: number, height: number): AbsoluteCellRange {
    return new AbsoluteCellRange(
        topLeftCorner,
        simpleCellAddress(topLeftCorner.sheet, topLeftCorner.col + width - 1, topLeftCorner.row + height - 1),
    )
  }

  public static fromCoordinates(sheet: number, x1: number, y1: number, x2: number, y2: number): AbsoluteCellRange {
    return new AbsoluteCellRange(simpleCellAddress(sheet, x1, y1), simpleCellAddress(sheet, x2, y2))
  }

  constructor(
      public readonly start: SimpleCellAddress,
      public readonly end: SimpleCellAddress,
  ) {
    if (start.sheet !== end.sheet) {
      throw new Error(DIFFERENT_SHEETS_ERROR)
    }
  }

  public toString() {
    return `${this.start.sheet},${this.start.col},${this.start.row},${this.end.col},${this.end.row}`
  }

  public width() {
    return this.end.col - this.start.col + 1
  }

  public height() {
    return this.end.row - this.start.row + 1
  }

  public size(): number {
    return this.height() * this.width()
  }

  public doesOverlap(other: AbsoluteCellRange) {
    if (this.start.sheet != other.start.sheet) {
      return false
    }
    if (this.end.row < other.start.row || this.start.row > other.end.row) {
      return false
    }
    if (this.end.col < other.start.col || this.start.col > other.end.col) {
      return false
    }
    return true
  }

  public addressInRange(address: SimpleCellAddress): boolean {
    if (this.sheet !== address.sheet) {
      return false
    }

    if (this.start.row <= address.row && this.end.row >= address.row
        && this.start.col <= address.col && this.end.col >= address.col) {
      return true
    }

    return false
  }

  public withStart(newStart: SimpleCellAddress) {
    return new AbsoluteCellRange(newStart, this.end)
  }

  public withEnd(newEnd: SimpleCellAddress) {
    return new AbsoluteCellRange(this.start, newEnd)
  }

  public sameDimensionsAs(other: AbsoluteCellRange) {
    return this.width() === other.width() && this.height() === other.height()
  }

  public sameSizeAs(other: AbsoluteCellRange) {
    return (this.width() * this.height()) === (other.width() * other.height())
  }

  public* generateCellsFromRangeGenerator(): IterableIterator<SimpleCellAddress> {
    let currentRow = this.start.row
    while (currentRow <= this.end.row) {
      let currentColumn = this.start.col
      while (currentColumn <= this.end.col) {
        yield simpleCellAddress(this.start.sheet, currentColumn, currentRow)
        currentColumn++
      }
      currentRow++
    }
  }

  public getAddress(col: number, row: number): SimpleCellAddress {
    if (col < 0 || row < 0 || row > this.height() - 1 || col > this.width() - 1) {
      throw Error('Index out of bound')
    }
    return simpleCellAddress(this.start.sheet, this.start.col + col, this.start.row + row)
  }

  public matrixFromPlainValues(sheets: Sheets, sheetMapping: SheetMapping) {
    const values = new Array(this.height())
    const sheet = sheets[sheetMapping.name(this.start.sheet)]
    for (let i = 0; i < this.height(); ++i) {
      values[i] = new Array(this.width())
    }

    for (const address of this.generateCellsFromRangeGenerator()) {
      const value = sheet[address.row][address.col]
      if (!isNaN(Number(value))) {
        values[address.row - this.start.row][address.col - this.start.col] = Number(value)
      } else {
        throw new Error('Range contains not numeric values')
      }
    }

    return new Matrix(values)
  }

  public shiftByRows(numberOfRows: number) {
    this.start.row += numberOfRows
    this.end.row += numberOfRows
  }

  public expandByRows(numberOfRows: number) {
    this.end.row += numberOfRows
  }
}
