export interface Writable {
  write(s: string): boolean;
}

export class StringWritable implements Writable {
  private readonly chunks: string[] = [];

  write(s: string): boolean {
    this.chunks.push(s);
    return true;
  }

  toString(): string {
    return this.chunks.join('');
  }
}
