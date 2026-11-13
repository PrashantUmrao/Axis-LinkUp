# Production Example Documents Manifest

> **Document ID:** DOC-DATA-006  
> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Institution:** Axis Institute of Technology & Management  
> **Format:** Valid JSON / MongoDB BSON Representation  
> **Last Updated:** November 2026  

---

## 1. Core Academic & Identity Examples (MVP)

### 1.1 Document: `users` (Student Persona)
```json
{
  "_id": { "$oid": "6730a101f8b1a2001a000001" },
  "clerkId": "user_2s8Xz99KlmOpQrstUvwXyZ1001",
  "email": "aarav.sharma@axiscolleges.in",
  "fullName": "Aarav Sharma",
  "role": "student",
  "departmentId": { "$oid": "6730a001f8b1a2001a000010" },
  "phone": "+919876543210",
  "avatarUrl": "https://res.cloudinary.com/axis-linkup/image/upload/v1/avatars/aarav_sharma.webp",
  "status": "active",
  "studentMetadata": {
    "rollNumber": "24BCSE104",
    "batchYear": 2024,
    "currentSemester": 3,
    "section": "A"
  },
  "facultyMetadata": null,
  "createdAt": { "$date": "2026-08-01T09:00:00.000Z" },
  "updatedAt": { "$date": "2026-11-01T14:22:00.000Z" }
}
```

### 1.2 Document: `users` (Faculty Persona)
```json
{
  "_id": { "$oid": "6730a101f8b1a2001a000002" },
  "clerkId": "user_2s8Xz99KlmOpQrstUvwXyZ1002",
  "email": "dr.sunita.verma@axiscolleges.in",
  "fullName": "Dr. Sunita Verma",
  "role": "faculty",
  "departmentId": { "$oid": "6730a001f8b1a2001a000010" },
  "phone": "+919812345678",
  "avatarUrl": "https://res.cloudinary.com/axis-linkup/image/upload/v1/avatars/sunita_verma.webp",
  "status": "active",
  "studentMetadata": null,
  "facultyMetadata": {
    "designation": "Associate Professor",
    "cabinRoom": "Block B - Room 204",
    "officeHours": {
      "start": "10:00",
      "end": "12:00",
      "isAcceptingDMs": true
    }
  },
  "createdAt": { "$date": "2026-07-15T08:30:00.000Z" },
  "updatedAt": { "$date": "2026-11-05T11:00:00.000Z" }
}
```

### 1.3 Document: `departments`
```json
{
  "_id": { "$oid": "6730a001f8b1a2001a000010" },
  "code": "CSE",
  "name": "Computer Science & Engineering",
  "hodId": { "$oid": "6730a101f8b1a2001a000002" },
  "isActive": true,
  "createdAt": { "$date": "2026-01-01T00:00:00.000Z" },
  "updatedAt": { "$date": "2026-01-01T00:00:00.000Z" }
}
```

### 1.4 Document: `courses`
```json
{
  "_id": { "$oid": "6730a002f8b1a2001a000020" },
  "code": "CS301",
  "title": "Data Structures & Algorithms",
  "departmentId": { "$oid": "6730a001f8b1a2001a000010" },
  "semester": 3,
  "credits": 4,
  "createdAt": { "$date": "2026-06-01T10:00:00.000Z" },
  "updatedAt": { "$date": "2026-06-01T10:00:00.000Z" }
}
```

### 1.5 Document: `academic_terms`
```json
{
  "_id": { "$oid": "6730a003f8b1a2001a000030" },
  "name": "Odd Semester 2026-27",
  "startDate": { "$date": "2026-08-01T00:00:00.000Z" },
  "endDate": { "$date": "2026-12-20T23:59:59.000Z" },
  "isCurrent": true,
  "createdAt": { "$date": "2026-06-15T00:00:00.000Z" }
}
```

