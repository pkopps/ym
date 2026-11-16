# Bot run 2026-11-16T23-20-14-801Z-seed-7

Seed 7. 12 providers, 30 crew, 120 owners, 3 booking attempts per owner, 24 owners at once.
Elapsed 197 s. Replay: `npm run bots -- --owners 120 --providers 12 --crew 30 --seed 7`.

## Activity

| Measure | Count |
| --- | ---: |
| searches | 360 |
| emptySearches | 34 |
| booked | 349 |
| recurring | 72 |
| bookFailures | 0 |
| accepted | 317 |
| declined | 74 |
| completed | 325 |
| cancelled | 26 |
| rescheduled | 27 |
| disputed | 56 |
| races | 97 |

Finder fees after fast-forwarding past the dispute window (fake card gateway, no Stripe): 11 waived, 145 paid, 38 blocked-by-dispute.

## Invariants

| Invariant | Checked | Failures |
| --- | ---: | ---: |
| No availability slot is booked twice; no provider has overlapping jobs | 375 | **112** |
| At most one finder fee per owner-provider pair | 194 | 0 |
| Finder fee at the right tier ($75 / $110 / $150), zero when waived | 194 | 0 |
| The provider's first relationship is waived, and only that one | 194 | 0 |
| No fee on a cancelled, disputed or never-completed first job | 194 | 0 |
| A recurring plan charges the finder fee once, not per visit | 72 | 0 |
| No job has more accepted crew than it needs | 355 | **31** |
| No crew member is on two jobs at once | 907 | **27** |
| Live location is readable only by that booking's owner, provider and assigned crew, and only while on route | 325 | **325** |
| Every state change produced exactly one notification per affected party | 1538 | **2** |

### FAILED: provider-no-overlapping-jobs

112 of 375 checked: No availability slot is booked twice; no provider has overlapping jobs (112 one visit was completed before its scheduled start, which freed the slot)

