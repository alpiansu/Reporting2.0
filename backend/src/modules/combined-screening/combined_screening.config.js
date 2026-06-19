/**
 * Combined Screening Configuration
 * Centralized config for all modules that participate in combined screening.
 */
export default {
  /**
   * Modules that are part of combined screening.
   * Order matters — modules are executed sequentially per store.
   *
   * resolveParams: maps the global context to the params each module's processSingleStore needs.
   */
  modules: [
    {
      name: "rekon_virtual_mrg",
      enabled: true,
      resolveParams: ctx => ({
        strYear: ctx.strYear,
        strMonth: ctx.strMonth,
      }),
    },
    {
      name: "penyesuaian",
      enabled: true,
      resolveParams: ctx => ({
        strPeriode: ctx.strPeriode,
        strYear: ctx.strYear,
        strMonth: ctx.strMonth,
      }),
    },
    {
      name: "prep_closing",
      enabled: true,
      requiresWrcCache: true, // flag: needs WRC cache pre-loaded
      resolveParams: ctx => ({
        strPeriode: ctx.strPeriode,
        strYear: ctx.strYear,
        strMonth: ctx.strMonth,
      }),
    },
    // {
    //   name: "rekon_persediaan",
    //   enabled: true,
    //   requiresWrcPool: true, // flag: needs per-branch WRC pool
    //   resolveParams: ctx => ({
    //     strPeriode: ctx.strPeriode,
    //     strYear: ctx.strYear,
    //     strMonth: ctx.strMonth,
    //   }),
    // },
    // {
    //   name: "rekon_sales",
    //   enabled: true,
    //   requiresGlData: true, // flag: needs per-branch GL data
    //   resolveParams: ctx => ({
    //     strMonth: ctx.strMonth,
    //     strYear: ctx.strYear,
    //   }),
    // },
  ],

  /**
   * Parallel processing settings
   */
  parallelProcessing: {
    concurrencyLimit: 5, // max stores processed concurrently
    storeTimeoutMs: 180000, // 3 minutes per store (longer because multi-module)
  },

  /**
   * Progress task name
   */
  taskProgressName: "combinedScreeningTask",
};
