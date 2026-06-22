/**
 * Whitelist of safe HTML entities to decode
 */
const SAFE_ENTITIES = ['&eacute;', '&aacute;', '&iexcl;', '&amp;', '&mdash;', '&quot;'];

/**
 * Decode HTML entities in a string with XSS protection
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text or original text if unsafe
 */
export function decodeHtmlEntities(text) {
    if (!text) return text;

    // Block any angle brackets to prevent tag injection
    if (text.includes('<') || text.includes('>')) {
        return text;
    }

    // Check if text contains any whitelisted entities
    const hasWhitelistedEntity = SAFE_ENTITIES.some(entity => text.includes(entity));

    // Only decode if whitelisted entities are present
    if (!hasWhitelistedEntity) {
        return text;
    }

    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}
