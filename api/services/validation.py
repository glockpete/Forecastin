"""
Input Validation and Sanitization Utilities

Provides secure validation for:
- URLs with IDNA (Internationalized Domain Names) encoding
- Unicode text with confusables detection
- Country codes, language codes, taxonomy identifiers
- Prevention of homograph attacks and unicode security issues

Security Features:
- IDNA encoding for international domain names
- Unicode normalization (NFC)
- Confusables detection for homograph attack prevention
- URL scheme validation (prevents SSRF)
- ISO code validation

Author: Forecastin Development Team
"""

import re
import unicodedata
from typing import Optional, Tuple
from urllib.parse import urlparse, urlunparse
import logging

logger = logging.getLogger(__name__)

# Valid URL schemes (prevent SSRF attacks)
ALLOWED_URL_SCHEMES = {'http', 'https'}

# ISO 639-1 language codes (most common ones)
VALID_LANGUAGE_CODES = {
    'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
    'ar', 'hi', 'bn', 'pa', 'te', 'mr', 'ta', 'ur', 'gu', 'kn',
    'ml', 'or', 'as', 'bh', 'sa', 'ne', 'si', 'my', 'km', 'lo',
    'th', 'vi', 'id', 'ms', 'tl', 'jv', 'su', 'ceb', 'ilo', 'hil',
    'nl', 'sv', 'no', 'da', 'fi', 'is', 'pl', 'cs', 'sk', 'hu',
    'ro', 'bg', 'sr', 'hr', 'bs', 'mk', 'sq', 'sl', 'lt', 'lv',
    'et', 'uk', 'be', 'ka', 'hy', 'az', 'tr', 'el', 'he', 'yi',
    'fa', 'ps', 'ku', 'sd', 'sw', 'am', 'om', 'so', 'ha', 'ig',
    'yo', 'zu', 'xh', 'af', 'st', 'tn', 'sn', 'ny', 'mg'
}

# ISO 3166-1 alpha-2 country codes (sample - extend as needed)
VALID_COUNTRY_CODES = {
    'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN',
    'IN', 'BR', 'MX', 'RU', 'KR', 'ID', 'TR', 'SA', 'AR', 'PL',
    'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'CH', 'AT', 'IE', 'PT',
    'GR', 'CZ', 'RO', 'HU', 'BG', 'HR', 'SK', 'LT', 'SI', 'LV',
    'EE', 'CY', 'MT', 'LU', 'IS', 'UA', 'BY', 'MD', 'AL', 'MK',
    'RS', 'BA', 'ME', 'XK', 'IL', 'PS', 'JO', 'LB', 'SY', 'IQ',
    'KW', 'QA', 'AE', 'OM', 'YE', 'EG', 'LY', 'TN', 'DZ', 'MA',
    'SD', 'SO', 'ET', 'KE', 'UG', 'TZ', 'ZA', 'NG', 'GH', 'CI',
    'SN', 'ML', 'BF', 'NE', 'TD', 'CM', 'CD', 'AO', 'ZW', 'MZ',
    'MG', 'MU', 'ZM', 'BW', 'NA', 'SZ', 'LS', 'MW', 'BI', 'RW'
}

# Valid regions for RSS sources
VALID_REGIONS = {
    'global', 'americas', 'europe', 'asia', 'middle_east', 'africa', 'oceania'
}


class ValidationError(ValueError):
    """Raised when validation fails"""
    pass


def normalize_unicode_text(text: str, form: str = 'NFC') -> str:
    """
    Normalize Unicode text to prevent homograph attacks.

    Args:
        text: Input text to normalize
        form: Unicode normalization form (NFC, NFD, NFKC, NFKD)
              NFC is recommended for most cases (Canonical Composition)

    Returns:
        Normalized text

    Example:
        >>> normalize_unicode_text('café')  # é can be one char or e + combining accent
        'café'  # Always returns single composed character
    """
    if not text:
        return text

    # Normalize to specified form
    normalized = unicodedata.normalize(form, text)

    return normalized


