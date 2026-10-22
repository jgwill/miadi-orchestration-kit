import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerObserver } from '../lib/observer.mjs';

export default function eventCapture(pi: ExtensionAPI) {
  registerObserver(pi);
}
