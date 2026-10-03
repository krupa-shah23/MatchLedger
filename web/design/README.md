# Google Stitch design references

Each page designed in Google Stitch is exported to `web/design/<page-name>/` with its HTML, CSS, and screenshots.

These exports are visual references only. Do not ship or import their HTML directly. Rebuild the design in `web/src` as React 19 + TypeScript components, with React Router 7, TanStack Query 5, and the shared `useSocket` hook. Route guards must come from the browser-safe common package. API money is a decimal string and never uses float arithmetic; UI calculations are clearly labelled estimates. A 202 action stays pending until its outcome event arrives.
