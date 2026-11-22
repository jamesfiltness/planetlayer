// The expression language of Calculate property (shared/expression.js):
// what it parses to, and the mistakes it explains.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ExpressionError, parseExpression } from '../../shared/expression.js';
import { expressionProperties } from '../properties/expressionSql.js';

const fails = (text, message) =>
  assert.throws(() => parseExpression(text), (error) => error instanceof ExpressionError && message.test(error.message));

describe('expressions', () => {
  test('numbers, properties and the order of operations', () => {
    assert.deepEqual(parseExpression('1 + pop * 2'), {
      type: 'binary', op: '+',
      left: { type: 'number', value: 1 },
      right: { type: 'binary', op: '*', left: { type: 'property', name: 'pop' }, right: { type: 'number', value: 2 } },
    });
    assert.deepEqual(parseExpression('(1 + 2) / 3').left, parseExpression('1 + 2'), 'brackets come first');
    assert.deepEqual(parseExpression('8 - 4 - 2').left, parseExpression('8 - 4'), 'and the same operators go left to right');
  });

  test('number forms, and a leading minus', () => {
    for (const [text, value] of [['12', 12], ['0.5', 0.5], ['.5', 0.5], ['1e3', 1000], ['2.', 2]]) {
      assert.deepEqual(parseExpression(text), { type: 'number', value }, text);
    }
    assert.deepEqual(parseExpression('-x'), { type: 'negate', arg: { type: 'property', name: 'x' } });
  });

  test('a quoted property name may hold anything, with "" for a quote', () => {
    assert.deepEqual(parseExpression('"area sq km"'), { type: 'property', name: 'area sq km' });
    assert.deepEqual(parseExpression('"say ""hi"""'), { type: 'property', name: 'say "hi"' });
    assert.deepEqual(parseExpression('"round"'), { type: 'property', name: 'round' }, 'even a function\'s name');
  });

  test('functions, in any case, with the right number of values', () => {
    assert.deepEqual(parseExpression('ROUND(x, 1)'), { type: 'call', name: 'round', args: [{ type: 'property', name: 'x' }, { type: 'number', value: 1 }] });
    assert.equal(parseExpression('max(a, b, c)').args.length, 3);
    fails('abs(1, 2)', /abs\(\) takes 1 value/);
    fails('round()', /round\(\) takes 1 or 2 values/);
    fails('min(1)', /min\(\) takes at least 2 values/);
    fails('sqrt(4)', /no function "sqrt"/);
    assert.deepEqual(parseExpression('number("pop est")'), { type: 'call', name: 'number', args: [{ type: 'property', name: 'pop est' }] });
    fails('number(pop * 2)', /number\(\) takes a property's name/);
  });

  test('mistakes say what and where', () => {
    fails('', /Write an expression/);
    fails('   ', /Write an expression/);
    fails(42, /Write an expression/);
    fails('1 +', /ends too soon/);
    fails('1 2', /Unexpected "2" at character 3/);
    fails('(1 + 2', /Expected "\)" at the end/);
    fails('a % b', /Unexpected "%" at character 3/);
    fails('"open', /no closing "/);
    fails('1e999', /too large/);
    fails('x'.repeat(1001), /at most 1000 characters/);
    fails(`${'('.repeat(60)}1${')'.repeat(60)}`, /nested too deeply/);
  });

  test('the properties an expression reads, each once', () => {
    assert.deepEqual(expressionProperties(parseExpression('a + max(b, "c d", a) / -b')), ['a', 'b', 'c d']);
  });
});
