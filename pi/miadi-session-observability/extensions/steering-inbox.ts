import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerSteeringInbox } from '../lib/steering.mjs';

export default function steeringInbox(pi: ExtensionAPI) {
  registerSteeringInbox(pi);
}
