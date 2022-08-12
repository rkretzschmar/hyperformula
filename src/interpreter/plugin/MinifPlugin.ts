/**
 * @license
 * Copyright (c) 2021 Handsoncode. All rights reserved.
 */

import { CellError, ErrorType } from '../../Cell'
import { ErrorMessage } from '../../error-message'
import { ProcedureAst } from '../../parser'
import {
  Condition,
  CriterionFunctionCompute,
} from '../CriterionFunctionCompute'
import { InterpreterState } from '../InterpreterState'
import {
  getRawValue,
  InterpreterValue,
  RawScalarValue,
} from '../InterpreterValue'
import { SimpleRangeValue } from '../SimpleRangeValue'
import {
  ArgumentTypes,
  FunctionPlugin,
  FunctionPluginTypecheck,
} from './FunctionPlugin'

/** Computes key for criterion function cache */
function minifCacheKey(conditions: Condition[]): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const conditionsStrings = conditions.map(
    (c) =>
      `${c.conditionRange.range!.sheet},${c.conditionRange.range!.start.col},${
        c.conditionRange.range!.start.row
      }`
  )
  return ['MINIF', ...conditionsStrings].join(',')
}

function min(left: RawScalarValue, right: RawScalarValue): number | CellError {
  if (left instanceof CellError) {
    return left
  } else if (right instanceof CellError) {
    return right
  } else if (typeof left === 'number') {
    if (typeof right === 'number') {
      return Math.min(left, right)
    } else {
      return left
    }
  } else if (typeof right === 'number') {
    return right
  } else {
    return 0
  }
}

export class MinifPlugin
  extends FunctionPlugin
  implements FunctionPluginTypecheck<MinifPlugin> {
  public static implementedFunctions = {
    MINIFS: {
      method: 'minifs',
      parameters: [
        { argumentType: ArgumentTypes.RANGE },
        { argumentType: ArgumentTypes.RANGE },
        { argumentType: ArgumentTypes.NOERROR },
      ],
      repeatLastArgs: 2,
    },
  }

  public minifs(ast: ProcedureAst, state: InterpreterState): InterpreterValue {
    return this.runFunction(
      ast.args,
      state,
      this.metadata('MINIFS'),
      (values: SimpleRangeValue, ...args) => {
        const conditions: Condition[] = []
        for (let i = 0; i < args.length; i += 2) {
          const conditionArg = args[i] as SimpleRangeValue
          const criterionPackage =
            this.interpreter.criterionBuilder.fromCellValue(
              args[i + 1],
              this.arithmeticHelper
            )
          if (criterionPackage === undefined) {
            return new CellError(ErrorType.VALUE, ErrorMessage.BadCriterion)
          }
          conditions.push(new Condition(conditionArg, criterionPackage))
        }

        return new CriterionFunctionCompute<RawScalarValue>(
          this.interpreter,
          minifCacheKey,
          Number.POSITIVE_INFINITY,
          (left, right) => min(left, right),
          (arg) => getRawValue(arg)
        ).compute(values, conditions)
      }
    )
  }
}
