# Security reporting

Please report suspected vulnerabilities privately to **milan@mijatovic.com** with the subject **Am I Going Broke? security report**. Do not open a public issue containing exploit details, real financial data, credentials, tokens, or private keys.

Include the affected URL or commit, browser, reproduction steps using fictional data, and likely impact. Do not access anyone else's data or disrupt the live service while investigating.

This is a solo-maintained project. There is no guaranteed response time or paid bug-bounty program. Maintenance focuses on the current `main` branch and production version; older snapshots do not receive separate security fixes.

If you discover an exposed credential, identify its location without sending the credential itself. The maintainer should revoke or rotate it at the issuing service; deleting a committed file alone does not remove it from Git history.
