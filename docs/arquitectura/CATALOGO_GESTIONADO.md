# Catálogo gestionado de Auth y Storage

Inventario de columnas, sin consultar filas. Se documenta para integrar, no para recrear ni modificar tablas gestionadas. Auth administra identidades, sesiones, factores y claves; Storage administra objetos. El diseño de negocio solo referencia Auth por UUID. No se copian contraseñas, tokens, factores ni secretos a tablas propias.

## auth.audit_log_entries
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| instance_id | uuid | YES | — |
| id | uuid | NO | — |
| payload | json | YES | — |
| created_at | timestamptz | YES | — |
| ip_address | varchar | NO | ''::character varying |


## auth.custom_oauth_providers
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| provider_type | text | NO | — |
| identifier | text | NO | — |
| name | text | NO | — |
| client_id | text | NO | — |
| client_secret | text | NO | — |
| acceptable_client_ids | _text | NO | '{}'::text[] |
| scopes | _text | NO | '{}'::text[] |
| pkce_enabled | bool | NO | true |
| attribute_mapping | jsonb | NO | '{}'::jsonb |
| authorization_params | jsonb | NO | '{}'::jsonb |
| enabled | bool | NO | true |
| email_optional | bool | NO | false |
| issuer | text | YES | — |
| discovery_url | text | YES | — |
| skip_nonce_check | bool | NO | false |
| cached_discovery | jsonb | YES | — |
| discovery_cached_at | timestamptz | YES | — |
| authorization_url | text | YES | — |
| token_url | text | YES | — |
| userinfo_url | text | YES | — |
| jwks_uri | text | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| custom_claims_allowlist | _text | NO | '{}'::text[] |


## auth.flow_state
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| user_id | uuid | YES | — |
| auth_code | text | YES | — |
| code_challenge_method | code_challenge_method | YES | — |
| code_challenge | text | YES | — |
| provider_type | text | NO | — |
| provider_access_token | text | YES | — |
| provider_refresh_token | text | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| authentication_method | text | NO | — |
| auth_code_issued_at | timestamptz | YES | — |
| invite_token | text | YES | — |
| referrer | text | YES | — |
| oauth_client_state_id | uuid | YES | — |
| linking_target_id | uuid | YES | — |
| email_optional | bool | NO | false |


## auth.identities
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| provider_id | text | NO | — |
| user_id | uuid | NO | — |
| identity_data | jsonb | NO | — |
| provider | text | NO | — |
| last_sign_in_at | timestamptz | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| email | text | YES | — |
| id | uuid | NO | gen_random_uuid() |


## auth.instances
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| uuid | uuid | YES | — |
| raw_base_config | text | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |


## auth.mfa_amr_claims
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| session_id | uuid | NO | — |
| created_at | timestamptz | NO | — |
| updated_at | timestamptz | NO | — |
| authentication_method | text | NO | — |
| id | uuid | NO | — |


## auth.mfa_challenges
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| factor_id | uuid | NO | — |
| created_at | timestamptz | NO | — |
| verified_at | timestamptz | YES | — |
| ip_address | inet | NO | — |
| otp_code | text | YES | — |
| web_authn_session_data | jsonb | YES | — |


## auth.mfa_factors
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| user_id | uuid | NO | — |
| friendly_name | text | YES | — |
| factor_type | factor_type | NO | — |
| status | factor_status | NO | — |
| created_at | timestamptz | NO | — |
| updated_at | timestamptz | NO | — |
| secret | text | YES | — |
| phone | text | YES | — |
| last_challenged_at | timestamptz | YES | — |
| web_authn_credential | jsonb | YES | — |
| web_authn_aaguid | uuid | YES | — |
| last_webauthn_challenge_data | jsonb | YES | — |


## auth.mfa_recovery_code_sets
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| user_id | uuid | NO | — |
| mfa_factor_id | uuid | NO | — |
| failed_verification_count | int4 | NO | 0 |
| verification_locked_until | timestamptz | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |


## auth.mfa_recovery_codes
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| mfa_recovery_code_set_id | uuid | NO | — |
| code_hash | text | NO | — |
| consumed_at | timestamptz | YES | — |
| created_at | timestamptz | NO | now() |


