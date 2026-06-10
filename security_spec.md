# Security Specification & "Dirty Dozen" Payloads

This specification defines the strict security invariants and threat models for the REIN Collects Firebase Firestore schema.

## Data Invariants

1. **User Sandboxing / Isolation**: All collections exist under `/users/{userId}/...` path. A logged-in user can only read, write, or query documents inside their own paths matching `request.auth.uid`. No user can access or query another user's subcollections.
2. **Strict Document Schema Validation**: Added records must conform to physical limits (e.g., `quantity >= 0`, `costBasis >= 0`, and structural bounds).
3. **Identity Verification**: Standard writes must require authenticated transactions with verified emails (`email_verified == true`).
4. **ID Hardening**: Handled by custom validator `isValidId()`. No invalid strings or overly long IDs.
5. **Timestamp Temporal Integrity**: Modified logs must match `request.time`.

---

## The "Dirty Dozen" Threat Payloads

Each payload below defines a specific exploit scenario designed to break invariants. These MUST consistently return `PERMISSION_DENIED` under the security rules.

### 1. Identity Spoofing Attack on Inventory Create
*   **Path**: `/users/VictimUID/inventory/item_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Attacker attempts to write into a victim's inventory subcollection.
*   **Payload**:
    ```json
    {
      "id": "item_1",
      "name": "Charizard ex",
      "set": "151",
      "category": "Singles",
      "quantity": 1,
      "costBasis": 100000,
      "currentPrice": 150000
    }
    ```

### 2. Privilege Escalation via Spoofed Email Verify State
*   **Path**: `/users/AttackerUID/inventory/item_1`
*   **Attacker**: Auth UID `AttackerUID`, email verified = `false`
*   **Intent**: Write without verifying email address.
*   **Payload**: Correctly shaped item, but should fail standard verification guard.

### 3. Denial of Wallet via Resource Poisoning ID
*   **Path**: `/users/AttackerUID/inventory/REALLY_LONG_ID_OR_MALICIOUS_CHARS_$$$$$$$$$$$$`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Cause extremely massive storage indices or breaking path patterns.

### 4. Negative Stock Underflow Attack
*   **Path**: `/users/AttackerUID/inventory/item_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Create inventory item with negative quantity or price to break calculation rules.
*   **Payload**:
    ```json
    {
      "id": "item_1",
      "name": "Mewtwo ex",
      "set": "151",
      "category": "Singles",
      "quantity": -50,
      "costBasis": -1200,
      "currentPrice": -10
    }
    ```

### 5. Shadow Fields Insertion (Map Keys Size Overrun)
*   **Path**: `/users/AttackerUID/inventory/item_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Put extra fields inside inventory document to store hidden variables (e.g. `isAdmin: true`).
*   **Payload**:
    ```json
    {
      "id": "item_1",
      "name": "Venusaur ex",
      "set": "151",
      "category": "Singles",
      "quantity": 2,
      "costBasis": 25000,
      "currentPrice": 35000,
      "hackedField": "superadmin"
    }
    ```

### 6. Temporal Hijack with Faked Historical Creation Date
*   **Path**: `/users/AttackerUID/inventory/item_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Try to bypass system timeline rules by back-dating a record instead of using server timestamps.
*   **Payload**:
    ```json
    {
      "id": "item_1",
      "name": "Pikachu",
      "set": "151",
      "category": "Singles",
      "quantity": 1,
      "costBasis": 100,
      "currentPrice": 200,
      "createdAt": "2010-01-01"
    }
    ```

### 7. Global Query Scraping (No Query Trust Guard)
*   **Path**: `/users/VictimUID/inventory` (via list query)
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Scrape another user's list query items.
*   **Payload**: GET matching where `userId != AttackerUID`.

### 8. Rogue Update on Constant ID
*   **Path**: `/users/AttackerUID/inventory/item_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Update fields that are physically constant once initialized (such as modifying `id` to mismatch path ID).
*   **Payload modification**: Attempt to modify the immutable `"id"` field.

### 9. Illegal Transaction State shortcut
*   **Path**: `/users/AttackerUID/transactions/trx_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Bypassing checks on transaction creation (illegal state).

### 10. Large Map Size Overflow on Batches List
*   **Path**: `/users/AttackerUID/inventory/item_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Put an arbitrarily large array into `batches` to crash parsing memory or induce denial of wallet.

### 11. Custom Settings Self-Assignment of Unlimited Cash Reserve
*   **Path**: `/users/AttackerUID/settings/store`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Set cash reserve settings field directly to an extreme negative or positive outlier to trick client validation.

### 12. Rogue QR Mapping takeover
*   **Path**: `/users/VictimUID/qr_mappings/mapping_1`
*   **Attacker**: Auth UID `AttackerUID`
*   **Intent**: Override a different user's barcode map so scans redirect incorrectly.

---

## The Test Spec

The firestore.rules.test.ts is designed to run isolated local tests verifying these deny statements.
