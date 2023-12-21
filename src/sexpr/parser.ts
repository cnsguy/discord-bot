export class Parser {
  private readonly content: string;
  private pos: number = 0;

  public constructor(content: string) {
    this.content = content;
  }

  public isDone(): boolean {
    return this.pos == this.content.length;
  }

  public getPos(): number {
    return this.pos;
  }

  public forward(): void {
    this.pos++;
  }

  public peek(): string | null {
    if (this.isDone()) {
      return null;
    }

    return this.content.slice(this.pos);
  }

  public peekChar(): string | null {
    if (this.isDone()) {
      return null;
    }

    return this.content[this.pos];
  }

  public nextChar(): string | null {
    if (this.isDone()) {
      return null;
    }

    const ch = this.peekChar();
    this.forward();
    return ch;
  }

  public takeWhile(pred: (ch: string) => boolean): string {
    const start = this.pos;
    this.forwardWhile(pred);
    return this.content.slice(start, this.pos);
  }

  public forwardWhile(pred: (ch: string) => boolean): void {
    for (;;) {
      if (this.isDone()) {
        break;
      }

      const ch = this.peekChar();

      if (ch === null || !pred(ch)) {
        break;
      }

      this.forward();
    }
  }
}
