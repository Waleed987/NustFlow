// Encryption utility for secure credential storage
// Uses Web Crypto API with AES-GCM encryption

class CredentialEncryption {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
    }

    // Generate or retrieve encryption key
    async getEncryptionKey() {
        // Try to get existing key from storage
        const result = await chrome.storage.local.get('_encryptionKey');

        if (result._encryptionKey) {
            // Import existing key
            return await crypto.subtle.importKey(
                'jwk',
                result._encryptionKey,
                { name: this.algorithm, length: this.keyLength },
                true,
                ['encrypt', 'decrypt']
            );
        }

        // Generate new key
        const key = await crypto.subtle.generateKey(
            { name: this.algorithm, length: this.keyLength },
            true,
            ['encrypt', 'decrypt']
        );

        // Export and store key
        const exportedKey = await crypto.subtle.exportKey('jwk', key);
        await chrome.storage.local.set({ _encryptionKey: exportedKey });

        return key;
    }

    // Encrypt text
    async encrypt(text) {
        if (!text) return null;

        const key = await this.getEncryptionKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedText = new TextEncoder().encode(text);

        const encryptedData = await crypto.subtle.encrypt(
            { name: this.algorithm, iv: iv },
            key,
            encodedText
        );

        // Combine IV and encrypted data
        const combined = new Uint8Array(iv.length + encryptedData.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encryptedData), iv.length);

        // Convert to base64 for storage
        return btoa(String.fromCharCode(...combined));
    }

    // Decrypt text
    async decrypt(encryptedText) {
        if (!encryptedText) return null;

        try {
            const key = await this.getEncryptionKey();

            // Convert from base64
            const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);

            const decryptedData = await crypto.subtle.decrypt(
                { name: this.algorithm, iv: iv },
                key,
                encryptedData
            );

            return new TextDecoder().decode(decryptedData);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }
}

// Export singleton instance
const encryption = new CredentialEncryption();
