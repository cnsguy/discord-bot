import { SExprList, SExprNull, SExprSymbol, SExprValue } from './sexpr_parser';

export class SExprEvalError extends Error {}

// XXX untested
export class SExprFunction {
  public readonly argList: SExprSymbol[];
  public readonly body: SExprValue[];

  public constructor(body: SExprValue[], argList: SExprSymbol[]) {
    this.argList = argList;
    this.body = body;
  }

  public apply(stack: SExprEvalStack, args: SExprEvalStackValue[]): SExprEvalStackValue {
    let result = new SExprNull();

    try {
      stack.newFrame();

      for (const arg of args) {
        for (const sym of this.argList) {
          stack.setValue(sym.value, arg);
        }
      }

      for (const value of this.body) {
        result = stack.eval(value);
      }

      return result;
    } finally {
      stack.popFrame();
    }
  }
}

export type SExprEvalStackValue = SExprValue | SExprFunction | SExprNativeFunction;
export type SExprNativeCallback = (stack: SExprEvalStack, args: SExprEvalStackValue[]) => SExprEvalStackValue;

export class SExprNativeFunction {
  public readonly callback: SExprNativeCallback;

  public constructor(callback: SExprNativeCallback) {
    this.callback = callback;
  }

  public apply(stack: SExprEvalStack, args: SExprEvalStackValue[]): SExprEvalStackValue {
    return this.callback(stack, args);
  }
}

export class SExprEvalStack {
  private readonly values: Map<string, SExprEvalStackValue>[] = [];

  public constructor() {
    this.newFrame();
  }

  public getValue(key: string): SExprEvalStackValue | null {
    for (let no = this.values.length; no > 0; no--) {
      const value = this.values[no - 1].get(key);

      if (value !== undefined) {
        return value;
      }
    }

    return null;
  }

  public setValue(key: string, value: SExprEvalStackValue): void {
    this.values[this.values.length - 1].set(key, value);
  }

  public newFrame(): void {
    this.values.push(new Map());
  }

  public popFrame(): void {
    this.values.pop();
  }

  public eval(value: SExprEvalStackValue): SExprEvalStackValue {
    if (value instanceof SExprSymbol) {
      const result = this.getValue(value.value);

      if (result === null) {
        throw new SExprEvalError(`Unbound symbol ${value.value}`);
      }

      return result;
    } else if (value instanceof SExprList) {
      const evaluated = [];

      for (const subValue of value.value) {
        evaluated.push(this.eval(subValue));
      }

      if (evaluated.length == 0) {
        throw new SExprEvalError('Tried to evaluate an empty list');
      }

      const fun = evaluated[0];

      if (fun instanceof SExprFunction || fun instanceof SExprNativeFunction) {
        return fun.apply(this, evaluated.slice(1));
      } else {
        throw new SExprEvalError('Symbol in function call did not evaluate to a function');
      }
    } else {
      return value;
    }
  }
}
