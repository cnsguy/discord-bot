import { Parser } from './parser';

export class SExprParseError extends Error {}
export class SExprValue {}
export class SExprNull extends SExprValue {}

export class SExprNumber extends SExprValue {
  public readonly value: number;

  public constructor(value: number) {
    super();
    this.value = value;
  }
}

export class SExprString extends SExprValue {
  public readonly value: string;

  public constructor(value: string) {
    super();
    this.value = value;
  }
}

export class SExprSymbol extends SExprValue {
  public readonly value: string;

  public constructor(value: string) {
    super();
    this.value = value;
  }
}

export class SExprList extends SExprValue {
  public readonly value: SExprValue[];

  public constructor(value: SExprValue[]) {
    super();
    this.value = value;
  }
}

export class SExprParser {
  private readonly parser: Parser;

  public constructor(content: string) {
    this.parser = new Parser(content);
  }

  public isDone(): boolean {
    return this.parser.isDone();
  }

  private skipWhitespace(): void {
    this.parser.forwardWhile((ch) => /\s/.test(ch));
  }

  public parseValues(): SExprValue[] {
    const values = [];

    for (;;) {
      this.skipWhitespace();

      if (this.isDone()) {
        return values;
      }

      values.push(this.parseValue());
    }
  }

  private parseValue(): SExprValue {
    switch (this.parser.peekChar()) {
      case '"':
        return this.parseString();
      case '(':
        return this.parseList();
      default:
        return this.parseAtom();
    }
  }

  private parseHexEscape(len: number): string {
    let value = 0;

    for (let i = 0; i < len; i++) {
      const ch = this.parser.nextChar();

      if (ch === null) {
        throw new SExprParseError('Unterminated string (in escape sequence)');
      }

      const chValue = parseInt(ch);

      if (Number.isNaN(chValue)) {
        throw new SExprParseError('Invalid hex digit in code point escape');
      }

      value += chValue >> (i * 8);
    }

    try {
      return String.fromCodePoint(value);
    } catch (_) {
      throw new SExprParseError('Invalid unicode code point generated from code point escape');
    }
  }

  private parseEscape(): string {
    const ch = this.parser.nextChar();

    if (ch === null) {
      throw new SExprParseError('Unterminated string (in escape sequence)');
    }

    switch (ch) {
      case '\\':
        return '\\';
      case 't':
        return '\t';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 'x':
        return this.parseHexEscape(2);
      case 'u':
        return this.parseHexEscape(4);
      default:
        throw new SExprParseError('Invalid escape sequence');
    }
  }

  private parseString(): SExprString {
    this.parser.forward();
    const content = [];

    for (;;) {
      const ch = this.parser.peekChar();

      if (ch === null) {
        throw new SExprParseError('Unterminated string');
      }

      if (ch === '"') {
        this.parser.forward();
        break;
      }

      if (ch === '\\') {
        this.parser.forward();
        content.push(this.parseEscape());
        continue;
      }

      const normalPart = this.parser.takeWhile((ch) => ch !== '"' && ch !== '\\');
      content.push(normalPart);
    }

    return new SExprString(content.join(''));
  }

  private parseList(): SExprList {
    this.parser.forward();
    const values = [];

    for (;;) {
      this.skipWhitespace();
      const ch = this.parser.nextChar();

      if (ch === null) {
        throw new SExprParseError('Unterminated list');
      }

      if (ch === ')') {
        this.parser.forward();
        return new SExprList(values);
      }

      const value = this.parseValue();
      values.push(value);
    }
  }

  private parseAtom(): SExprSymbol | SExprNumber {
    const content = this.parser.takeWhile((ch) => !/\s/.test(ch));
    const number = parseFloat(content);
    return !Number.isNaN(number) ? new SExprNumber(number) : new SExprSymbol(content);
  }
}
