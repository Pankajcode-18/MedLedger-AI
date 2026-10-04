/**
 * Master-key rotation.
 *   1. Generate a new key:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   2. Put it in MASTER_ENCRYPTION_KEY and move the old one to MASTER_ENCRYPTION_KEYS_PREVIOUS
 *   3. Stop the server, run:  npm run keys:rotate
 *   4. Start the server. Once this reports 0 records left on older keys, the old key can be removed.
 */
import { rotateMasterKey } from '../src/services/recordMigration.js';

rotateMasterKey().then((result) => {
  console.log(
    `[Keys] Current master key ${result.currentKeyId}: re-wrapped ${result.rewrappedFiles} file key(s) and re-sealed ${result.resealedNotes} note(s).` +
      (result.failed.length ? ` Could not re-wrap: ${result.failed.join(', ')} (see warnings above).` : '')
  );
  if (result.failed.length) process.exitCode = 1;
});
