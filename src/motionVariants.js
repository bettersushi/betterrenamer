// Shared framer-motion variants for the staggered macro-group entrance
// (toolbar -> sidebar -> main area) used by DashboardPage/SearchPage.

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

export const fadeItem = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
}
