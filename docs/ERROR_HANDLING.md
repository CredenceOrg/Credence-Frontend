# The App Rules for Loading, Empty, and Error Signs

When something happens on a screen, we must always use the exact same sign so users don't get confused!

## 🧭 Which sign do I use? (The Game Flow)

1. **Is the page still fetching data from the computer?**
   - ➡️ Use **`LoadingSkeleton`** (Grey blinking shapes that look like a page loading).
2. **Did the data load perfectly, but there is absolutely nothing there?**
   - ➡️ Use **`EmptyState`** (A nice graphic that says "Nothing here yet!").
3. **Did the whole page break or fail to load completely?**
   - ➡️ Use **`ErrorState`** (A screen with a big "Fix it" or "Retry" button).
4. **Did the page load fine, but there is a little warning message that needs to stay on screen?**
   - ➡️ Use **`Banner`** (An inline alert bar that stays put).
5. **Did the user just click a button, and you want to say "Saved!" or "Failed!" for a few seconds?**
   - ➡️ Use **`Toast`** (A little message bubble that pops up and slides away quickly).
6. **Did the screen totally crash and explode into a white screen?**
   - ➡️ The **`App Error Boundary`** will automatically catch it and show a full rescue page.

---

## 🛠️ Code Examples

### 1. LoadingSkeleton (Waiting blocks)

```tsx
// For a whole page
<LoadingSkeleton variant="page" rows={5} />

// For a small card block
<LoadingSkeleton variant="card" />
```
