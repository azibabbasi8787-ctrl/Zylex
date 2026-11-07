# Security Specification: Zylex Academy

## 1. Data Invariants
1. Only authenticated administrators (present in `/admins/{adminUid}`) can create, edit, or delete `/lessons/{lessonId}`.
2. Only authenticated administrators can modify user roles or create new student user accounts.
3. Students can only read their own `/users/{userId}` record and cannot escalate their role or change their status.
4. Students can read `/lessons/{lessonId}` ONLY if their user record has status == 'active' and the lesson has `isPublished == true`.
5. Blocked or revoked students (`status != 'active'`) must be denied read access to course lessons.
6. Admin email bootstrapping recognizes the site owner (`azibabbasi8787@gmail.com`).
7. Users cannot write to `/admins/{adminId}` directly unless they are already an authorized admin or the bootstrapped admin.
8. All string fields must have bounded sizes to prevent denial of wallet attacks.

## 2. The Dirty Dozen Payloads (Adversarial Security Test Cases)
1. **Unauthenticated Lesson Query**: Anonymous user attempts to read `/lessons` -> DENIED.
2. **Blocked Student Lesson Read**: User with status == 'blocked' attempts to read `/lessons/{lessonId}` -> DENIED.
3. **Student Lesson Create**: Active student attempts to `create` in `/lessons/new-lesson` -> DENIED.
4. **Student Role Self-Escalation**: Student attempts to `update` `/users/{studentUid}` with `{ role: "admin" }` -> DENIED.
5. **Student Status Self-Unblock**: Blocked student attempts to `update` `/users/{studentUid}` with `{ status: "active" }` -> DENIED.
6. **Cross-User Profile Hijack**: Student A attempts to read or edit `/users/{studentB_Uid}` -> DENIED.
7. **Ghost Field Injection**: Attempt to write undocumented arbitrary field `{ "backdoor": true }` into `/lessons` -> DENIED.
8. **Admin Collection Injection**: Regular student creates `/admins/{studentUid}` to grant themselves admin rights -> DENIED.
9. **Unpublished Lesson Read by Student**: Student attempts to get `/lessons/{lessonId}` where `isPublished == false` -> DENIED.
10. **Oversized String Attack (Denial of Wallet)**: Injection of 2MB string into `title` or `driveUrl` -> DENIED.
11. **ID Poisoning Attack**: Creation with invalid path characters or 10KB ID -> DENIED.
12. **Student Lesson Deletion**: Student attempts to delete `/lessons/{lessonId}` -> DENIED.