### 1.6 Document: `course_enrollments`
```json
{
  "_id": { "$oid": "6730a004f8b1a2001a000040" },
  "courseId": { "$oid": "6730a002f8b1a2001a000020" },
  "termId": { "$oid": "6730a003f8b1a2001a000030" },
  "section": "A",
  "primaryFacultyId": { "$oid": "6730a101f8b1a2001a000002" },
  "coFacultyIds": [],
  "studentIds": [
    { "$oid": "6730a101f8b1a2001a000001" }
  ],
  "createdAt": { "$date": "2026-07-28T09:00:00.000Z" }
}
```

---

## 2. Communication & Notice Examples (MVP)

### 2.1 Document: `notices`
```json
{
  "_id": { "$oid": "6730a005f8b1a2001a000050" },
  "title": "Rescheduled Mid-Term Examination Timetable for CS301",
  "contentMarkdown": "### Attention CSE 3rd Year Students\n\nPlease note that the **CS301 Data Structures** mid-term exam has been rescheduled to **Friday, Nov 20, 2026** at 10:00 AM in **Block B - Lab 402**.",
  "authorId": { "$oid": "6730a101f8b1a2001a000002" },
  "priority": "urgent",
  "targetScope": {
    "scopeType": "department",
    "departmentId": { "$oid": "6730a001f8b1a2001a000010" },
    "batchYear": 2024,
    "section": "A"
  },
  "attachments": [
    {
      "name": "revised_exam_schedule.pdf",
      "url": "https://res.cloudinary.com/axis-linkup/raw/upload/v1/notices/revised_exam_schedule.pdf",
      "sizeBytes": 245760,
      "mimeType": "application/pdf"
    }
  ],
  "isPinned": true,
  "requiresAcknowledgment": true,
  "expiresAt": { "$date": "2026-11-25T23:59:59.000Z" },
  "createdAt": { "$date": "2026-11-08T08:00:00.000Z" }
}
```

### 2.2 Document: `notice_receipts`
```json
{
  "_id": { "$oid": "6730a006f8b1a2001a000060" },
  "noticeId": { "$oid": "6730a005f8b1a2001a000050" },
  "userId": { "$oid": "6730a101f8b1a2001a000001" },
  "readAt": { "$date": "2026-11-08T08:15:22.000Z" },
  "acknowledgedAt": { "$date": "2026-11-08T08:16:05.000Z" }
}
```

### 2.3 Document: `chat_channels`
```json
{
  "_id": { "$oid": "6730a007f8b1a2001a000070" },
  "name": "CS301 - Data Structures Discussion",
  "type": "course",
  "courseId": { "$oid": "6730a002f8b1a2001a000020" },
  "departmentId": { "$oid": "6730a001f8b1a2001a000010" },
  "memberIds": [
    { "$oid": "6730a101f8b1a2001a000001" },
    { "$oid": "6730a101f8b1a2001a000002" }
  ],
  "isArchived": false,
  "createdAt": { "$date": "2026-08-01T10:00:00.000Z" }
}
```

### 2.4 Document: `chat_messages`
```json
{
  "_id": { "$oid": "6730a008f8b1a2001a000080" },
  "channelId": { "$oid": "6730a007f8b1a2001a000070" },
  "senderId": { "$oid": "6730a101f8b1a2001a000002" },
  "messageBody": "Good morning everyone. Lab 4 assignment brief is now live. Please review problem statement 2 carefully.",
  "attachments": [],
  "isDeleted": false,
  "createdAt": { "$date": "2026-11-09T09:30:15.000Z" }
}
```

### 2.5 Document: `notifications`
```json
{
  "_id": { "$oid": "6730a009f8b1a2001a000090" },
  "userId": { "$oid": "6730a101f8b1a2001a000001" },
  "title": "New Notice: Rescheduled Mid-Term Exam",
  "message": "Dr. Sunita Verma posted an urgent notice for CS301. Please acknowledge.",
  "category": "notice",
  "linkUrl": "/student/notices?id=6730a005f8b1a2001a000050",
  "isRead": false,
  "readAt": null,
  "createdAt": { "$date": "2026-11-08T08:00:05.000Z" }
}
```

