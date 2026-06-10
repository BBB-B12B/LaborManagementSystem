export const logService = {
  trackPageView: (user: any, category: string, pageName: string) => {
    console.log(
      `[MOCK LogService] PageView tracking - Category: ${category}, PageName: ${pageName}`,
      user
    );
  },
};
