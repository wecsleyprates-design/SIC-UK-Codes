"""
Application Configuration Management.

This module provides centralized configuration management using Pydantic Settings.
All configuration values are loaded from environment variables and support .env files
for local development.

Configuration groups:
- Slack: Notification settings
- Redshift: Data warehouse connection
- AWS: Access keys and service regions
- Postgres: Operational database connection
- Kafka: Message streaming configuration
- Redis: Cache and Celery broker
- S3: Bucket names for data storage
- WorthAI: Cognito user pools and client IDs
- Integration: Third-party API connections
"""

from typing import Any, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine.url import URL


class Config(BaseSettings):
    """
    Application configuration loaded from environment variables.

    All configuration values can be overridden via environment variables.
    For local development, values can be set in a .env file in the project root.
    """

    environment: Optional[str] = Field(default="local")

    # Slack - Notification system
    config_slack_token: Optional[str] = None
    config_slack_notification_channel: Optional[str] = "bot-test-channel"

    # Redshift - AWS Data Warehouse for analytics and reporting
    config_aws_redshift_url: Optional[str] = None
    config_aws_redshift_port: Optional[int] = None
    config_aws_redshift_db: Optional[str] = None
    config_aws_redshift_password: Optional[str] = None
    config_aws_redshift_user: Optional[str] = None
    config_aws_redshift_iam_user: Optional[str] = None
    config_aws_redshift_workgroup_name: Optional[str] = None
    config_aws_redshift_use_iam: Optional[bool] = False

    # AWS Keys - For S3, SES, Cognito access
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    config_aws_region: Optional[str] = "us-east-1"

    # Postgres - Operational transactional database
    config_db_url: Optional[str] = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432"
    )
    config_db_host: Optional[str] = None
    config_db_port: Optional[int] = None
    config_db_name: Optional[str] = None
    config_db_user: Optional[str] = None
    config_db_password: Optional[str] = None

    # Kafka - Event streaming and messaging
    config_kafka_group_id: Optional[str] = None
    config_kafka_client_id: Optional[str] = None
    config_kafka_ssl_enabled: Optional[bool] = True
    config_kafka_brokers: Optional[str] = None
    config_kafka_consumer_brokers: Optional[str] = None
    config_kafka_sasl_username: Optional[str] = None
    config_kafka_sasl_password: Optional[str] = None
    config_kafka_security_protocol: Optional[str] = "SASL_PLAINTEXT"
    entity_matching_topic: str = "entity_matching.v1"
    entity_matching_request_topic: str = "entity_matching_request.v1"
    facts_topic: str = "facts.v1"

    # AWS Misc - Additional AWS services
    config_aws_ses_region: Optional[str] = None
    config_aws_cognito_region: Optional[str] = None

    # S3 - Data storage buckets
    de_bucket: Optional[str] = None  # Data exchange bucket
    ds_bucket: Optional[str] = None  # Data science bucket
    integration_bucket: Optional[str] = None  # Integration data bucket

    # Redis - Caching and Celery message broker
    config_redis_url: Optional[str] = None
    config_redis_host: Optional[str] = None
    config_redis_port: Optional[int] = None
    config_redis_password: Optional[str] = None
    config_redis_ec_cluster: Optional[str] = None
    config_redis_disable_tls: Optional[bool] = False
    config_redis_disable_tls_reject_unauthorized: Optional[bool] = True
    config_redis_reconnect_max_wait: Optional[int] = 2000
    config_redis_key_prefix: Optional[str] = ""

    # WorthAI Envs - Cognito user pool configuration
    config_worth_admin_user_pool_id: Optional[str] = None
    config_customer_user_pool_id: Optional[str] = None
    config_applicant_user_pool_id: Optional[str] = None
    config_worth_admin_client_id: Optional[str] = None
    config_customer_client_id: Optional[str] = None
    config_applicant_client_id: Optional[str] = None

    # Integration - Third-party service connections
    config_integration_service_api_url: Optional[str] = None
    config_integration_service_api_key: Optional[str] = None

    # ML Model - XGBoost similarity model path
    similarity_model_path: Optional[str] = "artifacts/xgboost.json"

    # Business Logic - Maximum number of matches to return per query
    max_matches_returned: int = 3

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def kafka_brokers_list(self) -> list[str]:
        """Parse comma-separated Kafka broker list into array."""
        if "," in self.config_kafka_brokers:
            return self.config_kafka_brokers.split(",")
        return [self.config_kafka_brokers]

    @property
    def kafka_consumer_brokers_list(self) -> list[str]:
        """Parse comma-separated Kafka consumer broker list into array."""
        if "," in self.config_kafka_consumer_brokers:
            return self.config_kafka_consumer_brokers.split(",")
        return [self.config_kafka_consumer_brokers]

    def postgres_connection_string(self, _async: bool = False) -> str:
        """
        Generate PostgreSQL connection string.

        Args:
            _async: If True, uses asyncpg driver; otherwise uses psycopg2

        Returns:
            SQLAlchemy database URL for PostgreSQL
        """
        drivername = "postgresql+asyncpg" if _async else "postgresql+psycopg2"
        return URL.create(
            drivername=drivername,
            host=self.config_db_host,
            port=self.config_db_port,
            database=self.config_db_name,
            username=self.config_db_user,
            password=self.config_db_password,
        )

    def redis_connection_string(self) -> str:
        """
        Generate Redis connection string with TLS support.

        Returns:
            Redis connection URL with appropriate protocol (redis:// or rediss://)
        """
        if self.config_redis_disable_tls is False:
            # Use TLS connection with password authentication
            return f"rediss://default:{self.config_redis_password}@{self.config_redis_host}:{self.config_redis_port}/0?ssl_cert_reqs=none"  # noqa

        return f"redis://default:{self.config_redis_password}@{self.config_redis_host}:{self.config_redis_port}/0"  # noqa

    def redshift_connection_string(self) -> str:
        """
        Generate Redshift connection string.

        Returns:
            SQLAlchemy database URL for AWS Redshift
        """
        return URL.create(
            drivername="redshift+redshift_connector",
            host=self.config_aws_redshift_url,
            port=self.config_aws_redshift_port,
            username=self.config_aws_redshift_user,
            password=self.config_aws_redshift_password,
            database="dev",
        )

    def redshift_connection_args(self) -> dict[str, Any]:
        """
        Generate Redshift connection arguments with IAM support.

        Returns:
            Dictionary of connection arguments for Redshift connector
        """
        default_args = {
            "iam": self.config_aws_redshift_use_iam,
            "access_key_id": self.aws_access_key_id,
            "secret_access_key": self.aws_secret_access_key,
        }

        # Add serverless-specific configuration for production IAM auth
        if self.config_aws_redshift_use_iam:
            default_args |= {
                "is_serverless": True,
                "serverless_work_group": self.config_aws_redshift_workgroup_name,
            }

        return default_args

    def kafka_connection_args(self) -> dict[str, Any]:
        """
        Generate Kafka connection arguments with SASL authentication.

        Returns:
            Dictionary of connection arguments for Kafka producer/consumer
        """
        if self.config_kafka_ssl_enabled and self.config_kafka_sasl_username:
            return {
                "bootstrap_servers": self.kafka_brokers_list,
                "security_protocol": self.config_kafka_security_protocol,
                "sasl_mechanism": "SCRAM-SHA-512",
                "sasl_plain_username": self.config_kafka_sasl_username,
                "sasl_plain_password": self.config_kafka_sasl_password,
            }

        return {"bootstrap_servers": self.kafka_brokers_list}

    # Pydantic Settings configuration - used for local development only
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra environment variables not defined in model
    )