```json
[
  {
    "providerId": "43340fb6-eeb0-40b9-b266-dd0b82c9582c",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "eaf94984-fcb5-4cbd-bd5a-eecded6d3266",
      "status": "completed",
      "start": "2026-11-25T13:00:00.000Z",
      "end": "2026-11-25T14:00:00.000Z",
      "customerId": "3c9fd1cc-3aa5-42b7-a291-dc70f8ff00df",
      "completedAt": "2026-11-16T23:21:33.321Z"
    },
    "second": {
      "id": "d57de5ff-1658-4b64-b09c-9ad5ce0e213e",
      "status": "completed",
      "start": "2026-11-25T13:00:00.000Z",
      "end": "2026-11-25T14:00:00.000Z",
      "customerId": "3c9fd1cc-3aa5-42b7-a291-dc70f8ff00df",
      "completedAt": "2026-11-16T23:21:35.050Z"
    }
  },
  {
    "providerId": "43340fb6-eeb0-40b9-b266-dd0b82c9582c",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "25a3fea8-9c2d-482c-89c1-c5586d2fed89",
      "status": "completed",
      "start": "2026-11-27T18:00:00.000Z",
      "end": "2026-11-27T19:00:00.000Z",
      "customerId": "efce8277-e21e-4641-a26d-9ef053cfe625",
      "completedAt": "2026-11-16T23:21:30.175Z"
    },
    "second": {
      "id": "66e07ed7-9a38-4e1e-8e05-21d89ba30e96",
      "status": "completed",
      "start": "2026-11-27T18:00:00.000Z",
      "end": "2026-11-27T19:00:00.000Z",
      "customerId": "efce8277-e21e-4641-a26d-9ef053cfe625",
      "completedAt": "2026-11-16T23:21:28.710Z"
    }
  },
  {
    "providerId": "43340fb6-eeb0-40b9-b266-dd0b82c9582c",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "bd9b5906-d366-4fa0-bbc4-a0d243c0d302",
      "status": "completed",
      "start": "2026-11-29T13:00:00.000Z",
      "end": "2026-11-29T14:00:00.000Z",
      "customerId": "38d6b061-4c88-4a1d-929e-af4a2094c9ba",
      "completedAt": "2026-11-16T23:22:36.564Z"
    },
    "second": {
      "id": "9c9e171b-aee0-4a0c-9728-7cfc5b58e721",
      "status": "completed",
      "start": "2026-11-29T13:00:00.000Z",
      "end": "2026-11-29T14:00:00.000Z",
      "customerId": "51a3cee1-9ef9-4d48-a0f5-697209678179",
      "completedAt": "2026-11-16T23:21:23.889Z"
    }
  },
  {
    "providerId": "43340fb6-eeb0-40b9-b266-dd0b82c9582c",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "bd9b5906-d366-4fa0-bbc4-a0d243c0d302",
      "status": "completed",
      "start": "2026-11-29T13:00:00.000Z",
      "end": "2026-11-29T14:00:00.000Z",
      "customerId": "38d6b061-4c88-4a1d-929e-af4a2094c9ba",
      "completedAt": "2026-11-16T23:22:36.564Z"
    },
    "second": {
      "id": "4efd6046-57ce-4696-8813-39a45ef30865",
      "status": "completed",
      "start": "2026-11-29T13:00:00.000Z",
      "end": "2026-11-29T14:00:00.000Z",
      "customerId": "ffb9b0d6-5ccd-4ba5-be4a-5f4293f8d57a",
      "completedAt": "2026-11-16T23:21:25.785Z"
    }
  },
  {
    "providerId": "43340fb6-eeb0-40b9-b266-dd0b82c9582c",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "9c9e171b-aee0-4a0c-9728-7cfc5b58e721",
      "status": "completed",
      "start": "2026-11-29T13:00:00.000Z",
      "end": "2026-11-29T14:00:00.000Z",
      "customerId": "51a3cee1-9ef9-4d48-a0f5-697209678179",
      "completedAt": "2026-11-16T23:21:23.889Z"
    },
    "second": {
      "id": "4efd6046-57ce-4696-8813-39a45ef30865",
      "status": "completed",
      "start": "2026-11-29T13:00:00.000Z",
      "end": "2026-11-29T14:00:00.000Z",
      "customerId": "ffb9b0d6-5ccd-4ba5-be4a-5f4293f8d57a",
      "completedAt": "2026-11-16T23:21:25.785Z"
    }
  },
  {
    "providerId": "0a451ab8-601e-46e0-96de-12c2eb91ef22",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "d6a15d95-46a7-47b3-9567-ebe797ce7e04",
      "status": "completed",
      "start": "2026-11-18T15:00:00.000Z",
      "end": "2026-11-18T16:00:00.000Z",
      "customerId": "67df2bfa-702a-4f38-a94f-518e591bf014",
      "completedAt": "2026-11-16T23:22:21.850Z"
    },
    "second": {
      "id": "c6d65881-9371-4fad-8a38-0e31af431bd8",
      "status": "completed",
      "start": "2026-11-18T15:00:00.000Z",
      "end": "2026-11-18T16:00:00.000Z",
      "customerId": "67df2bfa-702a-4f38-a94f-518e591bf014",
      "completedAt": "2026-11-16T23:22:23.309Z"
    }
  },
  {
    "providerId": "0a451ab8-601e-46e0-96de-12c2eb91ef22",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "74b71ce0-c520-4c3e-a560-0cc88025342e",
      "status": "disputed",
      "start": "2026-11-21T16:00:00.000Z",
      "end": "2026-11-21T17:00:00.000Z",
      "customerId": "47c8805f-be6e-4fea-872d-a4879d6af409",
      "completedAt": "2026-11-16T23:23:04.980Z"
    },
    "second": {
      "id": "d989e077-b02a-4ed5-b8ed-793227c13a1e",
      "status": "completed",
      "start": "2026-11-21T16:00:00.000Z",
      "end": "2026-11-21T17:00:00.000Z",
      "customerId": "71092ef7-7c11-49ad-85bf-c1f059b12bd8",
      "completedAt": "2026-11-16T23:23:03.498Z"
    }
  },
  {
    "providerId": "0a451ab8-601e-46e0-96de-12c2eb91ef22",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "75456d2b-4d0f-44c1-a877-e48be7b4102d",
      "status": "completed",
      "start": "2026-11-21T18:00:00.000Z",
      "end": "2026-11-21T19:00:00.000Z",
      "customerId": "71092ef7-7c11-49ad-85bf-c1f059b12bd8",
      "completedAt": "2026-11-16T23:22:59.954Z"
    },
    "second": {
      "id": "3e07b605-79d9-45e2-ac2d-d6f6f1cdc935",
      "status": "completed",
      "start": "2026-11-21T18:00:00.000Z",
      "end": "2026-11-21T19:00:00.000Z",
      "customerId": "4763e9e3-2170-414d-9374-4fd4497a69ed",
      "completedAt": "2026-11-16T23:23:01.104Z"
    }
  },
  {
    "providerId": "0a451ab8-601e-46e0-96de-12c2eb91ef22",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "26d7018b-9f5d-407d-99e4-4abbeea75419",
      "status": "completed",
      "start": "2026-11-22T16:00:00.000Z",
      "end": "2026-11-22T17:00:00.000Z",
      "customerId": "3d260af6-587a-4144-9457-1e8287d8edcf",
      "completedAt": "2026-11-16T23:22:16.891Z"
    },
    "second": {
      "id": "b4d35e70-2ad0-493e-acce-40cf8f3ecbee",
      "status": "completed",
      "start": "2026-11-22T16:00:00.000Z",
      "end": "2026-11-22T17:00:00.000Z",
      "customerId": "c0ebf02e-0762-49a5-8d7f-435fc1e7723b",
      "completedAt": "2026-11-16T23:22:12.660Z"
    }
  },
  {
    "providerId": "0a451ab8-601e-46e0-96de-12c2eb91ef22",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "26d7018b-9f5d-407d-99e4-4abbeea75419",
      "status": "completed",
      "start": "2026-11-22T16:00:00.000Z",
      "end": "2026-11-22T17:00:00.000Z",
      "customerId": "3d260af6-587a-4144-9457-1e8287d8edcf",
      "completedAt": "2026-11-16T23:22:16.891Z"
    },
    "second": {
      "id": "7069d343-9a46-4982-83d2-f8574fc256f7",
      "status": "completed",
      "start": "2026-11-22T16:00:00.000Z",
      "end": "2026-11-22T17:00:00.000Z",
      "customerId": "c0ebf02e-0762-49a5-8d7f-435fc1e7723b",
      "completedAt": "2026-11-16T23:22:14.285Z"
    }
  }
]
```

