// Safe formula evaluator for grading expressions.
// Supports: numbers, identifiers, + - * /, unary -, parens, max(...) and min(...).
// No `eval`, no `Function`. Admin-editable formulas are run through this only.

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '(' | ')' | ',' };

const FN_NAMES = new Set(['max', 'min']);

export class FormulaError extends Error {}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < src.length && (/[0-9.]/).test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (Number.isNaN(n)) throw new FormulaError(`Bad number at ${i}`);
      out.push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i;
      while (j < src.length && (/[A-Za-z0-9_]/).test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/(),'.includes(c)) {
      out.push({ t: 'op', v: c as any });
      i++;
      continue;
    }
    throw new FormulaError(`Unexpected character '${c}' at ${i}`);
  }
  return out;
}

type Node =
  | { k: 'n'; v: number }
  | { k: 'v'; n: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; l: Node; r: Node }
  | { k: 'fn'; n: 'max' | 'min'; args: Node[] };

class Parser {
  private pos = 0;
  constructor(private toks: Token[]) {}
  private peek() { return this.toks[this.pos]; }
  private eat() { return this.toks[this.pos++]; }
  private expect(op: string) {
    const t = this.eat();
    if (!t || t.t !== 'op' || t.v !== op) throw new FormulaError(`Expected '${op}'`);
  }
  parse(): Node {
    const n = this.expr();
    if (this.pos !== this.toks.length) throw new FormulaError('Unexpected trailing input');
    return n;
  }
  // expr := term ( ('+'|'-') term )*
  private expr(): Node {
    let l = this.term();
    while (true) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.eat();
        const r = this.term();
        l = { k: 'bin', op: t.v, l, r };
      } else break;
    }
    return l;
  }
  // term := unary ( ('*'|'/') unary )*
  private term(): Node {
    let l = this.unary();
    while (true) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.eat();
        const r = this.unary();
        l = { k: 'bin', op: t.v, l, r };
      } else break;
    }
    return l;
  }
  // unary := '-' unary | atom
  private unary(): Node {
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '-') {
      this.eat();
      return { k: 'neg', a: this.unary() };
    }
    return this.atom();
  }
  // atom := num | ident | ident '(' args ')' | '(' expr ')'
  private atom(): Node {
    const t = this.eat();
    if (!t) throw new FormulaError('Unexpected end of input');
    if (t.t === 'num') return { k: 'n', v: t.v };
    if (t.t === 'op' && t.v === '(') {
      const n = this.expr();
      this.expect(')');
      return n;
    }
    if (t.t === 'id') {
      const nxt = this.peek();
      if (nxt && nxt.t === 'op' && nxt.v === '(') {
        if (!FN_NAMES.has(t.v)) throw new FormulaError(`Unknown function '${t.v}'`);
        this.eat();
        const args: Node[] = [];
        if (!(this.peek()?.t === 'op' && (this.peek() as any).v === ')')) {
          args.push(this.expr());
          while (this.peek()?.t === 'op' && (this.peek() as any).v === ',') {
            this.eat();
            args.push(this.expr());
          }
        }
        this.expect(')');
        return { k: 'fn', n: t.v as any, args };
      }
      return { k: 'v', n: t.v };
    }
    throw new FormulaError(`Unexpected token`);
  }
}

function evalNode(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case 'n': return n.v;
    case 'v': {
      const v = vars[n.n];
      if (v === undefined) throw new FormulaError(`Unknown variable '${n.n}'`);
      return v;
    }
    case 'neg': return -evalNode(n.a, vars);
    case 'bin': {
      const a = evalNode(n.l, vars);
      const b = evalNode(n.r, vars);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? 0 : a / b;
      }
      return 0;
    }
    case 'fn': {
      const vs = n.args.map(a => evalNode(a, vars));
      if (n.n === 'max') return Math.max(...vs);
      return Math.min(...vs);
    }
  }
}

export interface CompiledFormula {
  evaluate: (vars: Record<string, number>) => number;
  variables: string[];
}

export function compileFormula(expr: string): CompiledFormula {
  const toks = tokenize(expr);
  const tree = new Parser(toks).parse();
  const vars = new Set<string>();
  (function walk(n: Node) {
    if (n.k === 'v') vars.add(n.n);
    else if (n.k === 'neg') walk(n.a);
    else if (n.k === 'bin') { walk(n.l); walk(n.r); }
    else if (n.k === 'fn') n.args.forEach(walk);
  })(tree);
  return {
    evaluate: (v) => evalNode(tree, v),
    variables: [...vars]
  };
}

export function validateFormula(expr: string): { ok: true } | { ok: false; error: string } {
  try { compileFormula(expr); return { ok: true }; }
  catch (e: any) { return { ok: false, error: e?.message ?? 'Invalid formula' }; }
}
