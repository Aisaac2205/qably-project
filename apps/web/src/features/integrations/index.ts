/**
 * Public API barrel for the `integrations` module.
 *
 * Other modules import from `@/features/integrations` (this file), NEVER
 * from internal paths.
 */
export { useConnections } from './hooks/use-connections'
export {
  ConnectionActions,
  ConnectionLogo,
  ConnectionStatus,
  connectionResource,
} from './components/connection-presentation'
export { NotificationWebhooksPanel } from './components/notification-webhooks-panel'
export { WebhookSetupPanel } from './components/webhook-setup-panel'
