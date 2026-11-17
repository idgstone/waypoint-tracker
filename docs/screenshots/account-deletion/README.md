# Account-deletion review screenshots

These captures use fictional accounts in the isolated local review harness
`client/account-deletion-review.html`. No real authentication, database mutation,
or account deletion was performed. The harness mocks settings reads in memory
and rejects mutations; it is not imported by the normal application entry point.

- `01-applicant-settings.jpg`: earlier readiness layout, before the product copy
  was simplified. Retained as review history; it does not show the final copy.
- `02-applicant-deletion-dialog.jpg`: updated Applicant confirmation with the
  short availability message, empty current-password field, and disabled final
  submission. The background shows the simplified Delete account section.

Mentor and Admin captures were not completed during the interrupted screenshot
task. Do not treat missing screenshots or mocked checks as real API verification.
See `client/ACCOUNT_DELETION_READINESS.md` for the current handoff and blockers.
