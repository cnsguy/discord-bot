export class MissingEnvironmentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class LimitedBuffer {
  private parts: string[];
  private partsLength: number;

  public constructor(public readonly maxLength: number) {
    this.parts = [];
    this.partsLength = 0;
    this.maxLength = maxLength;
  }

  public canWrite(input: string): boolean {
    return this.partsLength + input.length <= this.maxLength;
  }

  public write(input: string): boolean {
    if (!this.canWrite(input)) {
      return false;
    }

    this.parts.push(input);
    this.partsLength += input.length;
    return true;
  }

  public get content(): string {
    return this.parts.join('');
  }

  public flush(): void {
    this.parts = [];
    this.partsLength = 0;
  }
}

export function limitTextLength(fullText: string, max: number, truncationIndicator: string): string {
  if (max <= truncationIndicator.length) {
    return truncationIndicator.slice(0, truncationIndicator.length - max);
  }

  const buffer = new LimitedBuffer(max - truncationIndicator.length);
  const split = fullText.split(' ');
  let truncated = false;

  for (const part of split) {
    if (!buffer.write(part)) {
      truncated = true;
      break;
    }

    if (!buffer.write(' ')) {
      truncated = true;
      break;
    }
  }

  if (truncated) {
    return buffer.content + truncationIndicator;
  }

  return fullText;
}

export function escapeLinksForDiscord(content: string): string {
  return content.replaceAll(/(\bhttps?:\/\/\S+\b)/g, '<$1>');
}

export function readEnvOrThrow(key: string): string {
  const value = process.env[key];

  if (value === undefined) {
    throw new MissingEnvironmentError(`Missing environment value: ${key}`);
  }

  return value;
}
