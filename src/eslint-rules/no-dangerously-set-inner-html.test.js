import { RuleTester } from 'eslint'
import rule from './no-dangerously-set-inner-html.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
})

ruleTester.run('no-dangerously-set-inner-html', rule, {
  valid: [
    {
      code: '<SafeHTML dangerouslySetInnerHTML={{ __html: "<p>hello</p>" }} />',
      options: [{ allow: ['SafeHTML'] }],
    },
  ],
  invalid: [
    {
      code: '<div dangerouslySetInnerHTML={{ __html: "<p>hi</p>" }} />',
      errors: [{ messageId: 'notAllowed' }],
    },
    {
      code: '<span dangerouslySetInnerHTML={{ __html: "text" }} />',
      errors: [{ messageId: 'notAllowed' }],
    },
  ],
})