### FAILED: crew-not-overfilled

31 of 355 checked: No job has more accepted crew than it needs

```json
[
  {
    "bookingId": "cde8e8ab-01f2-405e-9fa4-addc87881aa7",
    "category": "lawn-mowing",
    "needed": 2,
    "accepted": 10,
    "crewMemberIds": [
      "1cb2a363-501c-4ef7-b971-4e198effd9a2",
      "1d386e11-145c-4a53-8108-e5bf6639f820",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "20f2ed91-6520-4fb8-a068-70b458d8cfc7",
      "174f3ad7-8f71-4854-81ad-134f4f3bd89f",
      "451613d5-40a6-465a-88e4-db2c175ecb25",
      "f7bf6198-7c9b-4b96-8301-c4d5090c7b03",
      "45fdf091-b40a-412e-97a8-53f1996d679a",
      "7630e888-1525-4415-9856-eb9af9c9fd79",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa"
    ]
  },
  {
    "bookingId": "2fe5074c-03ee-4f30-b1d0-fda559a63611",
    "category": "lawn-mowing",
    "needed": 1,
    "accepted": 20,
    "crewMemberIds": [
      "40886c54-d437-4524-befe-68fea5c36c0e",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "f7bf6198-7c9b-4b96-8301-c4d5090c7b03",
      "174f3ad7-8f71-4854-81ad-134f4f3bd89f",
      "f80fa519-3d4f-4867-9c4c-77e787f1528e",
      "451613d5-40a6-465a-88e4-db2c175ecb25",
      "9fa90dd7-29ac-4eb5-8dd4-6d191ebeec21",
      "45fdf091-b40a-412e-97a8-53f1996d679a",
      "e9b5703d-f1bd-42f3-80ed-bb33e1b227a3",
      "107e7241-c70d-4ab4-bfa4-a99c42245eaa",
      "66124fae-ee83-42dd-be4b-c12f709d20b4",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa",
      "1d386e11-145c-4a53-8108-e5bf6639f820",
      "b65a1f1b-ad17-4a39-a60f-93f2b56f562f",
      "890d3728-e98d-4e21-9d28-973db8f33f14",
      "80dda6fe-ae4d-4c78-99e9-bd16c1d299ff",
      "45360ec1-7fcc-427f-a97e-6cb12bda3004",
      "cd49ddb9-8f56-45cc-9ce0-4d571804dd07",
      "297b737e-aa15-402e-9d3c-704e408b5575",
      "f331552c-7fea-4780-9ee1-412bf9398526"
    ]
  },
  {
    "bookingId": "947269b2-166f-4a84-b0a4-4b87aad4dafa",
    "category": "lawn-mowing",
    "needed": 1,
    "accepted": 16,
    "crewMemberIds": [
      "40886c54-d437-4524-befe-68fea5c36c0e",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "f7bf6198-7c9b-4b96-8301-c4d5090c7b03",
      "451613d5-40a6-465a-88e4-db2c175ecb25",
      "45fdf091-b40a-412e-97a8-53f1996d679a",
      "174f3ad7-8f71-4854-81ad-134f4f3bd89f",
      "f331552c-7fea-4780-9ee1-412bf9398526",
      "297b737e-aa15-402e-9d3c-704e408b5575",
      "7630e888-1525-4415-9856-eb9af9c9fd79",
      "66124fae-ee83-42dd-be4b-c12f709d20b4",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa",
      "e9b5703d-f1bd-42f3-80ed-bb33e1b227a3",
      "890d3728-e98d-4e21-9d28-973db8f33f14",
      "45360ec1-7fcc-427f-a97e-6cb12bda3004",
      "7c42a048-9541-4053-97ce-75dda3548bbd",
      "80dda6fe-ae4d-4c78-99e9-bd16c1d299ff"
    ]
  },
  {
    "bookingId": "c6510a8a-a85d-4554-b845-70e54f14a72f",
    "category": "lawn-mowing",
    "needed": 2,
    "accepted": 16,
    "crewMemberIds": [
      "890d3728-e98d-4e21-9d28-973db8f33f14",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "174f3ad7-8f71-4854-81ad-134f4f3bd89f",
      "20f2ed91-6520-4fb8-a068-70b458d8cfc7",
      "f331552c-7fea-4780-9ee1-412bf9398526",
      "f80fa519-3d4f-4867-9c4c-77e787f1528e",
      "107e7241-c70d-4ab4-bfa4-a99c42245eaa",
      "297b737e-aa15-402e-9d3c-704e408b5575",
      "66124fae-ee83-42dd-be4b-c12f709d20b4",
      "1cb2a363-501c-4ef7-b971-4e198effd9a2",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa",
      "bf753e24-7b8e-47da-9d4d-0c04e8b6508e",
      "b65a1f1b-ad17-4a39-a60f-93f2b56f562f",
      "1d386e11-145c-4a53-8108-e5bf6639f820",
      "45360ec1-7fcc-427f-a97e-6cb12bda3004",
      "7c42a048-9541-4053-97ce-75dda3548bbd"
    ]
  },
  {
    "bookingId": "5c77655b-2e8d-49f4-9304-2f3145e87119",
    "category": "lawn-mowing",
    "needed": 1,
    "accepted": 15,
    "crewMemberIds": [
      "f331552c-7fea-4780-9ee1-412bf9398526",
      "174f3ad7-8f71-4854-81ad-134f4f3bd89f",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa",
      "7630e888-1525-4415-9856-eb9af9c9fd79",
      "20f2ed91-6520-4fb8-a068-70b458d8cfc7",
      "45fdf091-b40a-412e-97a8-53f1996d679a",
      "c693d092-ac43-4d65-b4c7-63accd0bfcd5",
      "890d3728-e98d-4e21-9d28-973db8f33f14",
      "bf753e24-7b8e-47da-9d4d-0c04e8b6508e",
      "b65a1f1b-ad17-4a39-a60f-93f2b56f562f",
      "1d386e11-145c-4a53-8108-e5bf6639f820",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "7c42a048-9541-4053-97ce-75dda3548bbd",
      "f80fa519-3d4f-4867-9c4c-77e787f1528e",
      "e6f20283-1531-4821-988a-0fe9e08316ff"
    ]
  },
  {
    "bookingId": "91cb2712-b9d9-4ec3-8052-dd448cf0fb00",
    "category": "lawn-mowing",
    "needed": 2,
    "accepted": 13,
    "crewMemberIds": [
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "b65a1f1b-ad17-4a39-a60f-93f2b56f562f",
      "7c42a048-9541-4053-97ce-75dda3548bbd",
      "20f2ed91-6520-4fb8-a068-70b458d8cfc7",
      "f331552c-7fea-4780-9ee1-412bf9398526",
      "f80fa519-3d4f-4867-9c4c-77e787f1528e",
      "f7bf6198-7c9b-4b96-8301-c4d5090c7b03",
      "9fa90dd7-29ac-4eb5-8dd4-6d191ebeec21",
      "1cb2a363-501c-4ef7-b971-4e198effd9a2",
      "bf753e24-7b8e-47da-9d4d-0c04e8b6508e",
      "66124fae-ee83-42dd-be4b-c12f709d20b4",
      "451613d5-40a6-465a-88e4-db2c175ecb25",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa"
    ]
  },
  {
    "bookingId": "9fcb2ad0-f330-41a6-9180-efb4b78c0067",
    "category": "lawn-mowing",
    "needed": 2,
    "accepted": 16,
    "crewMemberIds": [
      "66124fae-ee83-42dd-be4b-c12f709d20b4",
      "45fdf091-b40a-412e-97a8-53f1996d679a",
      "1cb2a363-501c-4ef7-b971-4e198effd9a2",
      "bf753e24-7b8e-47da-9d4d-0c04e8b6508e",
      "1d386e11-145c-4a53-8108-e5bf6639f820",
      "7c42a048-9541-4053-97ce-75dda3548bbd",
      "f80fa519-3d4f-4867-9c4c-77e787f1528e",
      "107e7241-c70d-4ab4-bfa4-a99c42245eaa",
      "297b737e-aa15-402e-9d3c-704e408b5575",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa",
      "20f2ed91-6520-4fb8-a068-70b458d8cfc7",
      "f331552c-7fea-4780-9ee1-412bf9398526",
      "b65a1f1b-ad17-4a39-a60f-93f2b56f562f",
      "174f3ad7-8f71-4854-81ad-134f4f3bd89f",
      "9fa90dd7-29ac-4eb5-8dd4-6d191ebeec21"
    ]
  },
  {
    "bookingId": "bac74e94-ab3e-4fa4-bc4e-5b46ddf2ed1c",
    "category": "lawn-mowing",
    "needed": 2,
    "accepted": 8,
    "crewMemberIds": [
      "a3da7a2d-9d02-4d25-922e-cae23808d07c",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa",
      "40886c54-d437-4524-befe-68fea5c36c0e",
      "1cb2a363-501c-4ef7-b971-4e198effd9a2",
      "451613d5-40a6-465a-88e4-db2c175ecb25",
      "e9b5703d-f1bd-42f3-80ed-bb33e1b227a3",
      "890d3728-e98d-4e21-9d28-973db8f33f14",
      "9fa90dd7-29ac-4eb5-8dd4-6d191ebeec21"
    ]
  },
  {
    "bookingId": "c8a86383-7139-4f73-9fec-050fab20888e",
    "category": "lawn-mowing",
    "needed": 2,
    "accepted": 16,
    "crewMemberIds": [
      "a3da7a2d-9d02-4d25-922e-cae23808d07c",
      "37f89403-85cc-415f-8f0a-d90977c0a0fa",
      "20f2ed91-6520-4fb8-a068-70b458d8cfc7",
      "40886c54-d437-4524-befe-68fea5c36c0e",
      "1cb2a363-501c-4ef7-b971-4e198effd9a2",
      "451613d5-40a6-465a-88e4-db2c175ecb25",
      "66124fae-ee83-42dd-be4b-c12f709d20b4",
      "e9b5703d-f1bd-42f3-80ed-bb33e1b227a3",
      "f331552c-7fea-4780-9ee1-412bf9398526",
      "f80fa519-3d4f-4867-9c4c-77e787f1528e",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "bf753e24-7b8e-47da-9d4d-0c04e8b6508e",
      "7c42a048-9541-4053-97ce-75dda3548bbd",
      "1d386e11-145c-4a53-8108-e5bf6639f820",
      "cd49ddb9-8f56-45cc-9ce0-4d571804dd07",
      "297b737e-aa15-402e-9d3c-704e408b5575"
    ]
  },
  {
    "bookingId": "2f3da4a9-a016-485e-9f6c-464970c79510",
    "category": "hedge-trimming",
    "needed": 2,
    "accepted": 6,
    "crewMemberIds": [
      "e6f20283-1531-4821-988a-0fe9e08316ff",
      "197a9fe7-572f-4921-b80c-49ecd1962c02",
      "1d386e11-145c-4a53-8108-e5bf6639f820",
      "e9b5703d-f1bd-42f3-80ed-bb33e1b227a3",
      "890d3728-e98d-4e21-9d28-973db8f33f14",
      "cd49ddb9-8f56-45cc-9ce0-4d571804dd07"
    ]
  }
]
```

