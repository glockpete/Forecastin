"""
Configuration Validation
Validates required environment variables at startup to fail fast
"""

import os
import sys
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class ConfigValidationError(Exception):
    """Raised when configuration validation fails"""
    pass


def validate_environment_variables(strict: bool = False) -> Dict[str, str]:
    """
    Validate required environment variables at startup.

    Args:
        strict: If True, all variables must be set. If False, use defaults for optional vars.

    Returns:
        Dict of validated environment variables

    Raises:
        ConfigValidationError: If required variables are missing or invalid
    """
    errors: List[str] = []
    warnings: List[str] = []
    config: Dict[str, str] = {}

    # Required environment variables
    required_vars = {
        # Database (can be constructed from components or provided as full URL)
        'DATABASE_URL': None,  # Optional if components are provided
    }

    # Optional environment variables with defaults
    optional_vars = {
        'DATABASE_HOST': 'localhost',
        'DATABASE_PORT': '5432',
        'DATABASE_NAME': 'forecastin',
        'DATABASE_USER': 'forecastin',
        'DATABASE_PASSWORD': '',  # Empty password for development
        'REDIS_URL': None,  # Optional
        'REDIS_HOST': 'localhost',
        'REDIS_PORT': '6379',
        'API_PORT': '9000',
        'ENVIRONMENT': 'development',
        'LOG_LEVEL': 'INFO',
    }

    # Check DATABASE_URL or components
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        # Check if we have components to build the URL
        db_host = os.getenv('DATABASE_HOST', optional_vars['DATABASE_HOST'])
        db_port = os.getenv('DATABASE_PORT', optional_vars['DATABASE_PORT'])
        db_name = os.getenv('DATABASE_NAME', optional_vars['DATABASE_NAME'])
        db_user = os.getenv('DATABASE_USER', optional_vars['DATABASE_USER'])
        db_password = os.getenv('DATABASE_PASSWORD', optional_vars['DATABASE_PASSWORD'])

        if not db_password and strict:
            errors.append(
                "DATABASE_PASSWORD not set. "
                "This is insecure for production. Set it via environment variable."
            )
        elif not db_password:
            warnings.append(
                "DATABASE_PASSWORD not set - using empty password (development only!)"
            )

        config['DATABASE_URL'] = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        config['DATABASE_HOST'] = db_host
        config['DATABASE_PORT'] = db_port
        config['DATABASE_NAME'] = db_name
        config['DATABASE_USER'] = db_user
        config['DATABASE_PASSWORD'] = db_password
    else:
        config['DATABASE_URL'] = database_url

    # Check REDIS_URL or components
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        redis_host = os.getenv('REDIS_HOST', optional_vars['REDIS_HOST'])
        redis_port = os.getenv('REDIS_PORT', optional_vars['REDIS_PORT'])
        config['REDIS_URL'] = f"redis://{redis_host}:{redis_port}/0"
        config['REDIS_HOST'] = redis_host
        config['REDIS_PORT'] = redis_port
    else:
        config['REDIS_URL'] = redis_url

    # Set other optional variables
    for var_name, default_value in optional_vars.items():
        if var_name not in config:  # Skip if already set above
            config[var_name] = os.getenv(var_name, default_value)

    # Validate port numbers
    try:
        api_port = int(config['API_PORT'])
        if not (1 <= api_port <= 65535):
            errors.append(f"API_PORT must be between 1 and 65535, got: {api_port}")
    except ValueError:
        errors.append(f"API_PORT must be a valid integer, got: {config['API_PORT']}")

    # Validate environment
    valid_environments = ['development', 'staging', 'production']
    if config['ENVIRONMENT'] not in valid_environments:
        warnings.append(
            f"ENVIRONMENT is '{config['ENVIRONMENT']}', expected one of: {valid_environments}"
        )

    # Production-specific checks
    if config['ENVIRONMENT'] == 'production':
        if not config.get('DATABASE_PASSWORD'):
            errors.append(
                "DATABASE_PASSWORD must be set in production environment for security"
            )

    # Print warnings
    for warning in warnings:
        logger.warning(f"⚠️  Configuration Warning: {warning}")

    # Fail if there are errors
    if errors:
        error_msg = "Configuration validation failed:\n" + "\n".join(f"  ❌ {e}" for e in errors)
        logger.error(error_msg)
        raise ConfigValidationError(error_msg)

    logger.info("✅ Configuration validation passed")
    return config


def print_config_summary(config: Dict[str, str], mask_secrets: bool = True):
    """
    Print a summary of the configuration (useful for debugging)

    Args:
        config: Configuration dictionary
        mask_secrets: If True, mask sensitive values like passwords
    """
    logger.info("=" * 60)
    logger.info("Configuration Summary")
    logger.info("=" * 60)

    for key, value in sorted(config.items()):
        # Mask sensitive values
        if mask_secrets and ('PASSWORD' in key.upper() or 'SECRET' in key.upper()):
            if value:
                display_value = '***' + value[-4:] if len(value) > 4 else '***'
            else:
                display_value = '(empty)'
        else:
            display_value = value

        logger.info(f"  {key:25s} = {display_value}")

    logger.info("=" * 60)


if __name__ == "__main__":
    # Test configuration validation
    logging.basicConfig(level=logging.INFO)

    try:
        config = validate_environment_variables(strict=False)
        print_config_summary(config)
        print("\n✅ Configuration is valid!")
        sys.exit(0)
    except ConfigValidationError as e:
        print(f"\n❌ Configuration validation failed:\n{e}")
        sys.exit(1)
