export interface AnalyticsEvent {
  name: string;
  payload: Record<string, unknown>;
}

export class AnalyticsService {
  static async track(event: AnalyticsEvent) {
    // In lieu of a real analytics provider, emit a structured log.
    // Tests can spy on this method to ensure events are fired.
    console.info('[analytics]', event.name, JSON.stringify(event.payload));
  }
}