### FAILED: crew-not-double-booked

27 of 907 checked: No crew member is on two jobs at once (27 one visit was completed before its scheduled start, which freed the slot)

```json
[
  {
    "crewMemberId": "da352b51-2e56-4e45-aa9a-cb7ab55a19e2",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "2e1ffbf7-8ce4-4954-8718-bf07f633d782",
      "status": "completed",
      "start": "2026-11-18T15:00:00.000Z",
      "end": "2026-11-18T16:00:00.000Z",
      "customerId": "ed6daebb-1099-4e8d-8d01-6763a4e3121e",
      "completedAt": "2026-11-16T23:22:13.909Z"
    },
    "second": {
      "id": "013561fb-7c9f-49c4-949d-e422818f2c04",
      "status": "completed",
      "start": "2026-11-18T15:00:00.000Z",
      "end": "2026-11-18T16:00:00.000Z",
      "customerId": "648a5da6-411a-48d5-ae84-0316ffd27860",
      "completedAt": "2026-11-16T23:20:54.497Z"
    }
  },
  {
    "crewMemberId": "da352b51-2e56-4e45-aa9a-cb7ab55a19e2",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "4ec7c8e4-21bb-4e3c-a69d-7271d5a0a711",
      "status": "completed",
      "start": "2026-11-28T14:00:00.000Z",
      "end": "2026-11-28T15:00:00.000Z",
      "customerId": "f884d55d-58ac-4ad9-831c-ff2a4a94c96c",
      "completedAt": "2026-11-16T23:21:36.711Z"
    },
    "second": {
      "id": "732e51f2-f455-4000-9f16-a39634b0ed4c",
      "status": "disputed",
      "start": "2026-11-28T14:00:00.000Z",
      "end": "2026-11-28T15:00:00.000Z",
      "customerId": "51a3cee1-9ef9-4d48-a0f5-697209678179",
      "completedAt": "2026-11-16T23:21:35.061Z"
    }
  },
  {
    "crewMemberId": "da352b51-2e56-4e45-aa9a-cb7ab55a19e2",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "d9a7906f-babf-42fc-a242-72a7a9379b5b",
      "status": "completed",
      "start": "2026-11-28T16:00:00.000Z",
      "end": "2026-11-28T17:00:00.000Z",
      "customerId": "72c3e1ae-9649-4633-841f-d84dbc077f80",
      "completedAt": "2026-11-16T23:22:49.808Z"
    },
    "second": {
      "id": "4696c8c9-8130-4093-87f2-51642bcdd7c7",
      "status": "completed",
      "start": "2026-11-28T16:00:00.000Z",
      "end": "2026-11-28T17:00:00.000Z",
      "customerId": "97fa9aae-c47e-4418-88fc-ac4f8e16d034",
      "completedAt": "2026-11-16T23:21:32.785Z"
    }
  },
  {
    "crewMemberId": "d4667c4a-aa74-401b-8e27-3460dd5b3747",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "ad6c2279-0697-462e-94cf-576104497960",
      "status": "completed",
      "start": "2026-11-23T16:00:00.000Z",
      "end": "2026-11-23T17:00:00.000Z",
      "customerId": "bed91a57-0208-4d45-b506-52903ec2c149",
      "completedAt": "2026-11-16T23:22:00.339Z"
    },
    "second": {
      "id": "fe364cdc-b3fa-4943-abc1-2117c46ec9a2",
      "status": "confirmed",
      "start": "2026-11-23T16:00:00.000Z",
      "end": "2026-11-23T17:00:00.000Z",
      "customerId": "bed91a57-0208-4d45-b506-52903ec2c149"
    }
  },
  {
    "crewMemberId": "d4667c4a-aa74-401b-8e27-3460dd5b3747",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "7321371a-df5c-4a28-bbab-4452edf284f0",
      "status": "completed",
      "start": "2026-11-24T18:00:00.000Z",
      "end": "2026-11-24T19:00:00.000Z",
      "customerId": "2eb4b6c7-3a45-4aa3-82b1-0862ba15da27",
      "completedAt": "2026-11-16T23:23:25.393Z"
    },
    "second": {
      "id": "55937020-00e5-402d-a508-a52e76c01969",
      "status": "completed",
      "start": "2026-11-24T18:00:00.000Z",
      "end": "2026-11-24T19:00:00.000Z",
      "customerId": "3c9fd1cc-3aa5-42b7-a291-dc70f8ff00df",
      "completedAt": "2026-11-16T23:23:00.903Z"
    }
  },
  {
    "crewMemberId": "d4667c4a-aa74-401b-8e27-3460dd5b3747",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "d21362f8-05cf-4b39-ad3c-a3b6daa59be0",
      "status": "completed",
      "start": "2026-11-27T19:00:00.000Z",
      "end": "2026-11-27T20:00:00.000Z",
      "customerId": "14c9d8d5-870c-40e4-89e6-7820cbfe187b",
      "completedAt": "2026-11-16T23:22:33.817Z"
    },
    "second": {
      "id": "8d7baa8e-ed64-41ee-865b-69061194424b",
      "status": "disputed",
      "start": "2026-11-27T19:00:00.000Z",
      "end": "2026-11-27T20:00:00.000Z",
      "customerId": "14c9d8d5-870c-40e4-89e6-7820cbfe187b",
      "completedAt": "2026-11-16T23:21:15.260Z"
    }
  },
  {
    "crewMemberId": "d4667c4a-aa74-401b-8e27-3460dd5b3747",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "d21362f8-05cf-4b39-ad3c-a3b6daa59be0",
      "status": "completed",
      "start": "2026-11-27T19:00:00.000Z",
      "end": "2026-11-27T20:00:00.000Z",
      "customerId": "14c9d8d5-870c-40e4-89e6-7820cbfe187b",
      "completedAt": "2026-11-16T23:22:33.817Z"
    },
    "second": {
      "id": "93d34a02-ac51-49b2-8748-272ff6e2492c",
      "status": "completed",
      "start": "2026-11-27T19:00:00.000Z",
      "end": "2026-11-27T20:00:00.000Z",
      "customerId": "2dc6f717-a0f6-42cd-ac76-8fdbdfb1fa01",
      "completedAt": "2026-11-16T23:21:13.587Z"
    }
  },
  {
    "crewMemberId": "d4667c4a-aa74-401b-8e27-3460dd5b3747",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "8d7baa8e-ed64-41ee-865b-69061194424b",
      "status": "disputed",
      "start": "2026-11-27T19:00:00.000Z",
      "end": "2026-11-27T20:00:00.000Z",
      "customerId": "14c9d8d5-870c-40e4-89e6-7820cbfe187b",
      "completedAt": "2026-11-16T23:21:15.260Z"
    },
    "second": {
      "id": "93d34a02-ac51-49b2-8748-272ff6e2492c",
      "status": "completed",
      "start": "2026-11-27T19:00:00.000Z",
      "end": "2026-11-27T20:00:00.000Z",
      "customerId": "2dc6f717-a0f6-42cd-ac76-8fdbdfb1fa01",
      "completedAt": "2026-11-16T23:21:13.587Z"
    }
  },
  {
    "crewMemberId": "e6f20283-1531-4821-988a-0fe9e08316ff",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "d6a15d95-46a7-47b3-9567-ebe797ce7e04",
      "status": "completed",
      "start": "2026-11-18T15:00:00.000Z",
      "end": "2026-11-18T16:00:00.000Z",
      "customerId": "67df2bfa-702a-4f38-a94f-518e591bf014",
      "completedAt": "2026-11-16T23:22:21.850Z"
    },
    "second": {
      "id": "c6d65881-9371-4fad-8a38-0e31af431bd8",
      "status": "completed",
      "start": "2026-11-18T15:00:00.000Z",
      "end": "2026-11-18T16:00:00.000Z",
      "customerId": "67df2bfa-702a-4f38-a94f-518e591bf014",
      "completedAt": "2026-11-16T23:22:23.309Z"
    }
  },
  {
    "crewMemberId": "7630e888-1525-4415-9856-eb9af9c9fd79",
    "cause": "one visit was completed before its scheduled start, which freed the slot",
    "first": {
      "id": "78eb9443-eec3-4737-8e2a-f161bd5818da",
      "status": "completed",
      "start": "2026-11-24T18:00:00.000Z",
      "end": "2026-11-24T19:00:00.000Z",
      "customerId": "0ae41b8a-b879-43fa-bdb3-90405d78aece",
      "completedAt": "2026-11-16T23:23:23.947Z"
    },
    "second": {
      "id": "7321371a-df5c-4a28-bbab-4452edf284f0",
      "status": "completed",
      "start": "2026-11-24T18:00:00.000Z",
      "end": "2026-11-24T19:00:00.000Z",
      "customerId": "2eb4b6c7-3a45-4aa3-82b1-0862ba15da27",
      "completedAt": "2026-11-16T23:23:25.393Z"
    }
  }
]
```

