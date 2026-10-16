/** Portuguese cardinal numbers, normalized independently of the AI output. */
const cardinals: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200,
  trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
};
const scales: Record<string, number> = { mil: 1000, milhao: 1e6, milhoes: 1e6, bilhao: 1e9, bilhoes: 1e9, trilhao: 1e12, trilhoes: 1e12 };
const normalize = (text: string) => text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '');

function integer(words: string[]): number {
  let total = 0;
  let group = 0;
  for (const word of words) {
    const scale = scales[word];
    if (scale === 1000) group = (group || 1) * scale;
    else if (scale !== undefined) { total += (group || 1) * scale; group = 0; }
    else group += cardinals[word] ?? ( /^\d+$/.test(word) ? Number(word) : 0 );
  }
  return total + group;
}

export interface SourceNumber { value: number; text: string; start: number; end: number }

export function sourceNumbers(text: string): SourceNumber[] {
  const normalized = normalize(text);
  const tokens = Array.from(normalized.matchAll(/\p{L}+|\d+(?:[.,]\d+)*/gu));
  const out: SourceNumber[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;
    const word = token[0];
    if (/^\d/.test(word)) {
      // Brazilian grouped integers and either decimal separator are supported.
      const numeric = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(word) ? word.replace(/\./g, '').replace(',', '.') : word.replace(',', '.');
      let value = Number(numeric);
      let end = token.index + word.length;
      const next = tokens[i + 1];
      if (next && scales[next[0]] !== undefined && /^\s+$/.test(normalized.slice(end, next.index))) {
        value *= scales[next[0]] ?? 1; end = next.index + next[0].length; i += 1;
      }
      out.push({ value, text: text.slice(token.index, end), start: token.index, end });
      continue;
    }
    if (cardinals[word] === undefined && scales[word] === undefined) continue;
    const words = [word];
    let end = token.index + word.length;
    let j = i + 1;
    for (; j < tokens.length; j += 1) {
      const next = tokens[j];
      if (!next || !/^\s+$/.test(normalized.slice(end, next.index))) break;
      if (cardinals[next[0]] !== undefined || scales[next[0]] !== undefined || next[0] === 'virgula' || next[0] === 'ponto') {
        words.push(next[0]); end = next.index + next[0].length;
      } else if (next[0] === 'e' && tokens[j + 1] && (cardinals[tokens[j + 1]?.[0] ?? ''] !== undefined || scales[tokens[j + 1]?.[0] ?? ''] !== undefined)) {
        end = next.index + 1;
      } else break;
    }
    i = j - 1;
    // "um/uma" alone usually functions as an indefinite article, not a claim.
    // Treat it as a count for measurable lead quantities or explicit numerals.
    if (words.length === 1 && (word === 'um' || word === 'uma') && !/^(?:\s+)(?:avaliac\w*|cliente\w*|seguidor\w*|loja\w*|publicac\w*|post\w*|foto\w*|ano\w*|mes\w*|minuto\w*|estrela\w*|ponto\w*|unidade\w*|numero\w*)\b/.test(normalized.slice(end))) continue;
    const decimal = words.findIndex((w) => w === 'virgula' || w === 'ponto');
    const value = decimal < 0 ? integer(words) : Number(`${integer(words.slice(0, decimal))}.${words.slice(decimal + 1).every((w) => (cardinals[w] ?? 10) < 10) ? words.slice(decimal + 1).map((w) => cardinals[w]).join('') : integer(words.slice(decimal + 1))}`);
    out.push({ value, text: text.slice(token.index, end), start: token.index, end });
  }
  return out;
}

export function unsupportedNumbers(message: string, sources: string[]): string[] {
  const allowed = new Set(sources.flatMap(sourceNumbers).map((n) => n.value));
  return sourceNumbers(message).filter((number) => {
    // Exempt this occurrence only, never other occurrences of 2 in the message.
    if (number.text === '2' && /^\s+minutos\b/i.test(message.slice(number.end))) return false;
    return !allowed.has(number.value);
  }).map((number) => number.text);
}