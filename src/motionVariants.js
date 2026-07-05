// Shared framer-motion variants for the staggered macro-group entrance
// (toolbar -> sidebar -> main area) used by DashboardPage/SearchPage.

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.16, delayChildren: 0.08 } },
}

export const fadeItem = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

// Lighter stagger for small in-page item collections (e.g. subfolder grid tiles)
export const staggerContainerFast = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0 } },
}

// Slide-in from the left + fade, used for folder tiles in the subfolder grid
export const slideFadeItem = {
  hidden: { opacity: 0, x: -18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
}