### FAILED: live-location-access

325 of 325 checked: Live location is readable only by that booking's owner, provider and assigned crew, and only while on route

```json
[
  {
    "message": "owner after completion sees a live point for booking ea4b2184-175e-413a-80a3-3af9862e8b61",
    "bookingId": "ea4b2184-175e-413a-80a3-3af9862e8b61",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.95266,
      "longitude": -74.21189
    }
  },
  {
    "message": "owner after completion sees a live point for booking a64346c2-5706-4f0b-bf41-98d3b136e89f",
    "bookingId": "a64346c2-5706-4f0b-bf41-98d3b136e89f",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.83159,
      "longitude": -74.21685
    }
  },
  {
    "message": "owner after completion sees a live point for booking 6eac94e8-53e8-43e4-a52d-b2dc4cfce1c6",
    "bookingId": "6eac94e8-53e8-43e4-a52d-b2dc4cfce1c6",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.67781,
      "longitude": -74.2439
    }
  },
  {
    "message": "owner after completion sees a live point for booking bdbf1736-78f4-4404-8a32-a15daabda101",
    "bookingId": "bdbf1736-78f4-4404-8a32-a15daabda101",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.61371,
      "longitude": -74.31949
    }
  },
  {
    "message": "owner after completion sees a live point for booking 94759a8c-0a73-44e2-af61-00a4b8f84e39",
    "bookingId": "94759a8c-0a73-44e2-af61-00a4b8f84e39",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.59061,
      "longitude": -74.34732
    }
  },
  {
    "message": "owner after completion sees a live point for booking 16261ac0-ac5c-4faa-b2d5-f5c2635996dc",
    "bookingId": "16261ac0-ac5c-4faa-b2d5-f5c2635996dc",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.85051,
      "longitude": -74.21318
    }
  },
  {
    "message": "owner after completion sees a live point for booking 6d5cd1d7-5cba-4336-aabc-13272a389317",
    "bookingId": "6d5cd1d7-5cba-4336-aabc-13272a389317",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.61371,
      "longitude": -74.31949
    }
  },
  {
    "message": "owner after completion sees a live point for booking 65baef38-245a-4b15-a5de-3378d2b48539",
    "bookingId": "65baef38-245a-4b15-a5de-3378d2b48539",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.70282,
      "longitude": -74.24123
    }
  },
  {
    "message": "owner after completion sees a live point for booking f2c1d961-c569-4138-9ad4-f5611962631c",
    "bookingId": "f2c1d961-c569-4138-9ad4-f5611962631c",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.69008,
      "longitude": -74.23152
    }
  },
  {
    "message": "owner after completion sees a live point for booking 17daa25a-feea-4cb0-9dc2-1a7e2a76246a",
    "bookingId": "17daa25a-feea-4cb0-9dc2-1a7e2a76246a",
    "who": "owner after completion",
    "trackingStatus": "completed",
    "livePoint": {
      "latitude": 39.70707,
      "longitude": -74.26376
    }
  }
]
```

