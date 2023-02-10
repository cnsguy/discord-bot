export class Parser {
  private index: number;

  public constructor(private readonly content: string) {
    this.index = 0;
    this.content = content;
  }

  public peek(): string {
    return this.content[this.index];
  }

  public hasMore(): boolean {
    return this.index < this.content.length;
  }

  public forwardNum(num: number): void {
    for (let i = 0; i < num && this.hasMore(); ++i) {
      this.index++;
    }
  }

  public forward(): void {
    this.forwardNum(1);
  }

  public getPos(): number {
    return this.index;
  }

  public takeWhile(pred: (char: string) => boolean): string {
    const start = this.index;

    while (this.hasMore() && pred(this.peek())) {
      this.forward();
    }

    return this.content.slice(start, this.index);
  }

  public skipWhile(pred: (char: string) => boolean): void {
    while (this.hasMore() && pred(this.peek())) {
      this.forward();
    }
  }

  public takeWord(word: string): string | null {
    if (this.index + word.length >= this.content.length) {
      return null;
    }

    if (this.content.slice(this.index).startsWith(word)) {
      this.forwardNum(word.length);
      return word;
    }

    return null;
  }
}
