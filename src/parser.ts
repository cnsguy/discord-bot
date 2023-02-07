export class Parser {
  private position: number;

  public constructor(private readonly content: string) {
    this.position = 0;
    this.content = content;
  }

  public peek(): string {
    return this.content[this.position];
  }

  public hasMore(): boolean {
    return this.position < this.content.length;
  }

  public forward(): void {
    if (!this.hasMore()) {
      return;
    }

    this.position++;
  }

  public getPos(): number {
    return this.position;
  }

  public takeWhile(pred: (char: string) => boolean): string {
    const start = this.position;

    while (this.hasMore() && pred(this.peek())) {
      this.forward();
    }

    return this.content.slice(start, this.position);
  }

  public skipWhile(pred: (char: string) => boolean): void {
    while (this.hasMore() && pred(this.peek())) {
      this.forward();
    }
  }
}
