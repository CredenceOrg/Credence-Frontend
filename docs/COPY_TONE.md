# Copy Tone Guidelines — Empty & Error States

## Brand Voice

Credence speaks with **clarity, confidence, and calm**. Our copy should:

1. **Be direct** — Tell the user exactly what happened and what to do next
2. **Be human** — No jargon, no blame, no technical stack traces
3. **Be helpful** — Every message should include a path forward

## Tone Rules by State

### Empty States (Zero Data)

**Goal**: Acknowledge the blank state, explain what will appear here, and guide toward the next action.

| Rule | Example ✅ | Avoid ❌ |
|------|-----------|---------|
| Use "yet" to imply future content | "No active bonds yet" | "No bonds" |
| Describe what belongs here | "New trust score events will appear here once bonds or attestations occur" | "Empty list" |
| Offer a clear CTA | "Create your first bond" | "Click here" |
| Be encouraging | "Start building on-chain reputation" | "You have nothing" |

### Error States

**Goal**: Apologize briefly, explain the cause in plain language, and provide a recovery action.

| Rule | Example ✅ | Avoid ❌ |
|------|-----------|---------|
| Say what happened | "We could not load your bonds right now" | "Error 500" |
| Do not blame the user | "Something went wrong on our end" | "You entered invalid data" |
| Offer a fix | "Try again" or "Check your connection" | "Contact support" (only as last resort) |
| Keep it brief | 1-2 sentences max | Walls of text |

### Loading States

**Goal**: Set expectations for wait time without causing anxiety.

| Rule | Example ✅ | Avoid ❌ |
|------|-----------|---------|
| Be specific if possible | "Fetching bond data..." | "Loading..." |
| Use ellipsis for in-progress | "Submitting attestation..." | "Wait" |
| Do not over-explain | One line is enough | Paragraphs |

## Error Copy Templates

### Network Error
- **Title**: "Connection lost"
- **Description**: "We could not reach the server. Check your internet connection and try again."
- **CTA**: "Retry"

### API Error (5xx)
- **Title**: "Something went wrong"
- **Description**: "We are having trouble on our end. This is usually temporary — please try again in a moment."
- **CTA**: "Try again"

### Validation Error
- **Title**: "Check your input"
- **Description**: "Some fields need attention. Review the highlighted fields and try again."
- **CTA**: None (inline field errors guide user)

### Not Found (404)
- **Title**: "Page not found"
- **Description**: "The page you are looking for does not exist or has been moved."
- **CTA**: "Go to Dashboard"

### Unauthorized (401)
- **Title**: "Session expired"
- **Description**: "Your session has timed out for security. Please sign in again to continue."
- **CTA**: "Sign in"

### Rate Limited (429)
- **Title**: "Taking a short break"
- **Description**: "You have made too many requests. Please wait a moment before trying again."
- **CTA**: None (auto-resolves)

## Empty State Copy Templates

### Empty List (no CTA)
- **Title**: "Nothing here yet"
- **Description**: "[Items] will appear here once [condition]. Check back soon."
- **Example**: "Transactions will appear here once you create a bond or receive an attestation."

### Empty List (with CTA)
- **Title**: "Get started"
- **Description**: "You do not have any [items] yet. [One-line value prop]."
- **CTA**: "Create your first [item]"

### Empty Search
- **Title**: "No results found"
- **Description**: "We could not find anything matching your search. Try a different search term."
- **CTA**: "Clear search"

## Accessibility Notes

- Error messages must be announced to screen readers via role="alert" or aria-live="polite"
- CTA buttons must have descriptive labels (not just "Click here")
- Copy should never rely solely on color to convey meaning
- Use semantic headings (h2, h3) in empty states for screen reader navigation