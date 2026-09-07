import type { BlockPlugin } from "../../core/ports/contracts.ts";

type Fraction = { numerator: bigint; denominator: bigint };

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const FIVE = BigInt(5);
const TEN = BigInt(10);
const MAX_EXPRESSION_LENGTH = 200;
const MAX_TOKENS = 100;

function calculationError(): never {
  throw new Error("No pudimos calcular esa operación. Usa números, paréntesis y +, -, × o ÷.");
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < ZERO ? -left : left;
  let b = right < ZERO ? -right : right;
  while (b !== ZERO) [a, b] = [b, a % b];
  return a;
}

function fraction(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === ZERO) calculationError();
  const sign = denominator < ZERO ? -ONE : ONE;
  const divisor = gcd(numerator, denominator);
  return { numerator: (numerator / divisor) * sign, denominator: (denominator / divisor) * sign };
}

function add(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
}

function subtract(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator);
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Fraction, right: Fraction): Fraction {
  if (right.numerator === ZERO) calculationError();
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function decimal(value: string): Fraction {
  const [integer, decimals = ""] = value.split(".");
  let denominator = ONE;
  for (let index = 0; index < decimals.length; index += 1) denominator *= TEN;
  return fraction(BigInt(`${integer}${decimals}`), denominator);
}

function tokenize(expression: string): string[] {
  if (!expression.trim() || expression.length > MAX_EXPRESSION_LENGTH) calculationError();
  const tokens: string[] = [];
  const token = /\s*([0-9]+(?:\.[0-9]+)?|[()+\-*/])\s*/gy;
  while (token.lastIndex < expression.length) {
    const match = token.exec(expression);
    if (!match) calculationError();
    tokens.push(match[1]);
    if (tokens.length > MAX_TOKENS) calculationError();
  }
  return tokens;
}

function parse(expression: string): Fraction {
  const tokens = tokenize(expression);
  let position = 0;
  const peek = () => tokens[position];
  const consume = (value: string) => {
    if (peek() === value) { position += 1; return true; }
    return false;
  };
  const factor = (): Fraction => {
    if (consume("+")) return factor();
    if (consume("-")) { const value = factor(); return { ...value, numerator: -value.numerator }; }
    if (consume("(")) {
      const value = expressionRule();
      if (!consume(")")) calculationError();
      return value;
    }
    const value = peek();
    if (!value || !/^[0-9]+(?:\.[0-9]+)?$/.test(value)) calculationError();
    position += 1;
    return decimal(value);
  };
  const term = (): Fraction => {
    let value = factor();
    while (peek() === "*" || peek() === "/") {
      const operator = tokens[position++];
      value = operator === "*" ? multiply(value, factor()) : divide(value, factor());
    }
    return value;
  };
  const expressionRule = (): Fraction => {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const operator = tokens[position++];
      value = operator === "+" ? add(value, term()) : subtract(value, term());
    }
    return value;
  };
  const result = expressionRule();
  if (position !== tokens.length) calculationError();
  return result;
}

function format(value: Fraction): string {
  if (value.denominator === ONE) return value.numerator.toString();
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % TWO === ZERO) { denominator /= TWO; twos += 1; }
  while (denominator % FIVE === ZERO) { denominator /= FIVE; fives += 1; }
  if (denominator !== ONE) return `${value.numerator}/${value.denominator}`;

  const digits = Math.max(twos, fives);
  let scaled = value.numerator;
  for (let index = twos; index < digits; index += 1) scaled *= TWO;
  for (let index = fives; index < digits; index += 1) scaled *= FIVE;
  const negative = scaled < ZERO;
  const absolute = (negative ? -scaled : scaled).toString().padStart(digits + 1, "0");
  const integer = absolute.slice(0, -digits);
  const decimals = absolute.slice(-digits).replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${decimals ? `.${decimals}` : ""}`;
}

export function calculate(expression: string): string {
  return format(parse(expression));
}

function parseInput(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value) || typeof (value as { expression?: unknown }).expression !== "string") calculationError();
  return (value as { expression: string }).expression;
}

export const calcular: BlockPlugin = {
  manifest: {
    type: "calcular",
    label: "Hacer un cálculo",
    color: "#D4553E",
    icon: "calculator",
    placeholder: "Describe el cálculo que quieres realizar y los datos necesarios.",
  },
  tool: {
    schema: {
      name: "hacer_un_calculo",
      description: "Resuelve una operación aritmética exacta con números, paréntesis y los operadores +, -, * y /.",
      inputSchema: { type: "object", additionalProperties: false, required: ["expression"], properties: { expression: { type: "string", description: "Operación aritmética, por ejemplo (1250 * 0.16) + 1250." } } },
    },
    async execute(input) {
      const expression = parseInput(input);
      return { expression, result: calculate(expression) };
    },
  },
};
