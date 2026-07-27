# Footer & Disclaimer Link Manifest

This manifest lists the intended destinations and handoff notes for footer and disclaimer links in the UI. Use this as a single-source specification for engineering and legal to provide final URLs and content.

- Documentation
  - Intended route: `/docs` (internal docs) or canonical external docs site
  - Example (placeholder): `https://docs.example.com/credence`
  - Notes: Link should point to the official developer/user documentation. If docs are hosted in the repo under `/docs/`, route to that site or the rendered documentation location.
  - Status: Placeholder (UI shows "Coming soon")

- Terms of Service
  - Intended route: `/legal/terms` (site route) or external canonical legal page
  - Example (placeholder): `https://credence.org/legal/terms` or `/terms`
  - Notes: Final copy must be provided by Legal; include effective date and versioning.
  - Status: Placeholder (UI shows "Coming soon")

- Privacy Policy
  - Intended route: `/legal/privacy` (site route) or external canonical policy page
  - Example (placeholder): `https://credence.org/legal/privacy` or `/privacy`
  - Notes: Final copy must be provided by Legal/Compliance; ensure cookie/analytics disclosures as needed.
  - Status: Placeholder (UI shows "Coming soon")

- Full terms & conditions (Disclaimer)
  - Intended route: (same as Terms of Service) `/legal/terms` or canonical external link
  - Example (placeholder): `https://credence.org/legal/terms` or `/terms`
  - Notes: When available, update the `termsHref` prop for the `Disclaimer` component to the canonical URL.
  - Status: Placeholder (UI shows "Coming soon")

Handoff checklist for each link

- [ ] Confirm canonical URL with Legal/Docs owners.
- [ ] Provide final URL and (if external) add `rel="noopener noreferrer"` and `target="_blank"` where appropriate.
- [ ] Update component props or centralized config with final hrefs.
- [ ] Verify accessibility: visible focus, descriptive link text, and that links are keyboard-accessible.

Implementation notes

- Current treatment: placeholder links render as visually muted, non-interactive elements with `aria-disabled="true"` and `title="Coming soon"` to avoid false affordance.
- When final URLs are provided, replace `"#"` placeholders with real href values to render standard anchor tags.

Environment overrides (optional)

- You can override link targets at build/runtime using Vite environment variables. The resolution precedence is as follows:
  1. **Primary Environment Variable**: `VITE_{LINK_NAME}_URL` (e.g., `VITE_DOCS_URL`)
  2. **Legacy Environment Variable**: `VITE_{LINK_NAME}` (e.g., `VITE_DOCS`)
  3. **Default Path**: A hardcoded default path within the application.

- **Invalid Override Handling**: Empty strings (`""`), whitespace-only strings (`"   "`, `"\t"`), or `undefined` values for environment variables will be ignored, and the resolution will fall back to the next precedence level.

- **Supported Environment Variables**:
  - Docs:
    - `VITE_DOCS_URL` (Primary)
    - `VITE_DOCS` (Legacy)
  - Terms:
    - `VITE_TERMS_URL` (Primary)
    - `VITE_TERMS` (Legacy)
  - Privacy:
    - `VITE_PRIVACY_URL` (Primary)
    - `VITE_PRIVACY` (Legacy)

Example `.env`:

```
VITE_DOCS_URL=https://docs.credence.org
VITE_TERMS_URL=https://credence.org/legal/terms
VITE_PRIVACY_URL=https://credence.org/legal/privacy
```

Contact

For questions, contact the UI/UX owner or the legal/docs stakeholders responsible for final content.
