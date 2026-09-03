export interface WebhookChannel {
  send(url: string, content: string): Promise<void>;
}
