const ALLOW_OPTION = {
  type: 'array',
  items: { type: 'string' },
  uniqueItems: true,
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban dangerouslySetInnerHTML outside an explicit allowlist of wrapper components that have been reviewed for XSS safety.',
    },
    schema: [
      {
        type: 'object',
        properties: { allow: ALLOW_OPTION },
        additionalProperties: false,
      },
    ],
    messages: {
      notAllowed:
        'Using dangerouslySetInnerHTML is prohibited. If this component has been reviewed for XSS safety, add it to the `allow` list in eslint.config.js.',
    },
  },
  create(context) {
    const options = context.options[0] || {}
    const allowList = new Set(options.allow || [])

    const elementStack = []

    return {
      JSXOpeningElement(node) {
        elementStack.push(node)
      },
      'JSXOpeningElement:exit'() {
        elementStack.pop()
      },
      JSXAttribute(node) {
        if (
          !node.name ||
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'dangerouslySetInnerHTML'
        ) {
          return
        }

        const element = elementStack[elementStack.length - 1]
        if (!element) return

        let componentName
        if (element.name.type === 'JSXIdentifier') {
          componentName = element.name.name
        } else if (element.name.type === 'JSXMemberExpression') {
          componentName = `${element.name.object.name}.${element.name.property.name}`
        }

        if (!componentName || !allowList.has(componentName)) {
          context.report({ node, messageId: 'notAllowed' })
        }
      },
    }
  },
}
