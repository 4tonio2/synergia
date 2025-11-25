# Plode Care - Design Guidelines

## Design Approach
**Reference-Based**: Medical/Healthcare SaaS applications (Epic, Healthie, Zocdoc) - prioritizing trust, clarity, and professional credibility. Clean, accessible interfaces that emphasize security and compliance.

## Core Design Principles
- **Medical Trust**: Professional, secure, compliant aesthetic
- **Clarity First**: Clear hierarchy, no decorative distractions
- **Accessibility**: WCAG AA minimum for healthcare context

## Typography
- **Primary Font**: Inter or Outfit (Google Fonts) - modern sans-serif
- **App Name "Plode Care"**: font-bold, text-2xl to text-3xl
- **Headings**: font-semibold, text-xl to text-2xl
- **Body**: font-normal, text-base
- **Labels**: font-medium, text-sm
- **Footer Legal**: text-xs, font-normal

## Layout System
**Spacing Units**: Tailwind units of 4, 6, 8, 12, 16, 20
- Component padding: p-4 to p-8
- Section spacing: space-y-6 to space-y-8
- Form field gaps: gap-4 to gap-6

**Layout Structure**:
- Centered authentication card (max-w-md)
- Generous whitespace around main form
- Mobile: full-width with px-4 padding
- Desktop: centered card with shadow

## Component Library

### Logo & Branding
- Medical cross icon: cyan (#06B6D4) + navy (#1E40AF) gradient
- Size: w-10 h-10 or w-12 h-12
- Position: Top center of auth card with app name beside/below

### Role Selection Buttons (Pre-Login)
- Grid layout: grid-cols-2 gap-3 (mobile) / grid-cols-4 gap-4 (desktop)
- Unselected: border-2 border-gray-300, bg-white, hover:border-cyan-500
- Selected: border-2 border-cyan-600, bg-cyan-50, font-semibold
- Height: py-3 to py-4
- Icons: Simple profession icons (Heroicons) above text
- Transition: all 200ms for selection state

### Form Inputs
- Border: border border-gray-300, focus:ring-2 focus:ring-cyan-500
- Padding: px-4 py-3
- Rounded: rounded-lg
- Full width: w-full
- Text: text-base
- Error state: border-red-500, focus:ring-red-500

### Buttons
**Primary (Login)**:
- bg-cyan-600 hover:bg-cyan-700
- text-white, font-semibold
- px-6 py-3, rounded-lg
- w-full
- Transition: all 200ms

**Secondary (Google SSO)**:
- border-2 border-gray-300, bg-white
- hover:bg-gray-50
- Google logo icon (from CDN or Heroicons globe-alt)
- flex items-center justify-center gap-2
- w-full

**Text Link (Create Account)**:
- text-cyan-600 hover:text-cyan-700
- underline decoration-1
- font-medium, text-sm

### Card Container
- bg-white
- rounded-xl or rounded-2xl
- shadow-lg to shadow-xl
- p-8 to p-10 (desktop), p-6 (mobile)
- max-w-md mx-auto

### Footer Compliance Badge
- Text: "Données de santé – conforme RGPD / hébergement HDS"
- Centered, text-xs, text-gray-500
- Optional lock icon (Heroicons lock-closed)
- Positioned outside/below main card

## Page Structure
1. **Header Area**: Logo + "Plode Care" branding (centered, pt-8 to pt-12)
2. **Main Card**: White elevated card containing all auth UI
3. **Card Content**:
   - Heading: "Se connecter" (text-2xl, font-bold, mb-6)
   - Instruction: "Choisissez votre rôle :" (text-sm, font-medium, mb-3)
   - Role buttons grid (mb-6)
   - Email input field (mb-4)
   - Password input field (mb-6)
   - Primary login button (mb-3)
   - Divider with "ou" text (mb-3)
   - Google SSO button (mb-4)
   - Create account link (text-center)
4. **Footer**: RGPD/HDS compliance text (mt-8 to mt-12)

## Background
- Light gradient: from-gray-50 to-gray-100
- OR solid bg-gray-50
- Full viewport height with flex centering

## Icons
**Library**: Heroicons (outline style via CDN)
- Medical cross: Custom SVG with cyan/navy gradient
- Role icons: user-group, beaker, heart, users (assigned appropriately)
- Lock icon for footer
- Google logo for SSO

## Animations
**Minimal, purposeful only**:
- Role button selection: scale-105 on active
- Input focus: ring appearance (default Tailwind)
- Button hover: subtle background color shift
- NO loading spinners unless auth takes >1s

## Accessibility
- All inputs have associated labels (may be sr-only for clean design)
- Role buttons use aria-pressed for selected state
- Focus visible on all interactive elements (ring-2)
- Minimum touch target: 44x44px for buttons
- High contrast text: minimum 4.5:1 ratio

## Images
**No hero image needed** - This is a focused authentication page where trust and form clarity are paramount. The medical cross logo and clean card layout provide sufficient visual identity without competing imagery.