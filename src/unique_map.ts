export class UniqueMapError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UniqueMap<K, T> extends Map<K, T> {
  public constructor(items?: IterableIterator<[K, T]>) {
    super();

    if (items === undefined) {
      return;
    }

    for (const [key, val] of items) {
      this.setUnique(key, val);
    }
  }

  public setUnique(key: K, value: T): this {
    if (this.has(key)) {
      throw new UniqueMapError(`Duplicate key in unique map`);
    }

    this.set(key, value);
    return this;
  }
}
