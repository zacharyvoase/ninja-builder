import { NinjaBuildFile } from './index';
import { assert } from 'chai';
import dedent from 'dedent-js';

describe('NinjaBuild', () => {
  it('produces an empty file', () => {
    const ninja = new NinjaBuildFile();
    check('', ninja);
  });

  it('asserts a minimum version', () => {
    const ninja = new NinjaBuildFile({ requiredVersion: '1.7' });
    check(
      `
      ninja_required_version = 1.7
      `,
      ninja
    );
  });

  it('sets a builddir', () => {
    const ninja = new NinjaBuildFile({
      requiredVersion: '1.7',
      builddir: 'dist',
    });
    check(
      `
      ninja_required_version = 1.7
      builddir = dist
      `,
      ninja
    );
  });

  it('sets one default output', () => {
    const ninja = new NinjaBuildFile({
      requiredVersion: '1.7',
      builddir: 'dist',
      default: 'a.out',
    });
    check(
      `
      ninja_required_version = 1.7
      builddir = dist
      default a.out
      `,
      ninja
    );
  });

  it('sets multiple default rules', () => {
    const ninja = new NinjaBuildFile({
      requiredVersion: '1.7',
      builddir: 'dist',
      default: ['foo', 'bar'],
    });
    check(
      `
      ninja_required_version = 1.7
      builddir = dist
      default foo bar
      `,
      ninja
    );
  });

  it('defines a binding', () => {
    const ninja = new NinjaBuildFile({
      requiredVersion: '1.7',
      builddir: 'dist',
      default: ['foo', 'bar'],
    });
    ninja.bind('cflags', '-Wall');
    check(
      `
      ninja_required_version = 1.7
      builddir = dist
      cflags = -Wall
      default foo bar
      `,
      ninja
    );
  });

  it('defines a rule', () => {
    const ninja = new NinjaBuildFile({
      requiredVersion: '1.7',
      builddir: 'dist',
      default: ['foo', 'bar'],
    });
    ninja.rule('cc', 'cc $in -o $out');
    check(
      `
      ninja_required_version = 1.7
      builddir = dist
      rule cc
        command = cc $in -o $out
      default foo bar
      `,
      ninja
    );
  });

  it('defines a build edge', () => {
    const ninja = new NinjaBuildFile({
      requiredVersion: '1.7',
      builddir: 'dist',
      default: ['foo', 'bar'],
    });
    ninja.build('foo', 'cc', 'bar');
    check(
      `
      ninja_required_version = 1.7
      builddir = dist
      build foo: cc bar
      default foo bar
      `,
      ninja
    );
  });

  it('adds raw strings/comments/etc. to the output', () => {
    const ninja = new NinjaBuildFile({
      requiredVersion: '1.7',
      default: 'hello',
    });
    ninja.bind('cflags', '-Wall');
    ninja.raw('# This is a poor implementation of a cc rule.');
    ninja.rule('cc', 'cc $cflags $in -o $out');
    ninja.raw('# This is also not that great.');
    ninja.build('hello', 'cc', 'hello.c');
    check(
      `
      ninja_required_version = 1.7
      cflags = -Wall
      # This is a poor implementation of a cc rule.
      rule cc
        command = cc $cflags $in -o $out
      # This is also not that great.
      build hello: cc hello.c
      default hello
      `,
      ninja
    );
  });
});

function check(expected: string, ninja: { toString(): string }) {
  assert.strictEqual(ninja.toString().trimEnd(), dedent(expected).trimEnd());
}
