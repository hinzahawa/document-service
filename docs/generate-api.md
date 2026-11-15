# PDF generation API

`POST /generate` accepts an `applicationId` and nested form data, fills `template/Application_DemoV3.html`, archives the request JSON, and returns the PDF as `application/pdf` with an inline content disposition. Use Postman with a raw JSON body and inspect the binary response as a PDF.

## Request

`applicationId` is required and must contain 1–100 ASCII letters, digits, underscores, or hyphens. It is also used in the archive path, so other characters are rejected.

The header, applicant details, policy, and beneficiary fields use named paths. The remaining controls are grouped by the printed form part and numbered in their order in the HTML. See [template-field-map.json](./template-field-map.json) for all 551 input controls, their request paths, control types, page numbers, and nearby Thai labels.

For a full request body containing every distinct field path and synthetic example data, see [generate-request.example.json](./generate-request.example.json). The named fields contain mock applicant, agent, policy, and beneficiary details; numbered form fields use `X` or `false` as visible placeholders. Replace all mock values before using the request for a real application. Repeated printed fields share one request path, and the 13 national ID boxes use one `nationalId` string.

```json
{
  "applicationId": "APP-2026-0001",
  "agent": {
    "fullName": "Example Agent",
    "licenseNumber": "LIC-1001",
    "code": "AG-1001",
    "unitName": "Bangkok Unit",
    "unitCode": "B001",
    "branch": "Bangkok"
  },
  "applicant": {
    "fullName": "Example Applicant",
    "gender": {
      "male": false,
      "female": true
    },
    "birthDate": {
      "day": "23",
      "month": "กรกฎาคม",
      "buddhistYear": "2535"
    },
    "identification": {
      "nationalId": "1234567890123"
    }
  },
  "policy": {
    "mainPlan": {
      "name": "Example Plan",
      "sumAssured": "100000",
      "premium": "9557"
    }
  },
  "beneficiaries": {
    "primary": {
      "fullName": "Example Beneficiary",
      "benefitPercent": "100"
    }
  },
  "sections": {
    "part1": {
      "field135": false,
      "field136": true
    },
    "part3": {
      "field001": false
    }
  }
}
```

Text controls accept strings or numbers. `applicant.identification.nationalId` must be a string; it is split across the 13 printed digit boxes. Checkbox and radio controls accept booleans; only `true` checks the control. A missing or `null` value renders blank or unchecked. String values are HTML-escaped. Arrays are not part of this form contract. Unknown field paths and values with the wrong type receive `400 Bad Request`.

## Response and errors

- `200 OK`: PDF bytes, `Content-Type: application/pdf`, `Content-Disposition: inline`.
- `400 Bad Request`: missing/invalid `applicationId`, an unknown field path, or a value with the wrong type.
- `500 Internal Server Error`: template, PDF rendering, or request archive could not be written. A PDF is returned only after its request JSON has been archived.

Validation or rendering failures are not archived. The service stores the request JSON only; it does not store the generated PDF.

## Local paths and archive naming

`@nestjs/config` reads `.env` from the project working directory. `.env.example` supplies defaults, and `.env` is ignored by Git. Set `TEMPLATE_ROOT` to the folder containing `Application_DemoV3.html` and `BACKUP_ROOT` to the local archive root. Relative paths resolve from the project working directory; absolute paths are also accepted.

The archive key is:

```text
<BACKUP_ROOT>/appForm/YYYYMMDD/{applicationId}-YYYYMMDD-HHMMSS/request.json
```

Both dates use `APP_TIMEZONE` (default `Asia/Bangkok`). If another request with the same application ID lands in the same second, the folder stays unchanged and the additional JSON is named `request-<uniqueId>.json`; an existing request is never overwritten. The archive is not served over HTTP. Retention and encryption policies are outside this first version.

## Run locally

Install the Chromium runtime once after installing npm dependencies:

```bash
npm run playwright:install
```

The template uses `Noto Sans Thai`, `Sarabun`, and `Tahoma` fallbacks. Make sure at least one Thai-capable font is available to Chromium on the machine running the service.