---

## 3. Scheduling & Administrative Examples (MVP)

### 3.1 Document: `calendar_events`
```json
{
  "_id": { "$oid": "6730a00af8b1a2001a0000a0" },
  "termId": { "$oid": "6730a003f8b1a2001a000030" },
  "title": "Guru Nanak Jayanti Holiday",
  "description": "College campus will remain closed for all academic and administrative activities.",
  "category": "holiday",
  "startDate": { "$date": "2026-11-15T00:00:00.000Z" },
  "endDate": { "$date": "2026-11-15T23:59:59.000Z" },
  "targetScope": { "scopeType": "all" },
  "createdAt": { "$date": "2026-08-01T00:00:00.000Z" }
}
```

### 3.2 Document: `timetable_slots`
```json
{
  "_id": { "$oid": "6730a00bf8b1a2001a0000b0" },
  "courseId": { "$oid": "6730a002f8b1a2001a000020" },
  "facultyId": { "$oid": "6730a101f8b1a2001a000002" },
  "roomId": { "$oid": "6730a00ef8b1a2001a0000e0" },
  "termId": { "$oid": "6730a003f8b1a2001a000030" },
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "10:00",
  "section": "A",
  "createdAt": { "$date": "2026-08-01T12:00:00.000Z" }
}
```

### 3.3 Document: `request_categories`
```json
{
  "_id": { "$oid": "6730a00cf8b1a2001a0000c0" },
  "code": "BONAFIDE",
  "title": "Bonafide Student Certificate",
  "description": "Official institutional certificate for passport applications, educational loans, and bus pass requisitions.",
  "targetDepartmentId": { "$oid": "6730a001f8b1a2001a000010" },
  "defaultSlaHours": 48,
  "formSchema": {
    "type": "object",
    "required": ["purpose", "academicYear"],
    "properties": {
      "purpose": { "type": "string", "enum": ["Passport", "Education Loan", "Bus Pass", "Other"] },
      "academicYear": { "type": "string" },
      "additionalRemarks": { "type": "string" }
    }
  },
  "isActive": true
}
```

### 3.4 Document: `service_requests`
```json
{
  "_id": { "$oid": "6730a00df8b1a2001a0000d0" },
  "trackingNumber": "REQ-2026-1042",
  "categoryId": { "$oid": "6730a00cf8b1a2001a0000c0" },
  "studentId": { "$oid": "6730a101f8b1a2001a000001" },
  "departmentId": { "$oid": "6730a001f8b1a2001a000010" },
  "assignedAdminId": { "$oid": "6730a101f8b1a2001a000003" },
  "status": "under_review",
  "formData": {
    "purpose": "Passport",
    "academicYear": "2026-27",
    "additionalRemarks": "Need for appointment on Nov 18"
  },
  "proofAttachments": [
    {
      "url": "https://res.cloudinary.com/axis-linkup/raw/upload/v1/requests/fee_receipt_sem3.pdf",
      "name": "fee_receipt_sem3.pdf"
    }
  ],
  "issuedDocumentUrl": null,
  "resolutionNotes": "Verified fee payment; certificate forwarded for registrar signature.",
  "comments": [
    {
      "authorId": { "$oid": "6730a101f8b1a2001a000003" },
      "body": "Your application has been received and verified against accounts ledger.",
      "isInternal": false,
      "createdAt": { "$date": "2026-11-09T11:00:00.000Z" }
    }
  ],
  "slaDueDate": { "$date": "2026-11-11T09:00:00.000Z" },
  "resolvedAt": null,
  "createdAt": { "$date": "2026-11-09T09:00:00.000Z" }
}
```

