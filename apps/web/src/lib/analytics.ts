export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // Stub for PostHog tracking
  // if (typeof window !== 'undefined' && window.posthog) {
  //   window.posthog.capture(eventName, properties);
  // }
  console.log(`[Analytics] Track Event: ${eventName}`, properties || {});
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  // Stub for PostHog identify
  // if (typeof window !== 'undefined' && window.posthog) {
  //   window.posthog.identify(userId, traits);
  // }
  console.log(`[Analytics] Identify User: ${userId}`, traits || {});
};