## auth.oauth_authorizations
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| authorization_id | text | NO | — |
| client_id | uuid | NO | — |
| user_id | uuid | YES | — |
| redirect_uri | text | NO | — |
| scope | text | NO | — |
| state | text | YES | — |
| resource | text | YES | — |
| code_challenge | text | YES | — |
| code_challenge_method | code_challenge_method | YES | — |
| response_type | oauth_response_type | NO | 'code'::auth.oauth_response_type |
| status | oauth_authorization_status | NO | 'pending'::auth.oauth_authorization_status |
| authorization_code | text | YES | — |
| created_at | timestamptz | NO | now() |
| expires_at | timestamptz | NO | (now() + '00:03:00'::interval) |
| approved_at | timestamptz | YES | — |
| nonce | text | YES | — |


## auth.oauth_client_states
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| provider_type | text | NO | — |
| code_verifier | text | YES | — |
| created_at | timestamptz | NO | — |


## auth.oauth_clients
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| client_secret_hash | text | YES | — |
| registration_type | oauth_registration_type | NO | — |
| redirect_uris | text | NO | — |
| grant_types | text | NO | — |
| client_name | text | YES | — |
| client_uri | text | YES | — |
| logo_uri | text | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| deleted_at | timestamptz | YES | — |
| client_type | oauth_client_type | NO | 'confidential'::auth.oauth_client_type |
| token_endpoint_auth_method | text | NO | — |


## auth.oauth_consents
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| user_id | uuid | NO | — |
| client_id | uuid | NO | — |
| scopes | text | NO | — |
| granted_at | timestamptz | NO | now() |
| revoked_at | timestamptz | YES | — |


## auth.one_time_tokens
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| user_id | uuid | NO | — |
| token_type | one_time_token_type | NO | — |
| token_hash | text | NO | — |
| relates_to | text | NO | — |
| created_at | timestamp | NO | now() |
| updated_at | timestamp | NO | now() |
| expires_at | timestamptz | YES | — |


## auth.refresh_tokens
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| instance_id | uuid | YES | — |
| id | int8 | NO | nextval('auth.refresh_tokens_id_seq'::regclass) |
| token | varchar | YES | — |
| user_id | varchar | YES | — |
| revoked | bool | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| parent | varchar | YES | — |
| session_id | uuid | YES | — |


## auth.saml_providers
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| sso_provider_id | uuid | NO | — |
| entity_id | text | NO | — |
| metadata_xml | text | NO | — |
| metadata_url | text | YES | — |
| attribute_mapping | jsonb | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| name_id_format | text | YES | — |


## auth.saml_relay_states
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| sso_provider_id | uuid | NO | — |
| request_id | text | NO | — |
| for_email | text | YES | — |
| redirect_to | text | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| flow_state_id | uuid | YES | — |


## auth.schema_migrations
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| version | varchar | NO | — |


## auth.scim_tokens
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| sso_provider_id | uuid | NO | — |
| token_hash | text | NO | — |
| prefix | text | NO | — |
| created_at | timestamptz | NO | now() |
| expires_at | timestamptz | YES | — |
| revoked_at | timestamptz | YES | — |
| last_used_at | timestamptz | YES | — |


## auth.scim_users
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| sso_provider_id | uuid | NO | — |
| user_id | uuid | YES | — |
| resource | jsonb | NO | — |
| user_name | text | NO | — |
| external_id | text | YES | — |
| active | bool | NO | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| deleted_at | timestamptz | YES | — |


## auth.sessions
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| user_id | uuid | NO | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| factor_id | uuid | YES | — |
| aal | aal_level | YES | — |
| not_after | timestamptz | YES | — |
| refreshed_at | timestamp | YES | — |
| user_agent | text | YES | — |
| ip | inet | YES | — |
| tag | text | YES | — |
| oauth_client_id | uuid | YES | — |
| refresh_token_hmac_key | text | YES | — |
| refresh_token_counter | int8 | YES | — |
| scopes | text | YES | — |


## auth.sso_domains
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| sso_provider_id | uuid | NO | — |
| domain | text | NO | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |


## auth.sso_providers
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | — |
| resource_id | text | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| disabled | bool | YES | — |


