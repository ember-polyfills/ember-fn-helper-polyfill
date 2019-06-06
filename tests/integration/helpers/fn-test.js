import { module, test, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, setupOnerror } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Component from '@ember/component';
import { helper } from '@ember/component/helper';
import { DEBUG } from '@glimmer/env';
import { run } from '@ember/runloop';

const HAS_NATIVE_PROXY = typeof Proxy === 'function';

module('Integration | Helper | fn', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.owner.register('helper:invoke', helper(function([fn]) {
      return fn();
    }));

    let testContext = this;
    this.owner.register('component:stash', Component.extend({
        init() {
          this._super(...arguments);
          testContext.stashedFn = this.stashedFn;
        },
      }),
    );
  });

  test('updates when arguments change', async function(assert) {
    this.set('myFunc', (arg1, arg2) => {
        return `arg1: ${arg1}, arg2: ${arg2}`;
    });
    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    await render(hbs`{{invoke (fn this.myFunc this.arg1 this.arg2)}}`);

    assert.dom().hasText('arg1: foo, arg2: bar');

    this.set('arg1', 'qux');

    assert.dom().hasText('arg1: qux, arg2: bar');

    this.set('arg2', 'derp');

    assert.dom().hasText('arg1: qux, arg2: derp');

    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    assert.dom().hasText('arg1: foo, arg2: bar');
  });

  test('updates when the function changes', async function(assert) {
    let func1 = (arg1, arg2) => `arg1: ${arg1}, arg2: ${arg2}`;
    let func2 = (arg1, arg2) => `arg2: ${arg2}, arg1: ${arg1}`;

    this.set('myFunc', func1);

    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    await render(hbs`{{invoke (fn this.myFunc this.arg1 this.arg2)}}`);

    assert.dom().hasText('arg1: foo, arg2: bar');

    this.set('myFunc', func2);
    assert.dom().hasText('arg2: bar, arg1: foo');

    this.set('myFunc', func1);
    assert.dom().hasText('arg1: foo, arg2: bar');
  });

  test('a stashed fn result update arguments when invoked', async function(assert) {
    this.set('myFunc', (arg1, arg2) => {
        return `arg1: ${arg1}, arg2: ${arg2}`;
    });
    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    await render(hbs`{{stash stashedFn=(fn this.myFunc this.arg1 this.arg2)}}`);

    assert.equal(this.stashedFn(), 'arg1: foo, arg2: bar');

    this.set('arg1', 'qux');
    assert.equal(this.stashedFn(), 'arg1: qux, arg2: bar');

    this.set('arg2', 'derp');
    assert.equal(this.stashedFn(), 'arg1: qux, arg2: derp');

    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    assert.equal(this.stashedFn(), 'arg1: foo, arg2: bar');
  });

  test('a stashed fn result invokes the correct function when the bound function changes', async function(assert) {
    let func1 = (arg1, arg2) => `arg1: ${arg1}, arg2: ${arg2}`;
    let func2 = (arg1, arg2) => `arg2: ${arg2}, arg1: ${arg1}`;

    this.set('myFunc', func1);

    this.set('arg1', 'foo');
    this.set('arg2', 'bar');


    await render(hbs`{{stash stashedFn=(fn this.myFunc this.arg1 this.arg2)}}`);

    assert.equal(this.stashedFn(), 'arg1: foo, arg2: bar');

    this.set('myFunc', func2);
    assert.equal(this.stashedFn(), 'arg2: bar, arg1: foo');

    this.set('myFunc', func1);
    assert.equal(this.stashedFn(), 'arg1: foo, arg2: bar');
  });

  test('asserts if the first argument is not a function', async function(assert) {
    assert.expect(1);

    setupOnerror(function(error) {
      assert.equal(error.message, 'Assertion Failed: You must pass a function as the `fn` helpers first argument, you passed null');
    });

    this.set('myFunc', null);
    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    await render(hbs`{{invoke (fn this.myFunc this.arg1 this.arg2)}}`);
  });


  test('asserts if the provided function accesses `this` without being bound prior to passing to fn', async function(assert) {
    if (!HAS_NATIVE_PROXY || !DEBUG) {
      assert.expect(0);
      return;
    }

    this.set('myFunc', function(arg1) {
      return `arg1: ${arg1}, arg2: ${this.arg2}`;
    });
    this.set('arg1', 'foo');
    this.set('arg2', 'bar');
    await render(hbs`{{stash stashedFn=(fn this.myFunc this.arg1)}}`);

    assert.throws(() => {
      this.stashedFn();
    }, /You accessed `this.arg2` from a function passed to the `fn` helper, but the function itself was not bound to a valid `this` context. Consider updating to usage of `@action`./);
  });

  test('there is no `this` context within the callback', async function(assert) {
    if (DEBUG && HAS_NATIVE_PROXY) {
      assert.expect(0);
      return;
    }

    this.set('myFunc', function() {
      assert.strictEqual(this, null, 'this is bound to null in production builds');
    });

    await render(hbs`{{stash stashedFn=(fn this.myFunc this.arg1)}}`);

    this.stashedFn();
  });

  test('can use `this` if bound prior to passing to fn', async function(assert) {
    this.set('myFunc', function(arg1) {
      return `arg1: ${arg1}, arg2: ${this.arg2}`;
    });
    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    await render(hbs`{{stash stashedFn=(fn (action this.myFunc) this.arg1)}}`);

    assert.equal(this.stashedFn(), 'arg1: foo, arg2: bar');
  });

  test('partially applies each layer when nested [emberjs/ember.js#17959]', async function(assert) {
    this.set('myFunc', (arg1, arg2, arg3) => {
      return `arg1: ${arg1}, arg2: ${arg2}, arg3: ${arg3}`;
    });
    this.set('arg1', 'foo');
    this.set('arg2', 'bar');
    this.set('arg3', 'qux');

    await render(hbs`{{invoke (fn (fn (fn this.myFunc this.arg1) this.arg2) this.arg3)}}`);

    assert.dom().hasText('arg1: foo, arg2: bar, arg3: qux');

    this.set('arg1', 'qux');
    assert.dom().hasText('arg1: qux, arg2: bar, arg3: qux');

    this.set('arg2', 'derp');
    assert.dom().hasText('arg1: qux, arg2: derp, arg3: qux');

    this.set('arg3', 'huzzah');
    assert.dom().hasText('arg1: qux, arg2: derp, arg3: huzzah');

    this.set('arg1', 'foo');
    this.set('arg2', 'bar');
    this.set('arg3', 'qux');

    assert.dom().hasText('arg1: foo, arg2: bar, arg3: qux');
  });

  // this can't easily be polyfilled because our helper does not receive
  // the mut reference, it receives the raw value
  skip('can be used on the result of `mut`', async function(assert) {
    this.set('arg1', 'foo');
    this.set('arg2', 'bar');

    await render(hbs`{{this.arg1}}{{stash stashedFn=(fn (mut this.arg1) this.arg2)}}`);

    assert.dom().hasText('foo');

    run(this.stashedFn);

    assert.dom().hasText('bar');
  });
});