### 3.5 Document: `audit_logs`
```json
{
  "_id": { "$oid": "6730a010f8b1a2001a000100" },
  "actorId": { "$oid": "6730a101f8b1a2001a000003" },
  "actorRole": "admin",
  "action": "UPDATE_REQUEST_STATUS",
  "module": "MOD-13",
  "entityId": "6730a00df8b1a2001a0000d0",
  "oldState": { "status": "submitted", "assignedAdminId": null },
  "newState": { "status": "under_review", "assignedAdminId": "6730a101f8b1a2001a000003" },
  "ipAddress": "103.24.120.45",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0",
  "createdAt": { "$date": "2026-11-09T10:59:58.000Z" }
}
```

---

## 4. Coursework, Facilities & Portfolios Examples (Later Releases)

### 4.1 Document: `assignments` (Phase 2)
```json
{
  "_id": { "$oid": "6730a011f8b1a2001a000110" },
  "courseId": { "$oid": "6730a002f8b1a2001a000020" },
  "facultyId": { "$oid": "6730a101f8b1a2001a000002" },
  "title": "Lab Assignment 4: Red-Black Tree Implementation",
  "description": "Implement insertion and left/right rotation in C++ or Java. Submit source code and runtime test output.",
  "maxMarks": 20,
  "dueDate": { "$date": "2026-11-20T23:59:59.000Z" },
  "allowLate": true,
  "lateCutoffDate": { "$date": "2026-11-22T23:59:59.000Z" },
  "attachments": [],
  "createdAt": { "$date": "2026-11-09T08:00:00.000Z" }
}
```

### 4.2 Document: `submissions` (Phase 2)
```json
{
  "_id": { "$oid": "6730a012f8b1a2001a000120" },
  "assignmentId": { "$oid": "6730a011f8b1a2001a000110" },
  "studentId": { "$oid": "6730a101f8b1a2001a000001" },
  "fileUrl": "https://res.cloudinary.com/axis-linkup/raw/upload/s--abc123--/v1/assignments/24BCSE104_lab4.zip",
  "fileName": "24BCSE104_lab4.zip",
  "fileSizeBytes": 1542000,
  "submittedAt": { "$date": "2026-11-19T21:45:00.000Z" },
  "isLate": false,
  "status": "graded",
  "score": 19,
  "feedback": "Clean implementation of tree rotations. Edge case on double black node handled correctly.",
  "gradedById": { "$oid": "6730a101f8b1a2001a000002" },
  "gradedAt": { "$date": "2026-11-21T14:00:00.000Z" }
}
```

### 4.3 Document: `study_materials` (Phase 2)
```json
{
  "_id": { "$oid": "6730a013f8b1a2001a000130" },
  "courseId": { "$oid": "6730a002f8b1a2001a000020" },
  "facultyId": { "$oid": "6730a101f8b1a2001a000002" },
  "unitNumber": 3,
  "title": "Unit 3 Lecture Notes: Balanced Search Trees",
  "description": "Comprehensive slide deck covering AVL Trees, B-Trees, and Red-Black Trees.",
  "fileUrl": "https://res.cloudinary.com/axis-linkup/raw/upload/v1/study/CS301_Unit3_Trees.pdf",
  "fileType": "pdf",
  "fileSizeBytes": 4500000,
  "downloadCount": 87,
  "tags": ["Trees", "AVL", "Red-Black", "DSA"],
  "createdAt": { "$date": "2026-10-15T11:00:00.000Z" }
}
```

### 4.4 Document: `polls` (Phase 2)
```json
{
  "_id": { "$oid": "6730a014f8b1a2001a000140" },
  "title": "Preferred Timing for CS301 Extra Tutorial Lecture",
  "description": "Please vote for the time slot that best accommodates your lab schedule this Saturday.",
  "creatorId": { "$oid": "6730a101f8b1a2001a000002" },
  "options": [
    { "_id": { "$oid": "6730a014f8b1a2001a000141" }, "text": "Saturday 10:00 AM - 11:30 AM", "voteCount": 38 },
    { "_id": { "$oid": "6730a014f8b1a2001a000142" }, "text": "Saturday 02:00 PM - 03:30 PM", "voteCount": 14 }
  ],
  "isAnonymous": true,
  "targetScope": { "scopeType": "department", "departmentId": { "$oid": "6730a001f8b1a2001a000010" } },
  "expiresAt": { "$date": "2026-11-13T17:00:00.000Z" },
  "isClosed": false,
  "createdAt": { "$date": "2026-11-09T08:00:00.000Z" }
}
```

