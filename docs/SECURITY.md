# Security Summary

Key points for MVP:

- Do not commit secrets (service_role, private keys).
- RLS enabled on all tables; policies restrict access to owners and members.
- No access-code or location-secret fields are stored.
- No public buckets for user files in MVP.

Developers: use `.env.example` and local environment variables when running locally.
