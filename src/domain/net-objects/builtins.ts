// Built-in net-object registrations for Greyfall.
// Import this module once (e.g., in session boot) to ensure
// built-in descriptors are registered before controllers are created.

import '../character/character-sync.js';
import './chat-host.js';
import '../chat/chat-control.js';
import './party-host.js';
import './world-positions-host.js';
import '../session/participants-sync.js';
import '../world/world-control.js';
import '../world/travel-session.js';
import '../world/travel-control.js';
import '../interactions/interactions-session.js';
import '../interactions/interactions-control.js';
import './world-actors-host.js';
import '../actors/actors-control.js';
