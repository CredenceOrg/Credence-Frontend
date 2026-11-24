import { describe, it, expect } from 'vitest';
import config from './eslint.config.js';
import { ESLint } from 'eslint';

describe('eslint.config.js', () => {
  it('should be a valid array of config objects', () => {
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });

  it('should include necessary ignores', () => {
    const ignoreConfig = config.find(c => c.ignores);
    expect(ignoreConfig).toBeDefined();
    expect(ignoreConfig.ignores).toContain('dist');
    expect(ignoreConfig.ignores).toContain('node_modules');
  });

  it('should flag dangerouslySetInnerHTML via local rule', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
    const results = await eslint.lintText(`
      import React from 'react';
      export const Test = () => <div dangerouslySetInnerHTML={{ __html: "a" }} />;
    `, { filePath: 'test.tsx' });
    
    const error = results[0].messages.find(m => m.ruleId === 'local/no-dangerously-set-inner-html');
    expect(error).toBeDefined();
  });
  
  it('should handle unused variables correctly', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
    const results = await eslint.lintText(`
      const unused = 1;
      const _unused = 2;
    `, { filePath: 'test.ts' });
    
    const errors = results[0].messages.filter(m => m.ruleId === '@typescript-eslint/no-unused-vars');
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("'unused' is assigned a value but never used");
  });
  
  it('should parse valid node mjs without errors', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
    const results = await eslint.lintText(`
      import fs from 'node:fs';
      console.log(fs);
    `, { filePath: 'test.mjs' });
    
    const errors = results[0].messages.filter(m => m.severity === 2);
    // console might be allowed, but we just check it doesn't fail parsing.
    const parseErrors = results[0].messages.filter(m => m.fatal);
    expect(parseErrors.length).toBe(0);
  });

  // Boundary and error state tests
  it('should fail elegantly or report error on invalid js', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
    const results = await eslint.lintText(`
      const a = ;
    `, { filePath: 'test.ts' });
    
    const parseErrors = results[0].messages.filter(m => m.fatal);
    expect(parseErrors.length).toBeGreaterThan(0);
  });

  it('should recover / handle multiple files safely', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
    
    const files = [
      { code: 'const a = 1;', filePath: 'test1.ts' },
      { code: 'const a = ;', filePath: 'test2.ts' }
    ];

    const results1 = await eslint.lintText(files[0].code, { filePath: files[0].filePath });
    const results2 = await eslint.lintText(files[1].code, { filePath: files[1].filePath });

    expect(results1[0].messages.filter(m => m.fatal).length).toBe(0);
    expect(results2[0].messages.filter(m => m.fatal).length).toBeGreaterThan(0);
  });
});
