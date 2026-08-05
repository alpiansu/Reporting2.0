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
    {
      name: "rekon_sales",
      enabled: true,
      requiresGlData: true,
      resolveParams: ctx => ({
        strMonth: ctx.strMonth,
        strYear: ctx.strYear,
      }),
    },
    {
      name: "rekon_wt_harian",
      enabled: true,
      requiresWrcCache: false,
      resolveParams: ctx => ({
        strPeriode: ctx.strPeriode,
      }),
    },
  ],

  /**
   * Parallel processing settings
   */
  parallelProcessing: {
    concurrencyLimit: 15, // max stores processed concurrently
    storeTimeoutMs: 180000, // 3 minutes per store (longer because multi-module)
  },

  /**
   * Schedules: defines which modules run at which time.
   * Each schedule = 1 cron job. Modules run sequentially per store (1 connection).
   */
  schedules: [
    { time: "06:00", modules: ["rekon_virtual_mrg", "penyesuaian", "rekon_sales"], enabled: true, description: "Pagi - Rekon Virtual, Penyesuaian, Rekon Sales" },
    { time: "12:15", modules: ["rekon_virtual_mrg", "penyesuaian", "rekon_sales"], enabled: true, description: "Siang - Rekon Virtual, Penyesuaian, Rekon Sales" },
    { time: "20:00", modules: ["prep_closing", "rekon_wt_harian"], enabled: true, description: "Malam - Prep Closing + WT Harian" },
  ],

  /**
   * Progress task name
   */
  syncAfterAllStores: true,
  taskProgressName: "combinedScreeningTask",
};