### FAILED: notification-once-per-party

2 of 1538 checked: Every state change produced exactly one notification per affected party (2 missing: cancel)

```json
[
  {
    "problem": "missing",
    "action": "cancel",
    "party": "provider",
    "recipientId": "21787cf3-b85c-42e1-a7dd-568d9853b616",
    "bookingId": "5bdcf172-6495-44ae-b113-c9da0aca33b2",
    "at": "2026-11-16T23:22:26.261Z"
  },
  {
    "problem": "missing",
    "action": "cancel",
    "party": "provider",
    "recipientId": "21787cf3-b85c-42e1-a7dd-568d9853b616",
    "bookingId": "dbdef092-aba1-4ca0-9663-158daae45a30",
    "at": "2026-11-16T23:22:27.664Z"
  }
]
```

## Observations (not in the plan's invariant list)

- **live-point-retained**: 269 finished or cancelled bookings still store a live GPS point in the database
- **completed-before-scheduled-start**: 325 visits were marked complete before their scheduled start

## Probe findings

- same-slot-race: Two owners booked the same provider slot at the same time and both succeeded (23 times)
- double-submit: Two submits with one request id created two bookings (27 times)
- accept-cancel-race: Provider accept and owner cancel both succeeded; the booking ended confirmed (40 times)
- live-location-access: owner after completion sees a live point for booking … (325 times)

