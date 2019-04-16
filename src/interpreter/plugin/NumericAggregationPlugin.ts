import {
  cellError,
  CellValue,
  ErrorType,
  getAbsoluteAddress,
  SimpleCellAddress,
  AbsoluteCellRange,
} from '../../Cell'
import {generateCellsFromRangeGenerator} from '../../GraphBuilder'
import {AstNodeType, CellRangeAst, ProcedureAst} from '../../parser/Ast'
import {add} from '../scalar'
import {FunctionPlugin} from './FunctionPlugin'
import {findSmallerRange} from './SumprodPlugin'

export type RangeOperation = (rangeValues: CellValue[]) => CellValue

export class NumericAggregationPlugin extends FunctionPlugin {
  public static implementedFunctions = {
    sum: {
      EN: 'SUM',
      PL: 'SUMA',
    },
  }

  /**
   * Corresponds to SUM(Number1, Number2, ...).
   *
   * Returns a sum of given numbers.
   *
   * @param ast
   * @param formulaAddress
   */
  public sum(ast: ProcedureAst, formulaAddress: SimpleCellAddress): CellValue {
    return ast.args.reduce((currentSum: CellValue, arg) => {
      let value
      if (arg.type === AstNodeType.CELL_RANGE) {
        value = this.evaluateRange(arg, formulaAddress, 'SUM', reduceSum)
      } else {
        value = this.evaluateAst(arg, formulaAddress)
      }

      return add(currentSum, value)
    }, 0)
  }

  /**
   * Performs range operation on given range
   *
   * @param ast - cell range ast
   * @param formulaAddress - address of the cell in which formula is located
   * @param functionName - function name to use as cache key
   * @param funcToCalc - range operation
   */
  private evaluateRange(ast: CellRangeAst, formulaAddress: SimpleCellAddress, functionName: string, funcToCalc: RangeOperation): CellValue {
    const rangeStart = getAbsoluteAddress(ast.start, formulaAddress)
    const rangeEnd = getAbsoluteAddress(ast.end, formulaAddress)
    const rangeVertex = this.rangeMapping.getRange(rangeStart, rangeEnd)

    if (!rangeVertex) {
      throw Error('Range does not exists in graph')
    }

    let value = rangeVertex.getFunctionValue(functionName)
    if (!value) {
      const range = AbsoluteCellRange.fromCellRange(ast, formulaAddress)
      const rangeValues = this.getRangeValues(functionName, range)
      value = funcToCalc(rangeValues)
      rangeVertex.setFunctionValue(functionName, value)
    }

    return value
  }

  /**
   * Returns list of values for given range and function name
   *
   * If range is dependent on smaller range, list will contain value of smaller range for this function
   * and values of cells that are not present in smaller range
   *
   * @param functionName - function name (e.g. SUM)
   * @param range - cell range
   */
  private getRangeValues(functionName: string, range: AbsoluteCellRange): CellValue[] {
    const rangeResult: CellValue[] = []
    const {smallerRangeVertex, restRanges} = findSmallerRange(this.rangeMapping, [range])
    const restRange = restRanges[0]
    const currentRangeVertex = this.rangeMapping.getRange(range.start, range.end)!
    if (smallerRangeVertex && this.graph.existsEdge(smallerRangeVertex, currentRangeVertex)) {
      rangeResult.push(smallerRangeVertex.getFunctionValue(functionName)!)
    }
    for (const cellFromRange of generateCellsFromRangeGenerator(restRange)) {
      rangeResult.push(this.addressMapping.getCellValue(cellFromRange))
    }

    return rangeResult
  }
}

export function reduceSum(rangeValues: CellValue[]): CellValue {
  let acc: CellValue = 0
  for (const val of rangeValues) {
    acc = add(acc, val)
  }
  return acc
}
