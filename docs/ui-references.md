# UI references and credits

Design direction remains LsBarber charcoal/gold, informed by the Refero workflow.
User-requested references consulted for this implementation:

- [Rare UI Animated Counter](https://www.rareui.com/components/animatedcounter): rolling digits adapted to formatted BRL prices and dashboard metrics.
- [Rare UI Bounce Sidebar](https://www.rareui.com/components/bouncesidebar): shared spring indicator adapted to real router links.
- [shadcn Dialog](https://ui.shadcn.com/docs/components/base/dialog): composable dialog structure, title, overlay, close action and keyboard/focus handling. Implemented with Radix Dialog, not copied from the Base UI example.
- [shadcn Tabs](https://ui.shadcn.com/docs/components/base/tabs): visual grouping. Our selectors remain semantic toggle button groups, not incomplete ARIA tabs.
- [Transitions.dev](https://transitions.dev/): sliding pills, number transitions, short page entrances and modal scale/fade.

Motion components are original local implementations inspired by the documented interactions;
no paid source or registry code copied. Credit to [Rare UI](https://www.rareui.com/),
[shadcn/ui](https://ui.shadcn.com/) and [Transitions.dev](https://transitions.dev/).
Motion respects reduced-motion preferences, and business/store logic is unchanged.