## Non-2xx responses

| Response | Count | Expected | Sample message |
| --- | ---: | --- | --- |
| 500 POST /api/bookings/cancel (cancel (race)) | 4 | no | Unexpected server error |
| 409 POST /api/bookings (same-slot race) | 3 | no | This property is outside the provider's service area. |
| 409 POST /api/bookings/reschedule (reschedule) | 2 | no | That provider window overlaps another YardMatch job. Pick a different service window. |
| 500 POST /api/bookings/cancel (cancel) | 2 | no | Unexpected server error |
| 500 POST /api/bookings/decline (decline) | 1 | no | Unexpected server error |
| 500 POST /api/bookings/reschedule (reschedule) | 1 | no | Unexpected server error |
| 403 GET /api/bookings/tracking (tracking: stranger (owner) on route) | 325 | yes | Customers can only track their own bookings |
| 403 GET /api/bookings/tracking (tracking: stranger (crew) on route) | 325 | yes | Crew members can only track accepted assignments |
| 409 POST /api/providers/staffing/review (review crew) | 230 | yes | This crew member is no longer eligible for this assignment |
| 401 POST /api/auth/login (login: wrong password) | 5 | yes | Invalid email or password |
| 409 POST /api/auth/register (sign up: duplicate email) | 1 | yes | An account with that email already exists |
| 423 POST /api/auth/login (login: wrong password) | 1 | yes | Account temporarily locked after repeated failed sign-ins until 2026-11-16T23:50:25.432Z. |
| 404 GET /api/crew/opportunities (launch flag) | 1 | yes | Route not found |
| 404 GET /api/crew/opportunities/public (launch flag) | 1 | yes | Route not found |
| 404 GET /api/payouts/provider (launch flag) | 1 | yes | Route not found |
| 404 GET /api/payments (launch flag) | 1 | yes | Route not found |
| 400 POST /api/auth/password-reset/confirm (reset: wrong code) | 1 | yes | Invalid password reset code |
| 400 POST /api/auth/password-reset/confirm (reset: reused code) | 1 | yes | Password reset code has expired |
| 401 GET /api/auth/me (reset: old session) | 1 | yes | Session has been replaced |
| 401 POST /api/auth/login (reset: old password) | 1 | yes | Invalid email or password |
| 400 POST /api/auth/password-reset/confirm (reset: expired code) | 1 | yes | Password reset code has expired |

## Slowest routes (p95 ms)

| Route | Calls | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| POST /api/bookings/cancel | 70 | 272 | 2458 | 3513 |
| POST /api/bookings | 307 | 520 | 1725 | 1960 |
| POST /api/bookings/reschedule | 30 | 429 | 1689 | 2316 |
| POST /api/bookings/recurring-plans | 72 | 510 | 1630 | 1861 |
| POST /api/providers/search | 360 | 204 | 1148 | 1463 |
| POST /api/bookings/decline | 75 | 65 | 1123 | 2890 |
| POST /api/crew/matches/cancel | 58 | 457 | 836 | 945 |
| POST /api/bookings/confirm | 361 | 14 | 731 | 3516 |
| POST /api/providers/staffing/review | 787 | 156 | 679 | 1698 |
| GET /api/providers/staffing | 120 | 131 | 660 | 1552 |
| POST /api/bookings/dispute | 56 | 196 | 535 | 580 |
| POST /api/quotes/instant | 379 | 178 | 527 | 1575 |
| POST /api/auth/register | 163 | 384 | 409 | 425 |
| POST /api/auth/login | 8 | 226 | 390 | 390 |
| GET /api/crew/matches | 180 | 133 | 354 | 414 |
