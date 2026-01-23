# FReD Apps Style Rules

This document outlines the design system and theme rules for the FReD static apps to maintain visual consistency.

---

## Color Palette

### Primary Colors (Branding)
| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--fred-primary` | `#3F0508` | `#3F0508` | Header backgrounds, primary buttons, active sidebar nav |
| `--fred-primary-dark` | `#2A0305` | `#2A0305` | Header gradient end, button hover states |
| `--fred-primary-light` | `#5C1015` | `#7A2530` | Subtle accents |

### Accent Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--fred-accent-teal` | `#4DCCD0` | Success/significant indicators, effect count badge, dark mode active tabs |
| `--fred-accent-coral` | `#FA948C` | Failure/not significant indicators |

### Outcome Colors
| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--fred-success` | `#8FBC8F` | `#6BA86B` | Replication success outcomes |
| `--fred-failure` | `#FF7F7F` | `#E06060` | Replication failure outcomes |
| `--fred-failure-reversal` | `darkred` | `darkred` | Reversal outcomes |
| `--fred-not-significant` | `#D3D3D3` | `#888888` | Original study not significant |
| `--fred-not-coded` | `#C8C8C8` | `#666666` | Outcome not yet coded |
| `--fred-mixed` | `#efa986` | `#efa986` | Mixed results |

### UI Colors
| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--fred-bg` | `#FEFDF6` (warm cream) | `#1A1D1E` | Page background |
| `--fred-bg-alt` | `#F5F4ED` | `#242829` | Sidebar, footer, alternating rows |
| `--fred-bg-card` | `#FFFFFF` | `#2A2E30` | Card backgrounds |
| `--fred-border` | `#E5E3D8` | `#3A3E40` | Borders, dividers |
| `--fred-text` | `#212529` | `#E8E6E1` | Primary text |
| `--fred-text-muted` | `#6c757d` | `#9A9890` | Secondary text, labels |

### Chart Colors
| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--fred-chart-bg` | `#FFFFFF` | `#2A2E30` | Plotly paper/plot background |
| `--fred-chart-grid` | `#E5E3D8` | `#3A3E40` | Chart gridlines |
| `--fred-chart-text` | `#212529` | `#E8E6E1` | Axis labels, titles |

---

## Typography

- **Font Family**: System fonts (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
- **Base Size**: 16px (1rem)
- **Line Height**: 1.5

### Headings
| Level | Size |
|-------|------|
| h1 | 2rem |
| h2 | 1.75rem |
| h3 | 1.5rem |
| h4 | 1.25rem |
| h5 | 1.125rem |
| h6 | 1rem |

---

## Component Rules

### Cards
- Background: `var(--fred-bg-card)`
- Border: `1px solid var(--fred-border)`
- Border radius: `0.75rem`
- Shadow: `var(--fred-shadow)`
- Transition: `0.2s ease` on shadow and background

### Buttons
- **Primary**: Background `var(--fred-primary)`, white text
- **Secondary**: Background `var(--fred-bg)`, border `var(--fred-border)`
- Border radius: `0.25rem`
- Padding: `0.5rem 1rem`

### Form Controls
- Background: `var(--fred-bg-card)` (adapts to theme)
- Border: `1px solid var(--fred-border)`
- Border radius: `0.25rem`
- Focus: Border color `var(--fred-primary)` (light) or `var(--fred-accent-teal)` (dark)

### Sidebar Navigation
- Section titles: Uppercase, `0.75rem`, `var(--fred-text-muted)`
- Nav links: `0.9375rem`, `500` weight
- Active state: Background `var(--fred-primary)`, white text
- Hover state: Background `var(--fred-bg-card)`

### Tabs (Annotator)
- Light mode active: `var(--fred-primary)` color and border
- Dark mode active: `var(--fred-accent-teal)` color and border (for visibility)

### Effect Count Badge
- Label: `0.8125rem`, `var(--fred-text-muted)`
- Number: `1.25rem`, `700` weight, `var(--fred-accent-teal)`

---

## Theme Toggle Behavior

1. **Initialization**: Check `localStorage` for saved preference, fall back to system preference
2. **Persistence**: Save to `localStorage` key `fred-theme`
3. **Application**: Set `data-theme` attribute on `<html>` element
4. **Charts**: Dispatch `themechange` event for Plotly chart re-rendering

### Icon States
- Light mode (cream background): Show **moon** icon (click to go dark)
- Dark mode (dark background): Show **sun** icon (click to go light)

---

## Plotly Chart Theming

When creating Plotly charts, use `FReD.themeToggle.getPlotlyLayout()` to get theme-aware colors:

```javascript
const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

const layout = {
  paper_bgcolor: themeLayout.paper_bgcolor,
  plot_bgcolor: themeLayout.plot_bgcolor,
  font: themeLayout.font,
  xaxis: {
    // ... your axis config
    gridcolor: themeLayout.xaxis?.gridcolor,
    linecolor: themeLayout.xaxis?.linecolor
  },
  // ... etc
};
```

### Re-rendering on Theme Change
Charts should listen for the `themechange` event and re-render:

```javascript
window.addEventListener('themechange', () => {
  if (this.lastData) {
    this.render(this.lastData);
  }
});
```

---

## Logo

Use the FORRT avatar logo from:
```
https://forrt.org/author/forrt/avatar_hu8bc9dda6369ea35e3d2850cf7115c3e5_11296_270x270_fill_q100_h2_lanczos_center_2.webp
```

- Header size: `50px` height, `border-radius: 8px`
- Landing page hero: `80px` width/height, `border-radius: 12px`

---

## Shadows

| Variable | Light Mode | Dark Mode |
|----------|------------|-----------|
| `--fred-shadow` | `0 2px 8px rgba(63, 5, 8, 0.08)` | `0 2px 8px rgba(0, 0, 0, 0.3)` |
| `--fred-shadow-lg` | `0 4px 16px rgba(63, 5, 8, 0.12)` | `0 4px 16px rgba(0, 0, 0, 0.4)` |

---

## Transitions

Standard transition: `var(--fred-transition)` = `0.2s ease`

Apply to:
- Background color changes
- Border color changes
- Box shadow changes
- Color changes

---

## Responsive Breakpoints

| Breakpoint | Usage |
|------------|-------|
| `992px` | Sidebar layout collapses to single column |
| `768px` | Mobile adjustments, card headers stack vertically |
| `576px` | Reduce base font size to 14px |

---

## Dark Mode CSS Pattern

Use the `[data-theme="dark"]` selector for dark mode overrides:

```css
/* Light mode (default) */
.my-element {
  background: var(--fred-bg-card);
  color: var(--fred-text);
}

/* Dark mode override (only if needed beyond CSS variables) */
[data-theme="dark"] .my-element {
  /* Special dark mode styling */
}
```

Most components should work automatically with CSS variables. Only use explicit dark mode selectors for:
- Third-party components (DataTables)
- SVG/image adjustments
- Special visibility requirements (like active tabs)
