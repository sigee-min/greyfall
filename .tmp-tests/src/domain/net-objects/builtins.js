// Centralized side-effect imports for built-in net-objects.
// Import this module once in the app composition root to ensure
// built-in descriptors are registered before controllers are created.
import './chat-host.js';
import './world-positions-host.js';
import './party-host.js';
import '../character/character-sync.js';
// Intentionally no exports. Importing this file is sufficient.
