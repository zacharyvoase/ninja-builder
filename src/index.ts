import { Writable, StringWritable } from './util';

// The indent to use for rule/edge options etc.
const INDENT = '  ';

/** Any kind of node that can be output to a Ninja file. */
abstract class NinjaNode {
  /** Write this node to something with a write(s: string) method. */
  abstract writeTo(w: Writable): void;

  /** Convert this node to a string, using its writeTo() method. */
  toString(): string {
    const writable = new StringWritable();
    this.writeTo(writable);
    return writable.toString();
  }
}

export type BuildFileOptions = {
  requiredVersion?: string;
  builddir?: string;
  default?: string | string[];
};

export type RuleOptions = {
  depfile?: string;
  deps?: 'gcc' | 'msvc';
  msvc_deps_prefix?: string;
  description?: string;
  dyndep?: string;
  generator?: boolean;
  in?: string;
  in_newline?: string;
  out?: string;
  restat?: boolean;
} & ({} | { rspfile: string; rspfile_content: string });

export type EdgeOptions = {
  implicitOuts?: string[];
  implicitDeps?: string[];
  orderDeps?: string[];
  validations?: string[];
  dyndep?: string;
  pool?: string;
};

export class NinjaBuildFile extends NinjaNode {
  private readonly nodes: NinjaNode[] = [];

  constructor(public readonly options?: BuildFileOptions) {
    super();
  }

  private preamble(): NinjaNode[] {
    const preambleNodes = [];
    if (this.options?.requiredVersion != null) {
      preambleNodes.push(
        new Binding('ninja_required_version', this.options.requiredVersion)
      );
    }
    if (this.options?.builddir != null) {
      preambleNodes.push(new Binding('builddir', this.options.builddir));
    }
    return preambleNodes;
  }

  private postamble(): NinjaNode[] {
    const postambleNodes = [];
    if (this.options?.default != null) {
      postambleNodes.push(new Raw(`default ${fileList(this.options.default)}`));
    }
    return postambleNodes;
  }

  override writeTo(w: Writable): void {
    for (const node of [
      ...this.preamble(),
      ...this.nodes,
      ...this.postamble(),
    ]) {
      node.writeTo(w);
    }
  }

  /** Bind a variable name to a value. */
  bind(name: string, value: string): this {
    this.nodes.push(new Binding(name, value));
    return this;
  }

  /** Define a named rule. */
  rule(name: string, command: string, options?: RuleOptions): this {
    this.nodes.push(new Rule(name, command, options));
    return this;
  }

  /** Define a build edge (how to build outputs from inputs via a rule). */
  build(
    outputs: string | string[],
    rule: string,
    inputs: string | string[],
    options?: EdgeOptions,
    bindings?: Record<string, string>
  ): this {
    this.nodes.push(new Edge(outputs, rule, inputs, options, bindings));
    return this;
  }

  /** Add a raw string to the output. A newline will be added to the end. */
  raw(s: string): this {
    this.nodes.push(new Raw(s));
    return this;
  }
}

class Raw extends NinjaNode {
  constructor(public readonly string: string) {
    super();
  }

  override writeTo(w: Writable): void {
    w.write(this.string + '\n');
  }
}

class Binding extends NinjaNode {
  constructor(
    public readonly name: string,
    public readonly value: string,
    public readonly indent: string = ''
  ) {
    super();
  }

  override writeTo(w: Writable): void {
    w.write(`${this.indent}${this.name} = ${this.value}\n`);
  }
}

class Rule extends NinjaNode {
  constructor(
    public readonly name: string,
    public readonly command: string,
    public readonly options?: RuleOptions
  ) {
    super();
  }

  override writeTo(w: Writable): void {
    w.write(`rule ${this.name}\n`);
    new Binding('command', this.command, INDENT).writeTo(w);
    for (const [opt, value] of Object.entries(this.options ?? {})) {
      if (typeof value === 'boolean') {
        if (value) {
          new Binding(opt, '1', INDENT).writeTo(w);
        }
      } else {
        new Binding(opt, value, INDENT).writeTo(w);
      }
    }
  }
}

class Edge extends NinjaNode {
  constructor(
    public readonly outputs: string | string[],
    public readonly rule: string,
    public readonly inputs?: string | string[],
    public readonly options?: EdgeOptions,
    public readonly bindings?: Record<string, string>
  ) {
    super();
  }

  override writeTo(w: Writable): void {
    const outputs = [
      fileList(this.outputs),
      fileList(this.options?.implicitOuts, '|'),
    ].join('');

    const inputs = [
      fileList(this.inputs),
      fileList(this.options?.implicitDeps, '|'),
      fileList(this.options?.orderDeps, '||'),
      fileList(this.options?.validations, '|@'),
    ].join('');

    w.write(`build ${outputs}: ${this.rule} ${inputs}\n`);
    if (this.options?.dyndep) {
      new Binding('dyndep', this.options.dyndep, INDENT).writeTo(w);
    }
    if (this.options?.pool) {
      new Binding('pool', this.options.pool, INDENT).writeTo(w);
    }
    for (const [name, value] of Object.entries(this.bindings ?? {})) {
      new Binding(name, value, INDENT).writeTo(w);
    }
  }
}

/** Helper for building lists of filenames for build edges. */
function fileList(f?: string | string[], separator?: string) {
  if (f == null || f.length === 0) {
    return '';
  } else if (typeof f === 'string') {
    f = [f];
  }
  const joined = f.join(' ');
  if (separator != null && separator !== '') {
    return ` ${separator} ${joined}`;
  }
  return joined;
}

/** Escape a string literal for use in a Ninja file. */
export function escape(s: string): string {
  return s.replace(/[ \:\$\n]/g, (match) => '$' + match);
}
