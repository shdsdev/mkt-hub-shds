# Supabase Existing-Identity Invitation Resend Evidence

SDK: `@supabase/supabase-js` 2.116.0
Environment: `local Supabase stack (http://127.0.0.1:54321)`
Verified operation: `none`
Existing identity preserved: `Not tested; the installed SDK exposes no documented existing-invitation resend operation.`
Callback redirect accepted: `Not tested; no provider request was made.`
Provider error handling observed: `Not applicable; no provider request was made.`
Decision: `not enabled`

The installed `@supabase/auth-js` 2.116.0 definitions document
`auth.admin.inviteUserByEmail()` as an invitation operation. Its generic
`auth.resend()` contract accepts only `signup`, `email_change`, `sms`, and
`phone_change`; it does not accept `invite` or an Auth user ID. Calling either
operation as an existing-identity invitation resend would be unsupported, so no
experiment was performed and no resend transport is enabled.