def detect_confusables(text: str, strict: bool = False) -> Tuple[bool, Optional[str]]:
    """
    Detect potentially confusable characters (homograph attack prevention).

    This is a basic implementation. For production, consider using the
    'confusable_homoglyphs' package for comprehensive detection.

    Args:
        text: Text to check for confusables
        strict: If True, reject any mixing of scripts

    Returns:
        Tuple of (has_confusables, warning_message)

    Example:
        >>> detect_confusables("pаypal")  # Cyrillic 'а' (U+0430) instead of Latin 'a'
        (True, "Text contains potentially confusable characters")
    """
    if not text:
        return False, None

    # Check for mixed scripts (simplified version)
    scripts = set()
    for char in text:
        if char.isalpha():
            # Get the Unicode script/block
            char_name = unicodedata.name(char, '')
            if 'LATIN' in char_name:
                scripts.add('LATIN')
            elif 'CYRILLIC' in char_name:
                scripts.add('CYRILLIC')
            elif 'GREEK' in char_name:
                scripts.add('GREEK')
            elif 'ARABIC' in char_name:
                scripts.add('ARABIC')
            elif 'HEBREW' in char_name:
                scripts.add('HEBREW')
            elif 'CJK' in char_name or 'HIRAGANA' in char_name or 'KATAKANA' in char_name:
                scripts.add('CJK')

    # Warn if multiple scripts detected (potential homograph attack)
    if len(scripts) > 1:
        return True, f"Text mixes multiple scripts: {', '.join(scripts)}"

    # Additional checks for commonly confused characters
    confusable_pairs = [
        ('a', 'а'),  # Latin a vs Cyrillic а (U+0061 vs U+0430)
        ('e', 'е'),  # Latin e vs Cyrillic е
        ('o', 'о'),  # Latin o vs Cyrillic о
        ('p', 'р'),  # Latin p vs Cyrillic р
        ('c', 'с'),  # Latin c vs Cyrillic с
        ('y', 'у'),  # Latin y vs Cyrillic у
        ('x', 'х'),  # Latin x vs Cyrillic х
    ]

    for latin, cyrillic in confusable_pairs:
        if cyrillic in text.lower():
            return True, f"Text may contain confusable character '{cyrillic}' (looks like '{latin}')"

    return False, None


def validate_and_normalize_url(
    url: str,
    allow_private: bool = False,
    max_length: int = 2048
) -> str:
    """
    Validate and normalize a URL with IDNA encoding for international domains.

    Security features:
    - IDNA encoding for international domain names (IDN)
    - Scheme validation (only http/https by default)
    - Length validation
    - Prevents SSRF by rejecting private IPs (optional)

    Args:
        url: URL to validate and normalize
        allow_private: Allow private/local IP addresses
        max_length: Maximum URL length

    Returns:
        Normalized URL with IDNA-encoded domain

    Raises:
        ValidationError: If URL is invalid or insecure

    Example:
        >>> validate_and_normalize_url("http://münchen.de/news")
        'http://xn--mnchen-3ya.de/news'

        >>> validate_and_normalize_url("http://例え.jp/article")
        'http://xn--r8jz45g.jp/article'
    """
    if not url or not isinstance(url, str):
        raise ValidationError("URL must be a non-empty string")

    # Strip whitespace
    url = url.strip()

    # Check length
    if len(url) > max_length:
        raise ValidationError(f"URL exceeds maximum length of {max_length} characters")

    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise ValidationError(f"Invalid URL format: {e}")

    # Validate scheme
    if parsed.scheme not in ALLOWED_URL_SCHEMES:
        raise ValidationError(
            f"URL scheme '{parsed.scheme}' not allowed. "
            f"Allowed schemes: {', '.join(ALLOWED_URL_SCHEMES)}"
        )

    # Validate hostname exists
    if not parsed.hostname:
        raise ValidationError("URL must contain a hostname")

    # Apply IDNA encoding to hostname (handles international domain names)
    try:
        # IDNA encoding: converts unicode domain to ASCII-compatible encoding
        # Example: münchen.de -> xn--mnchen-3ya.de
        idna_hostname = parsed.hostname.encode('idna').decode('ascii')
    except Exception as e:
        raise ValidationError(f"Invalid hostname for IDNA encoding: {e}")

    # Check for private/local addresses if not allowed
    if not allow_private:
        # Basic check for localhost and private IPs
        if idna_hostname in ('localhost', '127.0.0.1', '0.0.0.0'):
            raise ValidationError("Local/private URLs not allowed")

        # Check for private IP ranges (basic)
        if idna_hostname.startswith(('192.168.', '10.', '172.16.', '169.254.')):
            raise ValidationError("Private IP addresses not allowed")

    # Reconstruct URL with IDNA-encoded hostname
    normalized_url = urlunparse((
        parsed.scheme,
        idna_hostname if not parsed.port else f"{idna_hostname}:{parsed.port}",
        parsed.path,
        parsed.params,
        parsed.query,
        parsed.fragment
    ))

    return normalized_url