### 4.5 Document: `poll_votes` (Phase 2)
```json
{
  "_id": { "$oid": "6730a015f8b1a2001a000150" },
  "pollId": { "$oid": "6730a014f8b1a2001a000140" },
  "optionId": { "$oid": "6730a014f8b1a2001a000141" },
  "voterHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "votedAt": { "$date": "2026-11-09T10:12:33.000Z" }
}
```

### 4.6 Document: `rooms` (Phase 2)
```json
{
  "_id": { "$oid": "6730a00ef8b1a2001a0000e0" },
  "block": "Block B",
  "roomNumber": "Lab 402",
  "type": "computer_lab",
  "seatingCapacity": 40,
  "hasProjector": true,
  "pcCount": 40,
  "isAirConditioned": true
}
```

### 4.7 Document: `room_reservations` (Phase 2)
```json
{
  "_id": { "$oid": "6730a016f8b1a2001a000160" },
  "roomId": { "$oid": "6730a00ef8b1a2001a0000e0" },
  "requestedById": { "$oid": "6730a101f8b1a2001a000002" },
  "startTime": { "$date": "2026-11-14T10:00:00.000Z" },
  "endTime": { "$date": "2026-11-14T11:30:00.000Z" },
  "purpose": "Remedial Coding Session for CS301 Section A",
  "status": "approved",
  "approvedById": { "$oid": "6730a101f8b1a2001a000003" },
  "createdAt": { "$date": "2026-11-09T11:30:00.000Z" }
}
```

### 4.8 Document: `student_achievements` (Phase 3)
```json
{
  "_id": { "$oid": "6730a017f8b1a2001a000170" },
  "studentId": { "$oid": "6730a101f8b1a2001a000001" },
  "category": "hackathon",
  "title": "Smart India Hackathon 2026 - 1st Runner Up",
  "issuer": "Ministry of Education / AICTE",
  "dateAchieved": { "$date": "2026-09-25T00:00:00.000Z" },
  "proofFileUrl": "https://res.cloudinary.com/axis-linkup/image/upload/v1/passport/sih_certificate.pdf",
  "verificationStatus": "verified",
  "verifiedById": { "$oid": "6730a101f8b1a2001a000002" },
  "rejectionReason": "",
  "verifiedAt": { "$date": "2026-10-02T10:00:00.000Z" },
  "createdAt": { "$date": "2026-09-28T14:00:00.000Z" }
}
```

### 4.9 Document: `emergency_alerts` (Phase 3)
```json
{
  "_id": { "$oid": "6730a018f8b1a2001a000180" },
  "title": "Campus Red Alert: Severe Storm Warning & Immediate Campus Evacuation",
  "message": "Due to severe cyclone advisories issued by civil defense, all academic activities are suspended immediately. Please vacate campus labs safely via the north gate.",
  "severity": "red",
  "isActive": true,
  "triggeredById": { "$oid": "6730a101f8b1a2001a000004" },
  "triggeredAt": { "$date": "2026-11-09T14:00:00.000Z" },
  "deactivatedAt": null,
  "deactivatedById": null
}
```

### 4.10 Document: `emergency_acknowledgments` (Phase 3)
```json
{
  "_id": { "$oid": "6730a019f8b1a2001a000190" },
  "alertId": { "$oid": "6730a018f8b1a2001a000180" },
  "userId": { "$oid": "6730a101f8b1a2001a000001" },
  "ipAddress": "103.24.120.98",
  "acknowledgedAt": { "$date": "2026-11-09T14:01:12.000Z" }
}
```

