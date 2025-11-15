# Modern CSS Architecture

This document describes the modern CSS architecture implemented in kb2midi for better maintainability, mobile compatibility, and developer experience.

## Architecture Overview

The new architecture uses **CSS Modules + CSS Custom Properties (Variables)** for a modern, performant, and maintainable styling system.

### Key Benefits

✅ **Scoped Styles** - CSS Modules prevent naming conflicts
✅ **Type Safety** - TypeScript support for CSS classes
✅ **Mobile-First** - Responsive design with proper touch targets (44px+)
✅ **Performance** - Zero runtime overhead, native CSS features
✅ **Maintainability** - Organized by component, easy to update
✅ **Accessibility** - ARIA-compliant, reduced motion support
✅ **Theming** - CSS Custom Properties for easy theme changes

## File Structure

```
src/styles/
├── variables.css           # Design tokens (colors, spacing, typography)
├── base.css               # Global reset and foundational styles
├── main.css               # Main entry point
├── layout.module.css      # Layout components (header, status, etc.)
├── controls.module.css    # Form controls and buttons
├── piano.module.css       # Piano keyboard and key mapping
├── particles.module.css   # Particle effects canvas
└── ui-classes.ts          # TypeScript helper for CSS modules
```

## Design Tokens (CSS Custom Properties)

All design tokens are defined in `variables.css` using CSS Custom Properties:

### Color System
```css
--color-primary: #667eea;
--color-success: #4CAF50;
--color-error: #f44336;
--color-warning: #FFC107;
```

### Spacing Scale (8px grid)
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
```

### Typography
```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-size-xs: 0.625rem;   /* 10px */
--font-size-base: 0.875rem; /* 14px */
--font-size-3xl: 2.5rem;    /* 40px */
```

### Transitions
```css
--transition-fast: 0.1s ease;
--transition-base: 0.2s ease;
--transition-slow: 0.3s ease;
```

## CSS Modules Usage

### TypeScript Integration

Import CSS modules in TypeScript:

```typescript
import { uiClasses } from './styles/ui-classes';

// Apply classes to elements
element.className = uiClasses.button('primary');
element.className = uiClasses.key('white', isActive);
```

### Helper Functions

```typescript
import { classNames, toggleClass, applyClasses } from './styles/ui-classes';

// Combine multiple classes
const classes = classNames(
  'base-class',
  condition && 'conditional-class',
  anotherClass
);

// Toggle a class based on condition
toggleClass(element, 'active', isActive);

// Apply multiple classes at once
applyClasses(element, 'class1', 'class2', condition && 'class3');
```

## Mobile-First Design

### Responsive Breakpoints

```css
/* Mobile-first approach - base styles are for mobile */

/* Tablet and up */
@media (max-width: 768px) {
  /* Tablet-specific styles */
}

/* Mobile only */
@media (max-width: 480px) {
  /* Mobile-specific styles */
}
```

### Touch Targets

All interactive elements meet mobile accessibility standards:

- **Minimum touch target**: 44x44px (iOS recommendation)
- **Comfortable target**: 48x48px (Material Design)
- **Touch-friendly spacing**: Adequate gaps between elements

### Mobile Optimizations

1. **Viewport Meta Tag**
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
   ```

2. **Prevent Pull-to-Refresh**
   ```css
   body {
     overscroll-behavior-y: none;
   }
   ```

3. **Smooth Scrolling on iOS**
   ```css
   overflow-x: auto;
   -webkit-overflow-scrolling: touch;
   ```

4. **Disable Tap Highlight**
   ```css
   -webkit-tap-highlight-color: transparent;
   ```

5. **Dynamic Viewport Height**
   ```css
   min-height: 100dvh; /* Mobile browsers with address bar */
   ```

## Accessibility Features

### Focus States
All interactive elements have visible focus states:
```css
:focus-visible {
  outline: 2px solid var(--color-success);
  outline-offset: 2px;
}
```

### Reduced Motion Support
Respects user's motion preferences:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Reader Support
Utility class for visually hidden but screen reader accessible content:
```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  /* ... */
}
```

## Performance Optimizations

### Hardware Acceleration
```css
transform: translateZ(0);
will-change: transform;
```

### Efficient Animations
Uses CSS animations over JavaScript:
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Image Rendering
Optimized for mobile:
```css
image-rendering: -webkit-optimize-contrast;
```

## Browser Compatibility

- ✅ Chrome/Edge (Latest 2 versions)
- ✅ Safari (Latest 2 versions)
- ✅ Firefox (Latest 2 versions)
- ✅ Mobile Safari (iOS 14+)
- ✅ Chrome Mobile (Android 9+)

## Migration from Old CSS

### Old Approach (Single CSS File)
```html
<link rel="stylesheet" href="styles.css">
<div class="control-group">...</div>
```

### New Approach (CSS Modules)
```html
<link rel="stylesheet" href="/src/styles/main.css">
```

```typescript
import { uiClasses } from './styles/ui-classes';
element.className = uiClasses.controlGroup();
```

## Theming Support

All colors use CSS Custom Properties, making theme changes easy:

```css
/* Light theme */
:root {
  --color-primary: #667eea;
  --color-background: #ffffff;
}

/* Dark theme (already default) */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #667eea;
    --color-background: #1a1a1a;
  }
}
```

## Best Practices

1. **Always use design tokens** - Never hardcode values
2. **Mobile-first** - Write base styles for mobile, add desktop enhancements
3. **Use CSS Modules** - Import and use typed classes
4. **Leverage helpers** - Use `classNames()` and `toggleClass()`
5. **Test on mobile** - Always test responsive behavior
6. **Respect accessibility** - Follow WCAG 2.1 guidelines
7. **Optimize for performance** - Use CSS animations, avoid layout thrashing

## Future Enhancements

- [ ] Add dark/light theme toggle
- [ ] Implement CSS-in-JS for dynamic theming (optional)
- [ ] Add more design tokens for advanced theming
- [ ] Create component-specific CSS utilities
- [ ] Add CSS Grid for complex layouts
- [ ] Implement container queries (when browser support improves)

## Resources

- [CSS Modules Documentation](https://github.com/css-modules/css-modules)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [Mobile Web Best Practices](https://developers.google.com/web/fundamentals/design-and-ux/principles)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