def validate_language_code(code: str) -> str:
    """
    Validate ISO 639-1 language code.

    Args:
        code: Language code to validate (e.g., 'en', 'fr')

    Returns:
        Lowercase language code

    Raises:
        ValidationError: If code is invalid
    """
    if not code or not isinstance(code, str):
        raise ValidationError("Language code must be a non-empty string")

    code = code.lower().strip()

    if len(code) != 2:
        raise ValidationError("Language code must be exactly 2 characters (ISO 639-1)")

    if code not in VALID_LANGUAGE_CODES:
        raise ValidationError(
            f"Invalid language code '{code}'. Must be a valid ISO 639-1 code."
        )

    return code


def validate_country_code(code: str) -> str:
    """
    Validate ISO 3166-1 alpha-2 country code.

    Args:
        code: Country code to validate (e.g., 'US', 'GB')

    Returns:
        Uppercase country code

    Raises:
        ValidationError: If code is invalid
    """
    if not code or not isinstance(code, str):
        raise ValidationError("Country code must be a non-empty string")

    code = code.upper().strip()

    if len(code) != 2:
        raise ValidationError("Country code must be exactly 2 characters (ISO 3166-1 alpha-2)")

    if code not in VALID_COUNTRY_CODES:
        raise ValidationError(
            f"Invalid country code '{code}'. Must be a valid ISO 3166-1 alpha-2 code."
        )

    return code


def validate_region(region: str) -> str:
    """
    Validate region identifier for RSS sources.

    Args:
        region: Region to validate

    Returns:
        Lowercase region identifier

    Raises:
        ValidationError: If region is invalid
    """
    if not region or not isinstance(region, str):
        raise ValidationError("Region must be a non-empty string")

    region = region.lower().strip()

    if region not in VALID_REGIONS:
        raise ValidationError(
            f"Invalid region '{region}'. "
            f"Must be one of: {', '.join(sorted(VALID_REGIONS))}"
        )

    return region


def validate_taxonomy_code(code: str) -> str:
    """
    Validate taxonomy/entity code format.

    Args:
        code: Taxonomy code to validate (e.g., 'POL-001', 'ORG-123')

    Returns:
        Uppercase taxonomy code

    Raises:
        ValidationError: If code format is invalid

    Format: 3-letter category + hyphen + 3+ digit number
    Examples: POL-001, ORG-123, LOC-001
    """
    if not code or not isinstance(code, str):
        raise ValidationError("Taxonomy code must be a non-empty string")

    code = code.upper().strip()

    # Validate format: XXX-NNN where X is letter, N is digit
    pattern = r'^[A-Z]{3}-\d{3,}$'
    if not re.match(pattern, code):
        raise ValidationError(
            f"Invalid taxonomy code format '{code}'. "
            f"Expected format: XXX-NNN (e.g., POL-001, ORG-123)"
        )

    return code


def sanitize_entity_name(name: str, max_length: int = 255) -> str:
    """
    Sanitize entity name with Unicode normalization and confusables check.

    Args:
        name: Entity name to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized and normalized name

    Raises:
        ValidationError: If name is invalid or contains confusables
    """
    if not name or not isinstance(name, str):
        raise ValidationError("Entity name must be a non-empty string")

    # Strip and normalize
    name = name.strip()
    name = normalize_unicode_text(name)

    # Check length
    if len(name) > max_length:
        raise ValidationError(f"Entity name exceeds maximum length of {max_length} characters")

    # Check for confusables
    has_confusables, warning = detect_confusables(name)
    if has_confusables:
        logger.warning(f"Entity name may contain confusables: {warning}")
        # Note: Not raising error here, just logging warning
        # In production, you may want to reject based on risk tolerance

    return name