## auth.users
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| instance_id | uuid | YES | — |
| id | uuid | NO | — |
| aud | varchar | YES | — |
| role | varchar | YES | — |
| email | varchar | YES | — |
| encrypted_password | varchar | YES | — |
| email_confirmed_at | timestamptz | YES | — |
| invited_at | timestamptz | YES | — |
| confirmation_token | varchar | YES | — |
| confirmation_sent_at | timestamptz | YES | — |
| recovery_token | varchar | YES | — |
| recovery_sent_at | timestamptz | YES | — |
| email_change_token_new | varchar | YES | — |
| email_change | varchar | YES | — |
| email_change_sent_at | timestamptz | YES | — |
| last_sign_in_at | timestamptz | YES | — |
| raw_app_meta_data | jsonb | YES | — |
| raw_user_meta_data | jsonb | YES | — |
| is_super_admin | bool | YES | — |
| created_at | timestamptz | YES | — |
| updated_at | timestamptz | YES | — |
| phone | text | YES | NULL::character varying |
| phone_confirmed_at | timestamptz | YES | — |
| phone_change | text | YES | ''::character varying |
| phone_change_token | varchar | YES | ''::character varying |
| phone_change_sent_at | timestamptz | YES | — |
| confirmed_at | timestamptz | YES | — |
| email_change_token_current | varchar | YES | ''::character varying |
| email_change_confirm_status | int2 | YES | 0 |
| banned_until | timestamptz | YES | — |
| reauthentication_token | varchar | YES | ''::character varying |
| reauthentication_sent_at | timestamptz | YES | — |
| is_sso_user | bool | NO | false |
| deleted_at | timestamptz | YES | — |
| is_anonymous | bool | NO | false |


## auth.webauthn_challenges
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES | — |
| challenge_type | text | NO | — |
| session_data | jsonb | NO | — |
| created_at | timestamptz | NO | now() |
| expires_at | timestamptz | NO | — |


## auth.webauthn_credentials
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| credential_id | bytea | NO | — |
| public_key | bytea | NO | — |
| attestation_type | text | NO | ''::text |
| aaguid | uuid | YES | — |
| sign_count | int8 | NO | 0 |
| transports | jsonb | NO | '[]'::jsonb |
| backup_eligible | bool | NO | false |
| backed_up | bool | NO | false |
| friendly_name | text | NO | ''::text |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| last_used_at | timestamptz | YES | — |


## storage.buckets
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| name | text | NO | — |
| owner | uuid | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| public | bool | YES | false |
| avif_autodetection | bool | YES | false |
| file_size_limit | int8 | YES | — |
| allowed_mime_types | _text | YES | — |
| owner_id | text | YES | — |
| type | buckettype | NO | 'STANDARD'::storage.buckettype |
| versioning_status | text | NO | 'DISABLED'::text |
| lifecycle_configuration | jsonb | YES | — |
| lifecycle_configuration_generation | uuid | YES | — |


## storage.buckets_analytics
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| name | text | NO | — |
| type | buckettype | NO | 'ANALYTICS'::storage.buckettype |
| format | text | NO | 'ICEBERG'::text |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| id | uuid | NO | gen_random_uuid() |
| deleted_at | timestamptz | YES | — |


## storage.buckets_vectors
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| type | buckettype | NO | 'VECTOR'::storage.buckettype |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |


## storage.migrations
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | int4 | NO | — |
| name | varchar | NO | — |
| hash | varchar | NO | — |
| executed_at | timestamp | YES | CURRENT_TIMESTAMP |


## storage.objects
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| bucket_id | text | YES | — |
| name | text | YES | — |
| owner | uuid | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| last_accessed_at | timestamptz | YES | now() |
| metadata | jsonb | YES | — |
| path_tokens | _text | YES | — |
| version | text | YES | — |
| owner_id | text | YES | — |
| user_metadata | jsonb | YES | — |
| archived_at | timestamptz | YES | — |
| is_delete_marker | bool | NO | false |
| is_versioned | bool | NO | false |


## storage.s3_multipart_uploads
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | — |
| in_progress_size | int8 | NO | 0 |
| upload_signature | text | NO | — |
| bucket_id | text | NO | — |
| key | text | NO | — |
| version | text | NO | — |
| owner_id | text | YES | — |
| created_at | timestamptz | NO | now() |
| user_metadata | jsonb | YES | — |
| metadata | jsonb | YES | — |


## storage.s3_multipart_uploads_parts
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| upload_id | text | NO | — |
| size | int8 | NO | 0 |
| part_number | int4 | NO | — |
| bucket_id | text | NO | — |
| key | text | NO | — |
| etag | text | NO | — |
| owner_id | text | YES | — |
| version | text | NO | — |
| created_at | timestamptz | NO | now() |


## storage.vector_indexes
| Columna | Tipo | NULL | Default |
|---|---|---|---|
| id | text | NO | gen_random_uuid() |
| name | text | NO | — |
| bucket_id | text | NO | — |
| data_type | text | NO | — |
| dimension | int4 | NO | — |
| distance_metric | text | NO | — |
| metadata_configuration | jsonb | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
