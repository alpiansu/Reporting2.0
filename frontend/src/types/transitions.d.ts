declare module '@/components/transitions' {
  import type { App } from 'vue';

  const _default: {
    install(app: App): void;
  };

  export default _default;

  export const PageTransition: any;
  export const AnimatedElement: any;
  export const PageTitle: any;
}
