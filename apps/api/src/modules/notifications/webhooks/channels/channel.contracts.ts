export interface WebhookNotification {
  title: string;
  message: string;
  color: string;
  timestamp: string;
  url?: string;
}

export interface WebhookChannel {
  send(url: string, notification: WebhookNotification): Promise<void>;
}
